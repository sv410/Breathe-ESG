import { Router, type IRouter } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { db, ingestionBatchesTable, emissionsRecordsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ────────────────────────────────────────────────────────────
// Emission factors (kg CO2e per unit) — sourced from IPCC AR6
// and UK DESNZ/DEFRA 2023 conversion factors
// ────────────────────────────────────────────────────────────
const FUEL_FACTORS: Record<string, { kgCo2ePerLitre: number; scope: "scope1" }> = {
  diesel:    { kgCo2ePerLitre: 2.688, scope: "scope1" },
  petrol:    { kgCo2ePerLitre: 2.315, scope: "scope1" },
  gasoline:  { kgCo2ePerLitre: 2.315, scope: "scope1" },
  lng:       { kgCo2ePerLitre: 1.164, scope: "scope1" },
  lpg:       { kgCo2ePerLitre: 1.555, scope: "scope1" },
  "natural gas": { kgCo2ePerLitre: 2.034, scope: "scope1" },
};

// UK grid: 0.207 kg CO2e / kWh (2023 DEFRA)
const ELECTRICITY_FACTOR_KG_PER_KWH = 0.207;

// Flight emission factors (kg CO2e per km per passenger, including RFI)
const FLIGHT_FACTORS: Record<string, number> = {
  short: 0.255,  // <1500 km
  medium: 0.195, // 1500-3500 km
  long: 0.150,   // >3500 km
};
const HOTEL_FACTOR_KG_PER_NIGHT = 31.0; // DEFRA 2023 business travel
const GROUND_FACTOR_KG_PER_KM = 0.14;  // avg taxi/rental

// Airport distance lookup (km, great-circle, most common pairs)
const AIRPORT_DISTANCES: Record<string, number> = {
  "LHR-JFK": 5540, "JFK-LHR": 5540,
  "LHR-CDG": 340,  "CDG-LHR": 340,
  "LHR-DXB": 5500, "DXB-LHR": 5500,
  "JFK-LAX": 3980, "LAX-JFK": 3980,
  "BOM-DEL": 1150, "DEL-BOM": 1150,
  "SIN-SYD": 6300, "SYD-SIN": 6300,
};

function getFlightDistance(origin: string, dest: string): number {
  const key = `${origin.toUpperCase()}-${dest.toUpperCase()}`;
  return AIRPORT_DISTANCES[key] ?? 2000; // default 2000 km if pair unknown
}

function getFlightFactor(distanceKm: number): number {
  if (distanceKm < 1500) return FLIGHT_FACTORS.short!;
  if (distanceKm < 3500) return FLIGHT_FACTORS.medium!;
  return FLIGHT_FACTORS.long!;
}

function toSuspicious(record: { normalizedCo2eKg: number; activityAmount: number }, threshold = 100000): { isSuspicious: boolean; suspiciousReason: string | undefined } {
  if (record.normalizedCo2eKg > threshold) {
    return { isSuspicious: true, suspiciousReason: `CO₂e value unusually high: ${record.normalizedCo2eKg.toFixed(0)} kg` };
  }
  if (record.activityAmount <= 0) {
    return { isSuspicious: true, suspiciousReason: "Activity amount is zero or negative" };
  }
  return { isSuspicious: false, suspiciousReason: undefined };
}

// ────────────────────────────────────────────────────────────
// SAP Ingest — flat-file tab-delimited IDoc-style export
// Expected columns (case-insensitive, tolerates German variants):
//   MENGE / Menge / quantity, MEINS / unit, MATNR / material,
//   WERKS / plant, BUDAT / posting_date, BUKRS / company_code,
//   optional: BKLAS / material_class
// Scope 1 (fuel combustion), category = fuel type
// ────────────────────────────────────────────────────────────
router.post("/ingest/sap", upload.single("file"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.body.clientId, 10);
  if (!clientId || isNaN(clientId)) {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(400).json({ error: "Client not found" });
    return;
  }

  const [batch] = await db.insert(ingestionBatchesTable).values({
    clientId,
    sourceType: "sap",
    filename: req.file.originalname,
    status: "processing",
  }).returning();

  let rowCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    const content = req.file.buffer.toString("utf-8");
    const rows: Record<string, string>[] = parse(content, {
      delimiter: ["\t", ";", ","],
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const normalize = (key: string) => key.toLowerCase().trim().replace(/\s+/g, "_");

    for (const rawRow of rows) {
      rowCount++;
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow)) row[normalize(k)] = String(v ?? "").trim();

      const quantityRaw = row["menge"] ?? row["quantity"] ?? row["qty"] ?? row["amount"] ?? "";
      const unit = (row["meins"] ?? row["unit"] ?? row["uom"] ?? "L").toLowerCase();
      const material = (row["matnr"] ?? row["material"] ?? row["material_description"] ?? "diesel").toLowerCase();
      const plant = row["werks"] ?? row["plant"] ?? "";
      const dateRaw = row["budat"] ?? row["posting_date"] ?? row["date"] ?? "";
      const companyCode = row["bukrs"] ?? row["company_code"] ?? "";

      const quantity = parseFloat(quantityRaw.replace(",", "."));
      if (isNaN(quantity)) {
        errorCount++;
        errors.push(`Row ${rowCount}: invalid quantity "${quantityRaw}"`);
        continue;
      }

      // Date parsing — SAP uses YYYYMMDD, YYYY-MM-DD, or DD.MM.YYYY
      let activityDate: string;
      try {
        if (/^\d{8}$/.test(dateRaw)) {
          activityDate = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
        } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateRaw)) {
          const [d, m, y] = dateRaw.split(".");
          activityDate = `${y}-${m}-${d}`;
        } else {
          const parsed = new Date(dateRaw);
          activityDate = isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
        }
      } catch {
        activityDate = new Date().toISOString().slice(0, 10);
      }

      // Determine fuel type and emission factor
      let fuelType = "diesel";
      for (const key of Object.keys(FUEL_FACTORS)) {
        if (material.includes(key)) { fuelType = key; break; }
      }
      const factor = FUEL_FACTORS[fuelType] ?? FUEL_FACTORS["diesel"]!;

      // Unit normalization to litres
      let litres = quantity;
      if (unit === "gal" || unit === "gallon") litres = quantity * 3.78541;
      else if (unit === "m3" || unit === "cbm") litres = quantity * 1000;
      else if (unit === "kg") litres = quantity; // approximate for gases

      const normalizedCo2eKg = litres * factor.kgCo2ePerLitre;
      const suspicious = toSuspicious({ normalizedCo2eKg, activityAmount: quantity });

      await db.insert(emissionsRecordsTable).values({
        batchId: batch.id,
        clientId,
        scope: factor.scope,
        category: fuelType,
        sourceType: "sap",
        rawData: rawRow as Record<string, unknown>,
        activityAmount: litres,
        activityUnit: "litres",
        normalizedCo2eKg,
        activityDate,
        location: plant || companyCode || null,
        description: `${material} combustion — plant ${plant} (${companyCode})`,
        ...suspicious,
      });
    }
  } catch (err) {
    logger.error({ err }, "SAP parse error");
    errorCount++;
    errors.push("Failed to parse file: " + String(err));
  }

  const [updated] = await db
    .update(ingestionBatchesTable)
    .set({
      status: errorCount === rowCount && rowCount > 0 ? "failed" : "completed",
      rowCount,
      errorCount,
      errorDetails: errors.length > 0 ? errors.slice(0, 10).join("\n") : null,
      completedAt: new Date(),
    })
    .where(eq(ingestionBatchesTable.id, batch.id))
    .returning();

  res.status(201).json(updated);
});

// ────────────────────────────────────────────────────────────
// Utility Ingest — portal CSV export from UK/US utility meters
// Expected columns: meter_id, period_start, period_end,
//   consumption_kwh (or consumption + unit), location/site
// Scope 2 (purchased electricity), category = electricity
// ────────────────────────────────────────────────────────────
router.post("/ingest/utility", upload.single("file"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.body.clientId, 10);
  if (!clientId || isNaN(clientId)) {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(400).json({ error: "Client not found" });
    return;
  }

  const [batch] = await db.insert(ingestionBatchesTable).values({
    clientId,
    sourceType: "utility",
    filename: req.file.originalname,
    status: "processing",
  }).returning();

  let rowCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    const content = req.file.buffer.toString("utf-8");
    const rows: Record<string, string>[] = parse(content, {
      delimiter: [",", ";", "\t"],
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const normalize = (key: string) => key.toLowerCase().trim().replace(/[\s-]+/g, "_");

    for (const rawRow of rows) {
      rowCount++;
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow)) row[normalize(k)] = String(v ?? "").trim();

      const kwhRaw = row["consumption_kwh"] ?? row["kwh"] ?? row["usage_kwh"] ?? row["consumption"] ?? "";
      const unit = (row["unit"] ?? row["uom"] ?? "kwh").toLowerCase().replace(/\s/g, "");
      const periodStart = row["period_start"] ?? row["start_date"] ?? row["billing_start"] ?? row["date"] ?? "";
      const meterId = row["meter_id"] ?? row["meter"] ?? row["account_number"] ?? "";
      const site = row["location"] ?? row["site"] ?? row["facility"] ?? row["address"] ?? "";

      let kwh = parseFloat(kwhRaw.replace(",", ""));
      if (isNaN(kwh)) {
        errorCount++;
        errors.push(`Row ${rowCount}: invalid consumption "${kwhRaw}"`);
        continue;
      }

      // Unit conversion: MWh → kWh
      if (unit === "mwh" || unit === "mw") kwh *= 1000;
      else if (unit === "gwh" || unit === "gw") kwh *= 1_000_000;

      let activityDate: string;
      try {
        const d = new Date(periodStart);
        activityDate = isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
      } catch {
        activityDate = new Date().toISOString().slice(0, 10);
      }

      const normalizedCo2eKg = kwh * ELECTRICITY_FACTOR_KG_PER_KWH;
      const suspicious = toSuspicious({ normalizedCo2eKg, activityAmount: kwh });

      await db.insert(emissionsRecordsTable).values({
        batchId: batch.id,
        clientId,
        scope: "scope2",
        category: "electricity",
        sourceType: "utility",
        rawData: rawRow as Record<string, unknown>,
        activityAmount: kwh,
        activityUnit: "kWh",
        normalizedCo2eKg,
        activityDate,
        location: site || meterId || null,
        description: `Electricity — meter ${meterId}${site ? ` at ${site}` : ""}`,
        ...suspicious,
      });
    }
  } catch (err) {
    logger.error({ err }, "Utility parse error");
    errorCount++;
    errors.push("Failed to parse file: " + String(err));
  }

  const [updated] = await db
    .update(ingestionBatchesTable)
    .set({
      status: errorCount === rowCount && rowCount > 0 ? "failed" : "completed",
      rowCount,
      errorCount,
      errorDetails: errors.length > 0 ? errors.slice(0, 10).join("\n") : null,
      completedAt: new Date(),
    })
    .where(eq(ingestionBatchesTable.id, batch.id))
    .returning();

  res.status(201).json(updated);
});

// ────────────────────────────────────────────────────────────
// Travel Ingest — Navan/Concur CSV export
// Expected columns: trip_type (flight/hotel/ground), origin,
//   destination, distance_km, nights, passengers, date,
//   traveler, department
// Scope 3 (business travel), categories: flight/hotel/ground_transport
// ────────────────────────────────────────────────────────────
router.post("/ingest/travel", upload.single("file"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.body.clientId, 10);
  if (!clientId || isNaN(clientId)) {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(400).json({ error: "Client not found" });
    return;
  }

  const [batch] = await db.insert(ingestionBatchesTable).values({
    clientId,
    sourceType: "travel",
    filename: req.file.originalname,
    status: "processing",
  }).returning();

  let rowCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    const content = req.file.buffer.toString("utf-8");
    const rows: Record<string, string>[] = parse(content, {
      delimiter: [",", ";", "\t"],
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const normalize = (key: string) => key.toLowerCase().trim().replace(/[\s-]+/g, "_");

    for (const rawRow of rows) {
      rowCount++;
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow)) row[normalize(k)] = String(v ?? "").trim();

      const tripType = (row["trip_type"] ?? row["type"] ?? row["category"] ?? "flight").toLowerCase();
      const dateRaw = row["date"] ?? row["departure_date"] ?? row["travel_date"] ?? row["check_in"] ?? "";
      const traveler = row["traveler"] ?? row["employee"] ?? row["name"] ?? "";
      const department = row["department"] ?? row["cost_center"] ?? row["team"] ?? "";

      let activityDate: string;
      try {
        const d = new Date(dateRaw);
        activityDate = isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
      } catch {
        activityDate = new Date().toISOString().slice(0, 10);
      }

      let normalizedCo2eKg = 0;
      let activityAmount = 0;
      let activityUnit = "";
      let category = "flight";
      let description = "";

      if (tripType.includes("flight") || tripType.includes("air")) {
        category = "flight";
        const origin = row["origin"] ?? row["departure"] ?? row["from"] ?? "";
        const dest = row["destination"] ?? row["arrival"] ?? row["to"] ?? "";
        const distanceRaw = row["distance_km"] ?? row["distance"] ?? row["km"] ?? "";
        const passengersRaw = row["passengers"] ?? row["pax"] ?? "1";
        const passengers = parseInt(passengersRaw, 10) || 1;

        let distanceKm = parseFloat(distanceRaw);
        if (isNaN(distanceKm) || distanceKm <= 0) {
          distanceKm = getFlightDistance(origin, dest);
        }

        const factor = getFlightFactor(distanceKm);
        normalizedCo2eKg = distanceKm * factor * passengers;
        activityAmount = distanceKm;
        activityUnit = "km";
        description = `Flight ${origin}→${dest} (${distanceKm} km, ${passengers} pax) — ${traveler}${department ? ` [${department}]` : ""}`;
      } else if (tripType.includes("hotel") || tripType.includes("accommodation") || tripType.includes("lodg")) {
        category = "hotel";
        const nightsRaw = row["nights"] ?? row["duration_nights"] ?? row["check_out"] ?? "1";
        const nights = parseFloat(nightsRaw) || 1;
        normalizedCo2eKg = nights * HOTEL_FACTOR_KG_PER_NIGHT;
        activityAmount = nights;
        activityUnit = "nights";
        const location = row["hotel"] ?? row["property"] ?? row["destination"] ?? row["city"] ?? "";
        description = `Hotel ${location} (${nights} nights) — ${traveler}${department ? ` [${department}]` : ""}`;
      } else {
        category = "ground_transport";
        const distanceRaw = row["distance_km"] ?? row["distance"] ?? row["km"] ?? "50";
        const distanceKm = parseFloat(distanceRaw) || 50;
        normalizedCo2eKg = distanceKm * GROUND_FACTOR_KG_PER_KM;
        activityAmount = distanceKm;
        activityUnit = "km";
        const from = row["origin"] ?? row["from"] ?? row["pickup"] ?? "";
        const to = row["destination"] ?? row["to"] ?? row["dropoff"] ?? "";
        description = `Ground transport ${from}→${to} (${distanceKm} km) — ${traveler}${department ? ` [${department}]` : ""}`;
      }

      const suspicious = toSuspicious({ normalizedCo2eKg, activityAmount });

      await db.insert(emissionsRecordsTable).values({
        batchId: batch.id,
        clientId,
        scope: "scope3",
        category,
        sourceType: "travel",
        rawData: rawRow as Record<string, unknown>,
        activityAmount,
        activityUnit,
        normalizedCo2eKg,
        activityDate,
        location: row["origin"] ?? row["city"] ?? null,
        description,
        ...suspicious,
      });
    }
  } catch (err) {
    logger.error({ err }, "Travel parse error");
    errorCount++;
    errors.push("Failed to parse file: " + String(err));
  }

  const [updated] = await db
    .update(ingestionBatchesTable)
    .set({
      status: errorCount === rowCount && rowCount > 0 ? "failed" : "completed",
      rowCount,
      errorCount,
      errorDetails: errors.length > 0 ? errors.slice(0, 10).join("\n") : null,
      completedAt: new Date(),
    })
    .where(eq(ingestionBatchesTable.id, batch.id))
    .returning();

  res.status(201).json(updated);
});

export default router;
