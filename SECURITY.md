# NEYO Security & Compliance (A.14)

## Implemented in code
- **Passwords:** Argon2id (`@node-rs/argon2`).
- **Sensitive fields:** AES-256-GCM envelope encryption, per-tenant DEK wrapped by master KEK (A.2.7). Used for M-Pesa/Daraja credentials.
- **Transport:** HTTPS enforced via HSTS in production; CSP, X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy (see `next.config.mjs`).
- **Audit log:** append-only. App never updates/deletes `AuditLog`. Production trigger in `prisma/rls/audit-immutable.sql` blocks UPDATE/DELETE at the DB.
- **Rate limiting:** per IP / user / key sliding-window limiter (`src/lib/security/rate-limit.ts`). Applied to OTP (A.1), magic links, and signups. Swap store to Redis for multi-instance.
- **Tenant isolation:** app-level `tenantDb()` + Postgres RLS policies (`prisma/rls/policies.sql`).
- **Logging:** pino with secret redaction; error capture seam (Sentry-ready).

## Compliance checklist (operational — founder actions)
- [ ] **ODPC registration** as a data processor (Office of the Data Protection Commissioner, Kenya). Required before going live.
- [ ] **DPO designation** — designate a Data Protection Officer; publish `dpo@neyo.co.ke`.
- [x] **Privacy Policy** published (`/privacy`, KE DPA 2019 aware).
- [x] **Terms of Service** published (`/terms`).
- [x] **Cookie consent** banner (essential cookies only).
- [ ] **Penetration test** — commission an external pen-test before/early in production; track findings here.

## Data breach notification process
1. **Detect & contain** — on suspicion, capture details (what data, scope, when) and contain the cause.
2. **Assess** — DPO assesses risk to data subjects.
3. **Notify ODPC** within **72 hours** of becoming aware (Data Protection Act, 2019).
4. **Notify affected schools** (controllers) without undue delay; they inform affected individuals as needed.
5. **Remediate & record** — fix, document in the audit trail, and review controls.

## Production hardening still to do at deploy
- Apply `prisma/rls/policies.sql`, `audit-immutable.sql`, `search.sql` on Postgres.
- Set HSTS preload domain; verify CSP against real asset hosts (R2 CDN).
- Move rate-limit store to Redis; enable Sentry/Better Stack/PostHog.
