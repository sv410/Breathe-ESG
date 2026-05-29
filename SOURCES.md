# Sources

For each of the three sources: what real-world format we researched, what we learned, what our sample data looks like and why, and what would break in a real deployment.

---

## Source 1: SAP Fuel & Procurement Data

### What we researched

SAP stores fuel and energy procurement in several modules depending on the client's configuration:
- **MM (Materials Management):** Purchase orders and goods receipts for materials like diesel, lubricants, gases. Relevant tables: EKPO (PO line items), MSEG (material document segment), MKPF (material document header).
- **FI (Financial Accounting):** Cost centre postings when fuel is expensed directly. Relevant tables: BSEG, FAGLFLEXA.
- **PM (Plant Maintenance):** Fuel consumed by plant equipment, sometimes linked to work orders.

The most common export mechanism for ESG teams is a flat file dump from transaction **MB51** (Material Document List) or **ME2M** (Purchase Orders by Material). These produce tab-delimited or semicolon-delimited text files with headers in the SAP system language — German headers (MENGE, MEINS) are standard in German-headquartered companies even for exports used in English.

SAP date fields use format YYYYMMDD internally (stored as numeric). Some extract tools reformat to DD.MM.YYYY (German locale convention). Quantity unit (MEINS) is the three-letter SAP unit of measure code: `L` (litres), `M3` (cubic metres), `GAL` (US gallons), `KG` (kilograms for solid fuels), `KWH` (electrical energy if SAP is used to track utility purchases).

Plant codes (WERKS) are 4-character alphanumeric codes that are meaningless without a plant master lookup — `DE01` might be "Frankfurt Plant A" or it might be "Düsseldorf Warehouse," depending on the client's configuration.

Material numbers (MATNR) are similarly opaque — up to 18 characters, often padded with leading zeros, and only meaningful with the material master (MARA/MAKT tables). We handle this by mapping common material description patterns (DIESEL, BENZIN, ERDGAS, FLUESSIGGAS) to fuel types.

### What our sample data looks like and why

```
WERKS	BUDAT	MATNR	MENGE	MEINS	BUKRS
DE01	20240115	DIESEL-B7	12500	L	1000
DE02	20240201	DIESEL-B7	8900	L	1000
DE01	20240115	ERDGAS	45000	M3	1000
UK03	20240301	DIESEL-B7	320000	L	2000
DE03	20240210	FLUESSIGGAS	3200	L	1000
```

Column choices reflect actual SAP FI export headers from a German SAP system. BUDAT is the "Buchungsdatum" (posting date) in YYYYMMDD format. MENGE is quantity, MEINS is the unit of measure. BUKRS is the company code (Buchungskreis) — a 4-digit code that identifies the legal entity, present in most financial extracts. WERKS is the plant.

The 320,000 litre diesel record for UK03 is deliberately suspicious (>100 tCO₂e) to demonstrate auto-flagging. It represents a plausible but unusual single-period fuel draw for a large plant — the kind of record an analyst needs to verify before it goes to auditors.

### What would break in a real deployment

1. **Material number mapping:** Our material-to-fuel-type lookup covers common German material names. A real client will have custom material numbers (e.g. "EXT-0000192847") that map to multiple fuel types or non-fuel materials. Without the client's MARA/MAKT extract, normalization is guesswork.

2. **Plant-to-region mapping:** Scope 2 electricity purchased via SAP needs the plant's country to select the right grid factor. Without a plant master lookup, we can't apply regional grid factors.

3. **Multiple units:** SAP allows any unit of measure. We handle L, M3, GAL. A real client might use MT (metric tonnes) for coal, KWH for directly metered equipment, or custom units.

4. **Company code consolidation:** Multi-national groups may have dozens of company codes (BUKRS). Inter-company eliminations (fuel purchased by one entity and used by another) need to be handled to avoid double-counting.

5. **Retroactive postings:** SAP allows postings to prior periods. An extract of BUDAT (posting date) ≠ BLDAT (document date). Using posting date can cause a Q1 extract to include December fuel that was posted in January.

---

## Source 2: Utility Electricity Data

### What we researched

UK commercial electricity billing typically works through one of three channels:
1. **Supplier portal CSV export:** National Grid, E.ON, SSE, EDF, Octopus Business, and most suppliers allow account holders to download consumption data as CSV from their online portals. This is the most accessible route for facilities managers.
2. **Half-hourly (HH) settlement data:** Sites with metered demand > 100 kW receive HH data (48 readings per day) in standardized UK HHDC formats (D0010, D0036). This is precise but verbose.
3. **Energy Procurement Platform APIs:** Aggregators like Stark, Utiligroup, and Amber provide consolidated API access to consumption across multiple suppliers. Requires a contract and API credentials.

Portal CSVs vary by supplier but typically contain: meter identifier (MPAN in UK), billing period start/end, consumption in kWh, tariff type, and total cost. Some suppliers include reactive energy (kVAr) which we ignore.

We researched National Grid and E.ON UK portal exports specifically. Both use ISO date formats (YYYY-MM-DD) and kWh as the primary unit.

### What our sample data looks like and why

```csv
meter_id,period_start,period_end,consumption_kwh,location,tariff
NGRID-DE01-A,2024-01-01,2024-01-31,148500,Frankfurt Plant A,HV_INDUSTRIAL
NGET-UK03-MAIN,2024-02-01,2024-02-29,201400,Manchester Site,LV_COMMERCIAL
TAURON-PL04-001,2024-03-01,2024-03-31,880000,Warsaw DC,B23
```

Meter IDs reflect real utility naming conventions: NGRID (National Grid), NGET (National Grid Electricity Transmission UK), TAURON (Polish utility). The Warsaw DC record with 880,000 kWh (182 tCO₂e) is deliberately suspicious — it represents a plausible data centre draw but warrants verification before audit lock-in.

Billing periods don't align to calendar months (a Feb period runs 1–29 in a leap year, or a billing cycle might run 15th to 14th). Our parser uses the `period_start` date as the `activity_date` on the record, with the full period available in `raw_data`.

### What would break in a real deployment

1. **UK grid emission factor varies by year and method:** 0.207 kg CO₂e/kWh is the DEFRA 2023 UK average. For sites in Germany (DE) or Poland (PL), the grid factor is different (Germany: ~0.364, Poland: ~0.681 in 2023). We apply UK factor to all records in this prototype. A real deployment needs country-level factor lookup per meter.

2. **Market-based vs location-based:** As noted in TRADEOFFS.md, sites on PPAs or REGOs have a different Scope 2 figure. Our model stores only location-based.

3. **MPAN vs meter ID:** UK electricity meters have 21-digit MPANs (Meter Point Administration Numbers). Portal exports sometimes use shortened meter IDs or account numbers. Without MPAN reconciliation, the same physical meter may appear under different IDs in different exports.

4. **Billing period misalignment:** If a site switches supplier mid-month, a single calendar month will have two billing records from different suppliers with overlapping or gapped periods. Our parser does not detect or handle this overlap.

5. **Transmission vs. distribution losses:** Some GHG reporting frameworks (e.g. SECR) require T&D losses to be added to the consumption figure before applying the emission factor. We apply the factor to reported consumption only.

---

## Source 3: Corporate Travel Data

### What we researched

Two major platforms dominate UK corporate travel: **SAP Concur** (enterprise, deeply integrated with SAP ERP) and **Navan** (formerly TripActions, growing UK market share). Both offer:
- In-app reporting with CSV export
- Direct API access (Concur: SAE API v4; Navan: REST API with webhook support)

We reviewed the Concur Trip Report export format and the Navan expense/travel export. Both contain trip-level records with: traveler name/employee ID, departure and arrival (city or airport code), trip date, mode of transport (flight/rail/hotel/car), distance or segment information, cost, and department/cost centre.

Key challenge: **Flights are recorded as city pairs, not distances.** Navan provides origin/destination IATA codes. Distance must be calculated or looked up. For the prototype, we expect `distance_km` in the CSV when provided; if absent, the record is still ingested with the airport codes stored in `raw_data`.

Emission factors differ significantly by category:
- **Flights:** Must account for class of travel, RFI, and distance band. DEFRA 2023 and ICAO both publish factors. We use DEFRA 2023 with RFI 1.9× uplift.
- **Hotels:** Average UK hotel = 31 kg CO₂e/night (DEFRA 2023). Hotel-specific factors from HCMI exist but require hotel-level data we don't have.
- **Ground transport:** Car hire/taxi = 0.170 kg CO₂e/km. Rail (UK) = 0.035 kg CO₂e/km (not implemented — no rail records in sample).

### What our sample data looks like and why

```csv
trip_type,origin,destination,distance_km,passengers,traveler,department,date
flight,LHR,JFK,5540,2,Sarah Chen,Executive,2024-01-08
flight,LHR,CDG,340,1,Marcus Weber,Finance,2024-01-14
hotel,,,3,,Sarah Chen,Executive,2024-01-22
ground,Frankfurt Airport,Frankfurt Plant A,18,1,Sarah Chen,Executive,2024-01-22
```

The LHR→JFK route (5,540 km) is long-haul at 0.150 kg CO₂e/km/pax × 2 pax = 1,664 kg CO₂e. LHR→CDG (340 km) is short-haul at 0.255 × 1 pax = 86.7 kg CO₂e. These distances match great-circle estimates from flight distance calculators.

The BOM→DEL record with 4 passengers is flagged for analyst review — the total (1,173 kg CO₂e) is within the suspicious threshold but the 4-passenger multiplier makes it worth verifying that the passenger count is correct (some exports record one row per traveler, others record one row per booking).

Hotel records use nights as the activity unit. Ground transport uses km. Both traveler and department are stored in `raw_data` for HR/cost-centre cross-referencing.

### What would break in a real deployment

1. **Class of travel:** Business class has a per-seat emission 2–4× higher than economy (different seat pitch = fewer seats per plane = more fuel per pax). DEFRA 2023 publishes class-specific factors. Concur records class; we don't use it.

2. **IATA code → distance lookup:** We rely on the CSV to include `distance_km`. Real Concur/Navan exports often don't. A production system needs an airport database (e.g. OpenFlights) and great-circle calculation.

3. **Hotel categories and geography:** 31 kg CO₂e/night is a UK average. A hotel in Warsaw (coal-heavy grid) is likely higher; a hotel in Norway (near-zero hydro grid) is much lower. HCMI certification exists for some chains but is voluntary and incomplete.

4. **Multi-segment trips:** A London → Dubai → Sydney trip may be recorded as two segments or one. If two segments, the connecting airport layover time affects whether it counts as one trip or two. Our parser treats each row as one segment.

5. **Rail travel:** UK/EU corporate travel frequently includes high-speed rail (Eurostar, ICE). These have very different emission factors from flights but are sometimes recorded in the same export under "ground transport." We don't distinguish rail from car in the current model.
