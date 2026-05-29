# Data Model

## Overview

The model is built around four core entities that track the full lifecycle of an emissions record — from raw ingest through normalization to audited lock-in.

---

## Entities

### `clients`

Represents a tenant. All other tables foreign-key to `clients.id`, so every query can be scoped to a single client without cross-contamination.

```
id          serial PK
name        text NOT NULL
slug        text UNIQUE NOT NULL
created_at  timestamptz DEFAULT now()
```

**Why `slug`?** Human-readable tenant identifiers make URL routing and API calls readable without exposing internal integer IDs to clients.

---

### `ingestion_batches`

One row per file upload. Captures what came in, from which source, and whether it processed cleanly — before any individual record is created.

```
id           serial PK
client_id    int FK → clients.id
source_type  enum('sap','utility','travel')
status       enum('processing','completed','failed')
filename     text
row_count    int
error_count  int
created_at   timestamptz DEFAULT now()
completed_at timestamptz
```

**Why a separate batch table?** It separates "did the file parse?" from "is each row valid?". A batch can complete with 100 rows but 3 parse errors — you need both signals. Auditors want to know which file produced which records.

**Source-of-truth tracking:** `batch_id` on every emissions record traces back to the exact file, upload timestamp, and row count. Nothing is orphaned.

---

### `emissions_records`

The normalized fact table. One row per emissions event, always in kg CO₂e regardless of source unit.

```
id                  serial PK
batch_id            int FK → ingestion_batches.id
client_id           int FK → clients.id  (denormalized for fast filtering)
scope               enum('scope1','scope2','scope3')
category            text                  -- e.g. 'diesel', 'electricity', 'flight'
source_type         enum('sap','utility','travel')
raw_data            jsonb                 -- original source fields, verbatim
activity_amount     numeric
activity_unit       text                  -- litres, kWh, km, nights …
normalized_co2e_kg  numeric NOT NULL      -- canonical output unit
emission_factor     numeric               -- factor applied at ingest time
activity_date       date
location            text
description         text
status              enum('pending','approved','rejected','flagged')
review_notes        text
reviewed_by         text
reviewed_at         timestamptz
is_suspicious       boolean DEFAULT false
suspicious_reason   text
created_at          timestamptz DEFAULT now()
```

**Scope assignment:** Done at ingest time, not at query time. SAP fuel → Scope 1, utility electricity → Scope 2, travel (all categories) → Scope 3. Stored on the record so auditors see what was decided when the row was created, not what the current logic would produce.

**`raw_data jsonb`:** The verbatim source fields are stored alongside the normalized values. If an analyst questions a figure, they can see the original MENGE/MEINS from SAP or the meter_id from the utility CSV. No data loss.

**`emission_factor` stored alongside `normalized_co2e_kg`:** This is deliberate. Emission factor tables change. Storing the factor applied at ingest time means the computation is auditable and reproducible. If DEFRA updates its 2023 factors, old records are unaffected and the delta is explainable.

**`client_id` denormalized:** You could join through `ingestion_batches` to get the client, but every record list query filters by client. Denormalizing here trades a small write cost for dramatically simpler, faster reads.

**Suspicious flagging:** Records are auto-flagged at ingest time when `normalized_co2e_kg > 100,000` (100 tCO₂e — plausible for a large facility but worth human eyes) or when `activity_amount <= 0` (zero or negative activity is always a data error). The reason is stored in `suspicious_reason` so analysts know what triggered the flag.

---

### `audit_logs`

Append-only log of every status change. Records are never silently mutated.

```
id           serial PK
record_id    int FK → emissions_records.id
action       text    -- 'approved', 'rejected', 'flagged', 'deleted'
actor        text    -- who performed the action
before_state jsonb   -- full record snapshot before change
after_state  jsonb   -- full record snapshot after change
created_at   timestamptz DEFAULT now()
```

**Why full snapshots?** A diff column (e.g. just `{status: "approved"}`) loses context if the record's other fields were also changed. Storing the full before/after state means the audit trail is self-contained — no joins needed to reconstruct what changed.

**Append-only:** Rows are never updated or deleted. `DELETE` on an emissions record still writes an audit log row first. Auditors can always trace back to the original ingested value.

---

## Multi-tenancy

Every table references `clients.id`. Every API route accepts an optional `clientId` query parameter that restricts all DB queries to that tenant. There is no row-level security at the DB layer (this is a prototype), but every application query is scoped by client.

---

## Scope 1 / 2 / 3 categorization

| Source type | Scope   | Rationale |
|-------------|---------|-----------|
| SAP (fuel/procurement) | Scope 1 | Direct combustion at owned/controlled facilities |
| Utility (purchased electricity) | Scope 2 | Indirect from energy purchase |
| Travel (flights, hotels, ground) | Scope 3 | Value chain — employee business travel |

Scope is written to the record at ingest time and is not re-derived. If the assignment changes (e.g. some SAP records turn out to be purchased energy), an analyst rejects and re-ingests — the original record and its scope assignment are preserved in audit.

---

## Unit normalization

All activity amounts are normalized to **kg CO₂e** at ingest time using emission factors from:

- **UK DEFRA 2023 GHG Conversion Factors** — diesel, petrol, LPG, natural gas, UK electricity grid
- **IPCC AR6 WG3** — supplementary factors for aviation (with RFI uplift), hotel stays

| Category | Factor | Unit | Source |
|----------|--------|------|--------|
| Diesel | 2.688 kg CO₂e/L | litres | DEFRA 2023 |
| Petrol | 2.316 kg CO₂e/L | litres | DEFRA 2023 |
| LPG | 1.555 kg CO₂e/L | litres | DEFRA 2023 |
| Natural gas | 2.034 kg CO₂e/m³ | m³ | DEFRA 2023 |
| UK electricity | 0.207 kg CO₂e/kWh | kWh | DEFRA 2023 |
| Short-haul flight (<1500 km) | 0.255 kg CO₂e/km/pax | km | IPCC AR6 + RFI |
| Medium-haul flight (1500–4000 km) | 0.195 kg CO₂e/km/pax | km | IPCC AR6 + RFI |
| Long-haul flight (>4000 km) | 0.150 kg CO₂e/km/pax | km | IPCC AR6 + RFI |
| Hotel night | 31 kg CO₂e/night | nights | DEFRA 2023 |
| Ground transport (car) | 0.170 kg CO₂e/km | km | DEFRA 2023 |
