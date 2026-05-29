---
name: Django migration decisions
description: Key facts about the Express→Django backend migration; model layout, URL conventions, auth setup, and schema gotchas.
---

## Django project location
`artifacts/api-server/` — Django project sits alongside the old Node files. The pnpm `package.json` shim has a `dev` script that runs Django directly via `python3 manage.py ...`.

## Model layout
All four domain models (`Client`, `IngestionBatch`, `EmissionsRecord`, `AuditLog`) use `managed = False` and `db_table` pointing to the existing Drizzle-created tables. Django only creates auth/session/admin tables via `migrate`.

## Schema gotcha — emissions_records columns
The actual `emissions_records` table (created by Drizzle) does NOT have an `emission_factor` column. It does have `updated_at`. The Django model must reflect this exactly or queries will fail with `ProgrammingError: column does not exist`.

## APPEND_SLASH = False (critical)
The generated React Query hooks use paths WITHOUT trailing slashes (e.g. `/api/clients`, `/api/records`). Django's default `APPEND_SLASH = True` redirects those to `/api/clients/`, which causes POST bodies to be dropped. Always set `APPEND_SLASH = False` in settings and register URL patterns without trailing slashes.

## Auth
- `djangorestframework-simplejwt` for JWT tokens
- Login: `POST /api/auth/login` → `{access, refresh, user}`
- Frontend: `setAuthTokenGetter(() => localStorage.getItem("breathe_access"))` in `main.tsx`
- Token lifetime: 7 days access / 30 days refresh (prototype-friendly)

## Default credentials
- username: `analyst`
- password: `breathe2024`
- Created by `python3 manage.py seed_users`

## Python installation
Python 3.11 installed via Replit module system (`installProgrammingLanguage({language: "python-3.11"})`). Django and dependencies installed via `installLanguagePackages`. The `dev` script skips `pip install` at runtime since packages are already system-wide.

**Why:** `pip install -r requirements.txt` in the dev script fails because pip isn't on PATH in the NixOS workflow shell; use the Replit module system to pre-install instead.
