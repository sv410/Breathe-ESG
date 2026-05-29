---
name: Date serialization
description: Drizzle ORM returns JS Date objects for date/timestamptz columns; Zod string schemas reject them with "received date" errors.
---

**Rule:** Before calling any Zod `.parse()` on a Drizzle query result, map all Date fields to ISO strings using `.toISOString()`.

**Why:** Drizzle's PostgreSQL driver returns native JS `Date` objects for `date` and `timestamptz` columns. The generated Zod schemas use `z.string()` for these fields (matching the OpenAPI spec). This causes a ZodError `"Expected string, received date"` at runtime, resulting in a 500 response.

**How to apply:** Write a `serializeRecord(r)` / `serializeBatch(b)` helper at the top of each route file. Apply it to every DB result before passing to Zod `.parse()`. Affected fields: `createdAt`, `completedAt`, `reviewedAt`, `activityDate` (use `.split("T")[0]` for date-only fields).
