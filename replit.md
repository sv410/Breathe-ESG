# Breathe ESG

A carbon emissions data ingestion and analyst review platform. Ingests fuel/procurement data from SAP flat files, electricity data from utility portal CSVs, and business travel data from Navan/Concur CSVs — normalizes everything to kg CO₂e, then surfaces a review dashboard where analysts approve, reject, or flag rows before they're locked for audit.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from env)
- `pnpm --filter @workspace/esg-dashboard run dev` — run the frontend (port from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (file uploads) + csv-parse
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui + React Query

## Where things live

- DB schema: `lib/db/src/schema/` — clients, ingestion_batches, emissions_records, audit_logs
- API spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- API routes: `artifacts/api-server/src/routes/`
  - `clients.ts` — tenant CRUD
  - `ingest.ts` — SAP / utility / travel file upload + parse + normalize
  - `batches.ts` — ingestion batch listing
  - `records.ts` — emissions record list, review (approve/reject/flag), audit log
  - `dashboard.ts` — summary stats, scope + source breakdowns
- Frontend pages: `artifacts/esg-dashboard/src/pages/`

## Architecture decisions

- **Single source ingest mode per source type**: SAP uses tab/semicolon-delimited flat file (IDoc-style), utility uses portal CSV (most common real-world export), travel uses Navan/Concur CSV. Each chosen for realistic prevalence over API pull (no live credentials needed).
- **Emission factors baked into the server**: IPCC AR6 + UK DEFRA 2023 factors applied at ingest time; stored alongside the normalized value so auditors can see what factor was applied.
- **Scope assignment at ingest time**: SAP fuel → Scope 1, utility electricity → Scope 2, travel (flight/hotel/ground) → Scope 3. Stored on the record; not re-derived.
- **Suspicion flagging at ingest time**: Records with CO₂e > 100,000 kg or zero/negative activity are auto-flagged `isSuspicious = true` for analyst attention.
- **Audit trail as append-only log**: Every approve/reject/flag writes an `audit_logs` row with before/after state. Records are never silently mutated.
- **Multi-tenancy via clientId foreign key**: All tables reference `clients.id`. Every query scopes by clientId when provided.

## Product

- Upload SAP fuel/procurement flat files, utility electricity CSVs, and Navan/Concur travel CSVs
- Per-source normalization to kg CO₂e using IPCC/DEFRA emission factors
- Analyst review dashboard: filter by scope, source, status, suspicion flag; approve/reject/flag individual rows with notes
- Audit trail per record showing every status change and who made it
- Dashboard summary: total tCO₂e, breakdown by scope and source, recent batch activity

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching the frontend or backend
- Dates from Drizzle come back as JavaScript `Date` objects — serialize with `.toISOString()` before passing to Zod response schemas
- File upload endpoints use multer multipart — `clientId` arrives in `req.body` (not JSON), `file` in `req.file`
- SAP date formats: YYYYMMDD (most common), DD.MM.YYYY (German locale), YYYY-MM-DD — all handled in `ingest.ts`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Emission factors reference: UK DEFRA 2023 GHG Conversion Factors, IPCC AR6 WG3
