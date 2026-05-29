# Decisions

Every significant ambiguity we resolved, what we chose, and why.

---

## SAP: Which export mechanism?

**Options considered:** IDoc (Electronic Data Interchange), OData service (REST-ish), BAPI (RFC), flat file dump.

**Chosen:** Flat file (tab/semicolon-delimited text export from FI/CO transactions like MB51 or FAGLL03).

**Why:** IDoc requires an active ALE/EDI channel configuration — not something a facilities or ESG team typically has standing access to. OData requires SAP Gateway to be enabled and usually IT involvement. BAPIs need an RFC connection. Flat file is what almost every sustainability consultant actually gets: the client's SAP admin runs a transaction, exports as `.txt` or `.csv`, and emails it over. It's unglamorous but it's reality.

**What we handle:** German column headers (MENGE, MEINS, MATNR, WERKS, BUDAT, BUKRS) as found in standard German SAP installations. Date formats YYYYMMDD (standard), DD.MM.YYYY (German locale), and ISO YYYY-MM-DD. Units L (litres), M3 (cubic metres), GAL (US gallons → converted to litres). Material codes mapped to fuel types via a lookup table.

**What we ignore:** IDoc IDOC segments, OData `$filter` queries, multi-currency conversion, goods receipt vs. goods issue distinction, plant hierarchy lookups.

**PM question we'd ask:** Do you have a plant-to-country lookup table? Without it, we're guessing at grid emission factors for electricity purchased via SAP.

---

## Utility: Which ingestion mode?

**Options considered:** PDF bill parsing (brittle, OCR-dependent), utility portal CSV export, direct API (rare — only a handful of utilities offer this, mostly in the US), manual entry.

**Chosen:** Portal CSV export.

**Why:** Most UK commercial facilities teams pull monthly consumption data from their utility's online portal (National Grid, E.ON, SSE, etc.) as a CSV. PDF parsing has unacceptable error rates on structured data — a single rotated page or font change breaks it. Direct APIs exist (EDF has one, some aggregators like Utiligroup/Stark do too) but require per-utility integration work and credentials we can't assume. Portal CSV is the common denominator: facilities managers already know how to do it.

**Column mapping we handle:** `meter_id`, `period_start`, `period_end`, `consumption_kwh` (also MWh and GWh with conversion). We also accept `location` and `tariff` as optional enrichment.

**Emission factor:** UK DEFRA 2023 grid intensity — 0.207 kg CO₂e/kWh for purchased electricity (Scope 2, location-based). We do not compute market-based Scope 2 (requires EAC/REGO certificate tracking — a future feature).

**What we ignore:** Reactive power (kVAr), demand charges, half-hourly settlement data (HH metering), PDF bills, water and gas utility exports (different schema, different factors).

**PM question we'd ask:** Are any sites on renewable PPAs or REGOs? If so, we need to handle market-based Scope 2 separately.

---

## Travel: Which platform and data shape?

**Options considered:** Concur SAE API (requires OAuth per tenant), Navan webhook export, TMC (Travel Management Company) consolidated CSV, credit card data.

**Chosen:** Navan/Concur CSV export (the report export that any user with reporting access can pull).

**Why:** The Concur SAE API requires IT to provision OAuth credentials per client tenant — too much friction for a prototype and even in production it requires per-client setup work. Navan offers webhook exports but again requires API access provisioning. The CSV export from either platform is what most corporate travel managers actually use for monthly reconciliation: it's a standard "expense report" or "trip report" export. Columns vary between platforms but the key fields (trip type, origin, destination, distance or city pair, traveler, department, dates) are consistent enough to normalize.

**Distance calculation:** When only IATA airport codes are provided (no distance_km), we apply a lookup for common routes. In a production system this would call the OpenFlights or Google Distance Matrix API. For the prototype, distance is expected in the CSV.

**Emission factors:** Distance-banded with Radiative Forcing Index (RFI 1.9× uplift) as recommended by DEFRA 2023:
- Short-haul < 1,500 km: 0.255 kg CO₂e/km/pax
- Medium-haul 1,500–4,000 km: 0.195 kg CO₂e/km/pax
- Long-haul > 4,000 km: 0.150 kg CO₂e/km/pax (non-linearly lower per km due to cruise efficiency)

Hotels: 31 kg CO₂e/night (DEFRA 2023 average, UK hotels). Ground transport (car): 0.170 kg CO₂e/km.

**What we ignore:** Class of travel (business class has 2–3× higher footprint per seat), seat load factor adjustments, hotel-specific emissions (some hotel chains report actuals via the Hotel Carbon Measurement Initiative).

**PM question we'd ask:** Do you want us to split by travel class? Business class emissions are materially different and some clients will insist on it.

---

## Scope assignment

**Decision:** Assign scope at ingest time, store on the record.

**Alternatives considered:** Derive scope at query time from source type + category.

**Why stored:** Scope classification can be contested (e.g. a company-owned vehicle fuelled by SAP purchase might be Scope 1 while a leased vehicle fuelled by SAP might be Scope 3). Storing it at ingest time with a `suspicious_reason` field if it's borderline gives analysts something concrete to review. Deriving at query time hides the classification decision and makes it impossible to audit.

---

## Emission factors: IPCC AR6 vs DEFRA 2023 vs EPA

**Decision:** UK DEFRA 2023 as primary source (since most of the seeded data is for UK/EU facilities), IPCC AR6 for aviation.

**Why:** The client (Meridian Industrial Group) has facilities in DE, UK, PL. DEFRA 2023 is the most commonly referenced source in UK corporate reporting and GHG Protocol submissions. EPA factors (US-centric) would be incorrect for UK grid electricity. IPCC AR6 aviation factors are more current than DEFRA's aviation annex.

---

## Suspicious threshold

**Decision:** Flag at > 100,000 kg CO₂e (100 tCO₂e) or activity_amount ≤ 0.

**Why 100 tCO₂e:** A typical UK manufacturing plant might emit 50–500 tCO₂e/month from fuel combustion. A single record claiming > 100 tCO₂e warrants a human look — it could be a full month of a large plant, which is plausible, or it could be a unit conversion error (e.g. gallons entered as litres). Zero or negative activity is always an error.

---

## Review workflow: analyst-only, no approval chains

**Decision:** Single analyst action (approve/reject/flag) with a notes field. No multi-step approval.

**Why:** The brief says "analysts approve rows before they're locked for audit." A two-tier approval (analyst + senior reviewer) would be more realistic for GHG inventory sign-off but is scope creep for a prototype. The audit trail makes it possible to add a second tier later without data migration.

---

## Multi-tenancy: application-layer scoping, not row-level security

**Decision:** All queries filter by `client_id` at the application layer. No PostgreSQL row-level security (RLS).

**Why:** RLS adds complexity (requires per-session role switching or security policies) that's disproportionate for a prototype with a single application user. The important thing is that the data model supports multi-tenancy — every table has `client_id`. RLS is the right next step before production.
