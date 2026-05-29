# Tradeoffs

Three things we deliberately did not build, and why.

---

## 1. Market-based Scope 2 accounting

**What it is:** GHG Protocol Corporate Standard allows two methods for Scope 2 (purchased electricity):
- **Location-based:** Grid average emission factor for the region (what we implemented — 0.207 kg CO₂e/kWh for the UK).
- **Market-based:** Factor associated with the specific energy contract, including REGOs, PPAs, and supplier emission factors. If a site buys 100% renewable electricity under a PPA, its market-based Scope 2 can be zero.

**Why we didn't build it:** Market-based accounting requires tracking Energy Attribute Certificates (EACs / REGOs in the UK, GOs in Europe) on a per-site, per-period basis, and matching them against consumption. This is a distinct data model — essentially a certificate ledger — that sits alongside the activity data. It also requires clients to actually have and share their EAC documentation. Most companies do location-based accounting first; many never do market-based at all. Adding it to a prototype before location-based is solid would be premature.

**What would break if we tried:** The `EmissionsRecord` model would need a `scope2_method` enum, a `market_factor_applied` field, and a link to a `certificates` table. The ingest pipeline would need a third pass over energy records to apply certificate allocations. Scope 2 totals on the dashboard would need to be computed twice and presented separately.

---

## 2. PDF bill parsing for utility data

**What it is:** Many facilities teams receive electricity bills as PDFs from their utility provider rather than (or in addition to) CSV portal exports. A PDF parser could extract meter reads, consumption figures, and billing periods directly from the PDF.

**Why we didn't build it:** PDF parsing is inherently brittle. Utility bill formats differ not just between providers but between billing periods for the same provider (rebrands, system migrations, tariff restructures). OCR-based parsing introduces error rates that are unacceptable for audit-quality data — a misread "8" as "B" in a consumption figure is a silent data quality problem that won't surface until an auditor spots an implausible number. The right solution is a supervised extraction approach (human-in-the-loop correction after OCR) which is a product in itself. Portal CSV is the pragmatic choice for a prototype because the structure is stable and machine-readable by design.

**What would be needed:** A document parsing pipeline (Textract, Azure Form Recognizer, or open-source Camelot/PDFPlumber), a per-utility template library, a confidence scoring system for extracted fields, and a correction UI for low-confidence extractions. That's a substantial product surface area.

---

## 3. Live API pull from SAP OData / Concur / utility APIs

**What it is:** Instead of file upload, the system would authenticate directly to SAP's OData service, the Concur SAE API, or a utility aggregator API (e.g. Stark, Utiligroup) and pull data on a schedule.

**Why we didn't build it:** Each of these requires per-client credential provisioning: SAP Gateway OAuth scopes (and IT involvement to enable the Gateway service), Concur OAuth app registration with the client's Concur tenant, utility API credentials that vary by provider and often don't exist for smaller utilities. This is onboarding overhead that makes sense in a production SaaS product but is disproportionate for a prototype where the goal is to demonstrate the normalization and review pipeline, not the credential management plumbing. File upload is also more resilient — it doesn't break when an upstream API changes its schema or rate limits.

**What would be needed:** A `credentials` table per client per source, a scheduler (cron or queue-based), per-source API clients with retry/backoff, webhook receivers for push-based sources (Navan supports webhooks), and a credential rotation mechanism. The ingest pipeline itself would be largely reusable — the API client would produce the same row structure that the file parsers currently produce.

---

## 4. User authentication and role-based access control

**What it is:** A full auth system with per-user accounts, role separation (analyst vs. senior reviewer vs. admin), multi-factor authentication, session management, and per-client data isolation enforced at the auth layer.

**What we built instead:** JWT-based authentication with Django's built-in `User` model (`djangorestframework-simplejwt`). A single `analyst` account is provisioned at startup. All protected API endpoints require a valid Bearer token. Tokens expire after 7 days.

**Why we deferred the full system:** The brief asks for an analyst review workflow, not an identity platform. Building SSO, RBAC, tenant-based access policies, MFA, password reset flows, and session revocation before the normalization pipeline and data model are solid would invert the priority order. In production, this would be the next major surface:
- Role separation: analyst (can review), senior analyst (can approve for audit), admin (can manage clients and re-ingest).
- Row-level security in PostgreSQL enforced by `client_id` claims in the JWT.
- Django Groups + Permissions for RBAC, or an external IdP (Auth0, Okta) for enterprise SSO.
- Audit log entries capturing the authenticated user's ID (not just username) with a foreign key to `auth_user`.

**PM question we'd ask:** Do different clients have different analyst teams, or is this a single internal team reviewing data for all clients? If the former, multi-tenant RBAC becomes critical before launch. If the latter, the current single-account model can be extended incrementally.
