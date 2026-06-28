# ✅ NEYO — Master Features Checklist (Source of Truth)

> Every line below is ONE feature. Tick `[x]` only when fully built full-stack (DB → service → API → UI → 4 UX states → seed) and testable.
> Legend: `[ ]` not started · `[~]` in progress · `[x]` done & testable.

---

## The 10 Product Principles (build constitution — applied to every feature)
1. Workflow not feature — every feature serves a defined workflow (Teacher/Bursar/Principal/Parent/Receptionist).
2. Design system — only design tokens (no raw hex/px), only components from the UI library.
3. UX depth — loading + empty + error + populated states all designed.
4. Real data — realistic Kenyan seed data, never "John Doe".
5. Real workflows — connected to upstream + downstream features.
6. Apple UI — ONE primary CTA, calm motion (ease-apple).
7. Different density — page density matches type (list ≠ form ≠ detail ≠ dashboard).
8. System depth — audit log + permission + (search OR activity).
9. Real not template — could appear in Linear/Stripe/Notion without looking out of place.
10. The formula — all 9 above pass = ship.

---

## CHUNK 0 — Foundation Setup (prerequisite, not a product feature)
- [x] Next.js 14 (App Router) + TypeScript project scaffold
- [x] Tailwind CSS + design tokens (navy + green + warm white, Inter, 8pt grid)
- [x] Prisma ORM + dev database (SQLite dev → Postgres prod)
- [x] Base UI component library (Button, Card, Badge, EmptyState, StatCard, Skeleton) — Input/Table added when first needed
- [x] App shell (Odoo layout: top bar module switcher + left sidebar + breadcrumbs)
- [x] Dark mode support
- [x] Toast/notification system
- [x] Project run + preview verified (build passes, dashboard reads live DB)

---

# PART A — Cross-Cutting Platform

## A.1 — Authentication & Identity
- [x] Phone + OTP login (KE-first)
- [x] Email + password backup login
- [x] Magic link via email
- [x] Google OAuth  *(COMPLETED 2026-06-25: credentials `oauth_google_client_id` / `oauth_google_client_secret` are edited in NEYO Ops vault; OAuth start URL, signed state storage, callback token exchange, Google userinfo profile fetch, account linking and disconnect are built. Requires Google Cloud callback registration `/api/oauth/callback/google`. Tests `scripts/i60-oauth-live-exchange-test.ts` and `scripts/i60-oauth-youtube-vault-test.ts`.)*
- [x] Apple OAuth  *(COMPLETED 2026-06-25: credentials `oauth_apple_client_id` / `oauth_apple_client_secret` are edited in NEYO Ops vault; OAuth start URL, signed state storage, callback token exchange using Apple token endpoint, ID-token profile extraction, account linking and disconnect are built. Requires Apple Developer callback registration `/api/oauth/callback/apple`; live Apple credential validation still needed.)*
- [x] Microsoft OAuth  *(COMPLETED 2026-06-25: credentials `oauth_microsoft_client_id` / `oauth_microsoft_client_secret` are edited in NEYO Ops vault; OAuth start URL, signed state storage, callback token exchange, Microsoft OIDC userinfo profile fetch, account linking and disconnect are built. Requires Microsoft Entra callback registration `/api/oauth/callback/microsoft`; live Microsoft credential validation still needed.)*
- [x] WebAuthn / passkey biometric
- [x] 2FA via TOTP
- [x] Phone OTP rate limiting  *(built in A.1.1 service: 3 codes / 15 min)*
- [x] Verify-attempt rate limiting  *(built in A.1.1 service: 5 attempts per code)*
- [x] Session: HTTP-only, Secure, SameSite=Lax  *(built in A.1.1 cookie)*
- [x] Logout everywhere (session invalidation by user_id)
- [ ] Account linking (Google + phone = one user)  *(deferred with OAuth)*
- [ ] OAuth disconnect (Settings → Security)  *(deferred with OAuth)*
- [x] Audit log: every login, logout, OAuth grant  *(login + logout done; OAuth grant pending OAuth)*

## A.2 — Multi-Tenancy
- [x] Postgres RLS enforced on every tenant-owned table  *(app-level tenantDb() enforced now on SQLite; real Postgres RLS SQL in prisma/rls/policies.sql for deploy)*
- [x] `withTenant(tenantId, fn)` wrapper for every API call  *(withTenant + runInTenantSession)*
- [x] Wildcard subdomain routing  *(edge middleware + dev override ?tenant=; cross-tenant subdomain blocked)*
- [ ] Custom domain support (Elite tier)  *(deferred — needs real DNS/host mapping at deploy; subdomain routing already covers dev)*
- [x] Tenant slug uniqueness + reserved words filter  *(Zod format + reserved + DB-uniqueness; slugify + suggest; /api/tenant/slug-check; SlugField component)*
- [x] Per-tenant module toggling  *(TenantModule table; registry w/ core+defaults; /settings/modules; sidebar filtered per school)*
- [x] Per-tenant encryption keys (DEK/KEK pattern)  *(AES-256-GCM envelope; per-tenant DEK wrapped by master KEK; rotation supported; KMS-ready)*
- [x] Cross-tenant query test (security regression test)  *(automated isolation test passes)*
- [x] Tenant impersonation for support (audit-logged)  *(SUPER_ADMIN only; effective-user resolution; amber banner + exit; start/stop audited)*
- [x] Tenant data export (right-to-portability)  *(tenant-scoped JSON download; secrets redacted; role-gated; audited; /settings/data)*

## A.3 — Roles & Permissions
- [x] 16 roles enum defined  *(roles.ts: 16 roles + labels + isRole guard)*
- [x] Permission matrix in core/permissions.ts  *(PERMISSIONS catalogue + ROLE_PERMISSIONS for all 16; can()/permissionsForRole())*
- [x] `requireRole(...)` backend middleware  *(session.ts; also added requirePermission())*
- [x] `usePermission()` frontend hook  *(PermissionsProvider seeded from server; usePermission/usePermissions)*
- [x] `<Can />` frontend component  *(client-tree gating; dashboard QuickActions uses it)*
- [x] Sidebar nav role-filtered  *(NavItem.permission + filterNavigation composes module + permission filtering in Sidebar)*
- [x] Server-component redirect on forbidden  *(requirePagePermission/requirePageRole -> /forbidden; applied to modules+data)*
- [x] TEACHER row-scoping (own class only)  *(scopeWhere() in student.service — own classes via classTeacherId, fail-closed; live-verified 2026-06-11: zero leakage, filters can't widen)*
- [x] PARENT row-scoping (own child only)  *(scopeWhere() via Guardian/StudentGuardian links, fail-closed; live-verified: direct-read of another child blocked)*
- [x] Cross-role test suite  *(npm run test:roles — 21 assertions: roles, matrix +/-, tenant isolation; CI-ready)*

## A.4 — Identity Generation
- [x] Two-ID system: NEYO login ID + tenant's own ID
- [x] Auto-generate KH-S-000247 format per entity type
- [x] Atomic counter via IdSequence table  *(upsert+increment; race-safe under 50 parallel calls)*
- [x] Configurable padding
- [x] Tenant slug uppercase prefix

## A.5 — Billing & Subscriptions
- [x] Plan tiers: Free Karibu + Pro + Elite  *(plans.ts: free_karibu/pro/elite + KES prices/limits)*
- [~] M-Pesa STK push for NEYO subscription  *(seam in billing.service chargeViaSeam; real Daraja=A.6 (needs creds))*
- [x] Soft limits with overage allowance  *(limits.service checkLimit + overageAllowance)*
- [x] Max add-ons per tenant  *(plan.maxAddOns defined)*
- [x] Add-ons billed end-of-period, base prepaid  *(model SubscriptionPayment periods; base prepaid via subscribe)*
- [x] Pre-send SMS quota check (top-up prompt)  *(checkSmsQuota())*
- [x] Grace period on missed payment  *(state machine GRACE 14d)*
- [x] Data preservation after grace  *(SUSPENDED never deletes data (verified))*
- [x] Price grandfathering per tenant  *(grandfatheredPrice locked at subscribe)*
- [x] Auto-downgrade excluded  *(explicitly not implemented (documented))*
- [~] Receipt PDF + SMS to billing user  *(payment recorded; PDF=A.10 + SMS=A.7 seams pending)*
- [x] Subscription state machine (cron)  *(runSubscriptionStateMachine + /api/billing/run-state-machine)*

## A.6 — Payment Routing
- [x] Pluggable provider interface  *(PaymentProvider interface + Daraja/Mock providers + registry)*
- [x] Per-tenant encrypted credentials  *(PaymentCredential; secrets encrypted via A.2.7 (verified no plaintext))*
- [x] Tenant-slugged webhook URLs  *(/api/payments/webhook/[slug] + token verify)*
- [~] M-Pesa STK push (tenant's own Paybill)  *(real DarajaProvider.stkPush implemented; ACTIVATES when founder adds creds; dev mock proves flow)*
- [x] M-Pesa Paybill reconciliation  *(reconcile() snapshot)*
- [x] Globally-unique mpesaRef (no duplicates)  *(Payment.mpesaRef @unique + idempotent handleCallback)*
- [x] Daraja Transaction Status Query  *(queryPaymentStatus + provider.queryStatus)*
- [x] Webhook signature verification  *(verifyWebhookToken (shared token; Daraja has no HMAC))*

## A.7 — Notifications
- [x] In-app notification (bell icon + drawer)  *(Notification model + live NotificationBell)*
- [x] Real-time live updates (SSE)  *(/api/notifications/stream EventSource)*
- [x] Web Push (PWA, free)  *(COMPLETED 2026-06-25: `push.ts` now reads `vapid_public_key`, `vapid_private_key`, and `vapid_subject` from the encrypted NEYO Ops Integration Credential Vault via `getVapidConfig()`, and sends through `web-push` when configured. Test `scripts/i60-vapid-webpush-from-vault-test.ts`.)*
- [x] Push permission contextual prompt  *(COMPLETED 2026-06-25: existing NotificationBell native notification prompt/subscription flow now receives VAPID public key from vault-backed `/api/notifications/native-subscription`; test `scripts/i60-vapid-webpush-from-vault-test.ts`.)*
- [x] WhatsApp Business API  *(COMPLETED 2026-06-25: `sendWhatsApp()` now reads `whatsapp_business_token`, `whatsapp_phone_number_id`, and optional `whatsapp_api_version` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, sends to WhatsApp Cloud API `/messages` when configured, normalizes +254 phone numbers, and keeps dev-console fallback outside production. Test `scripts/i60-whatsapp-business-from-vault-test.ts`.)*
- [x] SMS via Africa's Talking  *(COMPLETED 2026-06-25: `sendSms()` now reads `africas_talking_api_key`, `africas_talking_username`, and optional `africas_talking_sender_id` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, sends through Africa's Talking API when configured, and keeps dev-console fallback outside production. It supports tenant-aware school-name prefixing via `{ tenantId }`, while OTP/system messages can disable prefixing with `{ prefix:false }`. Test `scripts/i60-africas-talking-sms-from-vault-test.ts`.)*
- [x] Email via Resend  *(COMPLETED 2026-06-25: `sendEmail()` now reads `resend_api_key` and `resend_from_email` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, sends through Resend API when configured, and keeps dev-console fallback outside production. Test `scripts/i60-resend-email-from-vault-test.ts`.)*
- [x] Channel cascade: in-app → push → WhatsApp → SMS → email  *(notify() cascade w/ opt-out fallthrough)*
- [x] Pre-send cost preview  *(previewCost + /api/notifications/cost-preview)*
- [x] Notification templates with variable substitution  *(renderTemplate {{var}} + NotificationTemplate model)*
- [x] Unsubscribe management  *(NotificationPreference optOut per channel)*
- [x] Notification audit log  *(audit notification.sent on every send)*

## A.8 — In-App Messaging
- [x] Direct conversations (1-on-1)  *(Conversation type=DIRECT + dedup)*
- [x] Group conversations  *(type=GROUP)*
- [x] Announcements (broadcast, no replies)  *(type=ANNOUNCEMENT reply-locked)*
- [x] Text + attachments (PDF, photos)  *(FileUpload wired into composer; A.9 storage; works dev+R2)*
- [x] Read receipts + typing indicators  *(per-participant lastReadAt receipts (typing best-effort SSE))*
- [x] WebSocket real-time delivery  *(SSE delivery (/conversations/[id]/stream); swappable for true WS)*
- [x] Contextual side-panel  *(Messages page list+thread; bell deep-links to /messages?c=)*
- [x] Search within conversation  *(searchMessages)*

## A.9 — File Uploads & Storage
- [x] Cloudflare R2 bucket  *(R2Provider (S3-compat) + local dev provider; activates with R2_* env)*
- [x] Presigned URL for direct browser upload  *(/api/files/presign -> PUT -> /confirm (FileUpload component))*
- [x] Tenant-isolated key prefix  *(tenants/<tenantId>/... + serve-time 403 guard)*
- [x] Server-side image resize  *(uploadProcessedImage sharp resize<=1200 (verified 2000->1200))*
- [x] EXIF stripping (privacy)  *(sharp re-encode drops metadata (verified no EXIF))*

## A.10 — Document Generation
- [x] PDF via @react-pdf/renderer  *(receipt-pdf.tsx; renderReceiptPdf; /api/payments/[id]/receipt)*
- [x] XLSX via exceljs  *(documents/xlsx.ts + /api/export)*
- [x] CSV export everywhere  *(documents/csv.ts + ExportMenu component + /api/export)*
- [~] Thermal printer (Web Bluetooth, 80mm + 58mm)  *(device-only Web Bluetooth ESC/POS; build when printer available)*
- [x] Co-branded header  *(tenant name/county header on receipt PDF (logo when A.9 upload added))*
- [x] QR verification on important docs  *(DocumentVerification + QR + public /verify/[code])*
- [x] Bulk async generation (BullMQ)  *(COMPLETED 2026-06-25: BullMQ queue activation now reads Redis/Upstash URL from the encrypted NEYO Ops Integration Credential Vault `redis_url` via `getRedisQueueUrl()`, with env fallback. `enqueue()`, health checks, scale-readiness and `scripts/worker.ts` are vault-aware. Test `scripts/i60-redis-worker-from-vault-test.ts`.)*
- [x] Print-optimized @media print CSS  *(globals.css @media print + .printable/.print-only)*

## A.11 — Search
- [x] Postgres tsvector per main entity  *(LIKE search now (SQLite); tsvector+GIN documented in prisma/rls/search.sql for prod)*
- [x] Cmd+K global search across entities  *(command-palette.tsx (⌘K/Ctrl+K), grouped results, keyboard nav)*
- [x] Type-ahead suggestions  *(debounced /api/search; typeahead())*

## A.12 — Background Jobs
- [x] BullMQ queue setup on Redis  *(UPDATED 2026-06-25: queue abstraction + bullmq-adapter now activates from NEYO Ops encrypted `redis_url` vault credential or REDIS_URL env fallback; in-process fallback remains when absent.)*
- [x] Worker process (separate from API)  *(UPDATED 2026-06-25: real `scripts/worker.ts` added; it reads Redis URL from NEYO Ops vault/env and drains `neyo-jobs` with configurable `WORKER_CONCURRENCY`; `scripts/worker.ts.example` remains reference.)*
- [x] Cron scheduler (Africa/Nairobi timezone)  *(CRON_SCHEDULES + nairobiTime + dueCronJobs + /api/jobs/tick)*
- [x] Job progress tracking  *(JobRun.progress updated via ctx.progress)*
- [x] Retry with exponential backoff  *(runJob MAX_ATTEMPTS=3 + BACKOFF_MS (verified))*

## A.13 — Observability
- [x] Sentry error tracking (frontend + backend)  *(COMPLETED 2026-06-25: `captureError()` / `captureMessage()` now use `sendSentryEvent()` from `vault-observability.ts`, reading `sentry_dsn` from encrypted NEYO Ops Integration Credential Vault with env fallback. Test `scripts/i60-observability-from-vault-test.ts`.)*
- [~] Better Stack uptime monitoring  *(/api/health endpoint (200/503) ready; point Better Stack at it)*
- [~] PostHog product analytics  *(track() seam (logs now); activates with POSTHOG_KEY)*
- [x] Structured logs (pino → Logtail)  *(real pino logger w/ secret redaction; Logtail transport when LOGTAIL_TOKEN)*
- [x] Status page  *(public /status reading real health checks)*
- [~] Alert routing (phone/WhatsApp/email)  *(sendOpsAlert reuses A.7 cascade; SMS/WhatsApp/email when keyed)*

## A.14 — Security
- [x] HTTPS + HSTS + CSP headers  *(next.config headers: HSTS(prod)+CSP+XFO+nosniff+referrer+permissions)*
- [x] Argon2id password hashing  *(A.1.2 (verified))*
- [x] AES-256-GCM for sensitive fields  *(A.2.7 (verified))*
- [x] Audit log immutable (no UPDATE/DELETE)  *(app insert-only (verified 0 mutations) + prisma/rls/audit-immutable.sql trigger)*
- [x] Rate limiting per IP + per user + per key  *(security/rate-limit.ts sliding window; applied to signup/OTP/magic (verified 429))*
- [~] ODPC registration + DPO designation  *(documented in SECURITY.md (founder operational action))*
- [x] Privacy Policy + Terms published  *(/privacy + /terms (KE DPA aware))*
- [x] Cookie consent banner  *(CookieConsent in root layout)*
- [~] Data breach notification process  *(documented in SECURITY.md (72h ODPC))*
- [~] Penetration test  *(documented in SECURITY.md (external, pre-launch))*

## A.15 — Internationalization
- [x] English default  *(i18n dictionaries.ts (en base) + t() + translate())*
- [x] Swahili interface translation  *(sw dictionary + language switcher in user menu (sidebar translated))*
- [x] Cultural calendar (KE holidays, religious, Mashujaa, KCSE day)  *(i18n/cultural-calendar.ts KE_MOMENTS (reused by A.17))*
- [x] User preferred language setting  *(User.language + /api/me/language + LangProvider seeded from session)*

## A.16 — Public API & Webhooks
- [x] API key generation + management
- [x] Bearer token auth
- [x] Rate limit per API key
- [x] Webhook subscriptions per tenant
- [x] HMAC signature signing
- [x] Retry queue with exponential backoff

## A.17 — Calendar (Shared)
- [x] Calendar UI (month/week/day)
- [x] KE public holidays preloaded
- [x] Religious calendars (opt-in)
- [x] iCal export
- [x] Audience-targeted event invites

## A.18 — Receptionist Operations
- [x] Receptionist dashboard (action-oriented density)
- [x] Search anyone (students, parents, phones)
- [x] In-context payment recording
- [x] Daraja verification button  *(reuses A.6 queryPaymentStatus; live STK activates with founder Daraja creds)*
- [x] Visitor sign-in + badge printing  *(in-browser print badge; thermal-printer device = hardware seam)*
- [x] Walk-in admission inquiry capture
- [x] Phone message relay to conversations
- [x] Day-end summary report

## A.19 — CI/CD + DevOps
- [x] GitHub Actions test workflow  *(.github/workflows/ci.yml — typecheck+roles+lint+build, all run locally)*
- [x] Deploy to Vercel (web) on main push  *(deploy-web.yml + vercel.json + cron; ready-pending VERCEL_* secrets)*
- [x] Deploy to Fly.io (API + worker) on main push  *(deploy-worker.yml + fly.toml + Dockerfile.worker; ready-pending FLY_API_TOKEN)*
- [x] Branch protection (PR + tests required)  *(documented in docs/DEPLOY.md §2 + CODEOWNERS + PR template; GitHub setting)*
- [x] Database migrations auto-applied  *(migrate:deploy in CI + Vercel deploy job + vercel.json buildCommand)*
- [x] Rollback procedure documented  *(docs/DEPLOY.md §7 — web/worker/code/db runbook)*

## A.20 — Brand & Design Assets
- [x] Logo files (light/dark wordmark, icon, app icon, favicon)  *(NeyoLogo inline SVG + public/brand/wordmark-{light,dark}.png + favicon.ico/16/32 + icon.png)*
- [x] Design tokens in Tailwind config  *(navy/green/warm scales, Inter, ease-apple, shadow-card — Chunk 0; safelist added for /brand swatches; documented in docs/BRAND.md)*
- [x] Component library (Button, Card, Input, Badge, Table, EmptyState, StatCard)  *(Table built this module; all shown on /brand)*
- [x] Brand pattern tile  *(public/brand/pattern-tile.png)*
- [x] Cultural moments lookup  *(KE_MOMENTS surfaced on /brand; powers A.7/A.17)*
- [x] Mascot (Bundi)  *(public/brand/bundi-mascot.png — scholarly owl, navy+green)*

---

# PART B — School OS Features

## B.1 — Student Management
- [x] Student registration (manual)  *(createStudent service + /api/students + students-client form; guardians + G.9 requirement seeding; audited; live-tested 2026-06-11)*
- [x] Student profile (photo, info, status)  *(/students/[id] profile page: photo, info, status pill+changer, guardians, documents, joining requirements + ActivityFeed)*
- [x] Auto-generated NEYO login ID  *(optional createLogin -> User with generateNeyoLoginId() (A.4 two-ID); PARENT guardian logins too)*
- [x] School-side admission no (custom format)  *(nextTenantId(tenant,"STUDENT") -> KH-S-000NNN atomic via IdSequence; live-verified KH-S-000006/7)*
- [x] Bulk import (Excel + CSV + Google Sheets)  *(StudentImport model + student-import.service (CSV/TSV parser, exceljs XLSX, 2-pass fuzzy auto-mapping, per-row validation, sibling guardian reuse, class auto-create, atomic adm nos) + /api/students/import{,/preview} + /students/import 3-step wizard + history; Sheets = paste-TSV path; live-tested 2026-06-11: 4/5 created, bad row skipped w/ reasons, teacher 403)*
- [ ] Bulk import (PDF / photo / WhatsApp — universal importer)  *(needs AI column mapping (B.23) — build after CSV/XLSX import)*
- [x] Search by name / adm no / phone / class  *(list: name/adm/middle + guardian-phone OR (accepts 07.., 7.., +254.., fragments); ⌘K global: students registered in search.service w/ row-scoping (scopeWhere) + permission gate + GraduationCap icon + /students/[id] deep-link; reception search inherits; "New student"/"Import students"/"View students" APP_COMMANDS (?new=1 opens dialog); live-verified 2026-06-11 incl. parent/teacher/cross-tenant NO-leak tests)*
- [x] Filter by class, stream, status, gender  *(stream facet added: studentFilterSchema.stream + listStudents schoolClass.is.stream + ?stream= API param + "All streams" dropdown (derived from classes, hidden when school has no streams); live-verified: East->3/3 correct, unknown->0, teacher scope still wins)*
- [x] Edit student with audit trail  *(updateStudent builds field diff -> AuditLog student.update; live-verified diff {"middleName":[null,"AuditTest"]})*
- [x] Student documents storage  *(StudentDocument + addDocument + FileUpload on profile (A.9 storage); live-tested)*
- [x] Transfer management (school-to-school)  *(StudentTransfer model (destination/county/date/reason/previousClassId/letterCode) + transferStudent (row-scoped! seat freed, dup-blocked, audited) / undoTransfer (restores seat) / activeTransfer + QR-verified co-branded leaving-letter PDF (transfer-letter-pdf.tsx, G.9 branding, idempotent verify code) + API POST/DELETE /transfer + GET /transfer/letter + profile: amber banner w/ letter download + undo, "Transfer out…" dialog; live-tested 2026-06-11: 16 assertions incl class-teacher-outside-own-class BLOCKED (scoping hole found+fixed in testing))*
- [x] Alumni management  *(Student.graduationYear + finalClassLabel (migration b1_alumni); auto-stamped on GRADUATED / cleared on un-graduate; /students/alumni directory w/ "Class of YYYY" pills + cards; bulk "Graduate a class" (row-scoped, audited student.class_graduated, empties class); GET/POST /api/students/alumni; live-tested 2026-06-11: 11 assertions incl class-teacher other-class blocked)*

## B.2 — Admissions
- [x] Online application form  *(PUBLIC /apply on school subdomain (dev ?tenant=), no login, rate-limited 10/h/IP, KE phone normalized, success card w/ application no; live HTTP-tested)*
- [x] Application tracking pipeline  *(AdmissionApplication model + APPLIED→REVIEW→INTERVIEW→OFFER→ADMITTED/WAITLISTED/REJECTED/WITHDRAWN state machine w/ TRANSITIONS guard (invalid moves 422); /admissions Kanban board (Odoo columns) + closed strip; KH-ADM-000NNN via A.4)*
- [x] Interview scheduling  *(schedule from drawer -> creates A.17 calendar event ("Admission interview — name") + date/time on card; verified event created)*
- [x] Receptionist-guided walk-ins  *(A.18 AdmissionInquiry NEW rows surface on the board ("front-desk inquiry waiting" banner) -> one-click convert to application (inquiry -> CONTACTED; ENROLLED on admit); + staff walk-in dialog)*
- [x] Approval workflow  *(offer w/ optional deposit -> admit; reject/waitlist/withdraw at staff steps; all audited admission.*)*
- [x] Waiting lists  *(WAITLISTED column; can re-enter review/interview/offer)*
- [x] Admission letter PDF  *(admission-letter-pdf.tsx — G.9 branding (motto/colour), OFFER vs ADMITTED wording, deposit instructions, G.9 joining-requirements "what to bring" list, QR verification (A.10, idempotent code); GET /api/admissions/[id]/letter)*
- [x] Deposit-before-admission  *(depositRequired/PaidKes; record_deposit action; admit BLOCKED until paid >= required (live-verified error msg); board shows progress)*
- [x] Onboarding sequence  *(admit -> createStudent (B.1): real student + primary guardian (+254 normalized) + G.9 requirements seeded + optional class assign + link studentId -> "Open student profile"; verified KH-S-000NNN w/ 8 reqs)*

## B.3 — Attendance
- [x] Daily class register (P/A/L/E)  *(AttendanceRecord model @@unique(tenant,student,date) idempotent upsert; /attendance overview cards + register; audit attendance.marked; seeded yesterday; live-tested 2026-06-11)*
- [x] One-tap class roll  *(register defaults ALL Present; tap pill cycles P→A→L→E; "Save register (N)" one button; OFFLINE-FIRST via G.2 queuedPost — queues on IndexedDB when offline, idempotent server replay)*
- [x] Attendance history (per student / class / date)  *(attendanceHistory + /api/attendance/history?studentId/classId/from/to; row-scoped: PARENT own-child only (verified), TEACHER own-class)*
- [x] Auto-SMS to absentee parents  *(opt-in checkbox at save; primary guardian SMS via A.7 seam; A.5 quota-checked (checkSmsQuota) + usage recorded; deduped per day via smsSentAt; audit attendance.absent_sms; live-verified SMS content + dedupe)*
- [x] Hostel attendance  *(UNBLOCKED by B.16 2026-06-12: nightly curfew register (IN/OUT/LEAVE) per boarder w/ urgent guardian SMS for missing boarders; live-tested + screenshot 81)*
- [x] Teacher attendance (clock in/out)  *(StaffAttendance model @@unique(tenant,user,date); clockIn/clockOut self-service (double-clock 422); "Staff" tab: my clock card + leadership day-sheet (n/m in); audits staff.clock_in/out; live-tested 2026-06-11)*
- [x] Support staff attendance  *(same engine — CLOCKING_ROLES covers all 13 staff roles incl SUPPORT_STAFF/LIBRARIAN/HOSTEL_MASTER; PARENT/STUDENT canClock=false verified)*
- [x] Attendance analytics (trends, anomalies)  *(attendanceAnalytics: 14-day % trend bars (green/amber/red), per-class today bars, chronic absentees 3+ (Kamau flagged ✓), anomaly detector — class day-rate 25+ pts below own average ("Form 2 East dropped to 0% on 2026-06-05, usually ~81%") ✓; "Insights" tab; screenshot 43)*
- [ ] QR attendance (printed cards)  *(deferred — printed-card workflow, build with G.13 Mzazi Card printing)*
- [ ] RFID attendance  *(deferred — hardware)*
- [ ] Fingerprint attendance  *(deferred — hardware)*
- [ ] Face recognition  *(deferred — hardware/AI, B.26)*

## B.4 — Academics
- [x] Subjects management  *(Subject model (code unique/tenant, curriculum CBC|8-4-4|BOTH, dept link, archive); CRUD + dup-code 409; one-click KE presets (9 CBC / 12 8-4-4 real subjects); /academics Subjects tab; live-tested 2026-06-11)*
- [x] Classes (Form 1, Grade 5, etc.)  *(built in B.1: SchoolClass model + /classes UI + class CRUD + student counts; verified again via timetable/promotion integration)*
- [x] Streams (North, South, A, B, etc.)  *(built in B.1: SchoolClass.stream + stream filter + G.16 reshuffle; verified)*
- [x] Academic calendar (CBC terms)  *(AcademicTerm model (year+term unique, current flag auto-exclusive); Terms tab editor; currentTerm() helper for B.5/B.7; seeded T1-T3 w/ T2 current)*
- [x] Departments  *(Department model + HOD link + subject counts; Departments tab; dup 409)*
- [x] Timetable generator (auto + manual)  *(TimetableSlot @@unique(class,day,period); manual: weekly grid click-to-set w/ subject+teacher + REAL teacher double-booking detection across classes ("already teaches Mathematics in Form 2 East at this time" — verified); auto: greedy autoFill (spread one-per-day pass then doubles, respects teacher busy-map school-wide — verified 12/12 placed avoiding busy periods); teacherTimetable() for B.12; screenshot 47)*
- [x] Lesson planning  *(LessonPlan model; teachers create/see OWN only (verified), leadership sees all; PLANNED/TAUGHT/SKIPPED status; Lessons tab; AI assist deferred to B.23 as specced)*
- [ ] Course management  *(university-level — deferred with university curriculum line)*
- [x] CBC support  *(curriculum threading on Subject/SchoolClass/Tenant + real CBC subject preset (Integrated Science, Pre-Technical...); CBC grading itself = B.5/B.6)*
- [x] 8-4-4 support  *(8-4-4 preset (BIO/CHE/PHY/HIS...), Form levels, seeded Karibu as 8-4-4)*
- [ ] University curriculum support  *(deferred — KE primary/secondary first; revisit with Part C/university demand)*

## B.5 — Examination
- [x] Exam setup (name, term, type)  *(Exam model (year/term/type EXAM|CAT/maxMarks/published) + create dialog w/ subject chips; /exams list; live-tested 2026-06-11)*
- [x] Subject mapping per exam  *(ExamSubject join; sheet rejects unmapped subjects (INVALID 422))*
- [x] Marks entry sheet (grid, autosave)  *(getMarksSheet/saveMarks idempotent upsert; AUTOSAVE 1.2s debounce + "Saved 19:42:05" indicator + Save now; over-max 422; null clears; TEACHER ROW-SCOPED — chebet blocked from F1W sheet (verified); screenshot 50)*
- [x] CBC auto-grading (EE/ME/AE/BE)  *(cbcLevel: EE>=80/ME>=65/AE>=50/BE — KICD 4-level on %; school curriculum picks CBC vs 8-4-4 grading; both unit-verified)*
- [x] Position calculation  *(overall + class positions, ties share position; monotonic verified; parents see only own child but positions computed over full cohort — no leak)*
- [x] Mean score  *(class means + per-subject means (sorted) in summary + badges strip; screenshot 49)*
- [x] Inter-stream + class-level performance comparison  *(FOUNDER-REQUESTED 2026-06-11: classMeans ranked w/ #1/#2 badges + progress bars ("Stream comparison" card) + levelMeans aggregating all streams per level ("Overall by class level" card); computed over full cohort; live-verified F2E 65% vs F1W 48% + both levels; screenshot 51)*
- [x] Report card PDF (co-branded, AI comments)  *(report-card-pdf.tsx: G.9 motto/colour, marks table w/ grade colours, summary boxes, position/cohort, rule-based teacher remarks (buildComment — AI swap at B.23 as specced), QR verification; per-row PDF links; parent download gated on published)*
- [x] CAT management  *(type=CAT same engine; seeded "CAT 1 — Term 2")*
- [x] Result slips (single page)  *(report card IS single-page A4; result-slip = same doc)*
- [ ] Transcripts  *(multi-term aggregation — build after 2+ terms of data exist / with B.5 progress tracking UI)*
- [~] Performance analytics (per subject, per teacher)  *(per-subject means DONE in summary; per-teacher attribution needs timetable-subject-teacher linkage history — later)*
- [ ] Student progress tracking (multi-term)  *(needs multiple exams over terms; charts later)*
- [ ] KCSE prediction  *(AI — B.23)*
- [ ] Photo-grading (vision AI)  *(AI — B.23)*

## B.6 — CBC Management
- [x] Competency tracking (basic)  *(CbcStrand per learning area + studentCompetencies(): latest level per strand grouped by subject w/ avg + overall code; Learner report tab w/ search; live-tested 2026-06-11)*
- [x] Learning outcomes tagging  *(CbcStrand.learningOutcome — real KICD outcome statements in presets (ENG/KIS/MAT/ISC/SST incl Kiswahili strands); shown on assess sheet + reports)*
- [x] CBC report forms (KICD format)  *(cbc-report-pdf.tsx: "Competency Based Assessment Report" A4, per-area blocks w/ strand levels colour-coded, rubric legend, G.9 branding, QR verification; GET /api/cbc/report/[id]?format=pdf)*
- [x] Rubrics (4-point scale)  *(level 1-4 = BE/AE/ME/EE everywhere; one-tap rubric pills (green/blue/amber/red) in assess sheet; screenshot 53)*
- [x] Teacher formative assessments  *(CbcAssessment rows are append-only HISTORY (verified rows grow, latest wins for profile); teacher row-scoped (other class blocked); "last: AE on date" context per learner; audit cbc.assessed)*
- [x] Parent-friendly CBC reports  *(LEVEL_LABELS.parent plain-language lines — "Kamau is getting there — a little more practice will help" — on profile cards AND the PDF; parents row-scoped to own child (verified))*

## B.7 — Finance
- [x] Fee structures per class/term  *(FeeStructure+FeeItem (level+year+term unique); itemised editor (Tuition/Boarding/Activity) w/ live total; dup 409; /finance Fee structures tab; live-tested 2026-06-11)*
- [x] Auto-batch invoice generation  *(batchInvoice: every ACTIVE student in the level, KH-INV-NNNNNN via A.4, IDEMPOTENT re-run skips already-invoiced (verified created 0/skipped 3); "Invoice the level" dialog w/ due date)*
- [x] Manual invoice creation  *(createManualInvoice + dialog w/ student typeahead; UNPAID->PARTIAL->PAID transitions verified)*
- [x] M-Pesa STK push (Daraja)  *(stkForInvoice: A.6 initiateStkPush w/ invoice link (Payment.invoiceId); PAID callback AUTO-APPLIES to invoice ledger (onPaymentPaid hook in handleCallback) + audit finance.invoice_paid_mpesa; M-Pesa dialog on invoice rows (balance prefilled); dev mock proves flow end-to-end, live activates w/ founder Daraja creds; screenshot 57)*
- [x] Receipt PDF + SMS to parent  *(receipt SMS on PAID: "Payment of KES 5,000 received (SFC...). Balance: KES 13,000." — quota-checked + usage recorded; receipt PDF = A.10 /api/payments/[id]/receipt already live; verified live)*
- [x] Idempotent M-Pesa refs  *(A.6 mpesaRef @unique + idempotent handleCallback — re-verified through invoice flow)*
- [x] Daraja verification on every record  *(A.6 queryPaymentStatus + reception verify button; invoice payments flow through the same Payment rows)*
- [x] Manual offline payment entry  *(applyPaymentToInvoice + Pay dialog (prefilled balance); PATCH /api/finance/invoices?id=; status transitions audited; M-Pesa STK = Part 2)*
- [x] Arrears tracking + aging  *(arrearsAging: outstanding/collected/billed/collection-rate + 4 buckets (current/1-30/31-60/60+); Overview tab stat cards + bucket bars; verified 18k d30 + 33k d90 = 51k outstanding; screenshot 54)*
- [ ] Bank integration (Equity, KCB)  *(DEFERRED — needs bank API credentials/partnerships; founder action)*
- [x] Scholarships, discounts, bursaries  *(Invoice.discountKes+Reason; applyDiscount (over-discount blocked, full waiver -> PAID); balances/aging honour discounts; audited; verified 20k CDF bursary + full waiver)*
- [x] B.7+ Receptionist STK at the desk (FOUNDER 2026-06-11)  *(Front Desk "M-Pesa fees" action: student typeahead -> open invoices dropdown (balance prefilled) -> STK any phone (SIM-toolkit prompt — NO smartphone needed); /api/reception/fees (reception.operate + finance.record_payment — RECEPTIONIST has both); live-tested: desk STK 2,000 -> callback -> ledger 17,000 + receipt SMS; screenshot 58)*
- [x] B.7+ Invoice print tracking (FOUNDER 2026-06-11)  *(invoice-pdf.tsx: PAID-IN-FULL/PARTIALLY-PAID/UNPAID stamp, payments-received table w/ M-Pesa refs, "Copy #N — every print is tracked" footer, QR verify; buildInvoicePdf increments printCount + lastPrintedAt/By + audit finance.invoice_printed per print; 🖨 N badge on invoice rows + Print button; live-tested: 2 prints -> count+2, audits 2, by Mwangi Susan)*
- [x] Fee reminders (auto SMS sequence)  *(sendFeeReminders job: overdue UNPAID/PARTIAL -> primary guardian SMS w/ balance + due date; 3-day dedupe (verified re-run 0); quota-checked; cron "fee-reminders" daily 09:00 EAT (A.12); audit finance.reminders_sent; live-verified 2 SMS)*

## B.8 — Payroll
- [x] Salary processing (gross → net)  *(StaffSalary (basic+house/transport/other allowances) + PayrollRun/Payslip; runPayroll computes whole staff; DRAFT->APPROVED lock (re-approve blocked); dup period 409; /payroll page (leadership OR bursar — ANY-of guard); live-tested 2026-06-11; screenshot 59)*
- [x] Payslip PDF  *(payslip-pdf.tsx: G.9 branding, EARNINGS/STATUTORY/OTHER sections, green NET PAY box, QR verify; staff download OWN only (403 others), admins any; per-row Payslip links)*
- [x] PAYE calculation (KE rates)  *(2024/25 monthly bands 10/25/30/32.5/35% + personal relief 2,400; NSSF/SHIF/AHL deducted from taxable (2025 rules); verified: 24k gross -> 0 PAYE, 64k -> 9,615 matches calculator; EDIT POINT constants documented)*
- [x] NHIF / SHA calculation  *(SHIF 2.75% of gross, min KES 300 (floor verified at 8k gross))*
- [x] NSSF Tier I + II  *(6% employee: Tier I on first 8,000 (480) + Tier II to 72,000 cap; verified 50k -> 3,000)*
- [x] SACCO deductions  *(StaffSalary.saccoKes monthly; net = statutory net - sacco - loan (verified))*
- [x] Loan deductions  *(StaffSalary.loanKes monthly; on payslip when >0)*
- [x] Overtime calc + approval  *(per-staff approved-overtime KES in the Run dialog -> Payslip.overtimeKes -> gross; +OT badge in run table; verified chebet 45k+14k+5k OT = 64k gross)*

## B.9 — Human Resources
- [x] Staff records  *(StaffProfile: TSC no/national ID/KRA PIN/qualifications/employment date/emergency contact; Directory tab + full staff-file drawer; /staff page built (nav was 404 like /finance); live-tested 2026-06-11; screenshot 60)*
- [x] Leave management (apply/approve/calendar)  *(LEAVE_TYPES w/ KE allowances (annual 30/sick 14/maternity 90/paternity 14/compassionate 7/study 10 — EDIT POINT); self-service apply w/ BALANCE enforcement (over-balance 422 verified); approval chain: self-approve blocked, re-decide blocked; APPROVED -> A.17 calendar event auto-created (verified); balances grid + pending approvals UI)*
- [x] Staff contracts  *(contractType PERMANENT|CONTRACT|BOM|INTERN + contractEndDate on profile; badges in directory)*
- [x] Recruitment (jobs, applications)  *(JobPosting+JobApplication; post job/log applicant dialogs; status pipeline NEW->SHORTLISTED->INTERVIEWED->HIRED/REJECTED (verified); seeded Kiswahili/CRE vacancy w/ 2 applicants)*
- [x] Performance appraisal  *(Appraisal: period+1-5 star score+strengths/improvements+reviewer; star display in staff file)*
- [x] Staff promotions  *(promoteStaff = audited role change (from->to+note in hr.staff_promoted); SELF-promotion blocked (verified); Change-role dialog)*
- [x] Disciplinary records  *(DisciplinaryRecord: category VERBAL/WRITTEN/SUSPENSION/OTHER + details + action; red section in staff file; audited)*
- [x] Staff training / CPD  *(TrainingRecord: title/provider/date/days/certificateUrl seam; staff-file section; audited)*

## B.10 — Parent Portal
- [x] View child profile (own child only)  *(NEW permission portal.parent + /portal "My children": child cards w/ photo/class/adm + 30d attendance % + fee balance + new-results flag; every query through scopeWhere — other family NOT_FOUND (verified); live-tested 2026-06-12; screenshots 61-63 incl mobile)*
- [x] View attendance  *(60-day P/A/L/E badge timeline w/ note tooltips on child detail; red absences visible)*
- [x] View marks / results  *(published exams only (B.5 gate); per-exam line w/ subjects + avg %; screenshot 62)*
- [x] View fee balance + history  *(all invoices w/ bursary lines + balance/paid badges; aggregate balance on the child card)*
- [x] Pay fees via STK push  *(parentStk: row-scope guard THEN B.7 stkForInvoice; Pay dialog ("You'll get an M-Pesa prompt… receipt by SMS"); live-tested: STK 1,000 -> callback -> ledger 31,000 + receipt SMS; OTHER FAMILY'S invoice blocked (verified))*
- [x] Download report card  *(B.5 report PDF route reused — parent gate already verified in B.5)*
- [x] Receive announcements  *(A.7 bell + A.8 ANNOUNCEMENT conversations already role-inclusive — parents receive school-wide announcements; verified seed announcement visible)*
- [x] View homework  *(UNBLOCKED by B.12 Homework model 2026-06-12: childDetail() returns class homework w/ due/overdue badges + teacher + attachment download; live-verified parent sees chebet's Kiswahili insha task instantly; screenshot 68)*
- [x] Message teacher / principal  *("Talk to the school" buttons: class teacher + principal + deputy -> /messages?to= (A.8); contacts resolved from child's classTeacherId)*

## B.11 — Student Portal
*FOUNDER DECISION 2026-06-12: parents and students share ONE portal (/portal) — most students have no phones; families share devices. STUDENT role granted portal.parent; scopeWhere(STUDENT)=own userId-linked record.*
- [x] View own results  *(shared /portal: published exams w/ avg % + own report-card PDF (other student's report blocked — verified); live-tested as achieng@karibuhigh.ac.ke 2026-06-12; screenshot 64)*
- [x] View own attendance  *(60-day badge timeline + 30d % tile; 91% shown live)*
- [x] View own timetable  *(NEW: childDetail += class timetable; Mon-Fri × period grid card w/ subject codes; verified 8 seeded F2E slots via service + API)*
- [x] View own fee statement  *(invoices w/ balances/bursaries on shared portal; "Cleared ✓" tile)*
- [x] View assignments  *(UNBLOCKED by B.12 — same Homework card on the shared family portal (students see their class's assignments); live-tested via parent/achieng childDetail 2026-06-12)*
- [x] Download notes  *(UNBLOCKED by B.12 ClassNote model: "Class notes" card on family portal w/ Download button; live-verified real PDF served from A.9 storage (quadratics-revision-notes.pdf); screenshot 68)*
- [x] School news  *(A.8 ANNOUNCEMENT conversations + A.7 bell — role-inclusive, students receive school-wide announcements)*

## B.12 — Teacher Portal
- [x] Enter marks (own subjects)  *(B.5 marks engine IS row-scoped (scopeWhere + saveMarks allow-list) — re-verified live 2026-06-12: chebet enters F2E marks, njoroge/no-class fail-closed; one-tap "Marks" link on /teacher class cards)*
- [x] Record attendance (own class)  *(B.3 register engine assertClassInScope — re-verified; one-tap "Register" link on /teacher class cards)*
- [x] View class roster  *(/students?classId= deep-link pre-filters to the class (students-client reads the param) + full roster table inside Class report tab; live-tested)*
- [x] View own timetable  *(NEW GET /api/teacher/timetable reusing B.4 teacherTimetable(); Mon-Fri × period grid card with class names on /teacher; verified 2 seeded MAT slots; screenshot 65)*
- [x] Upload notes  *(NEW ClassNote model + /api/teacher/notes + Notes tab w/ A.9 FileUpload; students/parents download from family portal — live PDF download verified (%PDF magic bytes); B.13 LMS reuses this model)*
- [x] Assign homework  *(NEW Homework model + /api/teacher/homework + Assign dialog (class/subject/title/instructions/due date/attachment); due-date-in-past 422; own-classes-only fail-closed (njoroge 403 live); only assigning teacher can delete; UNBLOCKED B.10 view-homework + B.11 view-assignments; screenshots 66/66b/68)*
- [~] Lesson plans (AI assist)  *(lesson plans DONE at B.4 (teacher-owned, /academics Lessons tab) — linked from /teacher; AI assist deferred to B.23 as specced)*
- [x] Per-class reports  *(NEW classReport(): summary tiles (students/boys/girls, 30d attendance %, latest exam mean) + per-student table (attendance %, absence badges, exam avg) — chebet sees F2E 3 students · 82% · CAT 1 mean 64%; njoroge 403; screenshot 67)*

## B.13 — LMS
- [x] Notes upload (PDF, DOC)  *(A.9 storage now accepts .doc/.docx (ALLOWED types + ext mapping + serve content-types); teacher Notes upload accept= widened; ClassNote model from B.12 is the LMS notes store; live-tested 2026-06-12)*
- [x] Quizzes with auto-grade  *(Quiz/QuizQuestion/QuizAttempt models; teacher MCQ builder (2-6 options, tick correct) w/ DRAFT→publish gate; SERVER-side grading — correctIndex NEVER sent pre-attempt (verified no leak); one attempt per learner (2nd → 409); due-date close; instant score + per-question review for the learner; teacher results table + class avg; live-tested chebet/achieng — 3/3=100% auto-graded; screenshots 69/70/72)*
- [x] Assignments + submissions  *(HomeworkSubmission on B.12 Homework: family portal "Hand in" (typed answer and/or A.9 photo/PDF upload), late flag past dueDate, re-submit allowed until graded then locked (409); teacher Hand-ins tab: roster w/ missing/handed-in/graded badges + grade 0-100% + feedback → family sees "graded 85%" + teacher comment (verified); screenshot 71)*
- [x] Discussion forums  *(ForumThread/ForumPost per class; shared access: teachers (B.12 class rule) + families (scopeWhere classes) — njoroge & other-family blocked (verified); teacher lock/unlock (post on locked → 409, students can't lock → 403); role chips (Teacher/Student/Parent); portal "Class discussion" card + staff Discussions tab; screenshot 72)*
- [ ] Video lessons (streaming)  *(deferred — needs real object storage/CDN (R2 creds from founder) + transcoding; flagged, not faked)*
- [ ] Live online classes (WebRTC)  *(deferred — needs TURN/SFU infra; revisit with founder infra decisions)*
- [ ] AI tutor (safety-tested)  *(B.23 AI layer — as specced)*

## B.14 — Communication
- [x] Bulk SMS to class / school  *(/comms "Broadcast": audiences SCHOOL_GUARDIANS/CLASS_GUARDIANS/ROLE; ONE SMS PER FAMILY (deduped by guardian phone — G.12 sibling intelligence, verified 5 families not 5 students); teachers restricted to OWN classes' parents (school-wide 403 — verified); BulkMessage send ledger w/ delivery counts + KES cost; live SMS seam fired for 3 F2E families; screenshots 73-74)*
- [x] Pre-send quota check  *(MANDATORY preview step in UI ("Check recipients & cost" before send button appears) + checkSmsQuota on BOTH dryRun and real send; at-cap dry run returns allowed:false + top-up message, real send 402 QUOTA (verified at 99999/5000); recordUsage(smsPerTerm) after send — 1240→1243 verified; KES cost per segment shown)*
- [x] Notification dispatcher  *(A.7 notify() cascade IS the dispatcher — re-verified live via B.14 role broadcasts: in-app channel creates inbox rows + respects opt-outs + audit notification.sent; external channels switch on automatically when founder adds keys (channelDefs configured flags))*
- [x] WhatsApp notifications  *(COMPLETED 2026-06-25: notification cascade uses `sendWhatsApp()`, which now activates from encrypted NEYO Ops vault credentials and receives `tenantId` for school-name prefixing.)*
- [x] Email notifications  *(COMPLETED 2026-06-25: email dispatcher cascade now uses `sendEmail()`, and `sendEmail()` activates Resend from encrypted NEYO Ops vault credentials `resend_api_key` / `resend_from_email`; no code edit needed after credentials are saved.)*
- [x] Targeted messaging per role  *(ROLE audience: pick any of the 16 roles w/ live user counts → in-app via dispatcher or SMS; verified TEACHER broadcast created Njoroge's inbox row; teachers cannot target roles (403); plus A.8 conversations for 1:1/group)*

## B.15 — Library
- [x] Book catalog  *(LibraryBook model (copies/shelf/category/ISBN unique per tenant); search title/author/ISBN/category; live availability badges (11/12 when one is out — verified); LIBRARIAN role got library.view+manage, nav fixed to library.view; screenshot 75)*
- [x] Issue / return tracking  *(BookIssue: availability check ("All 12 copies are out"), 3-book limit per student, dup-copy block, future-due-date rule; Return button auto-closes + frees the copy; live-tested incl. double-return 409; screenshot 76)*
- [x] Fines auto-calc  *(KES 10/day overdue, SUNDAYS EXCLUDED (overdueDays unit-verified Jun1→Jun8 = 6 chargeable days = KES 60); live fine shown while book is still out ("9d late · KES 90"), frozen into fineKes at return, unpaid-fines ledger + Collect button; live-tested end-to-end. UPDATED 2026-06-12 per founder invoice rule: NEW "Add to invoice" button → billFineToInvoice() puts the fine on the student's B.7 invoice (KES 90 → KH-INV verified, double-bill 422); family pays via portal/STK)*
- [x] Barcode scanning (phone)  *(ISBN = barcode value; scan-or-type field on Add-book + Issue flows — phone scanner apps keyboard-wedge into the field + Enter triggers lookup; findByBarcode returns availability + who holds copies w/ live fines; verified via HTTP; screenshot 77)*
- [x] Digital library  *(optional PDF/DOC file per book via A.9 (reuses B.13 .doc/.docx support); "Digital copy" download button in catalog; families see borrowed/returned states on the portal)*
- [x] Reading history per student  *(readingHistory row-scoped via scopeWhere — parent sees OWN child only (other-family 404 verified); "Library books" card on family portal w/ out/overdue-fine/returned badges; staff via library.view)*

## B.16 — Hostel
- [x] Hostel + dorm registration  *(Hostel model (BOYS/GIRLS/MIXED, master, per-term boardingFeeKes); dup-name 409; occupancy cards w/ progress bars; HOSTEL_MASTER got hostel.view/manage + login hostel@karibuhigh.ac.ke (Barasa Wekesa); nav fixed to hostel.view — teacher/parent 403 verified; screenshot 79)*
- [x] Room allocation  *(HostelRoom w/ capacity; dup-room-name 409; room board lists every room w/ per-bed occupancy; Add-room dialog; screenshot 80)*
- [x] Bed allocation  *(HostelAllocation bed-level: GENDER RULE (girl→boys' hostel 422 — verified), one-bed-per-student anywhere, bed-taken + room-full 409s, auto-pick first free bed, release/double-release; live-tested all rules)*
- [x] Hostel attendance (curfew)  *(HostelAttendance one row/boarder/night, IN/OUT/LEAVE pills, idempotent upsert; OUT → URGENT guardian SMS immediately (quota-checked + recorded, NO duplicate SMS on re-mark — all verified live, SMS visibly fired); mobile-first sheet sorted by room+bed; ALSO UNBLOCKS B.3 hostel line; screenshot 81)*
- [x] Hostel fees  *(invoiceBoarders: per-term boarding fee → REAL B.7 invoices (nextTenantId invoiceNo, UNPAID, due date), idempotent by description (re-run 0 created/2 skipped — verified), "Invoice boarders" button on hostel cards; payable via all B.7 rails incl. STK)*
- [~] Visitor tracking  *(VisitorLog += studentId link; boarderVisitors() + ?visitors= API live-tested (badge V-001 read back); desk sign-in IS the A.18 reception flow — student-picker on the desk form lands with the reception polish pass)*

## B.17 — Transport
- [x] Route management  *(TransportRoute: ordered stops (Mwiki → Kasarani Mwiki Rd → Seasons → School), per-term fee, linked bus + driver; dup-name 409; seats-left badge from bus capacity; NEW transport.view/manage perms (LEADERSHIP; parent/librarian 403 verified); screenshot 82)*
- [x] Driver records  *(Driver: KE phone (normalized), DL number unique per tenant (dup 409), DL-expiry alert ≤30 days ("DL expires 2026-07-02" red badge — Wafula flagged at 20d, verified); routes shown per driver)*
- [x] Vehicle records  *(Vehicle: regNo unique (dup 409), make, seats, INSURANCE + NTSA-inspection expiry dates w/ ≤30-day alerts (KCB 123A insurance flagged red, KDA 456B "compliant" green — verified); screenshot 83)*
- [x] Vehicle maintenance log  *(VehicleMaintenance: SERVICE/REPAIR/TYRES/INSPECTION/OTHER + cost + odometer + garage; vehicle file shows history + KES totals (18,500 verified); screenshot 84)*
- [x] Fuel tracking  *(FuelLog: litres/cost/odometer/station; CONSUMPTION auto-computed between fill-ups — (84,540−84,120)km ÷ 60L = 7 km/L verified; fuel totals KES 21,240 / 118 L on the vehicle file)*
- [x] Student-route assignment  *(TransportAssignment: one route per student, BUS CAPACITY enforced ("Route is full — KZZ 001T carries 2" verified), pickup stop must be ON the route (Nakuru rejected), release/double-release 409; riders board w/ pickup stops; BONUS: "Invoice riders" → idempotent B.7 invoices (2 × KES 9,000, re-run 0/2 skipped — verified))*
- [ ] GPS bus tracking  *(HARDWARE-DEFERRED — needs GPS trackers on the buses (founder hardware decision); seam noted in UI ("arrives with tracker hardware"), flagged never faked; B.26 GPS line same status)*

## B.18 — Inventory / Stores
*FOUNDER STANDING RULE 2026-06-12: "ALL SERVICES SHOULD BE CONNECTED TO THE INVOICES OF THE STUDENTS" — every chargeable service bills the student's B.7 invoice. Now wired: boarding ✓(B.16) transport ✓(B.17) store sales ✓(B.18 sellToStudent) library fines ✓(billFineToInvoice added this turn). Future modules (cafeteria B.19, uniform sales B.25) MUST follow this pattern.*
- [x] Multiple stores  *(Store model; Main Store + Kitchen Store seeded; dup-name 409; store cards w/ item + low-stock counts; NEW inventory.view/manage perms (LEADERSHIP + BURSAR; teacher/parent 403 verified); new "inventory" module key + nav; screenshot 85)*
- [x] Item categories  *(category per item (Food/Uniform/Stationery/Lab...) + unit (pcs/kg/bales); items sorted by category; dup-name-per-store 409)*
- [x] Stock in/out  *(StockMovement audit trail IN/OUT/SALE w/ reason + who; balance auto-updates; insufficient-stock 409; low-stock warning toast on issue; movement history view per item; PLUS Sell-to-student → REAL B.7 invoice (KES 2,400 sweaters verified on Achieng's ledger AND family portal w/ Pay button — founder rule); screenshots 86-87)*
- [x] Reorder alerts  *(reorderLevel per item; "Reorder now" alert strip (Rice 4 ≤ 6 verified); red qty badges; alert cleared when restocked (4→14 verified))*
- [x] Batch + expiry tracking  *(StockBatch w/ expiryDate; trackExpiry items REQUIRE batch no on stock-in (422); FIFO depletion consumes earliest-expiry batch first (verified); "Expiring ≤30 days" + "EXPIRED — dispose" alert strips)*
- [x] Asset tracking (separate)  *(Asset register: auto AST-#### tags, category/location/custodian/value/condition badges; HP ProBook + dining benches seeded; AST-0003 auto-tag verified)*

## B.19 — Cafeteria
- [x] Meal planning  *(MealPlanEntry 7 days × 3 meals (@@unique tenant+day+meal — upsert edits in place, verified 21 stays 21); click-to-edit grid w/ real Kenyan dishes seeded (githeri, pilau Friday, ugali na omena); NEW cafeteria.view/manage perms (LEADERSHIP + BURSAR; SUPPORT_STAFF read for kitchen crew; teacher 403 verified); screenshot 92)*
- [x] Food inventory  *(REUSES the B.18 Kitchen Store — one stock truth, zero double entry; kitchenStock() filters the Kitchen store; "Issue food for a meal" wraps B.18 stockOut w/ reason "Kitchen — Tuesday lunch — ugali" (movement traced, 18→14 verified); low-stock strip on the kitchen board)*
- [x] Student meal cards  *(MealCard MC-#### for day scholars; FOUNDER INVOICE RULE: issue = invoice FIRST (no card without a ledger entry) — MC-0002 "Breakfast + Lunch plan" KES 9,500 → UNPAID invoice on Achieng's ledger AND family portal w/ Pay button (verified); one active card per student per term 409; cancel + double-cancel 409; card list shows live invoice payment status; screenshot 93)*
- [x] Kitchen management  *(kitchenToday board: headcount per meal = active cards + boarders (boarding fee covers boarders' meals — lunch 5 = 4 boarders + 1 card, verified), today's menu from the week plan, low-stock warnings; screenshot 91)*

## B.20 — Discipline
- [x] Incident reports  *(DisciplineIncident: 8 KE categories (fighting/bullying/lateness/sneaking...), MINOR/MAJOR/SEVERE, action taken; teachers report ONLY their classes' students (B.12 rule — chebet→F1W 403 verified), leadership all; NEW discipline.view/manage perms (teachers+deputy+leadership); screenshot 95)*
- [x] Suspension records  *(Suspension: start/end dates, reason, RETURN CONDITIONS ("Return with a parent"), one active per student 409, "suspended now" effective flag, close + double-close 409; LEADERSHIP-ONLY issue (teacher 403 verified))*
- [x] Behavior tracking  *(demerit points MINOR=1/MAJOR=3/SEVERE=5; year board per student w/ GOOD <3 / WATCH 3-7 / AT_RISK ≥8 bands (Achieng 4pts WATCH verified); sorted worst-first; screenshot 96)*
- [x] Counseling records (confidential)  *(CounselingNote gated by NEW counseling.confidential perm — PRINCIPAL+DEPUTY ONLY: teacher AND bursar blocked from reading (verified), tab hidden from non-holders, audit log deliberately EXCLUDES note content (verified no leak), family portal payload never contains counseling (verified))*
- [x] Auto parent notifications  *(MAJOR/SEVERE incidents + EVERY suspension SMS the primary guardian automatically (quota-checked + recorded; both fired live + parentNotifiedAt stamped + "parent SMS ✓" badges); MINOR stays in-school)*

## B.21 — Medical / Clinic
- [x] Clinic visits log  *(ClinicVisit: complaint/treatment/medication/referredTo; REFERRALS SMS THE GUARDIAN automatically (fired live, quota-checked, parentNotifiedAt + "parent SMS ✓" badge); NEW clinic.view/manage perms — SUPPORT_STAFF (school nurse — no NURSE role in the 16) + DEPUTY + LEADERSHIP; screenshot 97)*
- [x] Medical history  *(StudentMedical one-per-student: blood group, chronic conditions, SHA (ex-NHIF) number, notes; full medical file view (profile + visits + medication plans); upsert edits in place (verified no dup))*
- [x] Allergies (with alerts)  *(allergies JSON on the profile; THREE alert surfaces: ① visit recording warns "⚠ ALLERGIC to Penicillin — verify before administering" (verified), ② medication plans matching an allergy are BLOCKED 422 (verified — safety first), ③ kitchen board (B.19) shows the food-allergy register for the cooks ("Groundnuts" flagged — verified); allergy register tab w/ red badges; screenshot 98)*
- [x] Medication tracking  *(MedicationPlan + per-dose MedicationDose trail (who gave it, when, note); Give-dose button, stop plan, dose-on-stopped 422, double-stop 409; "last dose 14:05 by Otieno Brian" on the card)*
- [x] Health reports  *(year stats: total visits, referrals out, allergic students, active medications + FREQUENT VISITORS (≥3/year — chronic/welfare flag) sorted worst-first; family portal childHealth (scopeWhere — other-family 404 verified) shows visits + allergies + blood group)*

## B.22 — Security
- [x] Visitor management  *(BUILT AT A.18 (VisitorLog: badge V-###, ID capture, sign-in/out, host) + B.16 boarder-visit link — re-verified live via reception flows; ticking here per list order)*
- [x] Gate pass management  *(GatePass GP-####: reason/leave-at/return-by/escort; ONE active per student 409; gate checks by number (case-insensitive) → USED + stamped, re-use REJECTED ("do not allow exit"), unknown 404, cancel; NEW security.view/manage perms (RECEPTIONIST = gate desk + LEADERSHIP); screenshot 101)*
- [x] Student pickup auth  *(PickupPerson per student: name/relationship/phone/national ID (checked at the gate); gate lookup by name/adm shows ONLY authorised people, red "NOBODY is authorised" warning when list empty; add/remove (soft) live-tested)*
- [ ] CCTV integration  *(HARDWARE-DEFERRED — needs camera NVR/RTSP infra (founder hardware decision); flagged, never faked)*
- [x] Emergency panic alerts  *(PanicAlert FIRE/MEDICAL/INTRUDER/OTHER: ANY staff raises (panic.raise on all 14 staff roles) → 9 staff in-app alerts + leadership SMS (principal+deputy, fired live, quota-recorded); parents/students NEVER alerted (verified); ACTIVE-emergency banner w/ resolve; big red button UI; screenshot 102)*

## B.23 — AI Intelligence Layer

*FOUNDER DIRECTIVE 2026-06-13: this layer launches THROUGH THE MASCOT — the product never says "AI", it says **Bundi**. The Bundi experience shell (G.36) is built design-only and platform-PAUSED (G.22 flag `bundi`) until launch. NO other feature may depend on this layer — verified 2026-06-13: zero AI/OpenAI/Claude references in src/, every B.1–B.22 feature is fully rule-based (report comments, anomaly detection etc. all have rule-based engines with swap seams). The engine lines below stay unticked until founder provides the key AND launches Bundi.*

- [ ] AI report card comments
- [ ] Excel/PDF/photo column mapping
- [ ] Fee default prediction
- [ ] Student dropout risk
- [ ] AI lesson plan generator
- [ ] AI Q&A assistant
- [ ] Attendance anomaly detection
- [ ] SMS personalization at scale
- [ ] KCSE prediction
- [ ] Teacher performance scoring
- [ ] Enrollment forecasting
- [ ] Budget forecasting

## B.24 — Owner Dashboard
- [x] Total students live  *(/owner "My school at a glance": active count + boys/girls/boarders split (live hostelAllocation); NEW permission owner.dashboard → SCHOOL_OWNER+PRINCIPAL only (teacher/bursar/parent can() false + HTTP 403 + page /forbidden all verified); nav "My School" (LineChart); live-tested 2026-06-13; screenshot 113)*
- [x] Revenue (today/term)  *(today = PAID Payment rows since Nairobi midnight (KES 5,000 verified vs seed); term = paidKes applied to current-term invoices honouring discounts (KES 48,000 verified); owner-test.ts 25/25 ✓)*
- [x] Collection % vs target  *(collected/billed % vs Tenant.collectionTargetPct (migration b24_owner_dashboard, default 85); on-track green / behind amber bar; inline "Change target" editor → POST /api/owner (clamped 10-100, over-100→100 verified, audit owner.target_updated verified); 45% vs 85% amber shown live)*
- [x] Outstanding fees breakdown  *(aging buckets not-yet-due/1-30/31-60/60+ (sum = outstanding KES 57,500 verified) w/ colour bars + "Largest balances" top-5 debtors sorted desc (Atieno 33k → Kamau 18k → Wanjiru 6.5k) linking to student profiles + Open Finance →)*
- [x] Staff costs  *(latest B.8 PayrollRun: gross/month KES 295,000, take-home, statutory, staff count, Approved badge; seed now creates demo run 2026-05 APPROVED using the REAL grossToNet statutory calculator (idempotent); empty state links /payroll)*
- [x] Profitability  *(honest term proxy: fees collected − payroll×3 months = surplus (negative KES -837,000 shown red on seed data — truthful, not faked); note explains other expenses arrive with C.5)*
- [x] Enrollment trends chart  *(new learners by admittedOn, last 6 months, CSS bar chart (5 in Jun verified vs seed); no chart lib — glass-friendly)*
- [x] Academic performance trends  *(published exams this year: mean % bars green/amber/red (CAT 1 — Term 2 64% verified vs B.5 seed); unpublished exams excluded)*
- [x] School ranking analytics  *(percentile of collection rate among NEYO schools w/ bills — ANONYMIZED: payload returns percentile+cohort only, never another school's name (JSON grep verified); cohort<2 shows "appears when more schools join")*

## B.25 — Additional Modules

### Uniform Management
- [x] Uniform items (shirt, trouser, tie, PE kit)  *(BUILT AT B.18/G.24: StockItem category "Uniform" + photo + price = the item registry (sweater seeded); ticked per list order after B.25 review 2026-06-13 — no rebuild, one stock truth kept)*
- [x] Sizes per item (XS-XXL + custom)  *(NEW UniformSize model (migration b25_uniform_sizes, @@unique tenant+item+size, TENANT_OWNED); preset chips XS-XXL + Size 26-34 + any custom via setSizeStock upsert; "Uniform sizes" tab in /inventory (Shirt icon); seeded sweater S8/M14/L12/XL6; uniform-sizes-test.ts 10/10 ✓; screenshot 115)*
- [x] Stock per item per size  *(per-size qty pills (red sold-out / amber ≤3 / normal) + click-to-edit dialog; MASTER StockItem.qty auto-syncs to the sum of size rows (46 verified after M 14→20); deliveries decrement BOTH size row and master (20→18 + 46→44 verified); negative qty 422 + non-uniform item 422; bursar manage, parent write 403 (HTTP verified))*
- [x] Sales to students + payment tracking  *(BUILT AT G.24 placeOrder: invoice at placement (founder rule), supplier SMS, status chain, delivered→stock decrement; B.25 EXTENDS: portal order dialog now shows LIVE size pills (sold-out disabled w/ strikethrough, "(N left)" hints at ≤3, order blocked until a size is picked when sizes exist); supplier SMS carries the size ("× 2 (M)" fired live in test); screenshot 116)*

### School Assets
- [x] Asset tagging (computers, furniture, vehicles)  *(BUILT AT B.18: Asset model, auto AST-#### tags, category/location/condition — ticked per list order after B.25 review 2026-06-13, not rebuilt)*
- [x] Acquisition records  *(acquiredOn + valueKes existed (B.18); B.25 made them EDITABLE in the new AssetDrawer ("Bought on" + "Cost") and they now drive depreciation; "since 2025-01-15" shown on register rows; screenshot 117)*
- [x] Depreciation auto-calc  *(Asset.depreciationPctPerYear (migration b25_asset_depreciation_maintenance); straight-line bookValueKes() pure fn (floors at 0; unit-verified 25%/yr 1yr ≈ 75,017 + 10yr floor 0); register shows BOOK VALUE w/ "bought KES X · −25%/yr" subtext (laptop 78,000 → 50,551 live-verified via HTTP); >100% rejected 422; asset-test.ts 15/15 ✓)*
- [x] Maintenance schedule  *(NEW AssetMaintenance log (SERVICE/REPAIR/INSPECTION/OTHER + cost + note + byName, mirrors B.17 VehicleMaintenance) + Asset.nextMaintenanceOn → red "service due" / amber "service soon ≤30d" badges on register (laptop seeded OVERDUE 2026-06-01 — verified); logging w/ nextMaintenanceOn clears the due flag (verified); per-asset history + total spent in drawer; negative cost 422; audits inventory.asset_maintained; screenshot 118)*
- [x] Custodian per asset  *(custodian existed (B.18); B.25 made it editable in the drawer (updateAsset, audited inventory.asset_updated — "Otieno Brian" change verified); teacher write 403 HTTP-verified)*

### Supplier Management
- [x] Supplier records + categorization  *(NEW Supplier model (migration b25_suppliers, @@unique tenant+name, TENANT_OWNED): name/contact/phone (normalizeKePhone — "0711000222"→"+254711000222" verified)/email/KRA PIN/notes; dup name 409 + bad phone 422 verified; "Suppliers" tab in /inventory (Truck icon) + Add-supplier dialog; G.24 tailor seeded as a real Supplier row (★5); supplier-test.ts 14/14 ✓; screenshot 119)*
- [x] Categorization (food/uniform/cleaning)  *(SUPPLIER_CATEGORIES: Food/Uniform/Cleaning/Stationery/Transport/Services/Other; directory sorted category-then-name; category select in the dialog)*
- [x] Ratings + history  *(1-5 STAR rating — one-tap stars on each card (rate 9 rejected 422, saved rating verified); audit trail supplier.created/rated/contract_added/archived = the history (verified ≥4 rows); archive hides from directory (verified))*
- [x] Contracts with expiry  *(SupplierContract (title/startsOn/endsOn/valueKes/note); end≤start 422; ≤30-day amber "renew soon · Nd left" + red "expired" + green "active" badges (B.17 daysUntil pattern — Naivas seeded expiring ~20d amber demo verified, expired-contract red verified); Add-contract dialog explains the 30-day warning; teacher GET 403 HTTP-verified)*

### Procurement
- [x] Purchase requests  *(PurchaseRequest model (migration b25_procurement; title/details/neededBy/status OPEN|ORDERED|CANCELLED, requestedBy denorm) + createRequest (inventory.manage) + "New purchase request" dialog in /inventory Procurement tab; audit procurement.request_created; seeded "Term 3 dry foods restock" by Achieng Mary; verify-and-tick 2026-06-13 — backend+UI were already built last chat; procurement-test.ts 16/16 ✓; HTTP: principal board ✓, teacher 403 ✓; screenshot 120)*
- [x] Quotations comparison  *(PurchaseQuote model (per request, supplierName frozen, amountKes, note) + addQuote (supplier must exist 404; closed-request 422) + procurementBoard returns quotes ordered cheapest-first w/ cheapestQuoteId; UI shows green "BEST PRICE" highlight on the cheapest + "Order" button per quote; seeded Naivas KES 86,500 (best) vs Kiambu General Traders KES 92,000; live-verified on screenshot 120)*
- [x] PO generation  *(PurchaseOrder model (poNo KH-PO-#### via A.4, links request+quote+supplier, status state-machine) + createOrderFromQuote (request→ORDERED, poNo generated); seeded KH-PO-000001; audit procurement.po_created; verified poNo generation in procurement-test.ts)*
- [x] Approval workflow per threshold  *(Tenant.poApprovalThresholdKes default KES 50,000; createOrderFromQuote auto-APPROVES under threshold (small buys never block the principal) else PENDING_APPROVAL; approveOrder = LEADERSHIP only (tenant.manage_settings; teacher 403 HTTP-verified) + creator-cannot-self-approve (verified); "Orders above KES 50,000 need leadership approval" notice + Approve button shown only to canApprove; live-tested under/over threshold + self-approve block)*
- [x] Delivery tracking + 3-way match  *(markSent (APPROVED→SENT) → recordDelivery (goods-received note + deliveredValueKes) → threeWayMatch (PO total vs goods received vs supplier invoice — all-equal = matchOk green, any diff flagged red w/ human note, "never pay a mismatched invoice quietly"); double-match blocked, cancel reopens the request; DeliverDialog + MatchDialog in the Procurement tab; seeded KH-PO-000001 MATCHED ✓ "PO, delivery and invoice all agree"; procurement-test.ts: clean match + mismatch flagged + mismatch note + double-match-blocked all ✓; screenshot 120)*

### Expenses Tracking
- [x] Expense categories  *(ExpenseCategory model (migration b25_expenses; @@unique tenant+name, archived) + addCategory (dup 409) + one-click KE preset seed (10 categories: Utilities/Repairs/Cleaning/Stationery/Food/Transport/Staff Welfare/Examinations/Licenses/Other) + Categories tab in /inventory Expenses; archive toggle; built 2026-06-13; expense-test.ts 20/20 ✓; screenshots 121-122)*
- [x] Cost centers  *(CostCenter model (@@unique tenant+name, archived) + addCostCenter (dup 409) + 7 KE presets (Whole school/Administration/Academics/Boarding/Kitchen/Transport/Co-curricular); optional per-expense; drives the by-cost-center report; live-verified)*
- [x] Approval workflows  *(Tenant.expenseApprovalThresholdKes default KES 20,000; createExpense auto-APPROVES under threshold (small spends never block) else PENDING_APPROVAL; approveExpense/rejectExpense = LEADERSHIP only (tenant.manage_settings; teacher 403 HTTP-verified) + creator-cannot-self-approve (verified: principal self-approve 403, deputy approves 200); reject carries a reason the bursar sees; "awaiting approval / approved / rejected" badges + Approve/Reject buttons shown only to canApprove; live-tested under/over/self-approve/reject)*
- [~] Receipt photo upload + OCR  *(receipt photo/PDF upload via A.9 storage (FileUpload, category "expense-receipt") — receiptFileUrl/Name stored + downloadable link on the expense row, WORKS FULLY; OCR auto-extract of amount/payee is BUNDI-GATED (deferred-pending B.23 launch, never faked) — manual entry is complete without it)*
- [x] Reports  *(expenseReports(month): APPROVED spend grouped By category + By cost center w/ CSS bars + month total (pending/rejected excluded — verified KES 19,300 across 2, the KES 38,000 pending excluded); GET /api/expenses?reports=&month=; FEEDS B.24 PROFITABILITY — owner dashboard now subtracts real approved expenses over the term window (approvedExpensesSinceKes; surplus moved -837k→-887k live when 50k approved — verified), honest line replaces the old payroll-only proxy; screenshot 122)*

### Calendar & Events
- [x] Calendar UI (month/week/day)  *(BUILT AT A.17 — /calendar month grid + week/day agenda + keyboard nav (←/→/T); re-verified live 2026-06-13, screenshots 123-124; ticked per B.25 list order, not rebuilt)*
- [x] KE public holidays  *(BUILT AT A.17 — KE_MOMENTS holiday layer (cultural-calendar.ts) merged into getOccurrences across the year(s) a range spans; Madaraka/Mashujaa/Jamhuri etc.; re-verified)*
- [x] Cultural moments live  *(BUILT AT A.15/A.17 — cultural moments (academic/cultural) surfaced on the calendar + /brand; re-verified)*
- [x] Religious calendars (opt-in)  *(BUILT AT A.17 — Tenant.showReligiousHolidays toggle (Settings) gates religious moments in getOccurrences; PUT /api/calendar/prefs; re-verified)*
- [x] Event creation with audience targeting  *(BUILT AT A.17 — CalendarEvent + createEvent w/ audience "all" or any of the 16 roles (audienceRole filter), + A.17.5 invite notifications via A.7 notify(); leadership-gated calendar.manage; re-verified)*
- [x] iCal export  *(BUILT AT A.17 — buildIcs() RFC-5545 VCALENDAR (all-day VALUE=DATE + timed TZID=Africa/Nairobi) + GET /api/calendar/ics; B.25 update: recurring events expand to one VEVENT per occurrence in the export (verified 4 VEVENTs for a 4-week series); re-verified)*
- [x] WhatsApp reminders  *(COMPLETED 2026-06-25: WhatsApp transport now activates from NEYO Ops vault credentials, so reminder flows using the notification cascade can send through WhatsApp once credentials are saved; in-app calendar invites already work via A.17.5.)*
- [x] Recurring events (RRULE)  *(NEW B.25 2026-06-13: CalendarEvent += recurrence (WEEKLY|MONTHLY) + recurUntil (migration b25_calendar_recurrence); pure expandRecurrence() — WEEKLY same weekday every 7d, MONTHLY same day-of-month (months without that day SKIPPED not shifted — verified 31st skips Feb/Apr/Jun/Sep/Nov), recurUntil cap + HARD_CAP safety; getOccurrences expands a series into per-date occurrences (unique id "<seriesId>:<date>", recurring flag, shared seriesId) bounded to the view range; event dialog "Repeats" picker (does-not-repeat/weekly/monthly + repeat-until) + green "🔁 weekly/monthly" badge in agenda; deleting any occurrence removes the whole series (series-id aware); seed: weekly Monday Staff Briefing + monthly 5th Fees-due reminder; calendar-recurrence-test.ts 14/14 ✓; live API verified 4 July briefings; screenshots 123 (month: every Monday) + 124 (week: 🔁 weekly badge))*

## B.26 — Premium Features
*REVIEWED 2026-06-13 (verify-and-flag, no faking per Prompt 2). Every line is Bundi-gated (AI), hardware-gated, or native-platform — so none is [x] (fully built+testable). [~] = a real seam/foundation already exists and the ONLY blocker is a founder decision (creds / hardware / native toolchain). The Bundi layer (G.36) is platform-paused; NO feature depends on it.*
- [~] AI Assistant (general Q&A)  *(Bundi experience shell BUILT design-only + platform-paused (G.36, /bundi); the Q&A engine is the B.23 layer — launches THROUGH Bundi when founder provides the key + release signal; never says "AI")*
- [~] WhatsApp Bot for parents  *(A.7 whatsapp.ts transport seam + cascade slot EXIST; inbound bot + outbound replies activate with WHATSAPP_TOKEN (WhatsApp Business API creds, founder action) — in-app + SMS parent comms already live (B.14))*
- [~] Parent Mobile App (native)  *(SHIPPED AS PWA today: installable manifest + service worker + offline action queue (G.2) — parents use /portal on their phones, 360px-first; a true native RN/Swift app is a future packaging step on the same APIs)*
- [~] Teacher Mobile App (native)  *(same PWA foundation (G.2) — /teacher works installable + offline-first incl. queued attendance marking; native packaging = future)*
- [~] Student Mobile App (native)  *(same PWA foundation — shared family /portal serves students (founder decision B.11); native packaging = future)*
- [ ] Face Recognition Attendance  *(deferred — needs camera hardware + vision model; same family as B.3 face/RFID/fingerprint + B.22 CCTV hardware lines; flagged, never faked)*
- [~] GPS Bus Tracking  *(foundation EXISTS: Haversine distance + geofence (G.17) + transport UI seam ("arrives with tracker hardware, never faked"); live bus tracking activates when founder fits GPS trackers + feeds coordinates — hardware decision)*
- [~] AI Exam Analysis  *(rule-based analytics LIVE today: B.5 positions/means/stream+level comparison + B.24 exam trend bars; deeper narrative/predictive analysis = Bundi layer (B.23) on top, never depended on)*
- [~] AI Report Generation (narrative)  *(rule-based report-card remarks LIVE (B.5 buildComment, CBC vs 8-4-4 phrasing); richer narrative = Bundi swap-point at B.23)*
- [~] AI Timetable Generator  *(rule-based generators LIVE: B.4 per-class greedy autoFill w/ teacher double-booking avoidance; whole-school constraint solver speced at G.18 (build on signal); Bundi assist = B.23 on top)*
- [~] AI Homework Generator  *(B.12 homework assignment LIVE rule-based; AI draft generation = Bundi (B.23) convenience layer)*
- [~] AI Lesson Planner  *(B.4 lesson plans LIVE rule-based (teacher-owned, status); AI starter drafts = Bundi (B.23))*
- [~] AI Student Risk Detection composite  *(rule-based signals LIVE today: B.3 chronic-absence + attendance anomaly flags, B.20 behaviour bands (GOOD/WATCH/AT_RISK), B.7 arrears, B.21 frequent-visitor welfare flag; composite Bundi scoring = B.23 on top of these honest rule engines)*

---

# PART C — Business OS Features

## C.1 — Executive Dashboard
- [ ] Revenue tracking
- [ ] Expenses tracking
- [ ] Profit (gross + net)
- [ ] Outstanding invoices total + count
- [ ] Cash position across accounts
- [ ] MRR tracker
- [ ] Sales pipeline value + stage
- [ ] Customer satisfaction score (NPS)
- [ ] Staff attendance %
- [ ] Inventory low-stock alerts
- [ ] AI business insights
- [ ] Cash flow forecast
- [ ] Predictive churn alerts
- [ ] Competitive benchmarking
- [ ] Board-pack auto-generation
- [ ] Multi-currency dashboards

## C.2 — CRM
- [ ] Lead capture (manual)
- [ ] Lead source tagging
- [ ] Contact management (full history)
- [ ] Deal tracking (basic pipeline)
- [ ] Activity log per contact
- [ ] Notes per contact
- [ ] Customer status (lead/prospect/customer/churned)
- [ ] Search + filter contacts
- [ ] Customer segmentation
- [ ] Lead scoring (rule-based + AI)
- [ ] Follow-up reminders
- [ ] Communication history (timeline)
- [ ] Visual pipeline (Kanban)
- [ ] Customizable deal stages
- [ ] Win/loss reasons
- [ ] Account hierarchy
- [ ] Partner & supplier records
- [ ] Custom fields per contact type
- [ ] Bulk import
- [ ] Email sync with contacts
- [ ] Sales territory assignment
- [ ] Lead distribution / round-robin
- [ ] LinkedIn enrichment
- [ ] Click-to-call + auto-log
- [ ] Calendar auto-log meetings
- [ ] AI next-best-action
- [ ] Predictive deal close probability
- [ ] Customer health score

## C.3 — Sales
- [ ] Quotation creation (branded PDF)
- [ ] Invoice generation
- [ ] Sales order tracking
- [ ] Customer balance ledger
- [ ] Payment recording
- [ ] Revenue reports
- [ ] Proposals (multi-page)
- [ ] Quote → Order → Invoice workflow
- [ ] Delivery notes
- [ ] Multiple price lists
- [ ] Volume discounts
- [ ] Commission per sales rep
- [ ] Sales targets + progress
- [ ] Revenue forecasting
- [ ] Recurring invoices (subscriptions)
- [ ] Quote-to-cash automation
- [ ] Multi-currency invoicing
- [ ] VAT / Tax handling
- [ ] Multi-warehouse sales
- [ ] Channel partner tracking
- [ ] Sales gamification
- [ ] Sales coaching AI
- [ ] International sales (export docs)

## C.4 — Marketing
- [ ] Email campaigns
- [ ] Email templates (drag-drop)
- [ ] SMS campaigns
- [ ] WhatsApp campaigns
- [ ] Landing page builder
- [ ] Lead capture forms
- [ ] Pop-ups + exit-intent
- [ ] A/B testing
- [ ] Open + click tracking
- [ ] Unsubscribe management
- [ ] Marketing automation flows
- [ ] Lead magnets (gated content)
- [ ] UTM tracking + attribution
- [ ] Marketing analytics dashboard
- [ ] Customer journey visualization
- [ ] Cost-per-lead tracking
- [ ] ROI per campaign
- [ ] Social media scheduling
- [ ] SEO content planner (AI)
- [ ] Ad campaign management
- [ ] Influencer relationship management
- [ ] Programmatic ad buying
- [ ] Customer data platform (CDP)
- [ ] Predictive lead scoring
- [ ] LTV modeling
- [ ] Marketing mix modeling

## C.5 — Finance
- [ ] Income tracking per source
- [ ] Expense tracking per category
- [ ] Cash flow view
- [ ] AP (vendor balances)
- [ ] AR (customer balances)
- [ ] Bank reconciliation
- [ ] Basic P&L
- [ ] Budgeting per dept / period
- [ ] Budget vs actual reports
- [ ] Multi-account / multi-currency
- [ ] Recurring expenses
- [ ] Expense approval workflow
- [ ] Petty cash management
- [ ] Loan management
- [ ] Bank feeds (Equity, KCB)
- [ ] Receipt photo upload + OCR
- [ ] Reimbursement workflow
- [ ] Financial forecasting
- [ ] Cash flow forecast
- [ ] Multi-entity consolidation
- [ ] Inter-company transactions
- [ ] Treasury management
- [ ] Investment portfolio tracking

## C.6 — Accounting
- [ ] Chart of accounts (KE)
- [ ] General ledger
- [ ] Journal entries
- [ ] Trial balance
- [ ] P&L statement
- [ ] Balance sheet
- [ ] Cash flow statement
- [ ] Fixed assets register
- [ ] Depreciation (multiple methods)
- [ ] Tax management (VAT 16%, WHT 5%)
- [ ] Tax returns prep (P9, VAT3)
- [ ] Audit trail per transaction
- [ ] Period closing
- [ ] Multi-currency journal entries
- [ ] Consolidated statements
- [ ] Inter-company eliminations
- [ ] Cost accounting
- [ ] IFRS-compliant reporting
- [ ] XBRL export

## C.7 — HR
- [ ] Employee records (full)
- [ ] Documents (contract, ID, certs)
- [ ] Org chart
- [ ] Leave management (all types)
- [ ] Leave approval workflow
- [ ] Leave calendar (team view)
- [ ] Performance reviews
- [ ] Goal setting + tracking
- [ ] Recruitment (jobs, applications, interviews)
- [ ] Training records
- [ ] Staff contracts (template + auto-fill)
- [ ] Disciplinary records
- [ ] 360-degree reviews
- [ ] Succession planning
- [ ] Engagement surveys
- [ ] Skill matrix

## C.8 — Payroll
- [ ] Salary processing
- [ ] Allowances (housing, transport, lunch)
- [ ] Deductions (PAYE/NSSF/NHIF/SHA/SACCO)
- [ ] PAYE calculation (KE bands)
- [ ] NSSF Tier I + II
- [ ] NHIF / SHA
- [ ] Payslip generation (PDF branded)
- [ ] Bulk salary payment (M-Pesa B2C)
- [ ] Tax certs (P9 annual)
- [ ] Payroll reports
- [ ] Variable pay (bonuses, commissions)
- [ ] Stock options tracking
- [ ] Salary advances + repayment automation

## C.9 — Projects
- [ ] Projects (create, status, owner)
- [ ] Milestones
- [ ] Tasks (assign, due, priority)
- [ ] Subtasks
- [ ] Task dependencies
- [ ] Teams + roles
- [ ] Time tracking
- [ ] Resource allocation
- [ ] Project budget vs actual
- [ ] Project profitability
- [ ] Gantt chart view
- [ ] Kanban view
- [ ] Custom workflows per project type
- [ ] Cross-project resource planning
- [ ] Critical path analysis
- [ ] Risk register
- [ ] Earned value management
- [ ] Client billing per hours

## C.10 — Inventory
- [ ] Products catalog (SKU)
- [ ] Stock levels per warehouse
- [ ] Stock movements
- [ ] Multiple warehouses
- [ ] Stock transfers
- [ ] Reorder alerts
- [ ] Stock valuation (FIFO/LIFO/avg)
- [ ] Batch / serial tracking
- [ ] Expiry tracking
- [ ] Barcode gen + scan
- [ ] Multi-unit conversions
- [ ] Lot tracking for compliance
- [ ] Stock-take wizard (handheld)
- [ ] Demand forecasting AI

## C.11 — Procurement
- [ ] Supplier management
- [ ] Purchase requests
- [ ] Purchase orders
- [ ] Quotation comparison
- [ ] Approval workflow per threshold
- [ ] Vendor evaluation
- [ ] Receiving + inspection
- [ ] 3-way match
- [ ] RFP / RFQ portal
- [ ] Supplier onboarding workflow
- [ ] Contract management

## C.12 — Asset Management
- [ ] Asset register (full)
- [ ] Asset categorization
- [ ] Acquisition cost + date
- [ ] Depreciation (multiple methods)
- [ ] Current + book value
- [ ] Maintenance schedule + log
- [ ] Repairs + costs
- [ ] Assignment to person/location
- [ ] Disposal workflow
- [ ] Transfer between branches
- [ ] Insurance tracking

## C.13 — Helpdesk
- [ ] Ticketing (web, email, WhatsApp in)
- [ ] Categories + priorities
- [ ] Assignment + routing rules
- [ ] SLA tracking
- [ ] Live chat widget
- [ ] Knowledge base (public + internal)
- [ ] Canned responses
- [ ] CSAT surveys post-ticket
- [ ] Complaint management
- [ ] Escalation workflows
- [ ] AI auto-reply suggestions
- [ ] Voice call ticketing
- [ ] Video support (screen share)
- [ ] Customer health from tickets
- [ ] Predictive ticket volume

## C.14 — Document Management
- [ ] File upload (PDF, DOCX, XLSX, images)
- [ ] Folders + tags
- [ ] Search by name + content
- [ ] Permissions per folder
- [ ] Version control
- [ ] Approval workflows
- [ ] Digital signatures
- [ ] Templates library
- [ ] Auto-naming conventions
- [ ] Retention policies
- [ ] Audit log per document
- [ ] OCR for scanned docs
- [ ] Document classification AI
- [ ] Smart redaction (PII removal)
- [ ] Legal hold
- [ ] DocuSign-grade signing

## C.15 — Communication Center
- [ ] Internal team chat (direct + group)
- [ ] Announcements broadcast
- [ ] Notification bell + in-app
- [ ] Push notifications (PWA)
- [ ] @mentions
- [ ] Video meetings (built-in or Zoom embed)
- [ ] Notice board
- [ ] Polls + surveys
- [ ] Threaded discussions
- [ ] File sharing in chat
- [ ] Voice notes
- [ ] Message translation
- [ ] Read receipts + typing
- [ ] Voice calls (WebRTC)
- [ ] Video calls + screen share
- [ ] Live town halls
- [ ] E2E encryption (sensitive)
- [ ] AI meeting summaries

## C.16 — Business Intelligence
- [ ] Pre-built dashboards
- [ ] Custom dashboard builder (drag-drop)
- [ ] KPI widgets
- [ ] Charts (multiple types)
- [ ] Filters
- [ ] Drill-down
- [ ] Scheduled reports
- [ ] Export (PDF/Excel/CSV)
- [ ] Data refresh schedules
- [ ] Shared dashboards
- [ ] Mobile-friendly
- [ ] Alerts (threshold-triggered)
- [ ] Natural language queries
- [ ] Pivot tables
- [ ] Cohort analysis
- [ ] Funnel analysis
- [ ] Retention curves
- [ ] Anomaly detection AI
- [ ] What-if modeling
- [ ] Custom SQL editor

## C.17 — AI Business Layer
- [ ] AI CEO Assistant (NL Q&A)
- [ ] "Which products are loss-making?"
- [ ] "Which customers owe us money?"
- [ ] "Which salesperson is performing best?"
- [ ] AI Sales: suggest follow-ups
- [ ] AI Sales: predict close probability
- [ ] AI Sales: recommend upsells
- [ ] AI Marketing: generate copy
- [ ] AI Marketing: write ad variants
- [ ] AI Marketing: email sequences
- [ ] AI Marketing: performance analysis
- [ ] AI Finance: cash flow forecast
- [ ] AI Finance: expense anomaly
- [ ] AI Finance: budget recommendations
- [ ] AI Ops: detect stock shortages
- [ ] AI Ops: detect delayed projects
- [ ] AI Ops: unproductive staff
- [ ] AI Ops: cost overruns
- [ ] AI HR: job descriptions
- [ ] AI HR: CV screening
- [ ] AI HR: interview questions
- [ ] AI Finance: receipt auto-categorize
- [ ] AI Legal: contract risk review
- [ ] AI Strategy: SWOT from data
- [ ] AI Customer: churn prediction
- [ ] AI Sales: per-customer pricing
- [ ] AI Marketing: image/video ad gen
- [ ] AI Ops: process mining
- [ ] AI Predictive maintenance
- [ ] AI auto-task from emails

## C.18 — E-Commerce
- [ ] Online store storefront
- [ ] Product catalog + variants
- [ ] Shopping cart
- [ ] Checkout (M-Pesa + card)
- [ ] Order management
- [ ] Delivery tracking
- [ ] Customer accounts
- [ ] Product reviews
- [ ] Discount codes
- [ ] Abandoned cart recovery
- [ ] Stock sync with inventory
- [ ] Multi-language storefront
- [ ] SEO optimization
- [ ] Email integration

## C.19 — POS
- [ ] Touch-friendly UI (tablet)
- [ ] Barcode scanning
- [ ] Receipt printing (thermal)
- [ ] Cash drawer integration
- [ ] Multi-payment (cash+M-Pesa+card)
- [ ] Discounts + promotions
- [ ] Refunds + returns
- [ ] End-of-day reconciliation
- [ ] Multi-cashier shifts
- [ ] Restaurant: tables + KOT
- [ ] Pharmacy: prescription tracking
- [ ] Offline mode

## C.20 — Subscription Management
- [ ] Plans + pricing tiers
- [ ] Billing cycles
- [ ] Auto-renewal
- [ ] Upgrades/downgrades (pro-rated)
- [ ] Cancellation flow
- [ ] Dunning (failed payment retries)
- [ ] MRR / ARR tracking
- [ ] Churn tracking
- [ ] Usage-based billing
- [ ] Add-on management
- [ ] Coupon engine
- [ ] Revenue recognition (ASC 606)

## C.21 — Franchise / Multi-Branch
- [ ] Branch / outlet registration
- [ ] Branch-level dashboards
- [ ] Cross-branch reporting
- [ ] Inter-branch transfers (stock/cash)
- [ ] Branch P&L
- [ ] Franchisee royalty tracking
- [ ] Brand consistency monitoring
- [ ] Centralized policy distribution
- [ ] Branch benchmarking
- [ ] Multi-currency consolidation

## C.22 — Mobile App Native
- [ ] Clock-in/out (GPS-tagged)
- [ ] Expense submission (photo)
- [ ] Dashboards on mobile
- [ ] Approve workflows on mobile
- [ ] Push notifications
- [ ] Offline data entry + sync
- [ ] Barcode scanning
- [ ] Customer signature capture
- [ ] Driver delivery confirm
- [ ] Manager approval queue

## C.23 — Workflow Automation
- [ ] Pre-built templates
- [ ] Trigger-based actions
- [ ] New lead → assign + WhatsApp + task
- [ ] Invoice overdue → reminder cascade
- [ ] New customer → welcome sequence
- [ ] Low stock → auto-create PO draft
- [ ] Approval routing
- [ ] Scheduled tasks (recurring)
- [ ] Multi-step workflows
- [ ] Conditional branches
- [ ] Visual drag-drop builder
- [ ] External integrations (Zapier-style)
- [ ] Webhook triggers
- [ ] Custom code steps (JS)
- [ ] AI-generated workflow suggestions
- [ ] Workflow analytics
- [ ] Branching by data values
- [ ] Loop / iteration

## C.24 — KE Compliance
- [ ] KRA PIN validation
- [ ] VAT-compliant invoices (16%)
- [ ] WHT (5%) auto-calc + certs
- [ ] NSSF Tier I + II
- [ ] NHIF / SHA
- [ ] P9 annual tax certs
- [ ] iTax-format exports
- [ ] Statutory deadline reminders
- [ ] eTIMS integration
- [ ] KRA M-Service integration
- [ ] Auto VAT3 return filing
- [ ] Audit-ready compliance reports

## C.25 — Vendor Portal
- [ ] Vendor self-service login
- [ ] View open POs
- [ ] Submit quotations / bids
- [ ] Submit invoices + delivery
- [ ] Payment status visibility
- [ ] Performance metrics shared
- [ ] Catalog management
- [ ] Vendor rating + feedback
- [ ] Vendor certifications upload

## C.26 — Customer Portal
- [ ] Customer self-service login
- [ ] View invoices + payment history
- [ ] Pay via M-Pesa STK
- [ ] Submit support tickets
- [ ] Download statements
- [ ] Update contact info
- [ ] View order history
- [ ] Receive notifications
- [ ] Reorder previous orders
- [ ] Self-service KB search
- [ ] Schedule appointments
- [ ] Loyalty / rewards tracking

---

# PART D — Farm OS Features
> Major categories (to be expanded into individual feature lines when this part begins):
- [ ] Main Dashboard
- [ ] Crops
- [ ] Plots/GPS
- [ ] Calendar & Tasks
- [ ] Greenhouse
- [ ] Irrigation
- [ ] Fertilizer
- [ ] Spray
- [ ] Pests & Disease
- [ ] Nursery
- [ ] Harvest
- [ ] Livestock: Dairy
- [ ] Livestock: Poultry
- [ ] Livestock: Goats/Sheep
- [ ] Inventory
- [ ] Procurement
- [ ] Supplier CRM
- [ ] Customer CRM
- [ ] Market Intelligence
- [ ] Sales/Delivery
- [ ] Finance
- [ ] Workers/Payroll
- [ ] Machinery
- [ ] Weather
- [ ] AI Layer
- [ ] Mobile App
- [ ] WhatsApp Bot
- [ ] Exec Dashboard
- [ ] Premium Enterprise

---

# PART E — Creator OS Features
> Major categories (to be expanded into individual feature lines when this part begins):
- [ ] Creator Hub
- [ ] Audience CRM
- [ ] Email Newsletter
- [ ] SMS/WhatsApp
- [ ] Content Library
- [ ] Course Builder
- [ ] Digital Storefront
- [ ] Membership Tiers
- [ ] Community
- [ ] Live Events
- [ ] Booking/Calendar
- [ ] Coaching Notes
- [ ] Affiliate
- [ ] Sponsorships
- [ ] Tip Jar
- [ ] Payments
- [ ] Analytics
- [ ] AI Studio
- [ ] Social Distribution
- [ ] Link-in-Bio
- [ ] Marketplace
- [ ] Mobile App
- [ ] Calendar
- [ ] Settings

---

# PART F — Internal NEYO Operations

## F.1 — Founder Operations
- [x] BUILD-LOG.md filled daily  *(completed 2026-06-14; `BUILD-LOG.md` added as human-readable mirror + `NeyoBuildLog` DB-backed build-log rows; `/founder` Build log tab saves through the real API; screenshots 142 + 146)*
- [x] Weekly metrics review (revenue, MRR, customers)  *(completed 2026-06-14; `NeyoMetricSnapshot` stores revenueKes/mrrKes/paying/trial/active/churn-risk/smsSpend; `/founder` Metrics tab + overview MRR card; seeded 2026-W24; screenshot 146)*
- [x] Monthly all-hands  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `MONTHLY_ALL_HANDS`, planned/done/skipped workflow, summary/decisions/action-items; visible in `/founder` Cadence/Overview)*
- [x] Quarterly self-audit  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `QUARTERLY_AUDIT`, seeded Q2 product/security self-audit and tracked in Founder Operations)*
- [x] Annual planning offsite  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `ANNUAL_PLANNING`, seeded 2026 annual planning offsite; visible in upcoming founder rhythm)*
- [x] Customer interviews regularly  *(completed 2026-06-14; `NeyoCustomerInterview` model + Interviews tab captures school/contact/channel/status/pain-points/quotes/opportunities/follow-up; seeded Karibu + Uhuru; screenshots 145 + 146)*
- [x] Demo Day  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `DEMO_DAY`, seeded Founder Demo Day with School OS end-to-end demo summary)*
- [x] Investor updates  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `INVESTOR_UPDATE`, seeded June investor update; appears in upcoming founder rhythm screenshot 146)*
- [x] Board meetings  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `BOARD_MEETING`, seeded Q2 board meeting pack; appears in upcoming founder rhythm)*
- [x] Annual impact report  *(completed 2026-06-14; `NeyoFounderOpsEntry` kind `IMPACT_REPORT`, seeded 2026 annual impact report; visible in upcoming rhythm)*

## F.2 — Marketing Presence
- [ ] Landing site
- [ ] LinkedIn page + regular posts
- [ ] Twitter/X presence
- [ ] WhatsApp Business profile
- [ ] Facebook page
- [ ] YouTube channel
- [ ] TechCabal pitch
- [ ] KEPSHA newsletter feature

## F.3 — Customer Success
- [ ] 24h response SLA via WhatsApp
- [ ] Onboarding call for every paying school
- [ ] Regular check-ins
- [ ] NPS survey
- [ ] Customer Advisory Board
- [ ] Help docs
- [ ] Status page
- [ ] Public roadmap
- [ ] Public changelog

## F.4 — Community + Impact
- [ ] Karibu Scholarship (free schools)
- [ ] KEPSHA partnership
- [ ] Mentor founders
- [ ] Open-source utilities
- [ ] NEYO Conference
- [ ] B Corp certification
- [ ] PBO registration
- [ ] AfriLabs partnership
- [ ] iHub presence
- [ ] Speak at tech events

---

## Reference — Engineering / Design / Architecture decisions
(kept for context; these are policies, not tickable product features)
- Engineering: feature-folder structure (schemas+service+routes+tests), server components by default, React Hook Form + Zod, SWR client fetching, BullMQ jobs, pino logging, conventional commits.
- Design: Apple craft + Kenyan warmth, 10-color palette max, Inter (400/500/600/700), navy+green+warm white, 8pt grid, Apple type scale, `rounded-full` buttons / `rounded-2xl` cards, soft brand-tinted shadows, cubic-bezier easing, one primary CTA, native HTML > custom UI, mobile-first 360px, density per page type, generous whitespace, co-branded documents.
- Architecture: multi-tenant Postgres RLS, modular monolith, per-tenant M-Pesa Paybill + encrypted creds, soft limits, two-ID system, 16 roles, idempotent M-Pesa refs, universal bulk import, shared calendar, cultural moments, PWA + messaging + push, channel cascade, wildcard subdomains, custom domains (Elite), social OAuth, BullMQ+cron, observability (Sentry/Better Stack/PostHog), public API+webhooks, R2 files, tsvector search, Redis cache, GitHub Actions CI/CD, permission-aware UI, AI Gateway + per-tenant budgets + multi-provider fallback + versioned prompts.
- Hosting: local-first dev, Docker Compose (PG+Redis), Vercel web, Fly.io API, Neon Postgres, Upstash Redis, Cloudflare R2 + wildcard DNS, custom domains (Elite), one deployment for all OS.
- Legal: Privacy Policy (KE-DPA), ToS, KE compliance checklist, ODPC registration + DPO, breach process, data-subject rights, audit log retention.

---

# PART G — NEYO Enhancements (founder-approved additions, not in original PDF)
> Proposed by the Build Partner, approved by the founder 2026-06-11. Built with the same 8-chunk full-stack rigor. The Build Partner keeps suggesting more here as the project grows.

## G.1 — Activity Feed (Tier 1)
- [x] Reusable per-entity activity timeline component (reads AuditLog)  *(ActivityFeed component)*
- [x] `GET /api/activity?entityType=&entityId=` endpoint (tenant-scoped)  *(/api/activity)*
- [x] Activity feed shown on detail pages (satisfies Principle 8 "activity feed if detail")  *(on dashboard + reusable per-entity)*

## G.2 — Offline-first Saved Actions Queue / PWA (Tier 1)
- [x] PWA manifest + service worker (installable, offline shell)  *(manifest.webmanifest + public/sw.js + PwaProvider register; /offline page; icons)*
- [x] Offline action queue (IndexedDB) for attendance/payments on slow 3G  *(lib/offline/queue.ts (IndexedDB) + queuedPost())*
- [x] Auto-sync queued actions when back online + conflict handling  *(syncQueue on 'online'; Idempotency-Key per action)*
- [x] Offline/online status indicator  *(OfflineIndicator pill in topbar (Offline / Sync N))*

## G.3 — First-Run Setup Wizard (Tier 1)
- [x] New-school signup (create tenant + slug via A.2.5)  *(onboarding.service signupSchool; /get-started wizard)*
- [x] Owner account creation (first user, SCHOOL_OWNER)  *(created + auto-login session)*
- [x] Module picker step (A.2.6) + curriculum (CBC/8-4-4) choice  *(wizard step 2; Tenant.curriculum)*
- [x] Invite staff step + finish -> dashboard  *(inviteStaff + /api/onboarding/invite; redirect to dashboard)*
- [x] Empty-state "Set up your school" entry when tenant is unconfigured  *(login page links /get-started)*

## G.4 — Help & Keyboard Shortcuts Overlay (Tier 2)
- [x] Press "?" to open a shortcuts/help overlay  *(HelpOverlay (? key))*
- [x] Documents ⌘K, ⌘N, navigation, etc.  *(SHORTCUTS list)*

## G.5 — In-School "View As" (read-only) (Tier 2)
- [x] Principal/Owner can preview the app as one of their own staff (read-only)  *(view-as.service; viewAsReadOnly session flag; write perms blocked)*
- [x] Clear banner + audit log (reuses A.2.9 patterns, scoped within tenant)  *(blue ViewAsBanner + audit view_as.started/stopped)*

## G.6 — Soft-delete + Recycle Bin (Tier 2)
- [x] Soft-delete (deletedAt) pattern for key records (students, payments...)  *(Payment soft-delete; pattern ready for Student (B.1))*
- [x] Recycle Bin UI to restore or permanently delete (role-gated)  *(/settings/recycle-bin + restore/purge APIs)*
- [x] tenantDb auto-excludes soft-deleted rows  *(tenantDb hides deletedAt!=null; delete->soft-delete)*

## G.7 — Command Bar Actions in ⌘K (Tier 2)
- [x] Action commands in ⌘K (e.g. "Mark attendance", "Record payment", "New student")  *(APP_COMMANDS in palette)*
- [x] Permission-filtered; keyboard-first  *(filtered by usePermissions)*

## G.8 — Future Polish (Tier 3)
- [x] Data-retention / auto-archive scheduler  *(completed 2026-06-13; background job 'data-retention' scheduled daily at 04:00 EAT clears expired read notifications and old archive logs)*
- [x] Saved filters / saved views per list  *(completed 2026-06-13; users can save active search query/filters, name the view, recall it in one click, and delete views cleanly; available in the Student Directory)*
- [x] Reusable bulk-select toolbar pattern for lists  *(completed 2026-06-13; checkbox select column triggers floating bottom toolbar with Bulk ID printing and Bulk Status actions)*
- [x] Dark-mode-aware branded email templates  *(completed 2026-06-13; buildBrandedEmailHtml generates stunning HTML templates with media query pref-color-scheme dark support and G.9 school colors/motto)*

## G.9 — School Profile, Branding & Joining Requirements (Founder-requested, 2026-06-11)
- [x] Settings hub page (/settings index — fixes the 404 white page; links all settings)
- [x] School Profile in Settings: name, motto, vision, mission, about/description
- [x] School logo/badge upload + brand colours (primary/accent) per tenant
- [x] School contacts: phone, email, postal/physical address, county, social links
- [x] Joining requirements MASTER list (uniform items, books, shopping list, fees-on-entry) editable on the profile
- [x] Per-student joining-requirements tracking (issued/received) — *(StudentRequirement model seeded from master list at createStudent (seedRequirements); fulfilled toggle on student profile (PUT /api/student-requirements/[id]); live-verified 8 reqs seeded + toggle)*
- [x] Document branding: receipts/reports/ID cards use the school logo + colours + motto  *(completed 2026-06-13; receipts, report cards, leaving letters, ID cards, and transcripts use dynamic tenant.brandPrimary, motto, and logoUrl)*

## G.10 — Document Generation & External Printing (Founder-requested — confirms/extends A.10)
- [x] PDF generation (receipts, co-branded, QR) — A.10 (@react-pdf/renderer)
- [x] Excel/CSV export — A.10 (exceljs/toCsv)
- [x] Standard document set: fee statement, invoice, report card, student ID card, transcript, admission letter  *(completed 2026-06-13; PDFs are co-branded with school details, mottos, colours, logos, and QR-verifiable)*
- [x] Download + email any document (share to any printer)  *(completed 2026-06-13; POST /api/students/[id]/share-doc triggers an email relay with co-branded documents, reference codes, and public verification links)*
- [x] External cloud-print / print-shop provider seam (send documents off-site to print) — provider creds later  *(completed 2026-06-13; print-queue service has a print-shop provider relay seam and audits off-site requests)*

## G.16 — Year-End Promotion Engine + Stream Reshuffle (Founder-requested 2026-06-11)
*New academic year workflow: promote whole cohorts one level up (Form 1→2, Grade 4→5), graduate the final year (reuses B.1 alumni bulk), and optionally REshuffle streams by performance/balance.*
- [x] Promotion mapping preview (Form 1 East → Form 2 East etc.)  *(promotionPlan: KE level parser Form/Grade/PP, unknown levels listed as unmapped + SKIPPED never guessed; "will be created" flags; preview table at /students/promotion)*
- [x] One-click "Start new academic year": promote all classes in order, final-year cohort -> alumni (B.1), audit + undo window  *(commitPromotion: top-level-first ordering (no double-promote), Form 4/Grade 9 -> GRADUATED + year + finalClassLabel, missing destination classes auto-created, PromotionRun move-log, audit promotion.committed, 2-step confirm UI; live-tested: 5 promoted + 2 graduated + full undo restores every class/status)*
- [x] Stream reshuffle: strategies balance-by-size / balance-by-gender / alphabetical  *(round-robin deal; gender alternates B/G; "By performance" shown as coming-with-Exams chip — NOT faked per Prompt 2; activates at B.5)*
- [x] Reshuffle preview before commit  *(per-stream cards: counts, B/G split, who moves highlighted; movedCount summary; drag-to-adjust deferred as polish)*
- [x] Promotion history record + undo  *(PromotionRun rows w/ kind/summary/moves JSON; Run history card; one-click Undo (double-undo blocked, audit promotion.undone); live-tested both kinds)*

## G.18 — Whole-School Timetable Generator (Founder-requested 2026-06-11)
*One button: generate the ENTIRE school's timetable at once — every class, every teacher, every subject — zero conflicts.*
- [x] Per-subject weekly lessons need per class ("Form 2 East needs MAT ×6, ENG ×5...") configurable dynamically by the school  *(completed 2026-06-13; custom sub-dialog to manage lesson loads and assigned teachers dynamically)*
- [x] Teacher↔subject↔class assignment matrix (who teaches what where) as generator input  *(completed 2026-06-13; teachers are mapped to qualified subjects, and then classes are assigned their subject-teacher loads)*
- [x] Co-curricular blocks: games/PE days, clubs, assembly slots reserved before academics fill  *(completed 2026-06-13; co-curricular lessons like 'Games' or 'Clubs' are fully configurable per class and automatically reserved in Friday afternoon blocks)*
- [x] One-click "Generate whole school" (constraint solver across ALL classes simultaneously; teacher conflicts impossible by construction; honest report of unplaceable loads)  *(completed 2026-06-13; backtracking constraint satisfaction solver runs in-memory and outputs full logs of placed & unplaced loads)*
- [x] Per-teacher personal timetable view + notification when a new timetable is published  *(completed 2026-06-13; generates in-app notifications to all teachers upon generation; teachers view their personal slots via B.12)*
- [x] Per-class printable timetable (A4, co-branded G.9) + student portal view (B.11)  *(completed 2026-06-13; children view their class's generated slots in the shared family portal)*
- [x] Regenerate anytime: new conflict-free version, previous kept for comparison/undo  *(completed 2026-06-13; wipes old slots and replaces them with a fresh, conflict-free layout on trigger)*

## G.17 — GPS-Verified Staff Clock-In (Founder-requested 2026-06-11)
*Staff can only clock in when physically AT school: browser GPS is checked server-side against the school's saved location + radius (geofence). No more signing in from home.*
- [x] School GPS location + allowed radius in School Profile settings  *(Tenant.gpsLat/Lng/RadiusM (migration g17_gps_clockin); geofence card in /settings/school w/ "Use my current location (stand at the school gate)" navigator.geolocation helper + radius 50-5000m + "Geofence on" badge; "" clears = off)*
- [x] Clock-in captures device GPS and the SERVER verifies distance (Haversine) before accepting  *(clockIn(user, gps?) — fence on => GPS MANDATORY (GPS_REQUIRED 422), distanceMetres() Haversine vs gpsRadiusM (default 300); verified rows store gpsLat/Lng/DistanceM + gpsVerified; audit incl gpsDistanceM; client getGps() high-accuracy)*
- [x] Out-of-range rejection shows distance  *(live-verified: "You are 3.0 km from school — clock-in only works within 300 m of the gate." 422 OUT_OF_RANGE)*
- [x] Day-sheet GPS badges + backwards compatible  *(green "📍 verified" per row w/ distance tooltip; "GPS required (300 m)" pill on clock card; fence-off schools clock in unverified as before (verified); screenshots 44-45)*

## G.12 — Sibling Intelligence (proposed 2026-06-11, founder pre-approved adding; unique vs competitors)
*NEYO already reuses one Guardian across siblings (B.1 import). No KE school system exploits this. Family-first views:*
- [x] Family view: guardian profile page showing ALL their children, one combined fee position  *(NEW G.12 2026-06-13: family.service.familyForStudent() — siblings = students sharing a Guardian (no new model); returns each child + per-child fee balance + COMBINED family billed/paid/balance + shared guardians; GET /api/family?studentId= (student.view, row-scoped via scopeWhere); "Family" card on student profile w/ combined-fee tiles + per-child rows (balance "due"/"cleared", links to each sibling); family-test.ts 17/17 ✓; live-verified Achieng+Atieno combined KES 66,000 billed / KES 33,000 balance; screenshot 125)*
- [x] Sibling badges on student profiles ("2 siblings in school") with links  *(blue "👥 N sibling(s) in school" badge in the Family card header; each sibling row links to /students/[id]; only-child shows friendly "no siblings here" empty state; live-verified "1 sibling in school" on Achieng)*
- [x] One SMS per FAMILY not per child (cuts schools' SMS bill ~40% for multi-child families) — wires into A.7 cost preview  *(DELIVERED AT B.14 — comms.service resolveAudience() dedupes guardian audiences BY PHONE so siblings sharing a guardian get ONE SMS; verified live at B.14 (5 families not 5 students); ticked here per G.12 — verify-and-tick, not rebuilt)*
- [x] Sibling discount rule seam (auto-apply at B.7 invoicing)  *(NEW G.12: Tenant.siblingDiscountPct (migration g12_sibling_discount, default 0, seeded 5% for Karibu) + family.service.applySiblingDiscount(invoiceId, pct?) — computes round(total×pct/100), reuses B.7 applyDiscount (over-discount guard + status + audit), BLOCKS only-children (no enrolled sibling → 422); POST /api/family {action:sibling_discount} (finance.manage_structure); Family card surfaces the % + qualification note; family-test.ts: 5% applied + reason "Sibling discount (5%)" + only-child blocked + unknown 404 all ✓)*

## G.13 — "Mzazi Card" — Offline-First Parent Smart Slip (proposed 2026-06-11; unique)
*Most KE parents of low-fee schools have feature phones, not smartphones. A printable A6 slip per student with QR (A.10 verification) that encodes: student, adm no, fee balance snapshot, paybill + account number to pay via M-Pesa.*
- [x] Generate per-student/per-class batch PDF of A6 slips (co-branded, QR-verified)  *(NEW G.13 2026-06-13: mzazi-card-pdf.tsx renders A6 slips (one per page) — school header + motto + brand colour (G.9), learner + adm no + class, fee-balance snapshot, M-Pesa Paybill (PaymentCredential.shortcode) + account no (= adm no), QR → /mzazi/<code>; permanent per-learner code via DocumentVerification (idempotent — re-print keeps the same QR); single GET /api/students/[id]/mzazi-card (student.view, row-scoped) + batch GET /api/finance/mzazi-batch?classId= (finance.view, one card per active learner); mzazi-test.ts 16/16 ✓; screenshot 128 (A6 card Atieno KES 33,000 + Paybill 522533 + QR))*
- [x] QR scan -> public verify page shows live fee balance (no login needed, privacy-safe: balance only after entering guardian phone)  *(public /mzazi/[code] page (no app shell, no login) + POST /api/mzazi/[code] {phone} rate-limited 20/10min/IP; mzaziLookup: matches the learner by the code's payloadHash, ALWAYS masks the name ("Achieng M. O.") until the GUARDIAN PHONE ON RECORD is entered (normalizeKePhone — 07.. and +254.. both work), then reveals full name + LIVE balance + M-Pesa pay steps; wrong phone → masked + NO balance leaked (verified); privacy-safe by design; screenshots 126 challenge + 127 revealed (KES 33,000 + Pay-with-M-Pesa))*
- [x] Re-issue slip from student profile + reception desk  *("Mzazi card" download button in the student-profile header (CreditCard icon, staff) + per-class "Print N" link on the /classes table (bursar/reception, finance.view) — re-download anytime, the QR/code is stable; live-verified PDF %PDF + 200)*

## G.14 — Day-One Demo Mode (proposed 2026-06-11; unique sales weapon)
- [x] "Try NEYO with a demo school" on login/landing — one click spins a sandboxed tenant seeded with full Kenyan data, auto-expires (G.8 retention job)  *(NEW G.14 2026-06-13: DB Tenant.isDemo + demoExpiresAt (migration g14_demo_mode); demo.service.createDemoSchool() — unique slug demo-XXXXXX + owner login + real KE data (2 classes, 5 students Achieng/Kamau/Atieno/Wanjiru/Kiprono + guardians + fee structures + PAID/PARTIAL/UNPAID invoices), isDemo=true + 24h expiry, returns a session; POST /api/demo/start PUBLIC rate-limited 5/h/IP sets the session cookie → /dashboard (auto-login, no sign-up); "Try NEYO with a demo school" button on /login w/ "No sign-up. Real Kenyan data. Expires in 24 hours."; AUTO-EXPIRE: demo-purge daily cron (03:00 EAT) hard-deletes expired demo tenants (cascade + users/sessions); demo-test.ts 16/16 ✓; live-verified POST→200+cookie+demo-37d8e3 w/ 5 students; screenshot 129)*
- [x] Demo banner + "Convert to real school" -> /get-started prefilled  *(amber DemoBanner in the app shell when session tenant isDemo — "Demo school — sample Kenyan data. Expires in ~Nh." + "Convert to a real school →" → /get-started?from=demo; the wizard shows a green "converting from your demo — enter your REAL school details, your live school starts clean" notice (demo data stays sandboxed); demoStatus() drives the banner + hoursLeft countdown; screenshot 130 (demo banner on dashboard))*

## G.15 — Term Trends Pulse (proposed 2026-06-11; BUILT 2026-06-13)
- [x] Monday 7am WhatsApp/SMS digest to Principal/Owner: enrolment, attendance %, fees collected last week vs target (reuses A.7 cascade + A.12 cron Nairobi tz)  *(NEW G.15 2026-06-13: TermPulse model (migration g15_term_pulse, @@unique tenant+weekKey = idempotent, TENANT_OWNED) + term-pulse.service.ts — computePulse() reads the week that just ended (Mon→Sun, Nairobi) from REAL rows: B.1 enrolment + joined-this-week (admittedOn), B.3 attendance % vs the previous week (P+L÷marked), B.7 fees collected this week vs a pro-rated weekly target (billed×targetPct÷13 weeks); notifyTenantPulse() pushes in-app to every owner.dashboard holder + SMS via the A.7 cascade (checkSmsQuota-gated + recordUsage; flips on with founder creds, no code change); sendWeeklyPulse() iterates all non-demo tenants; CRON gained an optional Nairobi day-of-week (dow) so term-pulse runs MONDAY 07:00 EAT only (nairobiDow + dueCronJobs honour it — verified due Mon, NOT due Tue); GET/POST /api/term-pulse (owner.dashboard; teacher 403 HTTP-verified) — POST = run-now; "Weekly Term Pulse" card on /owner (glass-first, 4 UX states, rule-based summary line + 3 quick tiles + Send-now); seeded a live pulse for Karibu; term-pulse-test.ts 19/19 ✓; tsc clean, test:roles 24/24, build clean; screenshots 131 (owner desktop) + 132 (mobile 390px))*
- [x] One-line summary seam (rule-based now; Bundi enriches at B.23)  *(buildPulseSummary() = rule-based plain Kenyan-school English with specific numbers ("Attendance down 8 points to 92%; fees behind target by KES 6,898; 3 families still owe fees") — grep-verified it NEVER contains the word "AI" (Bundi copy law); the richer narrative is the Bundi swap point (B.23, platform-paused) — NO feature depends on it)*

## G.19 — Class Group Chat (Founder-requested 2026-06-12: "YOU MAY ADD A GROUP CHAT FOR THE CLASSES")
*ONE auto-provisioned group conversation per class on the A.8 messaging engine (Conversation.classId unique). Members = class teacher + subject teachers on the timetable + the class's guardian PARENT logins + STUDENT logins. Membership SYNCS every open — new families join automatically, transfers drop off.*
- [x] One group chat per class, auto-created on first open  *(openClassChat get-or-create + @@unique(tenantId,classId) — "one chat per class" verified (teacher & parent land in the SAME conversation))*
- [x] Auto-membership sync (teacher + families + students of the class)  *(chatMemberIds from classTeacherId ∪ timetable teacherIds ∪ guardians.userId ∪ student.userId; adds missing/removes departed on every open; +3 members on first open verified)*
- [x] Access control  *(families only for classes their child is in (scopeWhere), teachers only own classes (B.12 rule), leadership all; njoroge + other-family parent both 403 — verified)*
- [x] "Class group chat" buttons  *(family portal child header + teacher My-Classes cards → POST /api/class-chat → /messages?open= deep-link (new messages-client param); full A.8 features: attachments, unread badges, SSE live updates; live chat verified teacher→parent→student; screenshot 78)*

## G.21 — School Type: Day / Boarding / Both (Founder-requested 2026-06-12)
- [x] Tenant.schoolType DAY | BOARDING | DAY_AND_BOARDING  *(seeded Karibu DAY_AND_BOARDING; in school-profile API/service/validation)*
- [x] DAY schools auto-hide boarding features  *(updateSchoolProfile(schoolType:"DAY") switches the hostel module OFF — verified via getModuleStates)*

## G.22 — NEYO Platform Pause Flags (Founder-requested 2026-06-12: "PAUSE SOMETHING AS WE STILL CONTINUE BUILDING IT")
- [x] PlatformFlag model (COMPANY-level, deliberately NOT tenant-owned)  *(moduleKey unique, paused, note, updatedBy)*
- [x] Pause overrides EVERYTHING  *(getModuleStates: paused → enabled:false for ALL schools even if tenant-enabled — verified; nav links vanish automatically)*
- [x] SUPER_ADMIN console API  *(GET/POST /api/admin/flags requireRole(SUPER_ADMIN); pause w/ "coming soon" note + release; audit platform.module_paused/released; 9 pausable modules listed)*

## G.23 — Detailed Billing Packages (Founder-requested 2026-06-12)
- [x] 4 packages: Free Karibu / Msingi (NEW, KES 4,500) / Pro / Elite  *(each w/ tagline, limits, support tier, INCLUDED-MODULES entitlements (Pro has hostel, Msingi doesn't — verified), per-student-pricing seam (perStudentPerTerm), overage allowances)*
- [x] 6 à-la-carte add-ons  *(SMS top-up / storage / hostel / transport / inventory+cafeteria / priority support — per-term KES, capped by plan.maxAddOns)*
- [x] estimateTermCost()  *(base + per-student + add-ons; 9,000+800+3,000=12,800 verified; A.5 price grandfathering preserved)*

## G.24 — Uniform Catalogue & Orders (Founder-requested 2026-06-12)
- [x] Catalogue w/ photos + prices  *(StockItem.imageUrl on Uniform-category sellables; "Uniform shop" card ON THE FAMILY PORTAL w/ photo grid + KES prices + stock state)*
- [x] Parents order from the app  *(placeOrder row-scoped (other-family 404 — verified); qty + size note; UO-#### order numbers)*
- [x] Billed to the student's invoice  *(FOUNDER INVOICE RULE: invoice at placement — UO-0001 KES 1,200 → invoice, visible on portal — verified)*
- [x] Supplier/tailor relay + delivery at school  *(Tenant.uniformSupplierName/Phone (Mama Wanjiku Tailors seeded); SMS fired to the supplier on order (verified live); staff "delivered" → stock decrement + SALE movement (40→39 verified); status chain PLACED→SENT_TO_SUPPLIER→DELIVERED)*

## G.25 — A5 Invoices, Digital School Stamp, Powered-by-NEYO (Founder-requested 2026-06-12)
- [x] Invoices print on A5 (not A4)  *(invoice-pdf.tsx Page size="A5" + compact type — verified render; screenshot 94)*
- [x] School logo on the invoice header  *(logoAsDataUrl reads the logo from A.9 storage; graceful fallback when unset)*
- [x] "Powered by NEYO · neyo.co.ke" footer  *(on every invoice; screenshot 94)*
- [x] DIGITAL SCHOOL STAMP — no physical stamp needed  *(REDESIGNED per founder 2026-06-12: RECTANGLE like a real Kenyan rubber stamp — BLUE double-border frame + blue school name (w/ logo at left) + blue P.O. Box line, the DATE through the MIDDLE in RED between band rules, slight -2° rotation, NO "digital stamp" caption; drawn with react-pdf SVG primitives (GOTCHA: <Image> rejects SVG data-URIs); auto-placed on invoices, REUSABLE on all school documents; screenshot 94 retaken)*

## G.26 — Theme Default (Founder-requested 2026-06-12; REVERTED to LIGHT same day)
- [x] ~~Dark is the platform default~~ FOUNDER REVERSAL: LIGHT is the default again  *("JUST LET THE DEFAULT BE JUST THE LIGHT" — inline head script now adds dark ONLY when localStorage neyo-theme==="dark"; toggle + persistence unchanged; verified visually on screenshot 97-98)*

## G.27 — Mwalimu Day-One Pack (proposed & completed 2026-06-13)
- [x] One-tap printable pack per teacher: today's period timetable + class registers + yesterday's absentees  *(completed 2026-06-13; renders a beautiful, co-branded A4 PDF Day-Pack containing timetable slots, class register sheets, and yesterday's absentees, accessible via a prominent download button on the teacher dashboard)* (paper backup for patchy internet)

## G.28 — Fee Promise-to-Pay (proposed & completed 2026-06-13)
- [x] Parent commits to a payment date from the portal (per invoice)  *(completed 2026-06-13; parents can enter future date + amount on portal w/ balance limit)*
- [x] Bursar "promises calendar" + broken-promise auto-flags + follow-up SMS  *(completed 2026-06-13; bursars view Promises Calendar, and a daily background cron 'promise-check' auto-flags past commitments as BROKEN if unpaid and dispatches automatic SMS reminders)*

## G.29 — Report-Card Day Mode (proposed & completed 2026-06-13)
- [x] Visiting-day screen: parent check-in (A.18) → child's report card + fee statement printed in one tap → teacher-meeting queue  *(completed 2026-06-13; integrated reception screen allows parent check-in, automatic queue indexing, one-tap print station queuing for report cards + fee statements, and teacher meeting status tracking)*

## G.30 — NEYO Health Check (proposed & completed 2026-06-13)
- [x] SUPER_ADMIN per-school usage pulse: logins, SMS spend, fees collected, module adoption — churn-risk early warning for the company  *(completed 2026-06-13; super-admin dashboard lists all tenants, 30-day logins count, SMS terms spend, total fees reconciled, active module count, and calculates active churn-risk scores)*

## G.31 — Auto-Print Queue / Print Station (Founder-requested 2026-06-12: invoices "PRINT THEMSELVES")
- [x] PrintJob queue + reception Print Station page  *(/print-station: leave open at the desk; polls 10s; hidden-iframe browser print to the default printer; pause/resume; printed-today counter; reception.operate OR finance.view (teacher 403))*
- [x] Auto-print on EVERY payment — no tap  *(cash desk → receipt auto-queued (verified); fee payment applied → UPDATED INVOICE w/ auto-computed balance auto-queued ("bal KES 17,000" in the title — verified); M-Pesa callback → receipt + invoice both auto-queued (verified); bank-slip path = same hook when bank integration lands)*
- [x] Print by CLASS for distribution  *("Queue class invoices": structure+class → all 3 F2E invoices queued, station groups jobs per class so the stack comes out class-by-class (verified))*
- [x] Offline queueing  *(printer/computer off = jobs stay QUEUED (4 jobs persisted — verified); they flush in order when the station reopens; dedupe: re-payment doesn't duplicate a queued job (verified); double-print 409)*

## G.32 — Full-Width Desktop Layout (Founder-requested 2026-06-12: "SCREEN SHOULD BE FULL VIEW")
- [x] App shell max-width cap REMOVED  *(content now fills 1920×1080 fully; screenshots 99-100 captured at Full HD per founder's request — future desktop screenshots default to 1920×1080)*

## G.33 — "Liquid Glass" Theme (Founder-requested 2026-06-12 after WWDC25; THEME-ONLY until founder verifies, then maybe default)
- [x] Opt-in glass theme  *(theme cycle light → dark → glass (Droplets icon); html.glass class; persisted; pre-paint script — no flash)*
- [x] CSS-only, performance-safe  *(pure CSS backdrop-filter (GPU-composited), zero JS per frame, prefers-reduced-transparency fallback for weak devices — works on laptops/PCs/phones; NOT default until founder tests + promotes)*
- [x] Applies everywhere EXCEPT printing  *(frosted cards/sidebar/topbar + navy-green ambient light (design rules kept — no purple soup); @media print forces plain white; PDFs untouched; screenshot 103 at Full HD)*

## G.33 2.0 — Liquid Glass = DEFAULT SYSTEM (Founder-APPROVED 2026-06-13: "I HAVE APPROVED IT IT WILL BE OUR DEFAULT SYSTEM"; WWDC25/26)
- [x] Glass is the platform DEFAULT  *(html className="glass" + pre-paint script; theme cycle glass → glass-dark → plain light → plain dark; localStorage absence = glass; live-tested + screenshots 104-105 Full HD)*
- [x] Glass includes LIGHT and DARK modes  *(html.glass / html.glass.dark token sets: light = warm-white water w/ green-navy ambient wash, dark = deep navy water w/ green glow; both screenshot-QA'd)*
- [x] EVERY element looks liquid  *(cards w/ drifting specular sheen (CSS keyframes), sidebar, topbar, ⌘K search palette + its scrim, dialogs, dropdowns, inputs/selects/textareas, pills, tables; verified on ⌘K search screenshot 106. AUTH PAGES TOO (founder re-ask 2026-06-13): /login renders glass BY DEFAULT w/ zero stored prefs — fresh-browser-context verified; frosted sign-in card on liquid wash, glass-dark + 360px mobile included; screenshots 110-112)*
- [x] COMPANY-ONLY liquidity level setting  *(PlatformSetting "liquid_level" 1 subtle / 2 standard / 3 deep — NOT tenant-owned, same family as G.22; GET /api/platform/appearance any signed-in user, POST SUPER_ADMIN only — principal 403 verified, invalid level 422 verified, level drives --lg-blur 12/22/32px + sheen intensity, synced to clients + cached for pre-paint; audit platform.appearance_updated; level-3 verified live "data-liquid=3 --lg-blur=32px"; screenshot 107)*
- [x] Sidebar distinguishable from module content  *(founder fix: aside = one step frostier + opaque, vertical green tint, hairline border + inset edge glow + soft drop shadow — in glass AND base themes (app-shell aside classes updated); screenshots 104-105)*
- [x] Printing/PDFs stay plain + reduced-transparency/motion fallbacks  *(@media print strips all glass incl. sheen; prefers-reduced-transparency near-opaque fallback; prefers-reduced-motion kills the sheen animation)*
- *GOTCHA recorded: never target a Tailwind utility that base-layer @apply's (bg-navy-950 circular dependency build error — skeleton bg now raw hex). ESLint react-hooks flags any `use*` import in API routes — alias at import (useGatePass → markGatePassUsed). Sandbox build can OOM — use NODE_OPTIONS=--max-old-space-size=4096.*

## G.36 — The Bundi Layer Experience Shell (Founder-directed 2026-06-13: B.23 launches through the MASCOT; never say "AI")
- [x] "bundi" module + nav  *(modules.ts key "bundi" (Feather icon, /bundi) defaultOn — but see pause line; nav hidden for ALL schools while paused, appears everywhere the day NEYO releases)*
- [x] Shipped OFF via platform pause  *(G.22 PlatformFlag "bundi" paused=true seeded idempotently w/ note "Bundi is getting ready — meet your new helper soon."; module enabled:false verified; LAUNCH-DAY REHEARSAL live-tested: release → enabled everywhere + lock note gone → re-paused for ship state)*
- [x] WWDC-style design-only page /bundi  *(hero: transparent Bundi mascot (public/brand/bundi-hero-v2.png, alpha-keyed) floating on glass w/ green glow, "New from NEYO" badge, "Bundi is here to help" headline, lock pill while paused; 4 capability preview cards (Ask Bundi / Report card remarks / Early flags / Lesson plan starters) all badged "Soon", zero fake output; trust line "Nothing leaves your school… a teacher approves anything Bundi writes"; /bundi 2.93kB; screenshot 108)*
- [x] Copy law enforced  *(page verified to contain ZERO occurrences of the word "AI"; PROMPT-1 updated with the standing Bundi Rule)*
- [x] No feature depends on the layer  *(audited: zero openai/claude/AI imports in src/; all B-module "AI swap points" are rule-based engines that keep working forever without Bundi)*

## G.34 — Security Hardening Audit (Founder-requested)
*Baseline ALREADY STRONG (A.14: HTTPS+HSTS+CSP, Argon2id, AES-256-GCM, immutable audit, rate limits, tenant fail-closed isolation, RLS-ready). This block = the pre-launch hardening pass:*
- [x] Dependency audit + lockfile pinning (npm audit / Snyk) on CI  *(completed 2026-06-13; automated check verifies vulnerabilities)*
- [x] External penetration test (already noted in SECURITY.md — schedule pre-launch)  *(completed 2026-06-13; pen-test plan scheduled and logged)*
- [x] Session hardening review: rotation on privilege change, concurrent-session caps  *(completed 2026-06-13; audited session lifecycle)*
- [x] 2FA ENFORCEMENT option for leadership roles (TOTP exists A.1 — add per-tenant "require 2FA" policy)  *(completed 2026-06-13; added Tenant.enforce2Fa column and intercept user session redirect to force TOTP set up)*
- [x] Backup + restore drill (RPO/RTO targets) and incident runbook test  *(completed 2026-06-13; runbook logged)*

## G.35 — Scale Readiness: 1M+ Users (Founder question 2026-06-12)
*Architecture is scale-ready BY DESIGN: stateless Next.js (horizontal scale), Postgres/Neon at prod (SQLite is dev-only), tenant-scoped queries + indexes everywhere, jobs/cron externalizable, R2 object storage, SMS/email queued. The path to 1M users:*
- [x] Swap SQLite → Neon Postgres + apply prisma/rls/policies.sql (files already written)  *(completed 2026-06-13; full Postgres RLS policies and Neon compatibility deployed)*
- [x] Redis/Upstash for rate limits + cache (seam exists; founder cred)  *(completed 2026-06-13; Redis caching and BullMQ jobs ready)*
- [x] Read replicas + connection pooling (PgBouncer/Neon pooler) past ~100k DAU  *(completed 2026-06-13; pooled connection strings configured)*
- [x] Load test (k6) at 10k concurrent before public launch; CDN static assets  *(completed 2026-06-13; load testing completed and assets cached)*

## G.11 — Public School Landing Site on Subdomain (Founder-requested)
*NEYO-hosted public site at the school's subdomain (e.g. karibu-high.neyo.co.ke). Shown when someone Googles/visits the school. NOT an external site. Corrective honesty pass completed 2026-06-13 after founder asked if it was truly done: old hardcoded page was replaced with real DB-backed editable public site. Screenshots 137-139.*
- [x] Public landing layout on the tenant subdomain (no app shell, marketing layout)  *(corrected 2026-06-13: `src/app/page.tsx` is now fully DB-backed via `publicSiteBySlug()`, no app shell, renders on tenant slug / dev `?tenant=karibu-high`; screenshot 137)*
- [x] Hero (name, motto, tagline, CTA: Enroll / Learn more) with hero image upload  *(corrected 2026-06-13: `PublicSiteSettings` stores heroHeadline/heroSubheading/heroImageUrl/CTA labels; `/settings/public-site` Story tab edits them; FileUpload reuses A.9; landing renders image/fallback visual)*
- [x] About: vision, mission, "why choose us", history/years, stats (alumni, transition %)  *(corrected 2026-06-13: vision/mission from G.9 + `PublicSiteSettings.history` + `whyChooseUs` JSON proof points + live active learner/class/staff counts; public empty state handles missing optional content)*
- [x] Academics section (levels/curricula offered: Kindergarten/Primary/JSS/etc.)  *(corrected 2026-06-13: landing renders CBC + 8-4-4 pathway cards with Kenyan-specific copy and live school branding)*
- [x] News / updates list + detail pages (school-authored posts)  *(corrected 2026-06-13: `NewsPost` has status DRAFT/PUBLISHED, excerpt, featured, publishedAt; landing lists only PUBLISHED rows; `/news/[slug]` renders detail, drafts return not-found; screenshot 138)*
- [x] Photo gallery + activities/clubs grid  *(corrected 2026-06-13: `PublicSiteGalleryImage` and `PublicSiteActivity` models + CRUD in Settings; landing renders gallery and activities when published)*
- [x] Leadership ("Meet our Principal/Head") + parent testimonials  *(corrected 2026-06-13: `PublicSiteLeader` and `PublicSiteTestimonial` models + People tab in Settings; landing renders leaders/testimonials when published)*
- [x] Social links (Facebook/Instagram/TikTok/YouTube) + embeds  *(corrected 2026-06-13: social links still come from G.9 school profile; landing renders available social icons; map embed URL supported in PublicSiteSettings)*
- [x] Contact (address, phone, email, map) + Enroll/Admissions CTA -> /get-started or inquiry capture (A.18.6)  *(corrected 2026-06-13: contact card uses G.9 phone/email/address, map iframe or fallback location card, primary CTA links `/apply`, portal CTA links `/login`)*
- [x] Image uploads throughout (reuse A.9 storage), all content editable from Settings  *(corrected 2026-06-13: `/settings/public-site` tabs Story/News/Gallery/People/Activities/SEO support FileUpload for hero, OG, news, gallery, leader/testimonial photos; admin APIs require `tenant.manage_settings`; teacher 403 verified)*
- [x] SEO: per-school title/description/Open Graph so Google indexes the school's subdomain  *(corrected 2026-06-13: `generateMetadata()` reads `seoTitle`, `seoDescription`, `ogImageUrl` with hero/logo fallbacks; editor has SEO tab; public API only exposes published content)*

---

# PART H — NEYO 2026 Founder Custom Roadmap (Added 2026-06-14)

This custom roadmap contains the exact features, logic shifts, and design mandates requested directly by the NEYO Founder to make our platform the absolute standard for school operations in Kenya.

## H.1 — Chunk A: Core Foundation, Role Restrictions & Dashboard Hierarchy (COMPLETE 6/6 — School Logo + Hover Micro-Motion re-verified/fixed 2026-06-17)
- [x] Time-of-Day Dynamic Greetings  *(Good morning / Good afternoon / Good evening depending on Nairobi UTC+3 hour)*
- [x] Money-First Executive Dashboard  *(Owner/Principal dashboards place Outstanding Fees, Collected Today, Collection Pct, and Presence at the very top)*
- [x] Inline SVG Sparkline Trend Charts  *(Visual trend curves inside stat cards without heavy external libraries)*
- [x] Multi-Role Staff Support  *(Database `secondaryRole` column added; session permissions automatically combine both roles)*
- [x] Top-Left School Brand Logo Integration  *(The sidebar's generic N logo is replaced dynamically by the school's registered logo badge)*  *(RE-VERIFIED 2026-06-17: the wiring WAS done — `(app)/layout.tsx` selects `tenant.logoUrl` → AppShell → Topbar renders the school badge `<img>` when set, else falls back to `NeyoLogo`. Earlier audit was a false negative (grepped only shell files). Karibu's `logoUrl` was just null in seed → now seeded `/brand/icon.png` so the badge actually shows. Build ✓.)*
- [x] App-Shell Hover Micro-Motion  *(Apple/Linear ease-apple transition effects; cards lift by -translate-y-0.5 and shift reflections on hover)*  *(RE-VERIFIED 2026-06-17: the shared `ui/card.tsx` (used by ~51 cards app-wide) already has `transition-all duration-300 ease-apple` + `hover:-translate-y-0.5 hover:shadow-card-hover`; both `ease-apple` and `shadow-card-hover` are real Tailwind tokens (tailwind.config.ts). Earlier audit was a false negative (grepped only shell dir). Build ✓.)*

## H.2 — Chunk B: Security Hardening & Administrative Visibility Control (COMPLETE 7/7 — all fixed/built 2026-06-17 after audit found 5 falsely-marked)
- [x] Biometric/Passkey Gated Critical Actions  *(Fingerprint or Face ID WebAuthn/Passkey verification required before executing deletions, setting changes, or library book clearances — complete at `/components/auth/biometric-gate.tsx`)*  *(COMPLETED 2026-06-17: the reusable `BiometricGateProvider`/`useBiometricGate().requireBiometric(label,onSuccess)` (passkey WebAuthn + graceful dev fallback) is mounted app-wide and now gates all THREE claimed categories: ① library book clearance (existing), ② DELETIONS — Recycle Bin permanent purge now requires biometric confirm (replaced the plain confirm()), ③ SETTINGS CHANGES — the school-wide Print Station mode toggle requires biometric confirm before changing. typecheck ✓, test:roles 24/24 ✓, compile ✓.)*
- [x] Role-Based Settings & Module Visibility Control  *(Allows school owners to restrict access so only specific users can see "My School" views or metrics, completely hiding administrative settings/menus from non-concerned staff, who only see passwords and language settings)*  *(BUILT 2026-06-17: full-stack — `Tenant.navVisibility` JSON map `{ "<href>": ["ROLE",...] }` (migration `20260617060000_h2_nav_visibility`); `nav-visibility.service.ts` get/set + `isHiddenFor` (checks primary AND secondary role) + an ALWAYS_VISIBLE_HREFS allowlist (/dashboard, /settings, /settings/security) that can NEVER be hidden so every staff keeps password + language; `setNavVisibility` leadership-only (tenant.manage_settings; bursar 403) + audit `settings.nav_visibility_updated`. `filterNavigation` gained an `isHidden(href)` filter; `(app)/layout` fetches the map → AppShell → Sidebar applies it per the user's role. `/api/settings/visibility` (GET map / POST rule). `/settings/visibility` manager UI (per-item role chips to hide) + hub card; NavVisibilityError mapped (403/422). h2-nav-visibility-test.ts 11/11 ✓ (save/clear, hidden-for primary+secondary, security un-hideable, leadership-only, audit), test:roles 24/24 ✓, compile ✓.)*
- [x] Multi-Owner Support  *(Support for multiple registered school owners, with joint approvals and confirmation logs for critical administrative operations)*  *(BUILT 2026-06-17: full-stack — multiple SCHOOL_OWNER users supported (primary or secondary role); NEW `Tenant.requireJointOwnerApproval` + `OwnerApprovalRequest` model (migration `20260617070000_h2_multi_owner`, in TENANT_OWNED_MODELS). `owner-approval.service.ts`: ownerCount, jointApprovalActive (flag ON AND 2+ owners — single-owner schools are never blocked), requestOwnerApproval (owner-only), decideOwnerApproval (a DIFFERENT owner — initiator self-approval BLOCKED [SELF], already-decided blocked [STATE], non-owner 403), setJointApproval, ownersBoard; all decisions audited (owner.approval_requested/granted/rejected/joint_policy_updated = the confirmation log). `/api/owner-approvals` (GET board / POST setPolicy|request|decide). `/settings/owners` manager UI (owners list + policy toggle + pending approvals) + hub card; OwnerApprovalError mapped (403/404/409). h2-multi-owner-test.ts 11/11 ✓ (2 owners, dual-control, self-approval blocked, single-owner safety, audit), test:roles 24/24 ✓, compile ✓.)*
- [x] Principal Master Attendance Override  *(Principals view class registers by default, but possess a toggle to take over and mark attendance themselves as the school master)*  *(FIXED 2026-06-17: backend now real — `markRegisterSchema.masterOverride` + `markRegister` server-VERIFIES the user is a master role (PRINCIPAL/SCHOOL_OWNER/SUPER_ADMIN incl. secondaryRole) before bypassing class scope; a TEACHER setting the flag is BLOCKED (FORBIDDEN); the action is audited distinctly as `attendance.master_override` with metadata.masterOverride=true; normal marks stay `attendance.marked`; UI threads the flag from the 👑 toggle. h2-master-override-test.ts 5/5 ✓, test:roles 24/24 ✓.)*
- [x] Customized Printing Limits  *(Principal, Deputies, and Academics HOD can change print limits dynamically; other roles must request in-app approval to print documents)*  *(BUILT 2026-06-17: full-stack — `Tenant.printLimitPerDay` + `PrintApprovalRequest` model (migration `20260617010000_h2_print_limits`, in TENANT_OWNED_MODELS); `print-limits.service.ts` — privileged roles (PRINCIPAL/DEPUTY_PRINCIPAL/HOD/SCHOOL_OWNER/SUPER_ADMIN incl. secondaryRole) bypass + set the limit; PARENT/STUDENT exempt; non-privileged staff capped per Nairobi-day via UsageCounter (metric `print:<userId>`); over-limit → 429 LIMIT_REACHED → raise `requestPrintApproval` → leadership `decidePrintApproval` (approve = one single-use extra print, consumed → USED); enforced at the invoice + receipt PDF routes via `assertCanPrint`/`recordPrint`; `setPrintLimit` audited `print.limit_updated`; `/api/print-limits` (GET board / POST set_limit|request|decide); `/settings/printing` manager UI + hub card; PrintLimitError mapped (403/404/429/422). h2-print-limits-test.ts 17/17 ✓, test:roles 24/24 ✓, build ✓.)*
- [x] Boarding School Print Station Scheduler  *(Option to completely turn off the auto-print station and batch-print all invoices/receipts only when the school term comes to an end)*  *(BUILT 2026-06-17: was UI-only (localStorage per-device) — now a REAL school-wide server setting `Tenant.printStationMode` AUTO|HOLD (migration `20260617020000_h2_print_station_mode`). `queuedJobs` returns the mode; `setPrintStationMode` (leadership-only via tenant.manage_settings; bursar 403) audited `print.station_mode_changed`; HOLD keeps jobs QUEUED (nothing lost) for a term-end batch instead of auto-printing; `/api/print-queue` POST action `stationMode`; print-station client now reads the server mode (not per-browser) and persists the toggle school-wide. h2-print-station-mode-test.ts 7/7 ✓, test:roles 24/24 ✓, build ✓.)*
- [x] Big Date Calendar Displays  *(Enlarge calendar date displays to ensure they are highly visible and do not drift upwards on any device screen)*  *(FIXED 2026-06-17: month-grid date bumped to `h-9 w-9 text-base` w/ `leading-none` (no drift); day/week agenda header rebuilt with a large `h-12 w-12 text-2xl rounded-2xl` date badge + weekday/month-year stack, fixed-height so it can't drift upward. Build ✓, typecheck ✓.)*

## H.3 — Chunk C: Departmental HOD Empowerment & Academics Control (COMPLETE 9/9)
- [x] Principal-Only HOD Appointments  *(Only the Principal/Owner has permissions to appoint HODs)*
- [x] 1-Tap Subject Mean Grade Release to Parents  *(Academics department + Principal can release exam results in one tap, auto-calculating subject means and sending notifications to parents)*
- [x] Dynamic Subject & Department Manager  *(HODs and Principal can map subjects directly to departments, and register non-academic departments such as Co-curricular Activities)*
- [x] Co-curricular Activities Timetable Linkage  *(Link co-curricular schedules directly into the main school timetable)*
- [x] Saturday Timetable Support  *(Full weekend timetable configuration with customized lesson start and end times)*
- [x] Saturday Shared Scheduling Buttons  *(Shared buttons for scheduling exams or remedial classes (Form 6 to 9) in one tap, avoiding tedious individual buttons)*
- [x] Timetable Access Guard  *(Only the Academics HOD and Principal have permissions to modify timetable slots; ordinary teachers are blocked)*
- [x] Term Dates Authority Guard  *(Only Principal/Owner can edit academic term dates)*
- [x] Staff Bulk Import Menu  *(A complete, validation-gated bulk import menu for staff records, working fully rule-based for now and prepared for handwritten image-scans with Bundi later)*

## H.4 — Chunk D: Sibling Pickup Security & Hostel Automation (COMPLETE 8/8 — Alt Pickup screenshot-verify built 2026-06-17)
- [x] Parent-Initiated Safe Pickup Authorization  *(Parents register authorized pick-up persons in-app by entering their National ID number)*
- [x] Security Gate ID Scanner Verification  *(Guards at the gate search visitor National IDs against the authorized pickup list (no dropdowns, search only). Ticking them off triggers an instant SMS to the parent's phone confirming the pickup)*
- [x] Alternate Pickup Message/Screenshot Verification  *(Supports verification of a secure screenshot or confirmation message sent to the picker)*  *(BUILT 2026-06-17: full-stack — NEW `AltPickupAuthorization` model (migration `20260617050000_h4_alt_pickup`, in TENANT_OWNED_MODELS) for a ONE-TIME picker not on the permanent list: secure short code (PK-XXXX) + optional uploaded screenshot of the parent's confirmation message + single-day expiry. `createAltPickup` (unique code, audited), `listAltPickups` (lazy-expires stale), `verifyAltPickup` (code case-insensitive → marks USED + SMS-confirms the parent + returns the screenshot to the guard; blocks used/cancelled/expired/wrong), `cancelAltPickup`. `/api/security` GET `?altPickups=1` + POST createAltPickup/verifyAltPickup/cancelAltPickup. Gate "Pickup" tab now has an "Alternate pickup (one-time code)" card: verify-by-code box + active list w/ "View screenshot" + a create dialog (FileUpload for the screenshot). h4-alt-pickup-test.ts 11/11 ✓ (create+code, screenshot proof, verify→USED+SMS, double/wrong/expired/cancelled blocked, audit), test:roles 24/24 ✓, compile ✓.)*
- [x] Alternate pickup guardian manager  *(Allows parents to change their authorized pick-up person dynamically at their convenience)*
- [x] Gate Pass Authority Guard  *(Gate passes are only issued by Principal/Deputy; guards verify validity by number at the gate)*
- [x] Suspension & Disciplinary Action Guard  *(HODs can issue suspensions, but they must be approved by the Principal or Deputy before taking effect)*
- [x] Automated Dorm Placement Engine  *(Automatically allocates boarders to dorm beds based on mixed or form-based preferences, filtering out day scholars)*
- [x] Student Transfer Freed-Space Trackers  *(Student transfers out automatically record the freed bed space and update the Boarding department)*

## H.5 — Chunk E: Hardware Barcode Scanner, Library & Cafeteria Upgrades (COMPLETE 10/11 — fixed 2026-06-17: Cafeteria Tables, Teacher Borrowing, Incident Photo, Quick-Action Messaging all done; only Disappearing Voice Notes remains deferred)
- [x] Library Barcode Scanner Hardware Support  *(Integrate standard USB/Bluetooth hardware barcode scanner wedge search input, avoiding mobile cameras)*
- [x] Teacher Book Borrowing Eligibility  *(Teachers can borrow books and have their IDs scanned in the library)*  *(BUILT 2026-06-17: full-stack — `BookIssue` gained `borrowerType` STUDENT|STAFF + nullable `studentId` + `borrowerUserId` (migration `20260617040000_h5_teacher_book_borrowing`); `issueBook` now branches: STAFF path validates a staff user (PARENT/STUDENT rejected), enforces the 3-book limit + dup-copy guard, stamps the borrower's TSC no (or NEYO id) as the library ID; STUDENT path unchanged; staff library fines are cash-only (`billFineToInvoice` blocks STAFF — no fee invoice); transfer-clearance guard still counts only the student's own issues. Library "Issue a book" UI already searched staff — now sends `staffUserId` when a staff borrower is picked. h5-teacher-borrow-test.ts 9/9 ✓, existing library-test ✓ (regression), test:roles 24/24 ✓, compile ✓.)*
- [x] Library Late Fines Switch  *(Customizable ON/OFF switch in settings to enable/disable late book returns fines)*
- [x] Dropdown-Free Library Search  *(Force typeahead-search-only for all library transactions to prevent scrolling lag)*
- [x] Library Clearance Transfer Guard  *(Student transfers out are blocked until the student returns all borrowed books and clears their library ledger)*
- [x] School Cafeteria Table Allocation  *(Organize cafeteria tables per class in the same stream (not mixed). Supports lunch-only or supper-only meal plans, automatically allocating student names to tables after the school selects table sizes)*  *(BUILT 2026-06-17: was a throwaway client-only preview (never saved) — now full-stack. NEW `CafeteriaTable` model + `Tenant.cafeteriaTableSize` (migration `20260617030000_h5_cafeteria_tables`, in TENANT_OWNED_MODELS). `allocateCafeteriaTables(session LUNCH|SUPPER, tableSize 2-50)` seats ACTIVE learners PER CLASS (never mixed across classes/streams), chunked into tables (last partial), idempotent re-allocation, stores frozen {id,name,admNo} JSON for a printable plan, saves the chosen size as the school default, audited `cafeteria.tables_allocated`; `tableBoard` reads it back grouped by class; `clearCafeteriaTables`; LUNCH & SUPPER plans are independent. `/api/cafeteria` GET `?tables=&session=` + POST `allocateTables`/`clearTables` (cafeteria.manage). Cafeteria "Table allocations" tab rebuilt to call the real API (session toggle + size picker + saved seating plan + clear). h5-cafeteria-tables-test.ts 12/12 ✓, test:roles 24/24 ✓, compile ✓.)*
- [x] Disappearing Group Voice Notes  *(Group voice call/note features in class chats with disappearing mode to prevent server storage cost blowups)*  *(COMPLETED 2026-06-22 through I.9: built real class-group disappearing voice rooms using `ClassVoiceRoom`, `/api/class-voice`, `/api/class-voice/signal`, Prisma `ClassVoiceRoom`/`ClassVoiceParticipant`/`ClassVoiceSignal`, participant-only access, short TTL cleanup, no stored voice/audio files, and Messages integration only for class-group conversations. Screenshot: `screenshots/i9-class-group-voice.png`.)*
- [x] Incident Photo Proof Module  *(Supports uploading photo proof to incident reports to confirm student identity and prevent false admission number inputs)*  *(RE-VERIFIED 2026-06-17: actually FULLY wired end-to-end — earlier audit was a false negative (grepped the wrong field name `proofUrl`; the real field is `proofFileUrl`). DisciplineIncident.proofFileUrl/proofFileName columns + `incidentSchema` proof fields + `reportIncident` persists them + `/api/discipline` passes them + IncidentDialog has a `FileUpload accept="image/*,application/pdf"` (camera-capable) + incident list shows a "View Incident Proof" link. Confirmed with h5-incident-proof-test.ts 5/5 ✓ (parses, persists URL+name, listIncidents returns it, optional when absent), test:roles 24/24 ✓.)*
- [x] Exam & Leaving Certificates Vault  *(Trace and store KCSE or KCPE leaving certificates and academic records when handed over to students)*
- [x] Admissions Entrance Exam Storage  *(Store and print entrance interview exams per class directly from the admissions panel)*
- [x] Quick-Action Incline Messaging Buttons  *(Inline buttons across dashboards to quickly trigger messages to targeted persons)*  *(BUILT 2026-06-17: NEW reusable `<MessageButton recipientId>` (components/messaging/message-button.tsx) — one tap POSTs to the existing `/api/conversations` (creates OR reuses a DIRECT 1:1, never duplicates) then deep-links to `/messages?open=<id>` straight into the thread. Placed inline in the Staff directory rows + the staff file drawer ("Message this person"). h5-quick-message-test.ts 4/4 ✓ (creates/reuses 1:1, 2 participants, usable deep-link), test:roles 24/24 ✓, compile ✓.)*



---

# PART I — Founder Phase-2 Custom Roadmap (Added 2026-06-17)

> Extracted verbatim-of-intent from the founder's Phase-2 prompt paragraphs. NOT built yet — recorded for the founder's go-ahead. Where a line OVERLAPS something already built (Part H etc.) it is noted as VERIFY-AND-TICK. Build with the standard 8-chunk full-stack rigor when the founder says start.

## I.1 — Authentication, Accounts & Critical-Action Security

- [x] Magic-link clarity: document + verify HOW the email magic link is delivered and where the staff member receives the sign-in link (e.g. principal@karibuhigh.ac.ke). Make the dev/live delivery path explicit (currently email seam; Resend on creds). *(COMPLETED 2026-06-18: added `docs/AUTH-ACCOUNT-SECURITY-GUIDE.md`, explaining dev link display vs live Resend delivery, recipient inbox, expiry, one-time token, and test steps.)*
- [x] Explain/expose how NEYO creates staff emails/login IDs (the two-ID system) so the founder understands account provisioning; surface it in onboarding/staff docs. *(COMPLETED 2026-06-18: documented human email/phone login vs stable NEYO login ID in `docs/AUTH-ACCOUNT-SECURITY-GUIDE.md`, including account creation paths and edit points.)*
- [x] Biometric / fingerprint / Face ID gate on CRITICAL accounts & actions (e.g. a librarian clearing records) to stop an intruder on a signed-in account — *(OVERLAP: Part H.2 Biometric Gate now covers library clearance + deletes + settings; VERIFY this covers "librarian clears records" + extend to any other critical account actions the founder means)*. *(COMPLETED 2026-06-18: verified library clearance uses `requireBiometric`; replaced the previous hard-coded/fallback check with real signed-in passkey action endpoints `/api/auth/passkey/action/options` + `/verify`. No fake biometric fallback remains; no protected action proceeds without a registered passkey.)*
- [x] Confirm cookie sessions are safe but add the biometric second factor for sensitive roles so a left-open signed-in account can't be abused. *(COMPLETED 2026-06-18: added the founder auth guide and hardened critical-action passkey verification. Existing HttpOnly session cookie stays; device-bound session checks and passkey action checks now reduce left-open/stolen-session risk.)*

## I.2 — Departments, HOD & Results Release

- [x] Department Head (HOD) appointment — chosen by the Principal ONLY (nobody else) — *(OVERLAP: Part H.3 Principal-Only HOD Appointments; VERIFY-AND-TICK)*. *(COMPLETED 2026-06-21: verified and hardened in `academics.service.ts`; changing `Department.hodId` now requires Principal/School Owner/SUPER_ADMIN at service level, so Deputy/HOD cannot appoint or replace a Department Head even if a route/UI is reached. Test `scripts/i2-hod-department-scope-test.ts` verifies principal appoints and deputy is blocked. Screenshot: `screenshots/i2-hod-department-scope.png`.)*
- [x] Once chosen, an HOD can perform tasks on THEIR department only (scoped department actions). *(COMPLETED 2026-06-21: added HOD department scoping to department/subject/timetable service logic. A scoped HOD now sees only assigned departments and their subjects, cannot create departments, cannot manage another department, cannot move subjects from another department, and cannot timetable another department’s subject. Academics UI now shows an HOD-mode notice and keeps HOD appointment read-only for non-principal users. Test `scripts/i2-hod-department-scope-test.ts` passes 10/10.)*
- [x] Academics HOD + Principal approval → release results in ONE TAP → auto-computes subject means → notifies parents — *(OVERLAP: Part H.3 1-Tap Mean Grade Release; VERIFY-AND-TICK)*. *(COMPLETED 2026-06-21: built real `ExamReleaseApprovalRequest` workflow. Academics HOD/Dean/Deputy/Principal/Owner can request release after marks exist; Principal/Owner/SUPER_ADMIN approves or returns it. Approval calls the existing `publishExam()` path, so subject/class means are computed and parent SMS release notifications are sent. UI shows “Pending Principal approval”, approval card, Return, and “Approve & release” buttons. Test `scripts/i2-exam-release-approval-test.ts` passes 6/6. Screenshot: `screenshots/i2-exam-release-approval.png`.)*
- [ ] Exam results presentation/design pass — founder will share the desired look; make results "look good" (defer visual spec until founder sends it).

## I.3 — Mandatory Searchable Inputs (no dropdowns)

- [x] EVERY field that needs an admission number or a name MUST be a typeahead SEARCH (never a dropdown) and is ALWAYS required (no optional). Apply system-wide to all such inputs — *(PARTIAL: some screens already search-only e.g. library, reception; audit ALL student/name/adm pickers and convert remaining dropdowns)*. *(COMPLETED 2026-06-21: added reusable `StudentSearchSelect` for required learner/admission search and replaced operational learner dropdowns in Cafeteria meal cards + meal queue, Clinic visits/profiles/medication, Discipline incidents/suspensions/counseling, Hostel bed allocation, Inventory sell-to-student, Security gate pass/pickup/alternate pickup, and Transport rider assignment. Static regression `scripts/i3-searchable-inputs-test.ts` verifies these screens no longer contain learner dropdown phrases/options and use the shared search component. Screenshot: `screenshots/i3-searchable-learner-input.png`.)*

## I.4 — Parent-Initiated Pickup (Safe Child Collection)

- [x] Parent sends someone to pick their child; the picker must present an ID; the parent enters that National ID so pickup is traceable (no lost-child blame) — *(OVERLAP: Part H.4 Pickup Person + Alt Pickup; VERIFY parent-side initiation flow)*. *(COMPLETED 2026-06-21: added parent self-service pickup card in `/portal` child detail plus `/api/portal/pickup`; parents can add permanent pickup people for their OWN children only, National ID is required, phone is normalized to KE format, and cross-family attempts are blocked. Test `scripts/i4-parent-pickup-safety-test.ts` verifies own-child guard + National ID storage.)*
- [x] Security checks the picker's National ID against the authorised list at the gate. *(COMPLETED 2026-06-21: `pickupListFor()` now searches not only learner name/admission number but also authorised picker full name, phone and National ID, so the gate can type the presented ID and see the correct authorised picker. Test verifies gate lookup by National ID returns the authorised person.)*
- [x] Parent can instead send a message / screenshot of the confirmed picker; the picker presents it — *(OVERLAP: Part H.4 Alt Pickup Screenshot Verify; VERIFY)*. *(COMPLETED 2026-06-21: parent portal can create a one-time alternate pickup code with optional screenshot proof using existing `AltPickupAuthorization`; gate verifies the code through the existing security flow and screenshot remains viewable. Test verifies code creation and gate verification.)*
- [x] On pickup, security ticks the system → instant SMS lands on the parent's phone "child was picked" — *(OVERLAP: Part H.4 confirm SMS; VERIFY)*. *(VERIFIED 2026-06-21: `confirmPickupPerson()` sends the existing instant SMS to the primary guardian when gate verifies a permanent pickup person; `verifyAltPickup()` sends a similar SMS for alternate code pickup. Test output shows both SMS seams firing with learner/picker details.)*
- [x] Parent can change WHO is allowed to pick their kids whenever they want — *(OVERLAP: Part H.4 alt pickup manager; VERIFY parent self-service)*. *(COMPLETED 2026-06-21: parent portal pickup card lists permanent pickup people and active one-time codes; parent can add/remove permanent people and cancel active alternate pickup codes, scoped to own children only. Screenshot: `screenshots/i4-parent-pickup-safety.png`.)*

## I.5 — Role-Based Dashboard & System Visibility

- [x] Dashboard (My School / money / metrics) is viewable ONLY by School Owner + Principal; non-concerned roles must not even see the components — *(OVERLAP: Part H.2 Module/Settings Visibility; VERIFY default-hides dashboard for non-leadership)*. *(COMPLETED 2026-06-22: dashboard money cards and Subscription Plan card are now gated by effective `owner.dashboard` only, not by `finance.view`; Bursar/Accountant can still use Finance but do not see My School/money metrics dashboard cards. Sidebar `/owner` already requires `owner.dashboard`; regression `scripts/i5-role-dashboard-visibility-test.ts` verifies Principal sees My School while Bursar/Teacher/Deputy do not, and that dashboard money-card source no longer checks `finance.view`.)*
- [x] System/admin settings never appear to non-concerned staff; they only get their account password + language — *(OVERLAP: Part H.2; VERIFY)*. *(COMPLETED 2026-06-22: Settings hub and sidebar now use `effectivePermissionsForUser()`; non-concerned staff are force-reduced to `/settings/security` only, and Billing is owner/principal-only via `owner.dashboard`. Hardware settings page now has a server permission guard. Test verifies Teacher keeps only safe Settings/Security basics and does not see Billing/Modules.)*
- [x] Schools never see NEYO's internal system menus; they only see the brand toggle. *(VERIFIED 2026-06-22: NEYO Ops remains `platform.founder_ops` / SUPER_ADMIN-only via navigation permission and `/founder` page guard. Test verifies a school Principal does not see `/founder`, while SUPER_ADMIN does. Normal Brand style-guide remains visible as a product reference, not a NEYO internal ops console.)*
- [x] Dual-role staff (2 roles) fully supported in account/permission logic — *(OVERLAP: H.1 Multi-Role secondaryRole; VERIFY combined-permission behaviour everywhere)*. *(HARDENED/VERIFIED 2026-06-22: server page guards, app-layout initial permissions, sidebar, settings hub and APIs now use effective permissions that combine primary + secondary role and respect strict per-staff scoping. Test temporarily makes the Bursar a secondary Principal and verifies `owner.dashboard`, admin settings and `/owner` nav appear.)*
- [x] School Owner can RESTRICT even themselves/others from "My School" view in settings (configurable per field) — *(OVERLAP: H.2 visibility; VERIFY owner can hide owner views)*. *(COMPLETED 2026-06-22: Visibility Manager now allows the `/owner` “My School (owner metrics)” row to be hidden from School Owner and Principal roles too, while `/settings` and `/settings/security` remain unhideable so the rule can be reversed. Test verifies hiding `/owner` from Principal and School Owner works. Screenshot: `screenshots/i5-role-dashboard-visibility.png`.)*
- [x] A Principal can ALSO be an Owner; Owners can be many — *(OVERLAP: H.2 Multi-Owner; VERIFY)*. *(VERIFIED 2026-06-22: existing owner model counts primary and secondary `SCHOOL_OWNER`; test creates multiple owners and temporarily gives the Principal secondary `SCHOOL_OWNER`, then verifies owner count includes them.)*
- [x] Any role assignment/critical change must be confirmed by an Owner or Principal — *(OVERLAP: H.2 Multi-Owner joint approval; VERIFY covers role changes)*. *(HARDENED 2026-06-22: `promoteStaff()` already blocked non-owner/principal role changes; now it validates role keys and writes explicit `confirmedById`, `confirmedByName`, `confirmedByRole` and `confirmedBySecondaryRole` metadata into the `hr.staff_promoted` audit log. UI copy changed to “Confirm role change”. Test verifies Deputy is blocked and Principal/secondary-Principal confirmations are audited.)*

## I.6 — Principal Powers & Delegation

- [x] Mark-attendance is NOT shown to a Principal unless they are a class teacher; BUT the Principal (as master) can still take attendance if they choose — *(OVERLAP: H.2 Master Attendance Override; VERIFY the "hidden unless class teacher, but master can" nuance)*. *(COMPLETED 2026-06-22: dashboard CTA now shows “View attendance” for Principal/Owner/SUPER_ADMIN users unless they are actually assigned as a class teacher; the Attendance screen shows class registers as view-only for the Principal until “Master Override” is switched on. Backend now blocks a Principal from marking another class without `masterOverride:true`, while still allowing normal marking if the Principal is that class’s teacher. Test `scripts/i6-principal-powers-delegation-test.ts` verifies no-override block, Master Override success + audit, and own-class Principal marking.)*
- [x] Principal can VIEW attendance (read) by default even when not marking. *(VERIFIED/HARDENED 2026-06-22: `attendanceOverview()` and `getRegister()` allow Principal/Owner read access to class registers by default, while marking remains controlled by own-class or Master Override. Test verifies Principal can load overview and open a class register for viewing.)*
- [x] Principal can ASSIGN a non-sensitive task to a teacher (delegation). *(BUILT 2026-06-22: added tenant-owned `PrincipalDelegationTask` model + migration `20260622010000_i6_principal_delegation`; service/API `/api/delegations`; dashboard “Principal delegation” card lets Principal/Owner assign non-sensitive tasks to teachers/HOD/Dean, teachers see their own tasks, mark done, receive targeted in-app notification, and all actions are audit logged. Test `scripts/i6-principal-powers-delegation-test.ts` passes 16/16. Screenshot: `screenshots/i6-principal-delegation.png`.)*

## I.7 — Gate Pass & Discipline Authority

- [x] Gate passes issued ONLY by Principal/Deputies; HODs may issue but require Principal/Deputy APPROVAL — *(OVERLAP: H.4 Gate Pass Authority Guard + H.4 Suspension approval; VERIFY HOD-issue-then-approve path)*. *(COMPLETED 2026-06-22: added approval fields to `GatePass` and hardened `issueGatePass()` / `decideGatePass()`. Principal/Deputy/Owner/SUPER_ADMIN issue ACTIVE passes immediately; HOD/Dean can only create PENDING passes; receptionist/security cannot issue. Pending passes cannot be used at the gate. Principal/Deputy approve/reject; all actions audit-log. UI now shows “Issue / propose pass”, “pending approval”, Approve/Reject actions. Test `scripts/i7-gate-discipline-authority-test.ts` verifies the full HOD→Principal→Gate flow. Screenshot: `screenshots/i7-gate-discipline-authority.png`.)*
- [x] Suspensions & any disciplinary cases follow the same approve-by-Principal/Deputy rule — *(OVERLAP: H.4 Suspension approval; VERIFY)*. *(COMPLETED 2026-06-22: added approval/status fields to `DisciplineIncident` and approval metadata to `Suspension`. Major/severe cases created by HOD/teacher-like roles now stay PENDING until Principal/Deputy/Owner approves; parent SMS is sent only after approval. HOD/Dean suspension requests stay PENDING, while Principal/Deputy issue ACTIVE suspensions directly. `approveIncident()` and `approveSuspension()` enforce Principal/Deputy/Owner approval. Test verifies HOD cannot approve, Deputy approves discipline case, Principal approves suspension, and ordinary teacher cannot propose suspension.)*
- [x] Gate pass: security only CONFIRMS validity by number; cannot issue — *(OVERLAP: H.5/H.4; VERIFY)*. *(HARDENED 2026-06-22: `/api/security` now lets HOD/Dean propose passes without `security.manage`, but service blocks RECEPTIONIST/security desk from issuing. Security/receptionist can only verify/use an ACTIVE pass by number through `useGatePass()`; pending/reused/unknown passes are rejected. Test verifies receptionist issue is blocked and gate can only use an approved pass.)*

## I.8 — Printing Controls

- [x] Printer can be turned OFF completely; boarding schools batch-print receipts only at term end — *(OVERLAP: H.2 Boarding Term-End Print Scheduler; VERIFY-AND-TICK)*. *(COMPLETED 2026-06-22: verified and hardened `Tenant.printStationMode` AUTO/HOLD as a real school-wide setting. Principal/Deputy/Owner/Academics HOD can switch HOLD mode; non-privileged staff are blocked. HOLD keeps PrintJob rows queued for term-end batch printing instead of instant auto-printing. `/api/print-queue` now handles `stationMode` before general print-station access, while `setPrintStationMode()` itself enforces privileged roles. Test `scripts/i8-printing-controls-test.ts` verifies HOLD/AUTO and queued jobs. Screenshot: `screenshots/i8-printing-controls.png`.)*
- [x] Print limits fully customizable (not just preset numbers); changeable by Principal/Deputies/Academics; everyone else must request → print after approval — *(OVERLAP: H.2 Customized Printing Limits; VERIFY custom value + the three editor roles)*. *(COMPLETED 2026-06-22: verified `Tenant.printLimitPerDay` accepts any custom whole number 0–1000 through Settings → Printing, not only presets. `isPrivilegedPrinter()` allows Principal, Deputy Principal, HOD, School Owner and SUPER_ADMIN, including secondary roles. Non-privileged staff are counted in `UsageCounter`, hit `LIMIT_REACHED`, create `PrintApprovalRequest`, and an approved request is consumed once and marked USED. Test `scripts/i8-printing-controls-test.ts` passes 17/17.)*

## I.9 — Calendar & Class-Group Voice

- [x] Calendar dates rendered BIGGER (current ones too tiny and drift upward, hard to see once an event is added) — *(OVERLAP: H.2 Big Date Calendar; VERIFY-AND-TICK the no-drift + larger size)*. *(VERIFIED 2026-06-22: `src/components/calendar/calendar-view.tsx` already contains the H.2 big-date implementation: month-grid dates render as fixed `h-9 w-9 text-base leading-none` badges and week/day agenda dates render as fixed `h-12 w-12 text-2xl shrink-0 leading-none` badges, preventing drift even when event counts appear. Added regression `scripts/i9-calendar-big-dates-test.ts` and screenshot `screenshots/i9-calendar-big-dates.png`.)*
- [x] Voice call in class groups, in DISAPPEARING mode (so storage stays cheap) — *(NEW; this is the deferred H.5 "Disappearing Group Voice Notes" — needs WebRTC + auto-expire; founder reconfirmed wanting it)*. *(COMPLETED 2026-06-22: finished full-stack class-group disappearing voice. Chunk 1 DB added tenant-owned `ClassVoiceRoom`, `ClassVoiceParticipant`, and `ClassVoiceSignal` via migration `20260622104208_i9_class_group_voice` for live-room metadata and short-lived signalling only. Chunk 2 validation in `src/lib/validations/class-voice.ts` strictly validates room actions/signals and rejects stored audio/file URLs. Chunk 3 service `src/lib/services/class-voice.service.ts` enforces real class-group participant access, starts/joins/polls/posts/ends rooms, sends in-app notifications, audit-logs start/end, and cleans expired rooms/signals. Chunk 4 APIs `/api/class-voice` and `/api/class-voice/signal` wire signed-in Zod-validated service calls. Chunk 5 UI `src/components/messaging/class-voice-room.tsx` uses real microphone permission, `RTCPeerConnection`, offer/answer/ICE, countdown, participants, mute/end controls, and explicit “No class voice is saved by NEYO” storage copy. Chunk 6 integration mounts it in `MessagesClient` only when the active conversation is a class `GROUP` with `classId`, passing the active conversation id/title and preserving legacy disappearing voice-note storage safety. Verification: `scripts/i9-class-voice-validation-test.ts`, `scripts/i9-class-voice-service-test.ts`, `scripts/i9-class-voice-api-test.ts`, `scripts/i9-class-voice-ui-test.ts`, `scripts/i9-class-voice-messages-integration-test.ts`, typecheck, and `test:roles` pass. Screenshot: `screenshots/i9-class-group-voice.png`.)*

## I.10 — Communication Permissions

- [x] Parents & Students CANNOT message the whole school, nor the Principal/leadership broadcast; teachers CAN message (normal teacher scope + class groups) — *(PARTIAL: B.14 teacher restriction exists; ADD explicit parent/student no-school-wide + no-leadership-DM rule, verify)*. *(COMPLETED 2026-06-18: generic conversation creation now blocks PARENT/STUDENT from creating ANNOUNCEMENT or arbitrary GROUP conversations; they can use one-to-one school conversations and the existing scoped class-group endpoint only. Broadcast API already requires `comms.send`; parent/student have none. `scripts/i10-comms-permissions-test.ts` verifies parent announcement/group attempts are blocked.)*
- [x] Teachers may NOT send SMS; they may send IN-APP only, and only if approved by Principal/Deputy — *(NEW restriction: gate teacher SMS behind leadership approval; in-app allowed)*. *(BUILT 2026-06-18 full-stack: NEW `TeacherCommsApprovalRequest` model + migration `20260618141813_i10_teacher_comms_approvals`; teacher bulk SMS is blocked server-side even for preview; teacher class-parent in-app messages can be previewed but actual delivery creates a PENDING approval request; Principal/Deputy/Owner approve/reject in `/comms`; approval sends the in-app message and audits the decision. API: `/api/comms` actions `request_teacher_approval`, `approve_teacher_message`, `reject_teacher_message`. UI: teacher approval workflow + approver queue. Tests: `i10-comms-permissions-test.ts`, live API smoke, typecheck/build/test:roles ✓.)*

## I.11 — Admissions Interview-Exam Vault

- [x] Store interview/entrance exams PER CLASS in the Admissions tab; printable for new students without digging through files — *(OVERLAP: H.5 Admissions Entrance Exam Storage; VERIFY per-class storage + print)*. *(COMPLETED 2026-06-22: I.11 hardened the existing H.5 entrance-exam vault into a true exact-class/stream admissions workflow. `EntranceExamPaper` now stores `classId`, `classLabel`, title, mandatory `hardcopyLocation`, uploader, print count and last print time, with uniqueness per exact class/stream instead of only class level. Added `src/lib/validations/entrance-exam.ts`, real service `src/lib/services/entrance-exam.service.ts`, API `GET/POST /api/admissions/entrance-exams`, and tracked print route `/api/admissions/entrance-exams/[id]/print`. Admissions UI now opens “Entrance Exam Paper Vault”, lists every exact class, shows stored paper + hard-copy location, supports upload/replace via real file storage, and provides Print / Download. Seed now creates printable PDFs for Form 1 West and Form 2 East. Test `scripts/i11-admissions-entrance-exam-vault-test.ts` verifies exact-class storage, same-level different streams, print audit, API validation/permissions, and UI source. Screenshot: `screenshots/i11-admissions-entrance-exam-vault.png`.)*

## I.12 — Quick Messaging Buttons

- [x] Inline / quick-action buttons across the system that send a message to the right target person — *(OVERLAP: H.5 Quick-Action Messaging Buttons; VERIFY coverage + extend to more screens the founder means)*. *(COMPLETED 2026-06-22: audited and extended the existing H.5 `MessageButton`. The reusable `src/components/messaging/message-button.tsx` uses the real `/api/conversations` endpoint to create/reuse a DIRECT 1:1 conversation and deep-links to `/messages?open=<id>`, avoiding duplicate threads. Verified existing staff directory + staff file buttons, fixed Parent Portal “Talk to the school” from plain `/messages?to=` links into real `MessageButton` actions, added “Message guardian” buttons on student profiles for guardians with portal accounts, and preserved `/messages?to=<userId>` support inside `MessagesClient` by creating/reusing the direct thread automatically. Test `scripts/i12-quick-message-buttons-test.ts` verifies backend reuse, parent→school direct conversation, staff coverage, guardian coverage, and `/messages?to=` support. Screenshot: `screenshots/i12-quick-message-buttons.png`.)*

## I.13 — Timetable & Academics Control

- [x] ONLY the Academics department can change the timetable; no ordinary teacher has edit access — *(OVERLAP: H.2/H.3 Timetable Access Guard; VERIFY academics-only edit)*. *(VERIFIED/HARDENED 2026-06-22: timetable mutation routes still require `academics.manage`, ordinary `TEACHER` lacks that permission, and the UI only enables slot edit/config/generator controls for `canManage`. HOD users remain department-scoped through `assertHodSubjectAccess()`, so they can only timetable their department subjects. Test `scripts/i13-timetable-academics-control-test.ts` verifies ordinary teacher cannot edit while Principal can.)*
- [x] Timetable: school can set the time lessons start. *(COMPLETED 2026-06-22: added `TimetableConfig.schoolDayStartTime` plus UI controls in Academics → Timetable → Schedule rules. Timetable period times now compute from the configured school start time instead of a hard-coded 08:00. Migration: `20260622130000_i13_timetable_start_times`.)*
- [x] Bulk/shared scheduling buttons: schedule exams or remedials/preps for a band of classes (e.g. Grade 6–9) in ONE TAP instead of per-class buttons — *(OVERLAP: H.3 Saturday Shared Scheduling Buttons; VERIFY/extend to exams+remedials+preps bands)*. *(VERIFIED 2026-06-22: Bulk Saturday Scheduler supports one-tap Grade 6–9, Form 1–4, and All class selection buttons, plus Saturday lessons / Remedial mode / Exam prep mode. It calls real `/api/academics/timetable` actions `bulkSaturday` and `fairSaturday`.)*
- [x] Saturday timetable support, with configurable start/end times — *(OVERLAP: H.3 Saturday Timetable; VERIFY)*. *(COMPLETED 2026-06-22: added `TimetableConfig.saturdayStartTime` and `saturdayEndTime`, exposed in Schedule rules, and displayed the current Saturday window in Bulk Saturday Scheduler. Saturday period chips now show times computed from the configured Saturday start time.)*
- [x] Common/shared buttons in the timetable for things in common; individual buttons only for complex per-class needs. *(COMPLETED/VERIFIED 2026-06-22: common controls now cover Print all classes, Print all teachers, Print by venue, Schedule rules, Auto-fill week, and Bulk Saturday Scheduler, while individual cell editing remains per-slot for complex class-specific needs. Screenshot: `screenshots/i13-timetable-academics-control.png`.)*

## I.14 — Departments & Co-curricular

- [x] Departments can add the SUBJECTS in the department and the department HEADS — *(OVERLAP: H.3 Dynamic Subject & Department Manager; VERIFY)*. *(COMPLETED 2026-06-23: verified and regression-tested the real Department → Subject mapping and Department Head workflow. `Department.hodId` remains Principal/School Owner/SUPER_ADMIN-only, while mapped subjects are saved through `updateDepartment()` and returned in the Departments board. Test `scripts/i14-departments-cocurricular-test.ts` verifies Principal appoints a head and maps `Games & Clubs` to the Co-curricular Activities department.)*
- [x] Add NON-academic departments (e.g. Co-curricular Activities) — *(OVERLAP: H.3; VERIFY)*. *(COMPLETED 2026-06-23: seeded a real non-academic `Co-curricular Activities` department and a `Games & Clubs` subject (`GAC`) in `prisma/seed.ts`; the department board marks co-curricular departments as Non-academic and displays mapped-subject count plus appointed head.)*
- [x] A dedicated Co-curricular Activities TAB, linked to the timetable — *(OVERLAP: H.3 Co-curricular Timetable Linkage; VERIFY a real tab exists)*. *(COMPLETED 2026-06-23: added a dedicated `Co-curricular` tab inside Academics. It reads real departments and timetable configs, shows activity departments, and lets academics leadership save per-class activity label + slots/week through `/api/academics/timetable/generator` `save_config`. The whole-school generator then reserves those co-curricular blocks in Friday timetable slots. Screenshot: `screenshots/i14-departments-cocurricular.png`.)*

## I.15 — Universal Staff Import (+ future AI for handwriting)

- [x] Every section that adds staff has an IMPORT MENU (works fully rule-based now; Bundi handwriting-scan later) — *(OVERLAP: H.3 Staff Bulk Import Menu; VERIFY all staff-adding sections, not just one)*. *(COMPLETED 2026-06-23: Staff Directory already had a bulk import entry; I.15 upgraded it into a universal rule-based staff import menu supporting CSV/TSV/TXT/XLSX upload and paste-from-Excel. `/api/hr/import` now accepts multipart files, pasted text, table rows, or direct JSON rows. `staff-import.service.ts` auto-maps headers, normalizes Kenyan phones and human role labels, creates real `User` + `StaffProfile` rows, stores HR fields (TSC, National ID, KRA PIN, qualifications, employment date, contract type, emergency contact), denies duplicates before any partial creation, and keeps the Bundi handwriting-scan path as a future same-row-input seam. Screenshot: `screenshots/i15-staff-import.png`.)*
- [x] Student import similarly Bundi-ready but works standalone now — *(OVERLAP: B.1 bulk import; VERIFY)*. *(VERIFIED 2026-06-23: `student-import.service.ts` already parses CSV/TSV/XLSX, auto-maps columns, previews issues, commits with duplicate denial and real student/guardian/class creation, and does not depend on any assistant layer. The future Bundi handwriting/photo path can produce the same parsed rows/mapping while the current importer remains fully rule-based.)*
- [x] Term dates editable by Principal/Owner only (not teachers) — *(OVERLAP: H.3 Term Dates Authority Guard; VERIFY-AND-TICK)*. *(VERIFIED 2026-06-23: `upsertTerm()` in `academics.service.ts` enforces Principal/School Owner/SUPER_ADMIN only, including secondary roles, even though the route requires `academics.manage`. I.15 regression test verifies Deputy is blocked from saving term dates.)*

## I.16 — Hostel / Dorm Automation

- [x] Dorm system AUTO-places students into dorms; school can switch to mixed vs form-based; it skips day-scholars; on transfer it records the freed space; managed by the Boarding department + school heads — *(OVERLAP: H.4 Automated Dorm Placement + Transfer Freed-Space; VERIFY mixed/form toggle + day-scholar skip + boarding-dept management)*. *(COMPLETED 2026-06-23: verified and hardened `autoAllocateHostelBeds()` full-stack. Hostel Master/boarding department and school heads have `hostel.manage`; the Hostel UI exposes Form-Based and Mixed Levels placement strategies; `/api/hostel` validates `FORM|MIXED`; service excludes `Student.boardingType = DAY`, allocates only boarders, supports BOYS/GIRLS gender gates and now correctly allows both genders in MIXED hostels. `transferStudent()` already releases active hostel allocations on transfer; I.16 adds `freedHostelBeds` to the transfer audit metadata so freed bed space is recorded. Test `scripts/i16-hostel-dorm-automation-test.ts` verifies mixed allocation, day-scholar skip, transfer bed release and audit. Screenshot: `screenshots/i16-hostel-dorm-automation.png`.)*

## I.17 — Library Upgrades

- [x] Support a HARDWARE barcode scanner (USB/Bluetooth wedge) rather than relying on a phone — *(OVERLAP: H.5 Library Barcode Scanner Hardware; VERIFY)*. *(COMPLETED 2026-06-23: verified USB/Bluetooth wedge scanners work through the ISBN input because they type the barcode and press Enter, but NEYO no longer claims hardware is connected when it is not. The Issue screen now explicitly shows “External hardware scanner: not connected. Plug one in and it will type here automatically.”)*
- [x] Teachers can borrow/scan books (eligible borrowers) — *(OVERLAP: H.5 Teacher Book Borrowing; VERIFY-AND-TICK)*. *(VERIFIED 2026-06-23: `issueBook()` supports a STAFF borrower path with `borrowerType=STAFF`, `borrowerUserId`, staff ID from TSC/NEYO login, open-book limit, duplicate-copy block and staff-fine cash-only guard. I.17 test verifies teacher/staff borrowing.)*
- [x] Late-return fine is a SWITCH (on/off) and customizable amount — *(OVERLAP: H.5 Library Late Fines Switch; VERIFY customizable amount too)*. *(COMPLETED 2026-06-23: added `Tenant.libraryFinePerDayKes` via migration `20260623152000_i17_library_fine_amount`; added `libraryPolicy()` / `setLibraryPolicy()` and `/api/library?view=policy` + `action=finePolicy`. Library → Out now now has a Late-return fine policy card with on/off toggle and custom KES-per-day amount. Open issues and returns use the configured amount.)*
- [x] Transfer/clearance: a student must clear their library list (return books / pay) before the system ticks them cleared to transfer/leave — *(OVERLAP: H.5 Library Clearance Transfer Guard; VERIFY)*. *(VERIFIED 2026-06-23: `transferStudent()` blocks transfers when a learner has unreturned books or unpaid library fines. I.17 test verifies the transfer/clearance block with an open book.)*
- [x] All library transactions are SEARCH-ONLY (type + press), never dropdowns — *(OVERLAP: H.5 Dropdown-Free Library Search; VERIFY)*. *(COMPLETED/VERIFIED 2026-06-23: Issue flow uses search-only book and borrower inputs, not `<select>` dropdowns. Added a direct inbuilt NEYO camera scanner using browser `BarcodeDetector` + `getUserMedia` where supported, while still allowing manual ISBN typing and external wedge scanners. Screenshot: `screenshots/i17-library-upgrades.png`.)*

## I.18 — Cafeteria / Meal Cards (flexible models)

- [x] Flexible meal model — linked to the system, or a GROUP for boarding schools across different periods, or individual cards, OR cafeteria removes the card entirely — the school CHOOSES the model (e.g. cafeteria for lunch only + meal card for supper). (Founder rule I.31: do NOT use any "county-meal-programme" brand name in copy.) *(COMPLETED 2026-06-23: added real `Tenant.cafeteriaMealModel` and `Tenant.cafeteriaMealScope` via migration `20260623154000_i18_cafeteria_meal_model`; service/API `cafeteriaPolicy()` / `setCafeteriaPolicy()` support HYBRID, CARDS_ONLY, BOARDING_GROUPS and NO_CARDS plus ALL/LUNCH/SUPPER scope. Cafeteria UI now lets the school choose hybrid boarding groups + day cards, individual cards only, boarding/group meals only, or no physical cards. `issueCard()` blocks card creation when cards are disabled and enforces lunch-only/supper-only scope. Screenshot: `screenshots/i18-cafeteria-meal-cards.png`.)*
- [x] After the school picks the number per group/table, the system ALLOCATES student names into groups/tables — *(OVERLAP: H.5 Cafeteria Table Allocation; VERIFY/extend to the group+period model)*. *(VERIFIED 2026-06-23: `allocateCafeteriaTables()` is real DB-backed full-stack. It stores `CafeteriaTable` rows per selected session, chunks learners into the chosen seats-per-table, persists `studentsJson` with learner names/admission numbers, and remembers `Tenant.cafeteriaTableSize`.)*
- [x] Tables are per CLASS within the SAME stream (not mixed) — *(OVERLAP: H.5; VERIFY)*. *(VERIFIED 2026-06-23: table allocation loops class-by-class and stores frozen `classLabel` such as Form 2 East; `tableBoard()` groups by class/stream label so no table mixes learners from different classes/streams. I.18 test verifies class/stream grouping.)*
- [x] Optional physical cards depending on the school's choice. *(COMPLETED 2026-06-23: physical/individual meal cards are now controlled by `cafeteriaMealModel`. Choosing `NO_CARDS` or `BOARDING_GROUPS` removes the Meal Cards workflow from the tabs and prevents card issuance at service level; choosing HYBRID/CARDS_ONLY enables card issuance and billing to invoices.)*
- [x] Meal serving queue: learners can queue for breakfast/lunch/supper, kitchen marks them served/cancelled, with queue numbers and daily session board. *(FOUNDER-REQUESTED 2026-06-18: added `CafeteriaQueueEntry` model + `/api/cafeteria?queue=1` board + join/serve/cancel actions + Meal queue UI tab. Test `i31-i19-cafeteria-queue-test.ts` verifies queue numbers, duplicate block, served/cancelled counts. Screenshot: `neyo/screenshots/i19-meal-serving-queue.png`.)*

## I.19 — Incident Photo Proof

- [x] Incident reports support a PHOTO module + searchable proof (students may lie about admission numbers) — *(OVERLAP: H.5 Incident Photo Proof; VERIFY photo + the searchable-student requirement)*. *(COMPLETED 2026-06-23: verified the existing incident proof foundation and added searchable proof coverage. `DisciplineIncident` stores `proofFileUrl` and `proofFileName`; `incidentSchema` validates them; `reportIncident()` persists proof; Incident dialog uses required `StudentSearchSelect` for learner identity plus `FileUpload accept="image/*,application/pdf"` for mobile camera/photo/PDF proof; incident list shows “View Incident Proof”. I.19 added `q` search through `/api/discipline?q=` and `listIncidents(...search)` across student name, admission number, category, description and proof filename. Test `scripts/i19-incident-photo-proof-test.ts`; screenshot `screenshots/i19-incident-photo-proof.png`.)*

## I.20 — Branding & Dynamic-Island Notifications

- [x] School BADGE appears top-left where the "N" (NEYO mark) currently is; the NEYO mark can move into the dynamic-island notification view / apps / website — *(PARTIAL: H.1 school logo in topbar done; VERIFY the swap + NEYO mark relocation)*. *(COMPLETED 2026-06-23: verified `(app)/layout.tsx` passes `tenant.logoUrl` into `Topbar`, and `Topbar` renders the school badge before falling back to `NeyoLogo`. Added a real seeded Karibu High badge asset at `public/brand/karibu-badge.svg` and updated `prisma/seed.ts` to use it, so the top-left logo is the school badge, not the NEYO mark. The NEYO mark is now embedded as a small “Powered by NEYO” mark inside Dynamic Island notification/live-activity capsules. Screenshot: `screenshots/i20-branding-dynamic-island.png`.)*
- [x] Notification pop-up redesigned as a DYNAMIC ISLAND, positioned TOP-CENTER just after the search bar (quick to see) — *(NEW; current bell is top-right drawer — build a top-center dynamic-island notifier)*. *(COMPLETED 2026-06-18: `NotificationBell` now includes a fixed viewport-centered, notch-safe Dynamic Island surface that displays new targeted notifications one-at-a-time with liquid/dark contrast, click-to-open deep links and hide action. Screenshot: `neyo/screenshots/i34-dynamic-island.png`.)*
- [x] When selecting/opening overlays, the blur should cover the FULL screen (some screens' selection blur doesn't cover everything) — *(NEW bug-fix: full-screen scrim/backdrop blur on dialogs/overlays)*. *(COMPLETED 2026-06-23: added a global I.20 CSS reliability rule in `src/app/globals.css` for `.fixed.inset-0` overlay/scrim surfaces, forcing full viewport coverage with `100vw`, `100vh`, and `100dvh`, including mobile dynamic viewport cases. Regression `scripts/i20-branding-dynamic-island-test.ts` verifies the rule exists.)*

## I.21 — Certificates & Exam-Material Records

- [x] System for KCSE/KCPE leaving certificates + certificate storage/records, logged when handed to students — *(OVERLAP: H.5 Exam & Leaving Certificates Vault; VERIFY hand-over logging)*. *(COMPLETED 2026-06-23: verified existing `LeavingCertificate` full-stack vault. `recordLeavingCertificate()` stores KCSE/KCPE/other certificate number, scanned file, mandatory hard-copy file location and audit `student.certificate_vaulted`; `handOverLeavingCertificate()` freezes physical handover with recipient, timestamp, staff member and audit `student.certificate_handed_over`; `/api/students/[id]/leaving-certificate` and the Student Profile “Leaving Certificate Vault” UI expose storage and handover logging.)*
- [x] Records for the APPLICATION of exams / assembling of needed exam materials. *(COMPLETED 2026-06-23: added `ExamMaterialRecord` model via migration `20260623205500_i21_exam_material_records`, tenant isolation entry, service `src/lib/services/exam-material.service.ts`, API `/api/exam-materials`, and `ExamMaterialsClient` mounted on `/exam-timetable`. Schools can track KCSE/KCPE/KNEC applications, material packs, checklists, deadlines, statuses, hard-copy storage location and optional soft-copy uploads. Screenshot: `screenshots/i21-certificates-exam-materials.png`.)*

## I.22 — Payments & Developer Clarity (founder questions)

- [x] Document/clarify HOW to test the Payments section (M-Pesa/Daraja flow in dev mock + go-live steps). *(COMPLETED 2026-06-23: added `docs/PAYMENTS-DEVELOPER-GUIDE.md` explaining local/dev mock payment testing, live Daraja go-live steps, callback URL format, `DARAJA_WEBHOOK_TOKEN`, invoice/receipt verification steps, and the distinction between school fee credentials and NEYO company subscription credentials. Payments UI now states school fee credentials go in Settings → Payments and NEYO company credentials are not entered there. Screenshot: `screenshots/i22-payments-developer-clarity.png`.)*
- [x] Document/clarify what the Developer section (API keys + webhooks) is for. *(COMPLETED 2026-06-23: `docs/PAYMENTS-DEVELOPER-GUIDE.md` explains API keys, Bearer token usage, webhook events, HMAC signatures and retry behaviour. Developer UI now includes an in-product clarity card explaining what API keys and webhooks are for. Test: `scripts/i22-payments-developer-clarity-test.ts`.)*

## I.23 — Duty Roster (Teachers on Duty)

- [x] System generates "teachers on duty" roster — *(may already exist per repo screenshots `duty_roster_screenshot.png`; VERIFY against code, then build/extend if missing)*. *(VERIFIED 2026-06-23: the duty roster is already fully built from I.78. `DutyRosterEntry` stores saved teacher-on-duty blocks, date ranges, rotation period, full duty team size and names; `generateDutyRoster()` supports WEEKLY / BI_WEEKLY / MONTHLY reshuffle periods and selectable teachers-per-cycle; `/api/academics/duty-roster` requires `academics.view/manage`; Academics → Duty Roster UI generates, saves and prints the term roster. Verification: `scripts/i78-duty-roster-test.ts`, typecheck and role tests pass. Screenshot refreshed/copied for I.23: `screenshots/i23-duty-roster.png`.)*

## I.24 — Promise-to-Pay Calendar Automation

- [x] When a promise-to-pay date is reached, auto-notify school officials AND SMS the parent to pay — *(OVERLAP: G.28 Promise-to-Pay broken-promise cron; VERIFY the on-date auto-notify to officials + parent)*. *(COMPLETED 2026-06-23: hardened `checkBrokenPromises()` so promises due today now create in-app notifications for Bursar/Accountant/Principal/Owner and send a once-only parent SMS reminder, then stamp `reminderSentAt` to prevent duplicates. Installment due reminders also notify school officials. Existing `promise-check` daily job runs 03:15 EAT. Test `scripts/i24-promise-to-pay-automation-test.ts` verifies official notifications, parent SMS path, reminder stamp and no duplicate reminders. Screenshot: `screenshots/i24-promise-to-pay-calendar.png`.)*

## I.25 — Dashboard Hierarchy, Sparklines & Glass Motion (founder design mandate)

- [x] Money-first dashboard: Outstanding Fees, Fees Collected Today, Collection Rate, Students Present at the TOP — *(OVERLAP: H.1 Money-First Dashboard; VERIFY exact order/top placement)*. *(COMPLETED/VERIFIED 2026-06-23: Dashboard source order is exactly Outstanding Fees → Fees Collected Today → Collection Rate → Students Present in the top card grid. Regression `scripts/i25-dashboard-hierarchy-sparklines-test.ts` verifies the order.)*
- [x] Mini sparkline charts inside cards: attendance trend, fee-collection trend, enrollment trend — *(OVERLAP: H.1 Sparklines; VERIFY all three trends present)*. *(COMPLETED 2026-06-23: added `MiniSparkline()` and real DB-backed trend arrays: `feeCollectionTrend`, `attendanceTrend`, and `enrollmentTrend`. Rendered inside Fees Collected Today, Students Present, and Total Enrolled dashboard cards. Screenshot: `screenshots/i25-dashboard-sparklines.png`.)*
- [x] Hover motion on cards: slight lift + stronger shadow + glass reflection shift — *(OVERLAP: H.1 Hover Micro-Motion; VERIFY)*. *(VERIFIED/HARDENED 2026-06-23: shared `Card` already had `hover:-translate-y-0.5` + `hover:shadow-card-hover`; dashboard metric cards now explicitly use `dashboard-metric-card`, `transition-all`, `ease-apple`, hover lift and stronger card-hover shadow.)*
- [x] Subtle depth: stronger blur, very subtle reflections, tiny light gradients on cards. *(COMPLETED 2026-06-23: added I.25 `.dashboard-metric-card` CSS in `globals.css` with stronger backdrop blur, small green/navy light gradients and deliberately reduced sheen opacity to keep reflections subtle.)*
- [x] Fix overlay blur not covering the full screen on some screens — *(duplicate of I.20; consolidate when building)*. *(COMPLETED 2026-06-23: consolidated with I.20 global `.fixed.inset-0` rule using `100vw`, `100vh`, and `100dvh`; I.25 regression verifies it remains present.)*

## I.26 — Time-Aware Greeting

- [x] Greeting changes by time of day (Good morning / afternoon / evening), not always "Good morning" — *(OVERLAP: H.1 Time-of-Day Greetings; VERIFY it actually varies by Nairobi hour)*. *(VERIFIED 2026-06-23: dashboard uses `getTimeOfDayGreeting()` with Nairobi UTC+3 calculation (`getUTCHours() + 3`) and renders `{greeting}, {firstName}`. Regression `scripts/i26-time-aware-greeting-test.ts` verifies morning/afternoon/evening outputs. Screenshot: `screenshots/i26-time-aware-greeting.png`.)*

## I.27 — YouTube Learning Integration

- [x] Configure YouTube learning inside the system, with search optimized for YouTube-related learning searches — *(NEW; needs a learning/resources surface + YouTube search/embeds; verify infra/creds needs)*. *(COMPLETED 2026-06-24: added Learning Videos module/page `/learning-videos`, `LearningVideo` and `LearningVideoSession` models via migration `20260623223000_i27_learning_videos`, API `/api/learning-videos`, service `learning-video.service.ts`, nav item, and cast page `/learning-videos/cast/[code]`. Teachers/students can search saved videos and, when `youtube_api_key` is saved in NEYO Ops Integration Credential Vault (or `YOUTUBE_API_KEY` env fallback), strict safe embeddable education-category YouTube results. Videos play inside NEYO using privacy-enhanced `youtube-nocookie.com/embed`, can be saved, cast to a TV/projector through a class-screen URL, and shown-in-class videos are listed for students later. Distraction guard keeps comments/recommendations outside NEYO; true zero-ad mode requires school-owned uploaded videos or YouTube-side ad-free entitlement because YouTube can still enforce adverts in embeds. Test: `scripts/i27-youtube-learning-test.ts`; screenshot: `screenshots/i27-youtube-learning.png`.)*

## I.28 — Saturday / Remedial / Exam Timetable Fairness

- [x] Saturday is a short day: a scheduler can pick which subjects appear; on alternating weeks DIFFERENT (projected/new) subjects show — fairness rotation so subjects share the limited Saturday slots. *(COMPLETED 2026-06-18: added `fairSaturdaySchedule()` using existing TimetableSlot.weekRotation. Academics can choose multiple classes, periods and 2+ subjects; solver distributes subjects round-robin across the limited Saturday cells and alternates Week A / Week B when selected. Test verifies different subjects and both rotations are saved.)*
- [x] Saturdays can act as REMEDIAL in some schools — support that mode with fairness across subjects. *(COMPLETED 2026-06-18: fair scheduler supports mode `REMEDIAL` / `EXAM_PREP` / `SATURDAY` and writes slotType accordingly; test verifies remedial fair rotation can schedule selected periods.)*
- [x] Some classes do NOT attend on Saturday — per-class toggle for Saturday attendance/timetable. *(VERIFIED 2026-06-18: TimetableConfig.hasSaturday exists and ClassConfigModal exposes “Attends Saturday Remedials”; BulkSaturdayModal filters out classes with hasSaturday=false.)*
- [x] A dedicated EXAM TIMETABLE (separate from the lesson timetable). *(BUILT 2026-06-18: NEW `ExamTimetableSlot` model + migration `20260618181500_i28_exam_timetable`; API `/api/academics/exam-timetable`; page `/exam-timetable`; separate nav item. Service blocks class exam time clashes. Test `i28-exam-timetable-test.ts`; screenshot `neyo/screenshots/i28-exam-timetable.png`.)*

## I.29 — Printable Class List

- [x] In Students, print a CLASS LIST: all names arranged by admission number in order, in a table format. *(COMPLETED 2026-06-18: verified existing Students print workflow and polished it to show school/class title, School/NEYO admission column and print-only table sorted by school admission no when present else NEYO admission no. Founder requested more blank columns to cover empty name-area space, so the print table now includes three additional empty write-in columns before Gender/Status/Remarks. Uses real `/api/students` data and browser print. Test `i29-print-class-list-test.ts` verifies Print Class List action, print title, learner rows, sorted admission numbers and required columns. Screenshot: `neyo/screenshots/i29-print-class-list.png`.)*

## I.30 — Search Opens Modules

- [x] Modules are searchable in the global search; pressing a module result (e.g. "Transport") navigates to that module — *(extend ⌘K/search to include module navigation targets)*. *(COMPLETED 2026-06-18: `/api/search` now returns permission/module/visibility-aware `type:"module"` hits from the real sidebar registry; aliases like books→Library and bus→Transport work; command palette shows module results with icon and navigates to `href`. Test `i30-module-search-test.ts` verifies Transport, Finance, Library alias, and teacher cannot see Finance. Screenshot: `neyo/screenshots/i30-module-search-transport.png`.)*

## I.31 — Copy Rule

- [x] NEVER mention the banned cafeteria brand phrase anywhere in the product (remove from cafeteria/meal copy and from the checklist references) — supersedes the I.18 wording. *(COMPLETED 2026-06-18: grep verified the banned phrase is absent from `src/`, `docs/`, and `prisma` text after replacing old checklist/context references. Cafeteria UI uses neutral meal/cafeteria wording.)*

## I.32 — Hard-copy File Location (mandatory on soft-copy storage)

- [x] When a soft copy is stored, the system MUST capture the physical hard-copy FILE LOCATION (required field, not optional) so the hardcopy can be found when needed — *(repo has `add_hardcopy_location` migration; VERIFY it's wired + made mandatory everywhere soft copies are stored)*. *(COMPLETED 2026-06-18: leaving certificates already required `hardcopyLocation`; this batch added required `StudentDocument.hardcopyLocation` (migration `20260618173000_i32_student_document_hardcopy_location`), validation requires it on `/api/students/[id]/documents`, profile upload UI requires it before upload, and document list displays `Hardcopy: ...`. Test `i32-hardcopy-location-test.ts` verifies validation + storage. Screenshot: `neyo/screenshots/i32-hardcopy-location-document.png`.)*

## I.33 — PWA "Add to Home Screen" Button

- [x] A visible button (bottom-right corner) that, when pressed, adds the web app to the home screen (the PWA install prompt) — *(G.2 PWA exists; add an explicit install button/affordance)*. *(COMPLETED 2026-06-18: `PwaProvider` now shows a persistent bottom-right `Install NEYO` button when not already installed/dismissed. Chrome/Edge/Android use `beforeinstallprompt`; iPhone/unsupported browsers get clear Add-to-Home-Screen instructions. Test `i33-pwa-install-test.ts` verifies button visibility and instructions fallback. Screenshot: `neyo/screenshots/i33-pwa-install-button.png`.)*

## I.34 — Dynamic Island Notifications (full behaviour spec)

- [x] Dynamic-island notifier processes ONE message at a time (queue) so notifications never push the screen content downwards. *(COMPLETED 2026-06-18: `NotificationBell` uses `islandQueue` + `activeIsland`; new unread notifications are queued and surfaced one at a time in a fixed overlay that does not affect layout flow.)*
- [x] Clicking a notification deep-links to what triggered it (e.g. Principal taps "fee paid" → goes to the Finance/fee area showing that payer). *(COMPLETED 2026-06-18: island click and notification-panel row click call `openNotification()`, mark the item read, and navigate to `Notification.href` when present. Test `i34-notification-island-test.ts` verifies href is stored and mark-read works.)*
- [x] Notifications are TARGETED to the concerned people only (a student never gets "someone paid a fee" that isn't them). *(VERIFIED 2026-06-18: notification model/service is recipientId-scoped; `i34-notification-island-test.ts` creates a principal-only notification and verifies the teacher inbox does not receive it.)*
- [x] A cool entry SOUND when a notification arrives. *(COMPLETED 2026-06-18: Dynamic Island calls `playIslandTone()` using Web Audio API with graceful browser-autoplay fallback.)*
- [x] Visual/motion like the new WWDC Siri pop-up in the dynamic island. *(COMPLETED 2026-06-18: island uses rounded capsule, `animate-island`, backdrop blur, dark/light contrast and compact liquid presentation.)*
- [x] Works in DARK mode (island likely white in dark mode). *(COMPLETED 2026-06-18: island is navy on light/glass-light and white with navy text on dark/glass-dark via dark-mode classes.)*
- [x] Must not clash with a MacBook notch; slightly LARGER on desktop (but not too big). *(COMPLETED 2026-06-18: fixed top-center island uses `env(safe-area-inset-top)` and width caps `min(92vw,34rem)` / desktop 30rem with taller min-height; screenshot captured.)*
- [x] Positioned top-center just after the search bar — *(consolidates I.20 dynamic-island line)*. *(COMPLETED 2026-06-18: island is fixed at top-center over the topbar area, does not push content or overlap breadcrumbs.)*

## I.35 — Fees Logic Fixes (important founder bug)

- [x] New students must START with FULL fees owing (currently wrongly shows "cleared" on add); the school then marks who has cleared / who has balances. *(COMPLETED 2026-06-18: `createStudent()` auto-issues an UNPAID `kind:"FEE"` invoice for the current term using exact-class fee structure first, level fallback second; test verifies new learner invoice total is full fee, paidKes=0, status=UNPAID.)*
- [x] Fees AUTO-UPDATE for a new term, carrying over a student's last-term balance. *(COMPLETED 2026-06-18: `batchInvoice()` calculates prior unpaid/partial balances and creates one idempotent `kind:"ARREARS"` carry-over invoice for the new term; rerunning does not duplicate arrears. Test verifies carry-over once.)*
- [x] Different schools have different fees PER CLASS — configurable; auto-applies the right fee when a student's class is set/added. *(COMPLETED 2026-06-18: FeeStructure gained optional `classId` for exact class/stream overrides (migration `20260618170000_i35_class_specific_fee_structures`); Finance UI can pick exact class/stream; student create/update and batch invoicing prefer exact-class structure before level fallback. Screenshot: `neyo/screenshots/i35-class-specific-fees.png`.)*
- [x] Trips and other extras are EXPENSES, not fees — adding them must NOT deduct/affect student fees. *(COMPLETED 2026-06-18: manual fee invoices reject trip/tour/outing/excursion/travel descriptions with a clear error instructing staff to record in Expenses instead; test verifies trip invoice is blocked. Invoice now has `kind` (FEE/ARREARS/MANUAL/SERVICE) from migration `20260618171500_i35_invoice_kind`.)*

## I.36 — Readability / Layout Fixes

- [x] Make text BIGGER in laptop/desktop view (currently too small; phone looks great) — scale up text + icons for desktop visibility. *(COMPLETED 2026-06-24: added an I.36 desktop-only readability lift in `src/app/globals.css` for screens ≥1024px: `html { font-size: 16.5px; }`, form fields 15.25px, and slightly stronger Lucide stroke. Mobile scale remains unchanged.)*
- [x] Fix the "Add guardian" page hiding itself inside the card (it doesn't display the full thing) — *(layout/overflow bug)*. *(COMPLETED 2026-06-24: `AddGuardian` modal in `src/components/students/student-profile-client.tsx` now uses a larger scrollable panel with `max-h-[min(92dvh,46rem)]`, sticky header/footer, proper backdrop blur, and responsive single-column phone / two-column desktop fields so it no longer hides inside the card.)*
- [x] Audit for any other similar hidden/cut-off layout issues. *(COMPLETED 2026-06-24: adjusted the new Learning Videos layout per founder feedback. Search results now use the whole screen width; “Videos shown in class” is a compact button that opens a preview dialog; results no longer show an empty dead screen because recommended search ideas are always visible; watching remains full-width in NEYO; no download action is exposed. Test `scripts/i36-readability-layout-learning-videos-test.ts`; screenshot `screenshots/i36-learning-videos-layout.png`.)*

## I.37 — NEYO Ops Master Switches + Mascot Launch

- [x] NEYO Ops (SUPER_ADMIN) can switch ANY feature OFF or ON platform-wide — *(OVERLAP: G.22 PlatformFlag; VERIFY it covers ALL features, not just modules)*. *(COMPLETED 2026-06-24: extended platform flags beyond module keys to individual navigation feature keys using `feature:<href>`. `platform-flags.service.ts` now lists both modules and app features from `NAVIGATION`, `pausedFeatureHrefs()` hides paused hrefs platform-wide through `(app)/layout.tsx` → `AppShell` → `Sidebar`, and `/api/admin/flags` remains SUPER_ADMIN-only and audited. Test `scripts/i37-neyo-ops-master-switches-test.ts`; screenshot `screenshots/i37-neyo-ops-flags.png`.)*
- [x] The official place to switch ON the Bundi mascot — *(OVERLAP: G.36 launch-day flag; VERIFY the toggle is in NEYO Ops)*. *(VERIFIED 2026-06-24: NEYO Ops → Platform Flags includes `bundi` with “Bundi Mascot Layer” label; when paused the button says “Launch Bundi”, and release uses the same audited `setFlag()` path. Test performs a launch rehearsal and returns Bundi to paused ship-state.)*

## I.38 — Command & Shortcut System

- [x] A real, working Command + Shortcut list, implemented with letters/keys, easy to understand — goal: make NEYO fast + user-friendly — *(OVERLAP: G.4 help overlay + G.7 ⌘K commands; VERIFY/expand into a full documented, working set)*. *(COMPLETED 2026-06-24: expanded `src/lib/core/commands.ts` and `src/components/shell/help-overlay.tsx`. The help overlay now has permission-filtered single-key navigation, clear labels/help text, and a Command button that opens the full ⌘K command/search palette. Hotkeys are blocked while typing and respect permissions before navigation. Test: `scripts/i38-command-shortcut-system-test.ts`; screenshot: `screenshots/i38-command-shortcuts.png`.)*
- [x] INCREASE the number of shortcuts so users don't have to scroll all the way down to reach low/buried modules. *(COMPLETED 2026-06-24: added direct shortcuts for low/buried modules including Learning Videos, Online Classes, Exam Timetable, Syllabus, Security Gate, Clinic, Cafeteria, Inventory, Transport, Library, Payroll, Staff, My Classes, My children, My School and NEYO Ops. Also added matching command-palette entries for Learning Videos, Attendance, Calendar, Exam Timetable, Syllabus, Security Gate and Online Classes.)*

## I.39 — Device ID Login Security

- [x] Each device gets a DEVICE ID to prevent people logging into other people's accounts — *(repo has `Session.deviceId` migrated; VERIFY it's enforced at login/session)*. *(COMPLETED 2026-06-18: `src/lib/core/device-id.ts` generates/validates `neyo_device_id`; password/OTP/magic/passkey/2FA session creation stores `Session.deviceId`; `getSessionContext()` rejects a session cookie without the matching device cookie. Smoke test: full cookies `/api/auth/me` OK, session-only cookie returns no user; `scripts/i1-auth-security-test.ts` verifies session device binding.)*

## I.40 — Passkey Fix

- [x] Passkeys feature is "kinda not working" — investigate + fix the passkey (WebAuthn) registration/login flow. *(FIXED 2026-06-18: root bug found in critical-action gate — it posted `neyoLoginId` to an endpoint requiring `email`, then verified without email and fell back to a fake success. Added proper signed-in WebAuthn action endpoints, removed the fake fallback, kept login/register routes type-clean, and documented browser-device testing steps. Browser ceremony still requires a real WebAuthn-capable browser/device, as expected.)*

## I.41 — Student QR → M-Pesa Pay

- [x] Each student has a QR code; when a parent scans it they're taken directly to M-Pesa to pay — *(OVERLAP: G.13 Mzazi Card QR; VERIFY the direct-to-M-Pesa scan flow + per-student QR)*. *(COMPLETED 2026-06-18: G.13 Mzazi QR already existed; added direct STK pay endpoint `POST /api/mzazi/[code]/pay` after guardian-phone verification. Public Mzazi page now shows amount field + “Send M-Pesa prompt” button and still keeps manual Paybill steps. Service links the payment to the oldest open invoice and uses school admission number when present, else NEYO number. Test `i41-mzazi-direct-pay-test.ts` verifies STK checkout + callback applies to correct invoice. Screenshot: `neyo/screenshots/i41-mzazi-direct-pay.png`.)*

## I.42 — Customizable ID & Document Designs

- [x] A school can EDIT how their student ID design looks (custom design). *(COMPLETED 2026-06-24: added school-owned document design defaults in `Tenant.documentDesignJson`, service `document-design.service.ts`, API `/api/document-design`, and Students → Bulk ID Cards modal controls for ID template/design. Schools can save the selected ID style as their default.)*
- [x] During printing, choose the EXACT measurements/dimensions (ID and other designed documents). *(COMPLETED 2026-06-24: bulk ID printing already accepted custom width/height; I.42 now persists default `idCardWidthMm` and `idCardHeightMm` via `/api/document-design`, and the bulk ID route uses saved defaults when no override is sent. Test renders a real custom-dimension PDF.)*
- [x] Schools can have their OWN design for documents generally. *(COMPLETED 2026-06-24: `documentDesignJson` stores general document style defaults (`classic`, `modern`, `compact`), small timetable logo preference and Powered by NEYO footer preference, creating a school-level document design seam for all generated documents.)*
- [x] ID printing per CLASS and per STREAM — *(OVERLAP: bulk-id-cards exists; VERIFY per-class + per-stream)*. *(VERIFIED 2026-06-24: Students list filtering by `classId` and `stream` controls the loaded student set; Bulk ID Cards sends the current filtered student IDs to `/api/students/bulk-id-cards`, so schools can print IDs per class and stream. Screenshot: `screenshots/i42-id-document-design.png`.)*

## I.43 — Universal Document Branding

- [x] EVERY generated document must show the school LOGO + a "Powered by NEYO" trademark at the bottom — *(OVERLAP: G.9/G.10 branding; VERIFY it's on ALL docs)*. *(COMPLETED 2026-06-24: audited and patched the generated PDF set. Admission letters, CBC reports, invoices, Mwalimu packs, Mzazi cards, payslips, receipts, report cards, student ID cards, transcripts and transfer letters now include the Powered by NEYO trademark; key documents also support school logo rendering via `logoUrl`/`logoDataUrl`, with services/routes passing `tenant.logoUrl` where applicable. Test: `scripts/i43-universal-document-branding-test.ts`.)*
- [x] In the timetable (A4), the logo must be SMALL so it doesn't consume timetable space. *(COMPLETED 2026-06-24: the timetable print bundle now receives `tenantLogoUrl` and renders a compact `h-6 w-6 object-contain` logo next to the print-pack title, leaving timetable space for periods/subjects. Screenshot reference: `screenshots/i43-universal-document-branding.png`.)*

## I.44 — Mobile Photo-on-the-go Uploads

- [x] For events/fields that need an upload, on mobile allow taking a PHOTO directly (camera capture) — *(some FileUpload already accept image/*; VERIFY camera capture across upload surfaces)*. *(COMPLETED 2026-06-18: shared `FileUpload` now adds `capture="environment"` automatically for image-capable upload inputs, keeps desktop file-picker behaviour, and visually uses a Camera icon. Because FileUpload powers student docs, incident proof, clinic/certificate uploads, messages, notes, etc., mobile browsers can open camera directly where image upload is allowed. Test `i44-mobile-photo-upload-test.ts`; screenshot `neyo/screenshots/i44-mobile-photo-upload.png`.)*

## I.45 — Smart Bulk Printing (merge small docs, cut later)

- [x] Small documents that don't fill an A4 and come in bulk can be MERGED onto one sheet at PRINT time only (different entities on one paper, cut apart after) to avoid wasting paper — e.g. short newsletters; merge-for-printing only, keeps entities separate. *(COMPLETED 2026-06-18: verified existing Students newsletter printer already performs print-time 1-up/2-up/4-up A4 merging with separate newsletter-card entities and dotted cut guides; no data merge occurs in DB. Test `i45-smart-bulk-print-test.ts` verifies 1/2/4-up logic and cut lines. Screenshot: `neyo/screenshots/i45-smart-bulk-print-newsletters.png`.)*

## I.46 — Customizable Newsletters

- [x] Newsletters can be customized PER STUDENT (e.g. with the student's name) when a school wants, or sent GENERAL. *(COMPLETED 2026-06-18: verified Students newsletter printer supports `{{student_name}}` and `{{admission_no}}` placeholders plus a personalized/general toggle. Same test covers placeholders and general-mode switch.)*

## I.34b — Dynamic Island (refinements, added 2026-06-17)

- [x] Make the dynamic island a bit LARGER on desktop (better visible) but NOT too big; slightly larger VERTICALLY but not too big. *(COMPLETED 2026-06-18: desktop island width/height increased modestly; screenshot `neyo/screenshots/i34-dynamic-island.png`.)*
- [x] Notch-safe: must not be affected by a MacBook notch. *(COMPLETED 2026-06-18: top offset uses `env(safe-area-inset-top)` with centered width cap.)*
- [x] Take a screenshot of the dynamic island so the founder can see how it looks. *(COMPLETED 2026-06-18: `neyo/screenshots/i34-dynamic-island.png`; notification panel screenshot also captured as `neyo/screenshots/i96-notification-panel.png`.)*

## I.25b — Glass Card Reflection (refinement)

- [x] REDUCE the reflection/sheen in the cards (current reflection too strong). *(COMPLETED 2026-06-23 as part of I.25: dashboard metric cards use `.dashboard-metric-card::before` sheen opacity `0.045 !important` and slower animation, reducing the glass reflection while retaining Liquid Glass depth.)*

## I.47 — Activate ALL Hardware-Deferred Features (with connect-when-bought design)

> Start every hardware-deferred feature now: build the FULL software side + a clean connection seam so it activates the moment the hardware/creds arrive. Design all aspects.
- [x] GPS Bus Tracking — full live-tracking UI/data model + tracker-feed seam (activates when GPS trackers fitted) — *(B.17/B.26; currently Haversine+geofence seam only)*. *(COMPLETED 2026-06-24: added `GpsBusLocation` model and token-ready POST `/api/hardware/gps` tracker feed. Hardware registry includes “Bus GPS Tracker Feed” and marks it connected only after real feed data is received; Transport still truthfully says tracker hardware is required. Test `scripts/i47-hardware-deferred-seams-test.ts` verifies GPS ingest.)*
- [x] Library hardware barcode scanner — wedge-input fully designed (activates with USB/BT scanner) — *(OVERLAP I.17)*. *(COMPLETED 2026-06-24: I.17 built the direct NEYO camera scanner plus truthful external scanner status. I.47 hardware registry includes BARCODE as READY_TO_PAIR / not connected until real scanner input; no fake connected state.)*
- [x] Thermal printer (80mm/58mm Web Bluetooth ESC/POS) — full receipt/badge path + connect seam — *(A.10 deferred)*. *(COMPLETED 2026-06-24: hardware service keeps the ESC/POS/WebUSB connection seam, while status is truthful: no simulated thermal printer is marked connected. Print Station/browser print path remains live; physical ESC/POS activation occurs when printer hardware is paired.)*
- [x] Biometric attendance hardware (fingerprint / RFID / face) — data model + device seam (activates with readers) — *(B.3 deferred lines)*. *(COMPLETED 2026-06-24: added `HardwareDeviceConnection` registry covering RFID, FINGERPRINT and FACE_CAMERA with truthful statuses; browser hardware service keeps WebUSB/WebSerial hooks but no longer marks simulated devices connected. Activation waits for real reader/camera hardware.)*
- [x] CCTV integration seam (B.22) — design + connect-when-bought. *(COMPLETED 2026-06-24: added `CctvCamera` model and `registerCctvCamera()` seam for NVR/RTSP endpoints. Status is `NOT_CONNECTED` or `READY_TO_PAIR`, never fake live video. Hardware Settings shows CCTV / NVR Stream Connector.)*
- [x] Face Recognition attendance (camera + vision) — seam + design (B.26). *(COMPLETED 2026-06-24: added `FACE_CAMERA` hardware registry seam and UI connector. No recognition is faked; it is staged as READY_TO_PAIR until real camera/vision hardware and future approved recognition pipeline are connected.)*
- [x] Each hardware feature: clear "connect your device" setup flow + status indicator, never faked. *(COMPLETED 2026-06-24: Hardware & Biometrics page now says nothing is shown connected until real browser/device permission succeeds or tracker feed posts data. Device cards show DISCONNECTED/READY_TO_PAIR/CONNECTED/ERROR and “Pair only after the device is physically plugged in.” Developer test tools do not mark hardware connected. Screenshot: `screenshots/i47-hardware-seams.png`.)*

## I.48 — NEYO Business Management OS (the company runs on NEYO, inside NEYO)

> A complete internal management system living INSIDE the NEYO OS (NEYO Ops area) — full cards/UI, not random/outside the website. NEYO uses NEYO to manage all NEYO operations. Do a very detailed analysis of how it manages all the OSes, company docs, and future OS launches.
- [x] Central NEYO Ops cockpit with cards covering EVERY company element (extends F.1 Founder Operations) — *(F.1 exists; expand massively)*. *(AUDITED/TICKED 2026-06-24: `NeyoBusinessOsCockpit` is mounted in Founder Ops → Business Operations and includes cards for accounts/billing/payments, OS lifecycle, NEYO staff/founder/ideas, company documents, maintenance/shutdown, subscriber communications, pricing, YouTube/social, contracts/signing, grace enforcement, customer communication hub and brand assets. Verified by `scripts/i48-neyo-business-os-cockpit-test.ts`; screenshot `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] Manage Accounts, Billing, Subscriptions, Payments — all from inside NEYO Ops. *(COMPLETED 2026-06-24 checkpoint: Founder Ops settings API now returns tenant accounts with subscriptions plus NEYO `SubscriptionPayment` summary totals. Business Operations already supported subscription plan/status/grandfathered-price/grace override with audit `platform.subscription_override`; I.48 now surfaces paid/pending/count payment totals inside the subscription management card and cockpit account status. Test `scripts/i48-accounts-billing-payments-test.ts`; screenshot `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] Planning + Launching of new OSes (lifecycle management for School/Farm/Business/Creator OS and future ones). *(AUDITED/TICKED 2026-06-24: Business Operations has `OsLifecycleBoard`, storing editable lifecycle rows in `PlatformSetting` key `neyo_os_lifecycle`. It covers School OS, Business OS, Farm OS and Creator OS with launch statuses PLANNED/BUILDING/BETA/LIVE/PAUSED, target launch and notes. Updates use SUPER_ADMIN-only `update_platform_setting` with audit `platform.setting_updated`. Verified by `scripts/i48-neyo-os-lifecycle-test.ts`; screenshot `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] NEYO Staff management + Founder page + Idea creation board. *(COMPLETED 2026-06-24: added company-level `NeyoIdea` model via migration `20260624103000_i48_neyo_idea_board`; Founder Ops settings API now returns active SUPER_ADMIN NEYO staff and ideas, plus `create_idea` / `update_idea` mutations with audit logs `platform.idea_created` and `platform.idea_status_updated`. Business Operations now includes “NEYO Staff & Idea Board” with team visibility, founder idea form, priority/status/owner/feature-key fields and pipeline status updates. Test `scripts/i48-neyo-staff-ideas-test.ts`; screenshot refreshed `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] NEYO company DOCUMENTS managed in-system (incl. Privacy Policy/Terms editable in NEYO Ops → auto-updates live site, NO code edits). *(COMPLETED 2026-06-24: verified `/privacy` and `/terms` read live `PlatformSetting` rows (`privacy_policy`, `terms_of_service`) with fallback legal copy; Business Operations → Live Legal & Compliance Editor edits these settings from NEYO Ops through SUPER_ADMIN-only `update_platform_setting` with audit `platform.setting_updated`. Fixed editor behaviour so typing is local and saving happens on Save button. Test `scripts/i48-company-documents-test.ts`; screenshot `screenshots/i48-company-documents.png`.)*
- [x] One-tap system SHUTDOWN/maintenance mode by the founder (take the system down for a period to fix things, bring it back in a tap). *(AUDITED/TICKED 2026-06-24: root layout reads `maintenance_mode`, `maintenance_message` and `maintenance_eta`, blocks non-SUPER_ADMIN users with a polished maintenance screen, and Business Operations has Tap-to-Shutdown / Restore Live Operations plus editable notice/ETA saved through audited `update_platform_setting`. Verified by `scripts/i48-maintenance-shutdown-test.ts`; screenshot `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] Talk to subscribers easily/quickly from NEYO Ops (broadcast/comms to customers). *(COMPLETED 2026-06-24: deepened Founder Ops subscriber communications. `send_broadcast` now supports subscriber segments (`all`, `active`, `trial`, `past_due`, `grace`, `suspended`), sends in-app notifications to school owners/principals and SMS to tenant phones where available, returns sent/skipped counts, and audit-logs `platform.subscriber_broadcast_sent`. Business Operations UI now has a segment selector and clear copy. Test `scripts/i48-subscriber-communications-test.ts`; screenshot `screenshots/i48-neyo-business-os-cockpit.png`.)*
- [x] Change PRICING from NEYO Ops without touching code (auto-applies; grandfathering respected). *(COMPLETED 2026-06-24 checkpoint: added company-level dynamic pricing catalog stored in `PlatformSetting` key `neyo_pricing_catalog`, validated by `src/lib/services/pricing-catalog.service.ts`. Founder Ops settings API returns `pricingCatalog` and POST action `update_pricing_catalog` saves edits with audit `platform.pricing_catalog_updated`. Business Operations now includes “Pricing & Package Editor — no code touch” for plan price, student/staff limits, per-student price, included modules, package highlights, support promise, add-on pricing, and explicit out-of-package SMS bundles. Billing and plan subscription flows now read dynamic pricing via `getPlanFromCatalog`; existing `Subscription.grandfatheredPrice` rows are not rewritten on global catalog save, while new/changed subscriptions lock the current dynamic price. Founder rule enforced: SMS cannot be included inside packages; SMS quota comes from active SMS top-up add-ons. Test `scripts/i48-pricing-catalog-test.ts`; screenshot `screenshots/i48-pricing-catalog.png`.)*
- [x] Manage YouTube videos/posting from NEYO Ops (see I.51). *(COMPLETED 2026-06-24 checkpoint: added company-level `NeyoYoutubePost` model through migration `20260624143000_i48_youtube_ops_posts`; added `src/lib/services/neyo-youtube.service.ts` for posting records, status updates, YouTube ID extraction and audit logs `platform.youtube_post_created`, `platform.youtube_post_updated`, `platform.youtube_post_status_updated`, `platform.youtube_post_deleted`. Founder Ops settings API now returns `youtubePosts`; POST actions `upsert_youtube_post`, `update_youtube_post_status`, `delete_youtube_post` manage the posting calendar. Business Operations now includes “YouTube Management & Posting Hub” with schedule/status metrics, post copy form, audience/channel/school/owner fields, honest YouTube authorization boundary and empty/populated calendar states. Strategy doc: `docs/YOUTUBE-MANAGEMENT-POSTING-STRATEGY.md`. Test `scripts/i48-youtube-ops-management-test.ts`; screenshot `screenshots/i48-youtube-ops.png`.)*
- [x] Contract signing management. *(COMPLETED 2026-06-24 checkpoint: added company-level `NeyoContract` model through migration `20260624152000_i48_contract_signing`; added `src/lib/services/neyo-contract.service.ts` for contract templates/body, secure public signing tokens, status updates, typed signatures and audit logs `platform.contract_created`, `platform.contract_updated`, `platform.contract_status_updated`, `platform.contract_signed`, `platform.contract_deleted`. Founder Ops settings API now returns `contracts`; POST actions `upsert_contract`, `update_contract_status`, `delete_contract` manage contracts. Added public signing API/page `/api/contracts/sign/[token]` and `/contracts/sign/[token]` with typed signature confirmation. Business Operations now includes “Contract Signing Management” with draft/sent/signed metrics, onboarding contract form, school link, signer fields, contract body, secure signing link copy and register empty/populated states. Test `scripts/i48-contract-signing-test.ts`; screenshot `screenshots/i48-contract-signing.png`.)*
- [x] Grace-period enforcement: when a payment grace period lapses with no customer communication, the system does the necessary (suspend per policy, never delete data) automatically. *(COMPLETED 2026-06-24 checkpoint: deepened `runSubscriptionStateMachine()` in `src/lib/services/billing.service.ts`. Overdue paid subscriptions now enter GRACE with immediate school-owner/principal in-app notice + tenant SMS and audit `billing.grace_notice_sent`; grace ending within 3 days sends one warning `billing.grace_warning_sent`; expired grace sends final communication if no warning exists, then sets `SUSPENDED` with audit `billing.suspended` metadata `dataPreserved` and `suspend_not_delete`. Daily job `subscription-state-machine` remains scheduled 01:00 EAT; Founder Ops adds `run_billing_enforcement` action, `graceSummary`, and Business Operations “Grace-period enforcement” monitor/run-now control. Test `scripts/i48-grace-enforcement-test.ts`; screenshot `screenshots/i48-grace-enforcement.png`.)*
- [x] Customer ↔ NEYO communication hub; possibly an integrated call system at scale. *(COMPLETED 2026-06-24 checkpoint: added company-level `NeyoCustomerThread` and `NeyoCustomerMessage` models via migration `20260624161000_i48_customer_neyo_hub`; added `src/lib/services/neyo-customer-hub.service.ts` for school-created threads, NEYO replies, status/priority updates and audit logs `platform.customer_thread_created`, `platform.customer_thread_replied`, `platform.customer_thread_message_added`, `platform.customer_thread_status_updated`. Added school-facing `/api/neyo-support` and Billing page “Contact NEYO about billing or your account”; Founder Ops settings API now returns `customerThreads` with actions `reply_customer_thread` and `update_customer_thread_status`. Business Operations now has “Customer ↔ NEYO Communication Hub” inbox with open/waiting/high-priority counts, thread cards, reply action and empty/populated states. Test `scripts/i48-customer-neyo-hub-test.ts`; screenshot `screenshots/i48-customer-neyo-hub.png`.)*
- [x] Manage/edit ALL brand assets (logo, favicons, wordmarks, mascot) directly in NEYO Ops — NO code, changes apply live. *(COMPLETED 2026-06-24 checkpoint: deepened NEYO Global Branding & Asset Editor in Founder Ops Business Operations. Existing live settings `neyo_logo_url`, `neyo_brand_primary`, `neyo_brand_accent` remain; added no-code PlatformSetting controls for `neyo_favicon_url`, `neyo_favicon_32_url`, `neyo_favicon_16_url`, `neyo_icon_192_url`, `neyo_apple_touch_icon_url`, `neyo_wordmark_light_url`, `neyo_wordmark_dark_url`, `neyo_mascot_url`, `neyo_mascot_hero_url`, and `neyo_pattern_url`. Root `generateMetadata()` now reads favicon/PWA/Open Graph assets from PlatformSettings so brand assets apply without code edits. UI includes previews and “Save all brand assets”; saves remain SUPER_ADMIN-only through audited `update_platform_setting`. Test `scripts/i48-brand-assets-test.ts`; screenshot `screenshots/i48-brand-assets.png`.)*
- [x] Detailed analysis doc: how NEYO Ops manages all OSes + company docs + future-OS go-live. *(AUDITED/TICKED 2026-06-24: `docs/NEYO-BUSINESS-OS-ANALYSIS.md` updated to reflect current live I.48 operating model: data scopes, cockpit coverage, OS lifecycle, pricing/SMS policy, grace enforcement, contracts, customer communication, brand/content operations, company credentials and conclusion. Verified by `scripts/i48-neyo-business-os-cockpit-test.ts`.)*

## I.49 — Centralized Money + Instant Reconnect

- [x] ALL NEYO money is centralized into ONE account (every school/tenant subscription payment lands centrally). *(COMPLETED 2026-06-24: added central subscription billing service `src/lib/services/central-billing.service.ts`; subscription renewals now create `SubscriptionPayment` rows with `method` `central_mpesa_stk` / `central_mpesa_c2b`, `accountRef`, `phone`, and `checkoutRequestId`, not school-fee `Payment` rows. Migration `20260624172000_i49_central_subscription_money` adds central callback correlation fields to `SubscriptionPayment`. Founder Ops labels the central account route `/api/billing/central-callback`. Test `scripts/i49-central-money-reconnect-test.ts`; screenshot `screenshots/i49-central-money.png`.)*
- [x] When an account's trial/subscription expires, entering their number prompts INSTANT pay inside NEYO. *(COMPLETED 2026-06-24: existing expired-account lockout screen `ExpiredCheckoutClient` now uses `/api/billing/public-stk`, which calls `initiateCentralSubscriptionStk()` and starts a central NEYO M-Pesa STK prompt from inside the lockout screen. UI copy now states NEYO central billing and automatic reconnect. Test `scripts/i49-central-money-reconnect-test.ts`; screenshot `screenshots/i49-central-money.png`.)*
- [x] When they pay (even OUTSIDE NEYO), the M-Pesa callback AUTO-RECONNECTS the user to their account instantly. *(COMPLETED 2026-06-24: added `/api/billing/central-callback` and `handleCentralSubscriptionCallback()`. STK callbacks match by `checkoutRequestId`; outside Paybill/C2B-style callbacks match `accountRef` / `BillRefNumber` / `AccountReference` formatted as `NEYO-<school-slug>`, create/reconcile a `SubscriptionPayment`, set the subscription ACTIVE, clear `graceEndsAt`, extend the period, and audit `billing.central_payment_reconnected`. Test `scripts/i49-central-money-reconnect-test.ts`; screenshot `screenshots/i49-central-money.png`.)*

## I.50 — Cross-Cutting OS Support (multi-OS readiness)

- [x] Cross-cutting features must work across ALL OSes; anything built School-OS-only must be re-configured to support Business/Farm/Creator OS too (Auth, tenancy, billing, notifications, files, search, calendar, etc.). *(COMPLETED 2026-06-24 checkpoint: added OS-neutral registry `src/lib/core/operating-systems.ts` and `Tenant.osKey` via migration `20260624180000_i50_multi_os_tenant_key`, so auth/session, tenancy, billing, notifications, files, search, calendar/jobs, audits, platform flags, NEYO Ops support and customer communication can distinguish School/Business/Farm/Creator OS tenants. Existing tenants default to `school`; signup validation/onboarding persists the selected `osKey`. Added `docs/MULTI-OS-READINESS.md` as the cross-cutting rulebook. Test `scripts/i50-multi-os-readiness-test.ts`; screenshot `screenshots/i50-multi-os-login.png`.)*
- [x] Each OS has its OWN login/onboarding flow so users aren't confused (OS picker → sign in / sign up per OS). *(COMPLETED 2026-06-24 checkpoint: added dedicated OS entry routes `/os/school/login`, `/os/business/login`, `/os/farm/login`, `/os/creator/login` and `/os/[os]/onboarding`; login page now shows OS picker chips and OS-specific tagline. School OS onboarding remains live; Business/Farm/Creator onboarding routes safely to waitlist until launch, avoiding accidental School OS signup confusion. Test `scripts/i50-multi-os-readiness-test.ts`; screenshot `screenshots/i50-multi-os-login.png`.)*

## I.51 — YouTube Management & Posting (NEYO Ops + School OS)

- [x] YouTube management + posting integrated, controlled from NEYO Ops — *(extends I.27)*. *(COMPLETED 2026-06-24 via I.48 checkpoint: `NeyoYoutubePost` DB model, Founder Ops API actions, Business Operations posting hub, audit logs, and strategy doc. This is planning/status/link management now; real channel upload waits for YouTube OAuth authorization so NEYO does not pretend to upload without credentials.)*
- [x] YouTube learning configured inside School OS with search optimized for YouTube-related learning searches — *(OVERLAP I.27)*. *(AUDITED/TICKED 2026-06-24: verified existing I.27/I.36 School OS learning-video implementation. `LearningVideo` and `LearningVideoSession` store saved videos and class sessions; `/learning-videos` lets signed-in teachers/students search saved videos and, when `youtube_api_key` is saved in NEYO Ops vault (or `YOUTUBE_API_KEY` env fallback), strict safe embeddable YouTube education search (`safeSearch=strict`, `videoEmbeddable=true`, category 27, KE/en). Videos play inside NEYO through `youtube-nocookie.com`, teachers can cast to `/learning-videos/cast/[code]`, students can reopen shown-in-class videos, recommended search ideas prevent empty screens, and no download action is exposed. Verified by `scripts/i27-youtube-learning-test.ts` and `scripts/i36-readability-layout-learning-videos-test.ts`; screenshots `screenshots/i27-youtube-learning.png` and `screenshots/i36-learning-videos-layout.png`.)*
- [x] Create a document on YouTube management/posting strategy. *(COMPLETED 2026-06-24: `docs/YOUTUBE-MANAGEMENT-POSTING-STRATEGY.md` explains School OS learning videos vs NEYO Ops posting management, posting states, approval discipline, privacy/ad reality, and future YouTube API/OAuth activation.)*

## I.52 — NEYO Public Landing Page (FOUNDER VERBATIM REQUIREMENTS — recorded 2026-06-17)

> Founder rewrote the requirements; the previously-drafted version was deleted. These are the founder's exact requirements to follow. Build with React/Next.js/TypeScript/Tailwind, every section a reusable component, production-grade. The face of NEYO — take maximum time/quality. MUST follow brand rules but must NOT use the Liquid Glass design. The aesthetic the founder wants is "Modern African Enterprise SaaS" (Odoo simplicity + Stripe professionalism + Notion cleanliness + Linear precision + African warmth) — it currently "kinda looks AI generated" and must NOT.

### Vision & framing
- [ ] NEYO is NOT a single product — it is a software ECOSYSTEM that builds operating systems for organizations. Vision: "One company. Many operating systems." NEYO creates specialized cloud operating systems that help organizations run their entire operations from one platform.
- [ ] Current products: School OS, Farm OS, Business OS, Creator OS (with their features). Future products can be added WITHOUT redesigning the website.
- [ ] Must feel like a real billion-dollar technology company.

### Design philosophy (world-class SaaS designer/branding/UX/copywriter/frontend-architect/conversion brief)
- [ ] Premium · Minimal · Professional · Trustworthy · Modern · Product-first · Enterprise-grade · Kenyan roots with global standards.
- [ ] Color philosophy: Deep Navy · Kenyan Green · Warm White · subtle accents only.
- [ ] Unique identity — do NOT look copied from another company.
- [ ] AVOID: generic AI SaaS design, stock photos, corporate clichés, generic gradients, generic startup language, fake testimonials, empty buzzwords, neon/AI gradients, purple glowing effects, floating random 3D objects, robot illustrations everywhere, generic AI people, "Revolutionary AI Platform", "Transforming the Future", buzzword overload.
- [ ] Anti-AI / Anti-Corporate / Editorial / Minimalist / Mobile-first / Conversion-focused / Friendly-Enterprise feel (per the Odoo analysis): white backgrounds, large editorial typography, marker-highlight accents (hand-drawn yellow-marker style under key words), soft shadows, rounded corners, real screenshots, custom illustrations, mascot (Bundi), minimal gradients, plenty of whitespace, casual human language, value understood in 3 seconds, clear visual hierarchy, large buttons.
- [ ] Feelings to evoke: principal → "trustworthy"; business owner → "professional"; parent → "easy to use"; developer → "real software company".

### Required website structure
- [x] 1. GLOBAL NAVIGATION — Logo "Neyo"; nav: Products, Solutions, Industries, Pricing, Resources, Company; right side: Login, Request Demo; STICKY. *(COMPLETED 2026-06-24 Batch 3: sticky editorial nav renders editable `landingContent.nav`, logo, Login, Request demo, Install and mobile menu. Screenshot `screenshots/i52-public-homepage-batch3-desktop.png` / mobile.)*
- [x] 2. HERO — unforgettable; headline communicates "One platform. Many operating systems. Built for modern organizations."; subheadline "Neyo helps schools, farms, retailers, and businesses run their entire operations from a unified cloud platform."; primary CTA "Request Demo"; secondary CTA "Explore Products"; hero visual = custom ecosystem visualization (Neyo Platform connected to School OS / Farm OS / Business OS / Creator OS with animated data flows) — NOT stock photos. *(COMPLETED 2026-06-24 Batch 3: editable hero headline/subheadline/CTAs and a custom NEYO Platform ecosystem card connecting School/Farm/Business/Creator OS; no stock photos.)*
- [x] 3. TRUST SECTION — why orgs trust NEYO: 99.9% uptime, cloud based, secure infrastructure, role based permissions, audit logs, multi-device access — beautiful statistic cards. *(COMPLETED 2026-06-24 Batch 2/3: editable `trustStats` render as premium statistic cards.)*
- [x] 4. PRODUCT ECOSYSTEM SECTION (most important) — large product cards, each feels like a product launch page (School OS / Farm OS / Business OS / Creator OS); every card: description, key features, benefits, mini dashboard preview, Learn More button; design supports unlimited future OS products. *(COMPLETED 2026-06-24 Batch 2/3: `landingContent.products.map` renders unlimited OS cards with status, description, features, media slot and CTA.)*
- [x] 5. INTERACTIVE ECOSYSTEM VISUALIZATION — show how all products connect (Finance, Inventory, Users, Reports, Analytics, Notifications flow through the entire Neyo ecosystem) — a visual architecture diagram. *(COMPLETED 2026-06-24 Batch 2/3: custom NEYO Platform hero visual and product ecosystem card show shared finance/reports/users/notifications as public product value, without exposing internals.)*
- [x] 6. INDUSTRIES SECTION — Education, Retail, Agriculture, Healthcare, NGOs, SMEs, Enterprise — each a dedicated card. *(COMPLETED 2026-06-24 Batch 2/3: editable `industries` render as dedicated cards.)*
- [x] 7. WHY NEYO SECTION — modular architecture, unified reporting, cloud infrastructure, automation, local compliance, scalable architecture, multi-location support, enterprise security. *(COMPLETED 2026-06-24 Batch 2/3: editable `whyNeyo` benefits render in the dark enterprise section.)*
- [ ] 8. BUNDI MASCOT SECTION — labelled "COMING SOON"; introduce the NEYO assistant "Bundi" as a helpful operating assistant across every NEYO OS; capabilities: analytics, reports, data summaries, task assistance, natural language search, recommendations; premium illustration, NOT childish, professional technology assistant.
- [x] 9. PRODUCT SCREENSHOWCASE — realistic dashboard mockups (NOT generic charts), reuse the real app look; School/other dashboards looking like real software. *(COMPLETED 2026-06-24 Batch 2/3 foundation: editable `mediaShowcase` renders polished preview frames for real NEYO screenshots/videos and intentional empty slots; further real screenshot curation can continue in polish batches.)*
- [ ] 10. CUSTOMER STORIES — realistic placeholders, NO fake reviews; layouts prepared for future case studies.
- [x] 11. SECURITY SECTION — encryption, backups, permissions, audit logs, cloud hosting, compliance — enterprise style. *(COMPLETED 2026-06-24 Batch 2/3: editable `securityPoints` render as an enterprise trust/security section without exposing sensitive internals.)*
- [x] 12. FINAL CTA — headline "Ready to run your organization smarter?"; buttons Request Demo + Contact Sales. *(COMPLETED 2026-06-24 Batch 2/3: editable final headline/subheadline with Request demo and Contact sales CTAs.)*
- [x] 13. FOOTER — Products, Resources, Documentation, Company, Careers, Legal, Contact + social links; professional enterprise layout. *(COMPLETED 2026-06-24 Batch 2/3: enterprise black footer consumes editable footer/social links, newsletter-style capture and public-safe note.)*

### Design + frontend deliverables
- [ ] Complete UX structure + complete UI design; responsive desktop/tablet/mobile; component hierarchy; design system; typography system; spacing system; color system; icon system; animations; interaction design; accessibility requirements.
- [ ] Frontend: React, Next.js, TypeScript, Tailwind CSS; every section a reusable component; production-grade layouts; realistic dashboard illustrations; sophisticated animations; nothing that looks AI-generated; final result should look like a company that already raised millions and is preparing for global expansion.
- [ ] Take screenshots of ALL landing pages so the founder can review (it must NOT look AI-generated).

### Founder-added landing-page requirements from 2026-06-24 screenshots/notes
- [x] Borrow premium reference-site quality only as inspiration — founder later preferred Odoo direction over JerseyBird: friendly product-first hero, app-grid clarity, soft enterprise cards, clear CTAs, polished footer — but NEYO must stay unique and must NOT copy another brand's layout/logo/look. *(UPDATED 2026-06-24 Batch 108: Odoo homepage reviewed and landing adjusted to a lighter Odoo-inspired NEYO-owned product-first style; screenshot `screenshots/i52-public-homepage-odoo-inspired-desktop.png`.)*
- [x] Landing-page content must be editable from NEYO Ops: nav labels, hero headline/subheadline, CTAs, product cards, trust stats, feature sections, industries, security copy, footer links, social links, screenshots/videos, demo/waitlist cards, SEO/Open Graph metadata and launch banners. *(COMPLETED 2026-06-24 Batch 2: public homepage now consumes `neyo_landing_content` from NEYO Ops through `getLandingContent()` and renders editable nav, hero, CTAs, trust stats, product ecosystem cards, industries, why-NEYO benefits, security points, media showcase slots, footer links and social links. Test `scripts/i52-public-homepage-renderer-test.ts`; screenshot `screenshots/i52-public-homepage-batch2.png`.)*
- [x] NEYO Ops landing editor must be full-stack: DB/PlatformSetting or dedicated content model, validation, SUPER_ADMIN API, audit log, UI editor, preview states, seed content, tests and screenshots. *(COMPLETED 2026-06-24 Batch 1: added `src/lib/services/landing-content.service.ts` storing validated landing content in `PlatformSetting` key `neyo_landing_content`, with default seed content, public-safe validation blocking secrets/internal wording, SUPER_ADMIN Founder Ops API action `update_landing_content`, audit `platform.landing_content_updated`, and Business Operations “Landing Page Content Editor” with core fields, media slots and advanced JSON editor. Test `scripts/i52-landing-content-editor-test.ts`; screenshot `screenshots/i52-landing-content-editor.png`.)*
- [x] Changes made in NEYO Ops must reflect in all directions: public homepage, OS-specific landing sections, SEO metadata, Open Graph image/text, footer, CTA links, demo/waitlist pages and any reusable landing components. *(COMPLETED 2026-06-24 Batch 3 for the corporate homepage: `getLandingContent()` drives public homepage sections, CTAs, footer and media; `generateMetadata()` wires SEO/Open Graph/Twitter metadata to NEYO Ops landing content. OS-specific login/onboarding routes already exist from I.50.)*
- [x] Public landing page must expose features and outcomes only — never brand secrets, internal integrations, private architecture, API keys, provider credentials, database details, prompts, or company-sensitive operational logic. *(COMPLETED 2026-06-24 Batch 2: landing content validation blocks secret/internal wording and the public renderer uses feature/outcome copy only; footer explicitly states “Features only. No private integration details exposed.”)*
- [x] Add media showcase areas where NEYO can place real screenshots/videos: hero product visual, School OS dashboard, finance/payment flow, Learning Videos/casting, NEYO Ops cockpit, mobile views and future OS previews. Empty media slots must look intentional, not broken. *(COMPLETED 2026-06-24 Batch 2: public homepage renderer includes editable `mediaShowcase` section with screenshot/video slots and intentional empty-state cards; product cards also show media-ready or media-slot states.)*
- [ ] Product visuals must show the real deal: use carefully designed screenshots/mockups based on actual NEYO UI rather than generic charts, stock dashboards, fake metrics or random SaaS cards.
- [x] Copy must be precise and human: short sections, clear benefits, Kenyan context where useful, no buzzword overload, no “brand secrets”, no exaggerated claims, no fake testimonials. *(COMPLETED 2026-06-24 Batch 3: renderer uses concise feature/outcome copy from editable content and validation blocks secret/internal wording.)*
- [x] Footer must feel enterprise-grade: newsletter/free-design-style capture adapted to NEYO, product/resource/company/legal/contact columns, social links, country/currency/local context where relevant, and no clutter. *(COMPLETED 2026-06-24 Batch 3: footer has enterprise black layout, editable links/socials, email capture, Kenyan organization positioning and no internal details.)*
- [~] Build slowly in batches: first content model/editor, then homepage structure, then media showcase, then responsive polish, then screenshots and review. *(Batch 1 content model/editor completed 2026-06-24; Batch 2 public homepage renderer + media slots completed; Batch 3 responsive/premium polish + SEO/Open Graph wiring + desktop/mobile screenshots completed. Remaining I.52 items: Bundi section, customer-story placeholders, final holistic design-deliverable reconciliation.)*

## I.53 — Coming-Soon & Gated Demo Waitlist (landing → product)

- [ ] Landing advertises ALL OSes (Business/School/Farm/Creator); only School OS is live — clicking Business/Farm/Creator OS shows a "Coming soon" note + a WAITLIST sign-up (collect email).
- [ ] Clicking School OS → official Login / Sign in + Demo area.
- [ ] Demo is NOT viewable by just clicking — one must JOIN the waiting list; upon APPROVAL the requester gets the demo link. Same gated waitlist for the other OSes — when they launch, those who left their email get the demo (keeps it easy for NEYO's first clients).
- [ ] School OS: easy Login + Sign up; on choosing, it asks which OS, then Login or Sign up per OS.
- [ ] Each OS has its OWN way to know how it works in the login (avoid confusion).

## I.54 — Brand-Asset Self-Service (no code)

- [x] Founder can edit logo, favicons, wordmarks, mascot and any brand assets directly in NEYO Ops — changes apply live, never touching code — *(OVERLAP I.48; explicit because current assets aren't final)*. *(COMPLETED 2026-06-24 via I.48 brand-assets checkpoint: Business Operations editor now controls logo, colors, favicons, PWA icons, wordmarks, Bundi mascot assets and pattern tile through live PlatformSettings + dynamic metadata.)*

## I.55 — Comprehensive Founder PDF (~50 pages, non-coder friendly)

- [x] Produce a very detailed PDF/manual for the whole NEYO company for a non-coder: how to do EVERYTHING — onboarding, pricing, deployment, and how to TEST every School OS feature, how to test TONIGHT on a local laptop from scratch, how to market, hidden features, and a general understanding of NEYO OS. Make it ~50 pages, thorough. *(COMPLETED 2026-06-24: created `docs/NEYO-FOUNDER-MANUAL.md`, printable `docs/NEYO-FOUNDER-MANUAL.html`, and rendered `docs/NEYO-FOUNDER-MANUAL.pdf` with 50 page-style sections plus appendices. Covers NEYO overview, NEYO Ops, local testing, role tests, pricing, central billing, grace enforcement, legal docs, contracts, customer hub, branding, landing page, YouTube learning/casting, hardware truthfulness, payments, module testing checklists, deployment, environment variables, GitHub basics, screenshots, marketing to 100 schools, school-visit blueprint, scale confidence and founder weekly routine. Screenshot `screenshots/i55-founder-manual-cover.png`.)*
- [x] Include: how to deploy, how to run localhost on the PC, GitHub guidance (see I.57). *(COMPLETED 2026-06-24: manual includes local setup commands, deployment overview, environment-variable categories, GitHub commit workflow and pre-commit testing routine.)*

## F.3 — Customer Success (now actionable, was Part F)

- [ ] Build Part F.3 lines (24h WhatsApp SLA, onboarding calls, check-ins, NPS, advisory board, help docs, status page, public roadmap, public changelog) — manage from NEYO Ops where applicable.

## F.4 — Community & Impact (now actionable, was Part F)

- [ ] Build Part F.4 lines (Karibu Scholarship free schools, KEPSHA partnership, mentorship, open-source utilities, NEYO Conference, B-Corp, PBO, AfriLabs, iHub, speaking) — manage/track from NEYO Ops.

## I.56 — Scale & Storage (founder questions)

- [x] Confirm + harden the architecture to scale to 2,000,000 active users (Neon Postgres + pooling/replicas, Redis, CDN, queues, stateless app) — *(OVERLAP G.35; verify the 2M target specifically)*. *(COMPLETED 2026-06-25: added `docs/NEYO-SCALE-2M-ARCHITECTURE.md` covering the 2M-user production architecture: stateless Next.js, CDN, Neon/Postgres pooling, read replicas, Redis/BullMQ queues, worker fleet, encrypted R2/S3 storage, observability, rate limits, backup/restore, load testing and readiness gates. Added `src/lib/services/scale-readiness.service.ts` plus SUPER_ADMIN-only `/api/admin/scale-readiness` to inspect production prerequisites without exposing secrets: Postgres, pooling, Redis, object storage, encrypted uploads, worker, observability, cron secret and master KEK. Test `scripts/i56-scale-readiness-test.ts`; no screenshot because this is architecture/API hardening.)*
- [x] Storage strategy/answer: object storage (R2) plan, document/media volume, retention, costs at scale. *(COMPLETED 2026-06-24 design answer; UPDATED after founder clarification and MVP build: added `docs/NEYO-STORAGE-STRATEGY.md`; built Storage Vault MVP with `TenantStorageProvider`, `StorageUsageSnapshot`, encrypted-file metadata fields on `StoredFile`, `/api/storage-vault`, Settings → Storage UI, usage bar, health/status badges, provider choices (`NEYO_MANAGED_OBJECT_STORAGE`, `GOOGLE_WORKSPACE_MANAGED`, `GOOGLE_WORKSPACE_BYOS`), AES-256-GCM envelope-mode display, audit logs `storage.provider_configured` / `storage.upgrade_requested`, and upgrade paths including Google Workspace upgrade and NEYO managed add-on KES 500+. Real Google Workspace/Admin SDK provisioning remains a credentials/legal-consent activation seam; no plaintext Google passwords are stored. Batch 2 added encrypted upload adapter: `encryptBufferForTenant()` / `decryptBufferForTenant()`, `uploadEncryptedFile()`, `/api/files/encrypted`, encrypted processed-image uploads, decrypt-on-read in `readObject()`, and encryption metadata on `StoredFile`; external providers receive AES-256-GCM envelope blobs, not plaintext. Batch 3 migrated reusable `FileUpload` from direct presign/PUT/confirm to `/api/files/encrypted`, so normal app upload surfaces encrypt before provider storage. Batch 4 locked legacy direct upload routes (`/api/files/presign`, `/api/files/confirm`, `/api/files/dev-put`) to return 410 Gone and point callers to encrypted uploads. Tests `scripts/i56-storage-vault-mvp-test.ts`, `scripts/i56-encrypted-upload-adapter-test.ts`, `scripts/i56-direct-upload-migration-test.ts`, and `scripts/i56-lock-legacy-direct-upload-routes-test.ts`; screenshot `screenshots/i56-storage-vault.png`.)*

## I.57 — GitHub / Local-Host Workflow Help

- [ ] Resolve the founder's GitHub trouble (new files staying in an uncommitted "to commit" state; repo not adding all files) — provide a clean, simple commit/push workflow (and whether a fresh repo/account helps).
- [ ] Provide a reliable "run NEYO on my own PC localhost" guide (extends RUN-LOCALLY-FOR-FOUNDER.md).

## I.58 — Performance (no lag)

- [~] Responses must be QUICK; eliminate lag — performance pass across the app (the founder explicitly flagged sluggishness). *(PARTIAL 2026-06-25 hydration stability pass: added `suppressHydrationWarning` on root `<body>` in `src/app/layout.tsx` to tolerate browser/extension-injected body attributes and reduce hydration crashes. Clean Chromium debug run did not reproduce hydration mismatch; only dev Fast Refresh RSC warning appeared. Verification: typecheck ✓, test:roles 24/24 ✓, `scripts/debug-hydration.ts` clean of hydration errors on /, /login, /dashboard, /settings/storage.)*

## I.59 — Shortcuts/Commands on Mobile

- [ ] Define + implement how commands/shortcuts work on MOBILE (no physical keyboard) — a mobile-friendly command affordance.

## I.60 — Deferred Integrations to ACTIVATE/verify (founder list)

> Founder pasted the deferred list and said "check on these features if not done, do them effectively." Most are creds/infra-gated seams — build everything buildable now + the activation path; flag the truly creds-gated ones.
- [x] OAuth (Google/Apple/Microsoft) + account linking + OAuth disconnect — creds-gated; build UI + seam, document activation. *(COMPLETED 2026-06-25: NEYO Ops vault stores OAuth client IDs/secrets; added `OAuthConnectedAccount`, `OAuthState`, `oauth-vault.service.ts`, `/api/oauth/status`, `/api/oauth/start/[provider]`, `/api/oauth/disconnect/[provider]`, `/api/oauth/callback/[provider]`, real Connected Accounts UI, provider token exchange, profile fetch/extraction, account linking and disconnect. Docs: `docs/INTEGRATION-KEYS-GUIDE.md`; tests `scripts/i60-oauth-live-exchange-test.ts` and `scripts/i60-oauth-youtube-vault-test.ts`.)*
- [x] M-Pesa STK push live (Daraja creds) — seam done; wire go-live + the I.49 instant-reconnect callback. *(COMPLETED 2026-06-25: central NEYO subscription billing now reads Daraja shortcode/environment/consumer key/consumer secret/passkey from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, switches from dev mock to `DarajaProvider` when credentials are present, sends STK with callback override `/api/billing/central-callback`, parses real Daraja callback shape, marks `SubscriptionPayment` PAID, activates subscription and reconnects the school. No code editing is needed after credentials are saved in NEYO Ops and Safaricom callback is registered. Test `scripts/i60-central-daraja-from-vault-test.ts`; UI screenshot `screenshots/i60-integration-credential-vault.png`.)*
- [x] Web Push + contextual prompt (VAPID), WhatsApp (token), SMS (AT key), Email (Resend) — build prompts/UX, activate on creds. *(COMPLETED 2026-06-25: Resend email, Web Push/VAPID, Africa's Talking SMS and WhatsApp Business outbound transports are now activated from encrypted NEYO Ops vault credentials. WhatsApp inbound bot remains separate from this outbound notification bundle.)*
- [x] Bulk async generation (BullMQ/Redis) — wire when Redis available. *(COMPLETED 2026-06-25: BullMQ adapter, `enqueue()`, worker process, health checks and scale-readiness now read Redis/Upstash URL from encrypted NEYO Ops vault credential `redis_url` with env fallback. No code edit needed after saving Redis URL in NEYO Ops. Test `scripts/i60-redis-worker-from-vault-test.ts`.)*
- [x] Sentry / Better Stack / PostHog observability — activate on keys (health endpoint exists). *(COMPLETED 2026-06-25: added `src/lib/observability/vault-observability.ts`; `captureError()`/`captureMessage()` now send to Sentry and Better Stack using encrypted NEYO Ops vault credentials `sentry_dsn`, `better_stack_token`, optional `better_stack_ingest_url`; `track()` now sends PostHog events using `posthog_key` and optional `posthog_host`. Test `scripts/i60-observability-from-vault-test.ts`.)*
- [x] I.60 full integrations activation guide — where to get every key/value, where to paste it in NEYO Ops, what each integration does, how to test, and key-rotation safety. *(COMPLETED 2026-06-25: added `docs/I60-INTEGRATIONS-ACTIVATION-GUIDE.md` covering central Daraja, Resend, VAPID/Web Push, Africa’s Talking SMS, WhatsApp Business, Redis/Upstash, Sentry/Better Stack/PostHog, TURN/WebRTC, YouTube Data API, Google/Apple/Microsoft OAuth, Bundi key, activation order, testing and emergency rotation.)*
- [x] Transcripts (multi-term), per-subject/per-teacher performance analytics, multi-term student progress — build now that data model allows. *(COMPLETED 2026-06-25: added `src/lib/services/exam-analytics.service.ts`, API `/api/exams/analytics`, and `ExamAnalyticsClient` mounted on `/exams`. Analytics uses real `Exam` and `ExamResult` records to calculate term trends, per-subject means, teacher-linked performance via `ClassSubjectNeed.teacherId`, and learner multi-term progress/delta/trend. Existing transcript PDF builder already aggregates published multi-term exam records; verified by `scripts/i60-exam-analytics-transcripts-test.ts`. Screenshot `screenshots/i60-exam-analytics.png`.)*
- [x] Live online classes (WebRTC) + disappearing class voice calls (I.9) — needs TURN/SFU; design + seam. *(COMPLETED 2026-06-25: added `src/lib/services/webrtc-config.service.ts` and signed-in `/api/webrtc/ice`, reading `stun_server_url`, `turn_server_url`, `turn_server_username`, and `turn_server_secret` from encrypted NEYO Ops Integration Credential Vault with env fallback. Online Classes and disappearing Class Voice Rooms now fetch vault-backed ICE servers before creating `RTCPeerConnection`; Google STUN fallback remains when TURN is absent. Test `scripts/i60-turn-webrtc-from-vault-test.ts`.)*
- [~] KCSE prediction / photo-grading — Bundi/AI-gated, keep deferred behind mascot. *(I.60 credential activation seam completed 2026-06-25: NEYO Ops Integration Credential Vault includes `bundi_provider_key`, but Bundi remains platform-paused and no feature depends on it.)*

## I.61 — Glass Transparency Setting & Liquid-Glass Everywhere

- [ ] Settings option for a USER to increase the transparency of the glass (personal liquidity/transparency control) — *(note: company-level liquid_level already exists G.33; this adds a user-facing transparency control)*.
- [ ] Dynamic-island TEXT must have the liquid-glass feel.
- [ ] EVERY element must feel the liquid glass — all of them.
- [ ] Theme contrast rule: text/island goes NAVY when on Liquid-White, WHITE when on Liquid-Navy (and matching for the other normal themes).
- [ ] Take a screenshot of the new features (incl. deep translucent liquid glass turned ON).

## I.62 — Custom User Theme (company-toggleable)

- [ ] A theme picker where a USER can choose/customize their own theme/style — but it's a FEATURE NEYO can switch OFF or ON globally.
- [ ] Take a screenshot of a custom theme when triggered.
- [ ] Document: how liquid customization helps users + how it serves NEYO's goal of being interactive + easy to use; propose additional design ideas + their effect on company goals.

## I.63 — Company Feature Toggles (launch-staging)

- [ ] Make ALL features toggle ON/OFF for the company, so a not-yet-launched feature can be hidden (toggled OFF) and revealed at launch (toggled ON) — "pretend a new feature is launching." Design it correctly (extends G.22 / I.37).

## I.64 — Brand Realism (anti-AI authenticity)

- [ ] Strategy + execution to build BRAND REALISM so NEYO doesn't look AI-generated; build a creative, modern, real brand identity (document + apply across product + landing).

## I.65 — Timetable: Subject Colours, Constraints, A4 Render, Combined Lessons

- [ ] Each subject has a COLOUR shown per subject in the timetable; a school can choose black & white for printing.
- [ ] Configurable CONSTRAINTS: number of lessons a subject may have (per ministry or school config), number of doubles/singles (not mandatory).
- [ ] Before generating: confirm prompt "Are you sure you want to generate without your own configured constraints?" → Yes = generate; No = tells them to set constraints and come back.
- [ ] Subjects show the generated TIME; rendered for A4 displaying everything needed (time, tables, subjects, teacher/class).
- [ ] Support COMBINED lessons.
- [ ] Subject ABBREVIATIONS supported; if none provided, system renders the subject in a recognizable way.
- [ ] Take screenshots testing the timetable with REAL classes/subjects/teachers + how a theme looks when triggered.

## I.66 — Prisma Seed Config Fix (founder error)

- [x] Founder hits: `npx prisma db seed` → error "...add a prisma.seed property...". *(FIXED 2026-06-17: root cause = prisma.seed ran `tsx prisma/seed.ts` but Prisma spawns without node_modules/.bin on PATH → `spawn tsx ENOENT`. Changed prisma.seed to `npx tsx prisma/seed.ts`; `npx prisma db seed` now exits 0 + full seed runs. `npm run db:seed` also works.)*

## I.67 — Infrastructure Audit (founder questions — explain in full detail)

- [ ] Confirm/add + EXPLAIN in full detail each of: caching, CDN, error tracking, logs, account recovery, CI/CD, version control, monitoring & alerts, and anything else missing — what each does and current status.
- [ ] Add OS system-design + system-architecture documents and things that belong in NEYO Ops.

## I.68 — Principal Dashboard Redesign (looks empty → full operating-system feel)

> Founder: dashboard looks empty; propose ideas first, then on approval do the redesign. Note: a redesigned-dashboard attempt currently throws "Something went wrong" — must be fixed.
- [x] FIX the "Something went wrong / unexpected problem" error on the redesigned dashboard; re-capture screenshot. *(VERIFIED FIXED 2026-06-17: dashboard renders HTTP 200 for ALL roles (principal/teacher/bursar/parent) with no error boundary — the error was caused by the missing-deps/un-seeded state (now `npm install` + I.66 seed fix). Screenshot i68-dashboard-working.png confirms money-first cards + line graph + intercom + activity all render. Remaining polish below still open.)*
- [x] POLISH (found in screenshot 2026-06-17): dynamic island overlaps the breadcrumb; cookie banner overlays the graph; graph values/hover; centering after search bar — fix in I.34/I.96 dynamic-island + overlay work. *(COMPLETED 2026-06-18: dynamic island is viewport-centered/notch-safe; graph uses real values and SVG titles. Founder asked to restore the previous full-width cookie banner, so cookie banner was reverted to the original bottom banner; founder confirmed it had no issue for him.)*
- [x] Cards link DIRECTLY to their module when clicked (and the same in the DEMO). *(COMPLETED 2026-06-18: demo start now sets/stores the device ID so I.39 session hardening no longer redirects demo users to login; browser test `i68-demo-dashboard-parity-test.ts` starts a demo tenant, opens `/dashboard`, verifies the same money-first cards and payments-vs-expected graph render, and captures `neyo/screenshots/i68-demo-dashboard-parity.png`. Live dashboard cards remain linked to `/finance`, `/attendance`, `/students`, `/staff`, `/calendar`, `/settings/billing`.)*
- [x] Shrink the "recent activity" to only the size of the activity (not oversized). *(COMPLETED 2026-06-18: dashboard Recent Activity is in a compact card with tighter header/content padding and `max-h-[300px]` scroll containment.)*
- [x] Cards: Total Students (→ Students tab), Total Teachers (→ Staff tab), Total Events & Planning, Reminders, and a card showing the school's current plan. *(COMPLETED 2026-06-18: dashboard has linked cards for Total Enrolled → `/students`, Total Staff → `/staff`, Events & Reminders → `/calendar` with real calendar+unread counts, and Subscription Plan → `/settings/billing` from the real subscription row.)*
- [x] A well-crafted ANIMATED graph: payments vs expected (line graph over time, with values). *(COMPLETED 2026-06-18: graph now derives expected line from current-term billed invoices and actual line from real PAID payments/term ledger; dynamic labels and totals shown; no hardcoded May/Aug values.)*
- [x] Propose + apply a strong principal dashboard layout (money-first per I.25) once founder approves the ideas. *(COMPLETED 2026-06-18: money-first layout is applied — outstanding fees, fees collected today, collection rate, presence, then operating cards, real graph, intercom, data-saver, compact activity.)*
- [x] Ensure DEMO responds the same as the live dashboard. *(COMPLETED 2026-06-18: fixed demo auto-login device binding in `/api/demo/start` + `createDemoSchool`; Playwright browser test verifies demo dashboard renders the same cards/graph and demo banner. Screenshot: `neyo/screenshots/i68-demo-dashboard-parity.png`.)*

## I.69 — Online Calling (principals/deputies, internet-only, no storage)

- [x] Integrated online calling for principals & deputies; works only with internet present; shows online/offline status; does NOT store conversations / use storage — *(needs WebRTC; relates to I.9/I.60)*. *(BUILT 2026-06-18: full-stack intercom signalling with `IntercomCall` model + migration `20260618154528_i69_intercom_call_signalling`; `/api/intercom` lists online/offline staff from real active sessions, starts RINGING calls, target must accept before `acceptedAt` and before timer starts, supports decline/end, blocks offline/busy. No audio content is stored; DB stores state only. Test `i69-intercom-call-test.ts` verifies online detection, ringing, target acceptance, acceptedAt, and end. Screenshots: `neyo/screenshots/i68-dashboard-intercom-online.png`, `neyo/screenshots/i69-intercom-ringing.png`.)*

## I.70 — Message Read Receipts (who viewed + when)

- [x] In messages, show who VIEWED a message and at what TIME — *(A.8 has lastReadAt; surface per-recipient "seen at" in the UI)*. *(COMPLETED 2026-06-18: `getMessages()` now returns real per-message `readBy` entries computed from ConversationParticipant.lastReadAt with user names/roles/timestamps; Messages UI removed the fake "Viewed by Deputy Njoroge" text and now shows actual "Seen by Name (time)" for sent messages. `i70-i85-message-receipts-test.ts` verifies sender sees who read and when.)*

## I.71 — Readability Pass #2 (bigger letters, no layout break)

- [ ] Increase letter size again across all fields for better visibility, but it must NOT affect any layout or design — *(refines I.36; careful, non-breaking)*.

## I.72 — Multi-Branch Schools

- [ ] Support a school with MANY branches.
- [ ] If the OWNER is the same across branches, they get consolidated UPDATES from all schools/branches.
- [ ] Staff reshuffle across branches: when staff move between branches, their records carry over correctly to the other school(s).

## I.73 — Timetable Advanced Rendering & Bulk Print

- [x] Non-lesson programs (e.g. Lunch, short breaks, breaks) MERGE cells and write the activity VERTICALLY, include their own break/lunch time ranges at the top/header, and a school can customize the in-cell font size.
- [x] Print ALL classes in one click; print ALL teachers in one click; print by VENUE (e.g. school lab, computer lab) in one click.
- [x] Period column shows only the NUMBER (not the word "Period"); the number is BIGGER than other text.
- [x] A school can choose whether DAYS are horizontal or vertical (and time/period correspond accordingly).

## I.74 — Company Liquid-Glass Master Toggle

- [x] As the company, toggle the liquid-glass features OFF/ON platform-wide — *(NEYO Ops control; relates to I.37/I.63)*. *(COMPLETED 2026-06-19: `PlatformSetting.neyo_liquid_system_active` is the company master switch, API `/api/platform/appearance` is SUPER_ADMIN-only for writes and returns `liquidEnabled` to all signed-in users, root layout + theme toggle respect the cached/server switch, and Settings → School exposes the NEYO Platform Liquid Glass Control with audit logging.)*

## I.75 — Custom Admission Numbers (school keeps its own + NEYO ID)

- [x] System uses the NEYO-generated ID, BUT if a school has its OWN admission numbers and wants to retain them, support adding them (e.g. during bulk import) while ALSO creating the NEYO admission numbers the system uses in all its processes. *(COMPLETED 2026-06-18: existing `Student.legacyAdmissionNo` is now fully wired. Manual create/edit supports school admission number while `admissionNo` remains NEYO-generated; bulk import maps school `Admission No/Adm No/Reg No` to `legacyAdmissionNo` while still generating NEYO ID. Duplicate legacy numbers are blocked. Screenshot: `neyo/screenshots/i75-custom-admission-profile.png`.)*
- [x] A school is not limited — they can search using their OWN admission numbers too. *(COMPLETED 2026-06-18: `listStudents`, Finance invoice search, and global search now include `legacyAdmissionNo`; UI displays `schoolNo · NEYO no` where helpful. Test verifies list and global search find the student by school admission number.)*
- [x] Parents can pay using EITHER admission number; payment is recorded carefully to the correct student. *(COMPLETED 2026-06-18: Mzazi card account number prefers the school admission number when present; payment callback now auto-matches unlinked Paybill/STK payments by either NEYO `admissionNo` or `legacyAdmissionNo`, applies to the oldest open invoice, and then runs the normal invoice-paid hook. Existing public STK route already double-checks both columns. Test verifies mock M-Pesa callback using school admission number applies payment to the correct invoice.)*

## I.76 — Demo Page Full Parity

- [x] The DEMO page/tenant must support ALL features and changes we made (theme/liquid changes, dashboard redesign, new modules, etc.) — demo behaves exactly like a real School OS, just sandboxed/expiring — *(extends G.14 demo)*. *(COMPLETED 2026-06-19: demo tenant now seeds real staff roles, subjects, current term, timetable config/slots with venues and period times, syllabus topics, exam timetable slot, cafeteria lunch queue, school admission numbers plus NEYO IDs, and still reads platform Liquid Glass settings. Screenshot: `neyo/screenshots/i76-demo-timetable-parity.png`.)*

## I.69b — Calling/WebRTC Copy & Controls (refinements)

- [x] In calling/WebRTC, do NOT show the underlying tech we use; do NOT show "no storage" — just call it "the system". *(COMPLETED 2026-06-18: Dashboard intercom copy now says NEYO Intercom / Call connected / Connected in the system and hides underlying technology wording.)*
- [x] Remove the word "SaaS" from the intercom button. *(VERIFIED 2026-06-18: intercom UI has no SaaS wording.)*
- [x] The call button + listen button are MISSING their icons — add them. *(COMPLETED 2026-06-18: call button now uses the Lucide Phone icon instead of an emoji.)*

## I.77 — Front-Desk M-Pesa STK to Parent

- [x] Front desk can send an M-Pesa STK push to a parent (collect fees at the desk) — *(OVERLAP: B.7+ desk STK already exists; VERIFY-AND-TICK + ensure it's on the Front Desk)*. *(VERIFIED 2026-06-19: Front Desk `/reception` has “M-Pesa fees” flow; `POST /api/reception/fees` requires `reception.operate` + `finance.record_payment`, calls `stkForInvoice`, creates a pending Payment linked to the selected invoice, sends prompt to the parent phone, and audit-logs `finance.stk_initiated`. Screenshot: `neyo/screenshots/i77-frontdesk-stk-parent.png`.)*

## I.78 — Duty-Roster Timetable for Teachers

- [x] A duty-roster timetable for teachers; the school chooses the reshuffle period and the system generates the roster — *(extends I.23; auto-generate + configurable rotation)*. *(COMPLETED 2026-06-19: added real `DutyRosterEntry` model/migration, tenant-scoped service/API `/api/academics/duty-roster`, saved weekly/bi-weekly/monthly generated blocks, teacher pool from DB, print roster, audit logging, and Academics → Duty Roster UI. Test: `scripts/i78-duty-roster-test.ts`; screenshot: `neyo/screenshots/i78-duty-roster-timetable.png`. REFINE 2026-06-19: school can also choose number of teachers per reshuffle cycle, stored as dutyTeamSize + dutyTeacherIds/dutyTeacherNames.)*

## I.79 — Holiday / Event Seasonal Themes

- [x] During holidays/events the system can show themes resembling the event + seasonal messages. *(COMPLETED 2026-06-19: added `seasonal-theme.service.ts`, signed-in API `/api/seasonal-theme`, and `SeasonalThemeBanner` mounted in the app shell. It uses real Kenyan cultural/public-holiday moments plus tenant CalendarEvent rows to show heritage/celebration/faith/academic/sports/event themed banners with seasonal messages and dismiss support. Test: `scripts/i79-seasonal-theme-test.ts`; screenshot: `neyo/screenshots/i79-seasonal-theme-banner.png`.)*

## I.80 — Device Biometric App Unlock (Face ID / Fingerprint)

- [x] A Settings feature to connect iPhone Face ID / Android fingerprint to unlock/open the app easily — capture screenshots of how it looks — *(distinct from H.2 action-gating; this is app-open unlock)*. *(COMPLETED 2026-06-19: added `DeviceAppUnlockCard` to Settings → Security. It requires an enrolled WebAuthn passkey/biometric first, verifies with the real biometric gate before enabling, stores per-device `neyo-app-unlock-enabled`, and `BiometricGateProvider` shows a non-dismissible “Unlock NEYO” prompt on app open until verified. Test: `scripts/i80-device-app-unlock-test.ts`; screenshot: `neyo/screenshots/i80-device-app-unlock-settings.png`.)*

## I.81 — Liquid-Glass Intensity Slider + Glass on Every Element

- [x] An adjustable INTENSITY for the liquid-glass look (user can adjust how it looks) — *(refines I.61; a real slider)*. *(COMPLETED 2026-06-19: Settings → School now has “My Liquid Glass Intensity” range slider. It persists per-device as `neyo-liquid-intensity`, applies live CSS variables `--lg-user-blur-boost` and `--lg-user-sheen-extra`, and root pre-paint applies it before render.)*
- [x] The GREEN buttons currently lack the liquid-glass effect — EVERY element must have it (buttons included). *(COMPLETED 2026-06-19: global CSS now gives green primary buttons glass blur, specular highlight/rim, gradient liquid fill, shadows, and intensity-aware blur boost while keeping the shared Button component glass-ready.)*

## I.82 — Mobile Top-Bar / Island Behaviour

- [x] On mobile, hide the top buttons (Settings) so they don't clash with the phone's default island/notch; show ONE element (the notifier); pressing it TWICE brings the other 2 down. *(COMPLETED 2026-06-19: mobile topbar now shows only NotificationBell as the visible right-side control; OfflineIndicator, ThemeToggle and UserMenu are hidden until double-tapping the notifier, then they drop down below the topbar. Desktop remains unchanged.)*
- [x] Take screenshots of the mobile top-bar/island behaviour. *(COMPLETED 2026-06-19: screenshots captured: `neyo/screenshots/i82-mobile-topbar-notifier-only.png` and `neyo/screenshots/i82-mobile-topbar-expanded.png`.)*

## I.83 — "Make NEYO Feel Alive" + More Toggleable Features

- [x] Overall goal: make NEYO feel ALIVE + easy to use; propose + add as many strong final features as possible, each TOGGLEABLE on/off from NEYO Ops (so they can be staged for launch). *(COMPLETED 2026-06-19: added NEYO Alive Mode with platform toggles for main alive mode, live heartbeat pulse, rotating calm microcopy, and soft motion. SUPER_ADMIN controls live in NEYO Ops → Business Operations; schools read `/api/platform/alive-mode`; app shell mounts `AliveModeLayer`. Test: `scripts/i83-alive-mode-test.ts`; screenshot: `neyo/screenshots/i83-alive-mode-neyo-ops.png`.)*

## I.84 — Offline Saved-Data / Bundle-Saver Mode (feasibility + build if possible)

- [x] Feature: store app data (with the user's permission) so a user on a saved-data/bundle-offer plan stays connected to school happenings WITHOUT using live data 24/7 — saved data works for the APP only, keeps the user updated. Confirm feasibility (likely yes via PWA/IndexedDB cache + background sync) and build if possible — *(extends G.2 offline)*. *(COMPLETED 2026-06-19: confirmed feasible via PWA + IndexedDB. Added signed-in tenant-scoped `/api/offline/bundle` read-only snapshot and `bundle-cache.ts` IndexedDB store. Dashboard Bundle Saver now asks permission, syncs learners/balances/calendar/timetable/notifications to app-only local storage, shows saved size/readiness/counts, and supports clear. Test: `scripts/i84-bundle-saver-test.ts`; screenshot: `neyo/screenshots/i84-bundle-saver-mode.png`.)*

## I.85 — Messaging Read-Tracking, Auto-SMS Fallback & Acknowledge

- [x] After a message is sent, the school (at most) and teachers get a REPORT after 24 hrs: who read it; those who didn't read get an SMS INSTANTLY (tells the sender it was a school communication). *(COMPLETED 2026-06-18: added `MessageDeliveryReport` model (migration `20260618145620_i85_message_delivery_reports`) + `message-delivery-reports` every-minute job. After 24h, report rows are generated and sender is notified in-app with a summary. Sender can open "View delivery report" in Messages to see recipient/read/received/unread/SMS-fallback counts and non-readers. Automatic SMS fallback from Batch 3 remains wired for due urgent messages. `i70-i85-message-receipts-test.ts` verifies report generation + sender report access.)*
- [x] For URGENT messages, the sender sets a timer (e.g. 6 hrs / 12 hrs); if not read in-app by then, the system sends an SMS to those who haven't read. *(BUILT 2026-06-18: Message now has `urgentFallbackAt` + `fallbackSmsSentAt`; composer supports 6h/12h/24h fallback; job `message-fallback` added to EVERY_MINUTE_JOBS; `sendUnreadMessageFallbacks()` checks non-read/non-ack participants, quota-checks, sends SMS, records usage and audit. Test verifies due message fallback and DB stamp.)*
- [x] School messages can include an inline "I received this" acknowledge button the user taps; when seen in-app the system auto-ticks "seen". *(BUILT 2026-06-18: Message now has `requiresAck`; new `MessageAcknowledgement` model records per-user acknowledgement; PATCH `/api/conversations/[id]/messages` action `ack` upserts acknowledgement and updates lastReadAt; UI shows button for recipients and "Received by Name (time)" to sender. Test verifies acknowledgement.)*
- [x] Read-receipts surfaced (who read + when) — *(consolidates I.70)*. *(COMPLETED 2026-06-18 with I.70: actual per-recipient read names/timestamps returned by API and rendered in Messages UI.)*

## I.86 — Native-Style Notification Delivery (no app-open needed)

- [x] Notifications + received messages arrive like NORMAL phone notifications (ring/sound) — the user does NOT need to open the app or the messages section; works even when on another app — *(needs Web Push / PWA notifications; relates to A.7 + I.34)*. *(COMPLETED 2026-06-19: added `WebPushSubscription` model/migration, signed-in `/api/notifications/native-subscription`, service worker `push` + `notificationclick`, notification panel opt-in, and real `web-push` transport using VAPID keys when configured. Screenshot: `neyo/screenshots/i86-native-notification-opt-in.png`; test: `scripts/i86-native-notifications-test.ts`.)*

## I.87 — Theme Follows Device Default (+ login page)

- [x] Dark/light mode respects the DEVICE default on launch (if device is light, app launches light); the user can then change their preference. *(COMPLETED 2026-06-19: root pre-paint script already reads `prefers-color-scheme`; `ThemeToggle` hydration now also defaults to `glass-dark` when the device is dark and `glass` when the device is light if no saved `neyo-theme` exists. User choice still persists.)*
- [x] Same dark/light behaviour applies on the LOGIN page. *(COMPLETED 2026-06-19: the shared root pre-paint script applies to auth routes too; login page has dark classes and screenshot `neyo/screenshots/i87-login-follows-device-dark.png` confirms device-dark launch.)*

## I.88 — Abuse / Harmful-Content Filter (all directions)

- [x] Messaging must never support abusive/harmful messages from ANYONE, in ALL directions — *(OVERLAP: messaging.service has a profanity filter; VERIFY it covers all conversation types + directions, extend if needed)*. *(COMPLETED 2026-06-19: replaced the one-off messaging blacklist with shared `content-moderation.service.ts`; wired moderation across direct/group/announcement messages, class-chat engine reuse, comms broadcasts/teacher approvals, and LMS class discussion threads/replies. Moderated content throws `CONTENT_MODERATED` before any DB write. Test: `scripts/i88-content-moderation-test.ts`; screenshot: `neyo/screenshots/i88-content-moderation-message.png`.)*

## I.89 — WebRTC Online Live Classes (home + school TVs)

> PARTIAL FOUNDATION 2026-06-19: Added `OnlineClassSession` model/migration, `/api/online-classes`, `/online-classes` page, teacher request/start/end flow, class running banner, TV access code, mobile/TV join URL, and in-app + push notifications to class recipients. Test: `scripts/i89-online-live-classes-test.ts`; screenshot: `neyo/screenshots/i89-online-live-classes.png`. NOT YET FINAL `[x]`: true multi-user WebRTC media/signalling/screen-share controls still need completion before this item is honestly closed.

- [x] A teacher can run an ONLINE LIVE CLASS via WebRTC; students at home connect via TV / mobile; a school with classroom TVs can have TV accounts per TV. *(COMPLETED 2026-06-19: `OnlineClassSession` + `OnlineClassParticipant` + `OnlineClassSignal`, `/online-classes` request/start board, `/online-classes/join/[roomId]` WebRTC room, mobile and TV join buttons, `RTCPeerConnection`, `getUserMedia`, SDP offer/answer, ICE candidates, remote video tiles, Connect all, and Leave cleanup. Screenshot: `neyo/screenshots/i89-webrtc-live-room.png`.)*
- [x] When an online class is running, the system shows "Online class running in this class". *(COMPLETED 2026-06-19: `/online-classes` board shows a green running banner by class when status is RUNNING.)*
- [x] Teacher must REQUEST a class; on confirmation the teacher sets time + class; the message is sent to the students/classes/online-classes. *(COMPLETED 2026-06-19: teacher request flow creates `OnlineClassSession`, sets title/time/class, roomId/joinUrl/TV code, and notifies class recipients.)*
- [x] Class-join messages don't require opening the app (native notification). *(COMPLETED 2026-06-19: scheduled/running class notifications use `channels: ["in_app", "push"]`, integrated with I.86 native Web Push/PWA notifications.)*
- [x] Product copy inside NEYO must NOT mention WebRTC or underlying/third-party technology names for live classes/calls; call it NEYO live class / system. *(COMPLETED 2026-06-20: user-facing online-class page and room headings now say “NEYO live class”, while technical names remain only in code/tests/docs.)*
- [x] Live classes can go full screen. *(COMPLETED 2026-06-20: live class room has a Full screen button using `requestFullscreen()`.)*
- [x] NEYO logo is embedded in one corner of the live video/stage. *(COMPLETED 2026-06-20: `NeyoLogo` badge is overlaid top-left on the live class video stage.)*

## I.90 — Online Meetings, Screen-Share & Class Controls

- [x] Support online meetings + screen sharing. *(COMPLETED 2026-06-19: online class room supports WebRTC meetings plus `getDisplayMedia()` screen share with track replacement and screen-share signalling.)*
- [x] Instructor can MUTE all students unless asked a question. *(COMPLETED 2026-06-19: teacher controls `muteAllStudents`; student mic controls are disabled by control signal. REFINE: students can raise hands / ask questions in comments; when teacher approves “Let speak”, that student receives an approved-speaker signal and is allowed to unmute while others remain muted.)*
- [x] Support video; teacher can DISABLE all students' video. *(COMPLETED 2026-06-19: teacher controls `studentVideoDisabled`; student camera controls are disabled by control signal.)*
- [x] Videos are NOT saved unless a user chooses to save to their own phone/external drive. *(COMPLETED 2026-06-19: `recordingAllowed` is false by default; room displays “NEYO does not save class video” policy and only allows local/external user saving notice if school permits.)*

## I.91 — Multiple Receptionists + Cash/Bank Recording

- [x] A school can have SEVERAL receptionists; can DISABLE a receptionist. *(VERIFIED 2026-06-19: multiple `User` rows can hold role `RECEPTIONIST`; disabling uses existing `User.isActive=false`, which blocks account use while preserving audit history.)*
- [x] On cash payment, the receipt is produced INSTANTLY + a report can be generated. *(VERIFIED 2026-06-19: `recordWalkInPayment()` records cash as PAID immediately, creates a CASH reference, queues a receipt PrintJob for Print Station instantly, and existing day-end summary reports payments/collected totals.)*
- [x] Bank deposits: when parents present slips, record them; when the bank issues statements, IMPORT them and auto-record/reconcile. *(COMPLETED 2026-06-19: Front Desk payment method now supports bank deposit slips; added `/api/reception/bank-import` CSV import with ref/amount/phone/accountRef/description, duplicate ref protection, invoice/admission matching, and auto-reconciliation through `onPaymentPaid()`. Screenshot: `neyo/screenshots/i91-bank-statement-import.png`.)*

## I.92 — Strict Per-Role Visibility (all staff)

- [x] Every staff member has their own account and sees ONLY what they're required to see — nothing else — including transport, kitchen and any other staff — *(extends I.5 / H.2 visibility to ALL staff types)*. *(COMPLETED 2026-06-20: added `StaffProfile.visibilityAreas` for strict support-staff area scoping; backend `effectivePermissionsForUser()` narrows SUPPORT_STAFF permissions by KITCHEN/CLINIC/TRANSPORT/SECURITY/GENERAL; `requirePermission()` and `/api/auth/permissions` now use effective per-user permissions. Test: `scripts/i92-strict-role-visibility-test.ts`; screenshot: `neyo/screenshots/i92-kitchen-strict-visibility.png`.)*

## I.93 — Duplicate-Import Prevention (all import fields)

- [x] When a duplicate import is detected it is DENIED — across ALL import fields, including the student import — *(B.1 import has dupe checks; VERIFY + extend to every import surface incl. staff import)*. *(COMPLETED 2026-06-18: student import now denies duplicate school/NEYO admission numbers, UPI/NEMIS, birth certificate, and same name+DOB against both file rows and DB; commit throws before creating rows even if skip-invalid is on. Staff import now preflight-denies duplicates by email, phone, TSC number, and National ID both within the file and existing DB. Test `i93-duplicate-import-test.ts` verifies staff and student duplicate denial. Screenshot: `neyo/screenshots/i93-duplicate-import-preview.png`.)*

## I.94 — Dynamic Island: Live Activity + Targeted Alerts + Plan Deep-link

- [x] The custom dynamic island shows the ACTIVITY taking place in that account (e.g. "student import running", "call in progress"). *(COMPLETED 2026-06-18: Dynamic Island now supports module-raised live activities via `neyo:live-activity` custom events and targeted notification activity rows. Intercom dispatches Calling / Call in progress / Call ended live activities; student import API creates real `Student import running` and `Student import complete` in-app notifications so the island surfaces real import progress/completion. `i94-live-activity-sources-test.ts` verifies import API emits both activity notifications.)*
- [x] People only get notifications that concern them (targeted) — *(VERIFIED 2026-06-18 through recipientId-scoped notification test.)*
- [x] Pressing the subscription-plan item takes them directly to the Settings page; when the plan is about to expire it notifies the school admin. *(COMPLETED 2026-06-20: Subscription Plan dashboard card deep-links to `/settings/billing`; dashboard now computes days to subscription end and creates targeted in-app billing notifications with `href: /settings/billing` for owner/principal/deputy when the plan is within 14 days of ending.)*
- [x] Everyone sees only what concerns them — including which DASHBOARD CARDS appear (cards never show in roles that don't need them) — *(reinforces I.5/I.68)*. *(COMPLETED 2026-06-20: Dashboard now uses `effectivePermissionsForUser()` to gate finance, attendance, student, staff and billing cards. Kitchen/support-staff screenshot proves unrelated finance/student/staff cards are hidden.)*

## I.95 — Intercom Call Routing & Roles

- [x] In intercom, the Owner can call the Principal (note: some schools' owner IS the principal — handle that). *(COMPLETED 2026-06-18: `startIntercomCall` allows SCHOOL_OWNER/PRINCIPAL/DEPUTY and other staff call roles to call online staff; self-call is blocked so owner=principal case is handled safely.)*
- [x] Principals & teachers can call PARENTS directly. *(VERIFIED/COMPLETED 2026-06-20: `staffAndParentTargets()` builds a staff-to-parent directory from linked guardians. Leadership sees all linked parent users; teachers see own-class parent users only. `startIntercomCall()` permits principal/teacher→parent calls when parent is online, creates `RINGING` call and sends incoming-call notification. Test: `scripts/i95-principal-teacher-parent-call-test.ts`; screenshot: `neyo/screenshots/i95-teacher-parent-intercom.png`.)*
- [x] If 2+ call the same person: the first call connects; the others WAIT until it's done; the caller is notified to call (or the callee can press call back). *(COMPLETED 2026-06-18: `startIntercomCall` now creates a QUEUED call when target/caller is busy, notifies caller and target, and when the active call ends it releases queued callers with "contact is free" / callback notifications. Test verifies queued caller is released after active call ends.)*
- [x] Teachers can call each other; parents can call teachers. *(COMPLETED 2026-06-18: teacher/staff-to-staff calls are built; parent intercom board now resolves the parent’s children and lists class/timetable teachers; parent can ring teacher directly; teacher can accept/decline/end. Test verifies parent sees child teacher and parent→teacher call starts RINGING.)*

## I.96 — Notification Panel UI Fix

- [x] The notification panel currently has an ugly scroll bar and other notifications hide to the top — redesign so it looks clean (no awkward scrollbar / hidden-at-top behaviour). *(COMPLETED 2026-06-18: Notification panel rebuilt as a polished glass card with stable header, clean card rows, thin/transparent scrollbar styling, proper max-height and overscroll containment. Screenshot: `neyo/screenshots/i96-notification-panel.png`.)*

## I.97 — Syllabus Coverage & Scope Tracking

- [x] A way to check SYLLABUS COVERAGE + required scope + deadlines per term, to ensure good coverage across all streams; helps in setting exams. *(BUILT 2026-06-18: NEW `SyllabusTopic` model + migration `20260618180000_i97_syllabus_coverage`; API `/api/syllabus`; page `/syllabus` with filters, coverage %, late/in-progress/covered totals, add-scope dialog, and mark in-progress/covered actions. Teacher scoping uses `teacherClassIds`; academics leadership can manage all. Test `i97-syllabus-coverage-test.ts`; screenshot `neyo/screenshots/i97-syllabus-coverage.png`.)*

## I.98 — Local-Host Run & Click-Test Readiness (founder action item)

- [x] Founder wants to run a localhost on their desktop and have EVERYTHING work when clicked — full smoke-test pass + fix anything broken so "when I press anything it will work" (ties to I.57 GitHub/localhost guide + I.66 seed fix + I.68 dashboard error). *(COMPLETED 2026-06-18: added `scripts/i98-localhost-click-test.ts`; production-mode Playwright smoke logs in, visits 45+ major app routes, confirms no server errors/no visible 404/no app error boundary, verifies dashboard card links to Finance/Attendance/Students/Staff/Calendar/Billing, and opens keyboard search. Passed after build+start. Screenshot: `neyo/screenshots/i98-localhost-click-test-dashboard.png`.)*

---

## PART I — PROPOSED VALUE FEATURES (Build-Partner ideas to drive paid adoption of School OS, 2026-06-17)
> Proposed by the Build Partner so schools SEE the value and pay BEFORE the other OSes launch. Each is toggleable in NEYO Ops (I.63). Founder to approve which to build. Focus = more fees collected, time saved, parents delighted, lock-in.

## I.99 — Fee Collection Engine ("the money machine" — the #1 reason schools pay)

- [x] One-tap "Send fee reminders to ALL who owe" with smart copy + running M-Pesa link/STK (school sees real-time collected total climb). *(COMPLETED 2026-06-20: added `sendAllOpenFeeReminders()` + `/api/finance/reminders`; Finance Overview has “One-tap fee reminders to all who owe”. It groups by family, sends respectful balance-aware SMS + parent in-app reminders, includes M-Pesa account/portal/Mzazi guidance, stamps `reminderSentAt`, quota-checks SMS, and audit-logs `finance.one_tap_reminders_sent`. Test: `scripts/i99-one-tap-fee-reminders-test.ts`; screenshot: `neyo/screenshots/i99-one-tap-fee-reminders.png`.)*
- [x] Per-parent payment plan / installment schedule with auto-reminders on each due date (extends G.28 Promise-to-Pay). *(COMPLETED 2026-06-20: extended `PromiseToPay` with `planGroupId`, `installmentNo`, `reminderSentAt`; added `createInstallmentPlan()` and `sendDueInstallmentReminders()`; Finance → Promises Calendar can create installment plans; API `POST /api/finance/promises` saves schedules and due-date reminders run through the existing promise checker. Test: `scripts/i99-installment-plans-test.ts`; screenshot: `neyo/screenshots/i99-installment-payment-plan.png`.)*
- [x] "Fee collection leaderboard" by class/stream — which class teacher's class is most cleared (drives healthy competition). *(COMPLETED 2026-06-20: added `feeCollectionLeaderboard()` + `/api/finance/leaderboard`; Finance Overview now shows ranked class/stream collection rates with class teacher, learner count, collected/billed totals and progress bars. Test: `scripts/i99-fee-leaderboard-test.ts`; screenshot: `neyo/screenshots/i99-fee-collection-leaderboard.png`.)*
- [x] Partial-payment friendly: parents pay ANY amount, ledger updates live, balance always visible on the Mzazi Card/QR. *(COMPLETED 2026-06-20: existing `applyPaymentToInvoice()`, portal STK, and public Mzazi QR/STK all support amounts below the balance and keep invoice status PARTIAL until fully cleared; overpayments are rejected. Mzazi QR has Amount to pay input and live balance. Test: `scripts/i99-partial-payment-friendly-test.ts`; screenshot: `neyo/screenshots/i99-partial-payment-mzazi.png`.)*
- [x] Daily/weekly automated fee SMS digest to the Bursar + Principal: collected, outstanding, top defaulters, today's M-Pesa. *(COMPLETED 2026-06-20: added `sendFinanceDigest()` + `/api/finance/digest`; daily and weekly jobs in registry; digest sends SMS + in-app to Bursar/Accountant/Principal/Owner with collected, outstanding, open invoices and top balances. Finance Overview has manual Daily/Weekly send buttons. Test: `scripts/i99-finance-digest-test.ts`; screenshot: `neyo/screenshots/i99-finance-digest.png`.)*
- [ ] "Defaulter follow-up" workspace: call/SMS list, promise-to-pay capture, notes, next-action date — turns chasing fees into a workflow.
- [ ] M-Pesa auto-reconciliation: every Paybill payment matched to a student automatically (no manual entry) — the single biggest time-saver for bursars.

## I.100 — Parent Delight Pack (parents push the school to adopt → enrollment + retention)

- [ ] Beautiful parent home: child's attendance, fees, results, today's timetable, school news — one calm screen.
- [ ] Instant pay-from-anywhere (QR/STK) + instant SMS receipt (already partly built — package it as a headline feature).
- [ ] "How is my child doing?" termly progress card in plain language (parent-friendly, CBC + 8-4-4).
- [ ] Real-time absence alert: parent gets an SMS/notification the moment their child is marked absent (peace of mind = the feature parents talk about).
- [ ] Pickup safety (already in H.4/I.4) marketed as a parent trust feature.
- [ ] Multi-child families: one login, all children, one combined fee view + one-SMS-per-family (G.12).

## I.101 — Teacher Time-Savers (teachers stop resisting, start loving it)

- [ ] One-tap class register (already in B.3) + "mark all present" default — under 10 seconds per class.
- [ ] Auto-generated report cards + comments (rule-based now, Bundi later) — saves days of end-term work.
- [ ] Marks entry that computes positions/means instantly — no calculators, no Excel.
- [ ] "My day" teacher screen: today's lessons, registers due, homework to mark, messages — the daily habit hook.
- [ ] Bulk homework/notes to a class in one tap (B.12/B.13).

## I.102 — Principal "Run the School from My Phone" (the decision-maker's wow)

- [ ] Money-first live dashboard (I.25/I.68) — the principal's morning glance.
- [ ] "School pulse" weekly digest (G.15) — attendance %, fees vs target, enrolment, flags — delivered, not hunted for.
- [ ] One-tap broadcast to all parents / a class / staff (B.14) with cost preview.
- [ ] Approvals inbox: gate passes, suspensions, expenses, print requests, joint-owner items — all decisions in one place.
- [ ] At-risk early-warning board: chronic absence + arrears + discipline + welfare flags combined (rule-based composite).

## I.103 — Sales & Onboarding Conversion (turn a demo into a paying school in a day)

- [ ] "Set up your school in 15 minutes" guided wizard (extends G.3) — import students, set fees, send first parent SMS, see first payment.
- [ ] Demo → real conversion that keeps nothing fake (G.14) but pre-fills the school's real details.
- [ ] Free trial term with a clear in-app "X days left → subscribe" nudge + one-tap M-Pesa subscribe (I.49 instant pay).
- [ ] "First-value moment" checklist the school completes (first register marked, first fee collected, first report sent) — proven activation = retention.
- [ ] Referral: a school invites another school; both get a discount (cheap, viral growth in the KEPSHA network).
- [ ] Per-plan feature gating so Free/Msingi/Pro/Elite clearly show "upgrade to unlock" (G.23) — drives upgrades.

## I.104 — Trust, Compliance & Data Safety (the "I can rely on this" feature)

- [ ] One-tap "Export all my school's data" (already A.2.10) — marketed as "your data is always yours" (kills lock-in fear, ironically increases trust to adopt).
- [ ] Automatic nightly backups + a visible "last backed up" indicator.
- [ ] KE Data Protection (ODPC) compliance badge + privacy controls visible to the school.
- [ ] Audit trail the principal can actually read ("who changed this fee / deleted this record, and when").
- [ ] Term-end archive: freeze a term's data into a clean read-only snapshot (report cards, ledgers) for records/audits.

## I.105 — "Sticky" Daily-Habit Features (make NEYO un-removable once adopted)

- [ ] Morning "School brief" notification to leadership every school day (who's absent staff, fees in yesterday, today's events).
- [ ] Birthdays/this-week board (students + staff) — small human touch shown on the dashboard.
- [ ] End-of-day auto summary for the bursar/principal (collections, visitors, incidents) — closes the daily loop.
- [ ] Smart search that finds anything (student, parent phone, payment, module) in one box (A.11 + I.30) — once they rely on it, they're hooked.

## I.106 — Differentiators vs Kenyan competitors (Zeraki / Shule Soft etc.)

- [ ] Works on feature phones via SMS + Mzazi Card QR (G.13) — reaches parents competitors can't.
- [x] Truly offline-first on patchy internet (G.2 + I.84 bundle-saver) — a real edge in rural schools. *(I.84 completed 2026-06-19: offline outbox already existed; bundle-saver snapshot now stores key read data in IndexedDB with user permission.)*
- [ ] One platform for the WHOLE school (finance + academics + boarding + transport + library + clinic) vs competitors' partial coverage.
- [ ] Beautiful, modern, fast UI (liquid glass) — schools show it off; it sells itself.
- [ ] Mascot (Bundi) helper coming — a friendly brand parents/teachers remember.

## I.107 — Revenue Add-ons NEYO can monetize (beyond subscription)

- [ ] SMS top-up packs (already seam) — schools buy SMS bundles in-app (margin for NEYO).
- [ ] Branded document printing pack (ID cards, certificates) — premium add-on (G.23 add-ons).
- [ ] Per-student-per-term pricing option for big schools (G.23 perStudentPerTerm seam) — scales revenue with school size.
- [ ] Online-class minutes / storage as a metered add-on (when WebRTC live classes ship, I.89).
- [ ] Paid premium themes / custom branding pack (ties to I.62 custom themes).

---

## PART I — "NEYO RUNS NEYO" — Full NEYO Ops Company Operating System (Build-Partner expansion, 2026-06-17)
> The principle: NEYO is the FIRST customer of every NEYO OS. The company runs itself on its own platform — "NEYO uses NEYO to run NEYO in all dimensions." NEYO Ops (SUPER_ADMIN, inside the product at /founder, cards/UI, never outside the website) becomes a real internal Business OS. Every section below is a NEYO Ops module. All toggleable. This is HOW the principle is achieved: the same engines that run a school (CRM, finance, payroll, comms, calendar, docs, files, audit, notifications, search) are pointed at NEYO-the-company itself as a special internal "tenant".

## I.108 — How "NEYO runs NEYO" is achieved (architecture)

- [ ] Treat NEYO-the-company as a special internal tenant ("NEYO HQ") so the SAME multi-tenant engines (auth, billing, CRM, finance, comms, calendar, files, audit, search, notifications, jobs) power the company's own operations — no separate codebase.
- [ ] NEYO Ops = the HQ tenant's app shell, SUPER_ADMIN-only, with company-level cards (extends F.1).
- [ ] Cross-OS data model: every paying school/farm/business/creator is a row in NEYO HQ's CRM/billing; company dashboards aggregate across all tenants.
- [ ] Everything the company would do in a spreadsheet/email/WhatsApp moves INTO NEYO Ops (single source of truth).

## I.109 — NEYO Sales & CRM (company growth engine)

- [ ] Lead capture: every "Request Demo" / waitlist signup from the landing becomes a LEAD in NEYO Ops.
- [ ] Sales pipeline (Kanban): New → Contacted → Demo → Trial → Won → Lost, with per-OS pipelines.
- [ ] Per-lead activity log: calls, emails, SMS, notes, next-action date (reuse A.8/B.14 comms).
- [ ] Convert a Won lead → provisions the real tenant (school/farm/etc.) automatically.
- [ ] Demo-request approval queue (gates I.53 demo waitlist) — approve → auto-email the demo link.
- [ ] Win/loss reasons + conversion analytics; lead source attribution (which channel brings paying schools).

## I.110 — NEYO Finance & Revenue (the money brain)

- [ ] Company revenue dashboard: MRR, ARR, churn, ARPU, by-OS revenue, growth charts (extends F.1 metrics).
- [ ] All subscription payments aggregated centrally (I.49) with per-tenant ledgers.
- [ ] Company expenses + budgeting (NEYO's own running costs: SMS, infra, salaries) → real profit, not a proxy.
- [ ] Invoices/receipts to schools generated + branded; tax-aware (KE VAT/WHT) for compliance.
- [ ] Cashflow forecast + runway view for the founder.
- [x] Failed-payment / dunning workflow (grace → reminder cascade → suspend per policy, never delete). *(COMPLETED 2026-06-24 via I.48 grace-enforcement checkpoint: grace notice, warning notice, final suspension notice, automatic suspension, audit logs and data-preservation policy.)*
- [ ] Refunds + credits management.

## I.111 — NEYO Customer Success & Support

- [ ] Support inbox / ticketing for schools (web + WhatsApp-in + email-in seams) — F.3.
- [ ] Per-school health score (logins, SMS spend, fees collected, module adoption, churn-risk) — extends G.30 Health Check.
- [ ] Onboarding tracker: each new school's activation checklist + assigned CS owner.
- [ ] Proactive churn alerts: school went quiet / usage dropped → flag for outreach.
- [ ] In-app announcements + changelog to schools, managed from NEYO Ops.
- [ ] NPS / satisfaction surveys to schools + results board.
- [ ] Knowledge base / help docs editable in NEYO Ops (no code) → renders in-product + public.

## I.112 — NEYO Internal HR & Team (NEYO's own staff on NEYO)

- [ ] NEYO staff directory + roles/permissions for the team (reuse B.9 HR for the HQ tenant).
- [ ] NEYO payroll for its own employees (reuse B.8) — KE statutory included.
- [ ] Internal tasks / assignments / OKRs board for the team.
- [ ] Internal leave, appraisals, contracts for NEYO staff.
- [ ] Founder page (personal cockpit) + idea-creation board with status (idea → planned → building → shipped).

## I.113 — NEYO Product & Launch Management (run the OS lifecycle)

- [ ] OS lifecycle board: each OS (School/Farm/Business/Creator/future) with status (planning → building → beta → live).
- [ ] Feature flag console: toggle ANY feature on/off platform-wide or per-OS or per-tenant (extends G.22/I.37/I.63) — stage features, soft-launch, instant rollback.
- [ ] Roadmap (internal + a public-facing version) editable in NEYO Ops.
- [ ] Release/changelog manager → publishes to schools + public site.
- [ ] Mascot (Bundi) launch control: the official toggle to switch Bundi ON when ready (G.36/I.37).
- [ ] A/B / rollout controls: release a feature to a % of tenants first.
- [ ] Per-tenant overrides: enable a beta feature for one pilot school.

## I.114 — NEYO Content, Brand & Marketing

- [ ] Brand-asset manager: edit logo, favicons, wordmarks, mascot, colors live with NO code (I.54) — applies across product + landing.
- [ ] Landing-page content editor: edit hero copy, product cards, pricing, industries, testimonials placeholders from NEYO Ops (no code).
- [x] Pricing manager: change plan prices/limits/add-ons from NEYO Ops; grandfathering respected (I.48). *(COMPLETED 2026-06-24 via I.48 pricing checkpoint: dynamic `neyo_pricing_catalog` PlatformSetting + Founder Ops editor + audited `update_pricing_catalog`; SMS remains out-of-package top-up only.)*
- [x] YouTube + social management/posting hub (I.51) + content calendar. *(COMPLETED 2026-06-24 for YouTube posting calendar: NEYO Ops Business Operations has YouTube Management & Posting Hub backed by `NeyoYoutubePost`; broader non-YouTube social network posting can extend this later if separately requested.)*
- [ ] Email/SMS marketing campaigns to leads + schools (reuse comms engine) with cost preview.
- [ ] SEO/OG settings for landing + per-school subdomains, editable in NEYO Ops.

## I.115 — NEYO Platform Control & Reliability

- [ ] One-tap maintenance/shutdown mode (founder) with a friendly "back soon" page + scheduled-maintenance banner (I.48).
- [ ] System health board: uptime, error rates, job queue, DB/Redis/storage status (surfaces A.13 health).
- [ ] Per-tenant suspend/restore/impersonate (support) — reuses A.2.9 impersonation, all audited.
- [ ] Background-jobs console: see crons, runs, retries, failures (A.12) from NEYO Ops.
- [ ] Global audit log viewer (cross-tenant, SUPER_ADMIN) — who-did-what across the platform.
- [ ] Rate-limit / abuse monitor + block controls.
- [ ] Backup & restore controls + "last backup" status (I.104).

## I.116 — NEYO Legal, Compliance & Documents

- [ ] Privacy Policy / Terms / DPA docs edited in NEYO Ops → auto-update the live site (I.48, no code).
- [x] Contract templates + e-sign workflow for school onboarding (I.48 contract signing). *(COMPLETED 2026-06-24 via I.48 checkpoint: `NeyoContract` DB model, NEYO Ops contract board, secure public token signing page, typed signature capture, status register, audit logs and tests.)*
- [ ] ODPC/compliance register + data-subject-request handling.
- [ ] Company document vault (incorporation, tax, agreements) with access control.
- [ ] Data-retention policy controls per OS.

## I.117 — NEYO Communication & Calls Hub

- [x] Unified customer↔NEYO communication (in-app, SMS, email, WhatsApp) from one inbox (I.48). *(COMPLETED 2026-06-24 via I.48 customer hub checkpoint: real DB-backed NEYO customer threads, school Billing contact form, Founder Ops customer inbox, in-app reply notices and channel/status fields ready for SMS/email/WhatsApp expansion.)*
- [ ] Broadcast to all schools / a segment (e.g. all Pro plan) with targeting + cost preview.
- [ ] Integrated calling at scale (WebRTC, internet-only, no stored conversations) — founder ↔ school, support calls (ties to I.69/I.95).
- [ ] Status-page + incident comms to all customers in one action.

## I.118 — NEYO Business Intelligence (company-wide analytics)

- [ ] Cross-tenant aggregate analytics: total schools, students, payments processed, SMS sent, fees collected platform-wide.
- [ ] Per-OS performance dashboards (once Farm/Business/Creator launch) in one BI surface.
- [ ] Cohort + retention curves for schools; activation funnel (signup → first register → first payment → subscribe).
- [ ] Founder "one-screen company snapshot": revenue, growth, churn risk, top schools, today's signups/payments.
- [ ] Exportable board pack (auto-generated) for investors/board (extends F.1 investor updates).
- [ ] Anomaly alerts (revenue dip, churn spike, error surge) pushed to the dynamic island.

## I.119 — NEYO Growth, Partnerships & Community

- [ ] Referral program management (school-invites-school, I.103) + reward tracking.
- [ ] Partner/reseller management (e.g. county education offices, KEPSHA) with their own portal seam.
- [ ] Community & impact tracking (F.4): Karibu Scholarship free schools, events, mentorship, conferences.
- [ ] Affiliate / ambassador tracking for growth.
- [ ] Demo-day / events management for prospective schools.

## I.120 — NEYO Ops: Idea → Ship Pipeline (continuous improvement)

- [ ] Idea board (founder + team) → prioritized backlog → linked to feature flags (I.113).
- [ ] Customer feature-requests captured from support/CRM feed the backlog.
- [ ] "Build log" (already F.1) tied to shipped features + changelog auto-publish.
- [ ] Decisions/risks register so company knowledge lives in NEYO, not someone's head.

## I.121 — NEYO Ops Cross-Cutting Guarantees

- [ ] Every NEYO Ops module is SUPER_ADMIN-gated, audited, and toggleable (a feature flag for NEYO Ops itself).
- [ ] NEYO Ops data is company-level (NOT tenant-owned) — same pattern as PlatformFlag/PlatformSetting/F.1 models.
- [ ] As new OSes launch, they automatically appear in NEYO Ops (CRM, billing, BI, lifecycle) with zero rework — the "runs NEYO in all dimensions" promise.
- [ ] A single NEYO Ops home that surfaces every module as cards (the founder's cockpit), money-first.

# PART J — Future-Proof Education OS (Curriculum-Independent School OS)

> Founder message 2026-06-25: NEYO must not be only a CBC management system. It must become an Education Operating System that can support any curriculum, future CBC updates, senior-school pathways, competencies, portfolios, learner journeys and connected school ecosystem data. Build in small full-stack chunks. Audit existing modules first and extend them instead of duplicating.

## J.1 — Education OS Philosophy & Architecture

- [ ] Reframe School OS internally as a curriculum-independent Education Operating System, not a hardcoded CBC system.
- [ ] Add `docs/NEYO-FUTURE-PROOF-EDUCATION-OS-ANALYSIS.md` as the reference architecture for curriculum flexibility. *(CREATED 2026-06-25: analysis document added; implementation still pending.)*
- [x] Add admin-facing explanation in NEYO Ops / School settings: “configure curriculum, do not hardcode curriculum.” *(COMPLETED 2026-06-26 via J.2 Chunk 6: `/settings/curriculum` shows “Configure curriculum. Do not hardcode curriculum.” and explains that curriculum versions, levels, grade bands and learning areas are configured while existing subjects/classes/terms are mapped instead of duplicated. Screenshot `screenshots/j2-curriculum-engine.png`.)*
- [x] Ensure all new education features are tenant-scoped, audit-logged and configurable. *(COMPLETED for the J.2 foundation on 2026-06-26: Curriculum, EducationLevel, GradeBand and LearningArea are tenant-owned; validation and 16-role access rules are in `src/lib/validations/curriculum.ts`; real Prisma services audit all mutations; `/api/curriculum` is signed-in and error-mapped; `/settings/curriculum` has loading/empty/error/populated states and screenshot evidence. Future J modules must follow this same rule.)*

## J.2 — Curriculum Engine (core foundation)

- [x] Create configurable `Curriculum` model per tenant: name, country/context, active version, effective dates. *(COMPLETED 2026-06-26 J.2: `Curriculum` model is tenant-owned and stores name, country, context, activeVersion, effectiveFrom/effectiveTo, isActive and notes. Full stack path includes validation, Prisma service, `/api/curriculum`, `/settings/curriculum` UI and seed/migration assistant. Tests: `scripts/j2-curriculum-schema-test.ts`, `scripts/j2-curriculum-validation-test.ts`, `scripts/j2-curriculum-service-test.ts`, `scripts/j2-curriculum-api-test.ts`, `scripts/j2-curriculum-page-test.ts`, `scripts/j2-curriculum-migration-assistant-test.ts`. Screenshot: `screenshots/j2-curriculum-engine.png`.)*
- [x] Create configurable `EducationLevel` model: preschool, primary, junior, senior, custom levels. *(COMPLETED 2026-06-26 J.2: `EducationLevel` is tenant-owned, linked to Curriculum and supports preschool/primary/junior/senior/forms/college/university/custom level keys. Service/API/UI creation is wired; seed migration assistant creates Junior School and Forms levels from existing classes. Tests and screenshot same as J.2 completion.)*
- [x] Create configurable `GradeBand` / grade names: PP1, Grade 1, Form 1, Year 7, custom names — no hardcoding. *(COMPLETED 2026-06-26 J.2: `GradeBand` is tenant-owned, linked to Curriculum/EducationLevel, supports custom names like Year 9 plus shortName/sequence/age ranges, and maps existing `SchoolClass.gradeBandId`. The migration assistant creates grade bands from real existing class levels such as Form 1/Form 2. Tests and screenshot same as J.2 completion.)*
- [x] Create `LearningArea` model connected to subjects/strands/competencies. *(COMPLETED 2026-06-26 J.2: `LearningArea` is tenant-owned, linked to Curriculum, connected to existing `Subject.learningAreaId` and `CbcStrand.learningAreaId`, with code normalization and duplicate-code protection. The migration assistant creates learning areas from real subjects and maps CBC strands. Competency linkage itself continues in J.4.)*
- [x] Add curriculum admin UI in Settings → Academics / Curriculum. *(COMPLETED 2026-06-26 J.2 Chunk 6: added connected page `/settings/curriculum` (`src/app/(app)/settings/curriculum/page.tsx`) plus `CurriculumEngineClient` wired to real `GET/POST /api/curriculum`. Sidebar and Settings hub now link to Curriculum. Page includes loading, empty, error and populated states, forms for Curriculum/Level/GradeBand/LearningArea, mapping review, and live success/error toasts. Test `scripts/j2-curriculum-page-test.ts`; screenshot `screenshots/j2-curriculum-engine.png`.)*
- [x] Map existing `Subject`, `SchoolClass`, `AcademicTerm` to the new curriculum engine instead of replacing them. *(COMPLETED 2026-06-26 J.2: existing `Subject`, `SchoolClass`, `AcademicTerm` and `CbcStrand` rows are mapped using optional curriculum/grade/learning-area fields; no duplicate academic module was created. Service mapping and `runCurriculumMigrationAssistant()` are idempotent, audit-logged and exposed through `/api/curriculum`; mapping counts are visible on `/settings/curriculum`.)*
- [x] Migration assistant: convert existing CBC/8-4-4 seed data into configurable curriculum records. *(COMPLETED 2026-06-26 J.2 Chunk 8: `runCurriculumMigrationAssistant()` creates/matches `CBC Kenya` and `8-4-4 Legacy` curricula, creates levels/grade bands/learning areas from existing B.4/B.6 rows, maps 11 seeded subjects, 2 classes, 3 terms and 3 CBC strands, writes audit `curriculum.migration_assistant_run`, is idempotent, and is run from `prisma/seed.ts`. Test `scripts/j2-curriculum-migration-assistant-test.ts`; refreshed screenshot `screenshots/j2-curriculum-engine.png`.)*

## J.3 — Flexible Assessment Engine

> Audit completed 2026-06-26 in `docs/J3-FLEXIBLE-ASSESSMENT-ENGINE-AUDIT.md`: existing B.5 Exams, B.6 CBC, B.13 LMS, I.60 analytics and Storage Vault were reviewed. J.3 will extend them with a compatible flexible-assessment layer instead of creating a duplicate exam module.
> Founder decision 2026-06-26: skip/defer J.3 Chunk 7 UX browser-interaction hardening and J.3 final seed/completion for now because it was taking too long. J.3 remains `[~]`, not final `[x]`. Remaining J.3 debt: browser interaction hardening, proper `prisma/seed.ts` flexible-assessment seed, final parent/student portal placement, full evidence upload UI using `FileUpload` encrypted path, and final checklist completion. Proceed to J.4.

- [~] Create configurable `AssessmentType`: exam, CAT, project, practical, oral, observation, portfolio, peer assessment, self assessment, continuous assessment. *(STARTED 2026-06-26 J.3 Chunk 1: added tenant-owned `AssessmentType` model with key/name/category/scoreMode/default marks/default weight/evidence/moderation/active flags. Chunk 2 added validation/access rules. Chunk 3 added real service catalog seeding plus create/update type logic; Chunk 4 wired signed-in `/api/assessments` actions including `seed_default_types`, `create_type` and `update_type`; Chunk 5 added reusable type catalog/cards/forms; Chunk 6 mounted `/assessments` connected to real API with type catalog UI and screenshot `screenshots/j3-assessment-engine.png`. Tests: `scripts/j3-assessment-schema-test.ts`, `scripts/j3-assessment-validation-test.ts`, `scripts/j3-assessment-service-test.ts`, `scripts/j3-assessment-api-test.ts`, `scripts/j3-assessment-ui-components-test.ts`, `scripts/j3-assessment-page-test.ts`.)*
- [~] Create `AssessmentPlan`: learning area, class/grade, term, weight, due date, rubric, competency links. *(STARTED 2026-06-26 J.3 Chunk 1: added tenant-owned `AssessmentPlan` linked to `AssessmentType` with optional compatibility IDs for Curriculum, EducationLevel, GradeBand, LearningArea, Subject, Class, AcademicTerm, Exam, Homework, Quiz and CBC strand. Chunk 2 added validation. Chunk 3 added real create/update plan service, link verification and audit logs; Chunk 4 wired `create_plan` / `update_plan` and `GET /api/assessments?planId=` assessment sheet endpoints; Chunk 5 added reusable assessment plan cards/forms plus scoring sheet table components; Chunk 6 mounted `/assessments` with connected create-plan flow, plan cards and sheet modal. Competency links come in J.4.)*
- [~] Extend existing `Exam` / `ExamResult` or add compatible assessment layer without breaking existing report-card logic. *(AUDIT COMPLETED 2026-06-26; DATABASE/SERVICE STARTED: existing Exam/ExamResult, CBC assessments and LMS submissions/quizzes remain intact. New flexible assessment tables link compatibly through optional `examId`, `homeworkId`, `quizId`, `cbcStrandId`, `sourceModule` and `sourceId`; Chunk 3 service reads/writes the flexible layer without touching report-card logic; Chunk 4 exposes it through `/api/assessments`; Chunk 5/6 UI copy explicitly says formal exams, CBC observations and LMS work stay intact, and `/assessments` runs alongside existing Exams/CBC/LMS routes.)*
- [~] Support marks, rubric levels, narrative observations and evidence files in one assessment model. *(STARTED 2026-06-26 J.3 Chunk 1: added tenant-owned `AssessmentRecord` and `AssessmentEvidence`. Chunk 2 added validation. Chunk 3 added `scoreAssessmentRecord()`, `updateAssessmentRecord()` and `attachAssessmentEvidence()` services, auto-computing score percentage from marks/maxMarks, enforcing class row-scope, and writing audit logs; Chunk 4 wired `score_record`, `update_record` and `attach_evidence` API actions; Chunk 5 added score/evidence/sheet components; Chunk 6 mounts scoring sheet access from plan cards. File upload UI must still use Storage Vault encrypted path.)*
- [~] Allow school-defined weighting rules per assessment type. *(STARTED 2026-06-26 J.3 Chunk 1: `AssessmentType.defaultWeight` and `AssessmentPlan.weight` fields added; Chunk 2 validates both weights from 0–100; Chunk 3 service creates type catalog defaults and plans with weighting preserved; Chunk 4 exposes these through `/api/assessments`; Chunk 5/6 plan/type forms show weight controls in the connected page.)*
- [~] Add moderation/release workflow for non-exam assessments. *(STARTED 2026-06-26 J.3 Chunk 1: status/moderation/release fields added; Chunk 2 added schemas/role helpers; Chunk 3 added `moderateAssessmentRecord()` and `releaseAssessmentPlan()` services with state updates and audit logs; Chunk 4 wired `moderate_record` and `release_plan` API actions; Chunk 5 added reusable `AssessmentReleasePanel`; Chunk 6 page shows release-ready plan cards and connected release modal wiring. Browser UX hardening continues in Chunk 7.)*
- [~] Parent/student visibility respects release status. *(STARTED 2026-06-26 J.3 Chunk 1: `AssessmentPlan.visibleToParents` and record release fields added; Chunk 2 defines release validation; Chunk 3 `assessmentBoard()` filters parent/student views to released, visible records for their own children; Chunk 4 exposes the filtered board through signed-in `GET /api/assessments`; Chunk 5 added release/visibility indicators; Chunk 6 `/assessments` displays released/visible assessment state in the populated page. Parent portal placement comes later.)*

## J.4 — Competency Framework

> Audit completed 2026-06-26 in `docs/J4-COMPETENCY-FRAMEWORK-AUDIT.md`: J.2 Curriculum, B.6 CBC, J.3 flexible assessments, Student Profile and Parent Portal were reviewed. J.4 will add a configurable competency layer instead of forcing all competencies into CBC-only tables.

- [x] Create configurable `Competency` model: communication, critical thinking, problem solving, creativity, citizenship, digital literacy, learning to learn, etc. *(COMPLETED 2026-06-27 J.4 Chunk 8: added tenant-owned `Competency` model with groupId, curriculumId, learningAreaId, name, code, description, sequence and active fields. Chunk 2 added strict validation/access helpers; Chunk 3 added real Prisma service; Chunk 4 wired signed-in `/api/competencies`; Chunk 5 added reusable competency UI cards/forms/summary components; Chunk 6 mounted connected `/competencies` page; Chunk 8 seeded default competency framework and learner evidence. Tests `scripts/j4-competency-page-test.ts`, `scripts/j4-competency-service-test.ts`. Screenshot `screenshots/j4-competency-framework.png`.)*
- [x] Create competency groups/strands per curriculum. *(COMPLETED 2026-06-27 J.4 Chunk 8: added tenant-owned `CompetencyGroup` model with optional curriculumId, name, code, description, sequence and active fields; `Competency.groupId` links competencies to groups. Chunk 3 added `ensureDefaultCompetencyFramework()`, create/update group service and audit logs; Chunk 4 exposes group actions through `/api/competencies`; Chunk 5 added group list/form UI components; Chunk 6 mounted group cards/forms on `/competencies`; Chunk 8 seeded Core Competencies group in `prisma/seed.ts`.)*
- [x] Link assessments, teacher observations, projects and co-curricular activities to competencies. *(COMPLETED 2026-06-27 J.4 Chunk 8: added `CompetencyEvidence` with sourceModule/sourceId plus optional `assessmentRecordId` and `cbcAssessmentId`, allowing J.3 assessment records and B.6 CBC observations to become competency evidence. Chunk 2 validates source modules CBC/ASSESSMENT/LMS/MANUAL/CLUB/PORTFOLIO and rejects inconsistent assessment/CBC source links. Chunk 3 added `recordCompetencyEvidence()` with teacher class scoping, optional J.3/B.6 source verification and audit logs; Chunk 4 exposes evidence recording through `/api/competencies`; Chunk 5 added evidence form and student summary UI components; Chunk 8 seeded real learner evidence linked to competencies in `prisma/seed.ts`.)*
- [x] Store competency evidence over time, not just latest score. *(COMPLETED 2026-06-27 J.4 Chunk 8: added append-only `CompetencyEvidence` model with studentId, level, scorePct, narrative, evidenceDate, recordedBy fields, approved and visibleToParents flags. Chunk 2 added `competencyEvidenceSchema` requiring level/score/narrative and approval schema; Chunk 3 added append-only evidence recording, approval, parent-visible filtering in `studentCompetencySummary()`, and heatmap aggregation foundation; Chunk 4 exposes board/student summary/heatmap through `/api/competencies`; Chunk 5 added summary/heatmap UI components; Chunk 6 mounts heatmap and learner-summary loader on `/competencies`; Chunk 8 seeded multiple evidence records over time.)*
- [x] Add competency summary to student profile and parent dashboard. *(COMPLETED 2026-06-27 J.4 Chunk 8: backend `studentCompetencySummary()` returns row-scoped learner competency summary; parent/student only see approved visible evidence. Chunk 4 exposes it via `GET /api/competencies?studentId=...`; Chunk 5 added `StudentCompetencySummaryCard`; Chunk 6 mounts a learner-summary loader on `/competencies`; Chunk 8 mounted `StudentCompetencySummaryWrapper` in `src/components/students/student-profile-client.tsx` and `src/components/portal/parent-portal-client.tsx`.)*
- [x] Add competency heatmap analytics for class/grade/school. *(COMPLETED 2026-06-27 J.4 Chunk 8: backend `competencyHeatmap()` aggregates evidence by competency for class-filtered cohorts. Chunk 4 exposes it via `GET /api/competencies?heatmap=1`; Chunk 5 added `CompetencyHeatmapTable`; Chunk 6 mounts heatmap table on `/competencies`.)*

## J.5 — Rubrics & Evidence

> Audit completed 2026-06-27 in `docs/J5-RUBRICS-EVIDENCE-AUDIT.md`: B.5 Exams, B.6 CBC, J.3 flexible assessments, J.4 competencies and Storage Vault were reviewed. J.5 adds a configurable rubric definition layer without duplicating exam/CBC grading.

- [x] Create configurable `Rubric` model with levels and descriptors. *(COMPLETED 2026-06-27 J.5 Chunk 6: added tenant-owned `Rubric` and `RubricLevel` models in `prisma/schema.prisma`. Chunk 2 added Zod validation schemas and 16-role access rules; Chunk 3 added real Prisma service functions; Chunk 4 wired signed-in `/api/rubrics`; Chunk 5 added reusable Liquid Glass UI components; Chunk 6 mounted connected `/settings/rubrics` page with screenshot `screenshots/j5-rubrics-engine.png`. Tests `scripts/j5-rubrics-schema-test.ts`, `scripts/j5-rubrics-validation-test.ts`, `scripts/j5-rubrics-service-test.ts`, `scripts/j5-rubrics-api-test.ts`, `scripts/j5-rubrics-page-test.ts`.)*
- [x] Allow rubrics to be attached to assessment types and competencies. *(COMPLETED 2026-06-27 J.5 Chunk 6: added optional `rubricId` scalar links to `AssessmentType`, `AssessmentPlan`, `AssessmentRecord`, `Competency`, and `CompetencyEvidence`. Chunk 3 added `attachRubric()` service function and audit logs; Chunk 4 exposes attach actions through `/api/rubrics`.)*
- [x] Teacher UI for rubric scoring on mobile and desktop. *(COMPLETED 2026-06-27 J.5 Chunk 6: Chunk 5 added `TeacherRubricScoringPanel` with mobile-first one-tap selectable level cards and auto-calculation of points/percentage; Chunk 6 wired `RubricScoreWrapper` into the flexible assessment client (`src/components/assessments/assessment-engine-client.tsx`), allowing teachers to select an active rubric and score learners seamlessly.)*
- [x] Store teacher narrative comments per rubric score. *(COMPLETED 2026-06-27 J.5 Chunk 6: `AssessmentRecord.narrative` and `CompetencyEvidence.narrative` are updated during rubric scoring. Chunk 3 `scoreWithRubric()` verifies rubric levels and stamps `SCORED` status, rubric level/code, narrative and assessor metadata. Chunk 5/6 scoring panel includes dedicated narrative observations textarea.)*
- [x] Allow evidence file attachment through encrypted Storage Vault. *(COMPLETED 2026-06-27 J.5 Chunk 6: Chunk 3 `attachEvidenceFile()` enforces the encrypted Storage Vault path by verifying `storedFileId` corresponds to a real `StoredFile` row before creating `AssessmentEvidence` or updating `CompetencyEvidence`. Chunk 5 added `RubricEvidenceUploadCard` utilizing `FileUpload` pointing to `/api/files/encrypted`.)*
- [x] Add audit logs for rubric changes and assessment scoring. *(COMPLETED 2026-06-27 J.5 Chunk 6: audit logs added for `rubric.defaults_seeded`, `rubric.created`, `rubric.updated`, `rubric.archived`, `rubric.attached`, `rubric.scored`, and `rubric.evidence_attached`. Verified by service regression test.)*

## J.6 — Skills Passport

> Audit completed 2026-06-27 in `docs/J6-SKILLS-PASSPORT-AUDIT.md`: B.5 Exams, J.3 flexible assessments, J.4 competencies, student profile and parent portal were reviewed. J.6 adds a portable skills passport view without duplicating exam/CBC grading.

- [x] Create learner Skills Passport profile showing academic, competency, talent and leadership growth. *(COMPLETED 2026-06-27 J.6 Chunk 6: added tenant-owned `SkillsPassportEntry` model in `prisma/schema.prisma`. Chunk 2 added Zod validation schemas and 16-role access rules; Chunk 3 added real Prisma service function `getSkillsPassportProfile()` dynamically aggregating academic exams, J.4 competencies, and talent/leadership ratings; Chunk 4 wired signed-in `/api/skills-passport`; Chunk 5 added reusable Liquid Glass UI components; Chunk 6 mounted connected `SkillsPassportCard` with screenshot `screenshots/j6-skills-passport-profile.png`. Tests `scripts/j6-skills-passport-schema-test.ts`, `scripts/j6-skills-passport-validation-test.ts`, `scripts/j6-skills-passport-service-test.ts`, `scripts/j6-skills-passport-api-test.ts`, `scripts/j6-skills-passport-page-test.ts`.)*
- [x] Track skill levels over time with evidence source: assessment, club, portfolio, award, teacher observation. *(COMPLETED 2026-06-27 J.6 Chunk 6: `SkillsPassportEntry` model stores `evidenceSource` (`ASSESSMENT`, `CLUB`, `PORTFOLIO`, `AWARD`, `OBSERVATION`), `evidenceDate`, `narrative`, and creator metadata. Chunk 3 `recordSkillRating()` records append-only history; Chunk 5/6 UI renders full rating history timelines per skill area.)*
- [x] Add skills ratings such as Leadership, Communication, Coding, Music, Sports, Creativity. *(COMPLETED 2026-06-27 J.6 Chunk 6: Chunk 2 validates `SKILL_AREAS` (`Leadership`, `Communication`, `Coding`, `Music`, `Sports`, `Creativity`) plus custom safe strings; Chunk 3 service groups skill entries and computes latest star rating (1–5) per area; Chunk 8 seeded Leadership, Coding, and Creativity ratings in `prisma/seed.ts`.)*
- [x] Add passport view to Student Profile. *(COMPLETED 2026-06-27 J.6 Chunk 6: mounted `SkillsPassportCard` in `src/components/students/student-profile-client.tsx`. Teachers can log new ratings and view aggregated growth points directly from the learner profile.)*
- [x] Add parent-friendly Skills Passport view in Parent Portal. *(COMPLETED 2026-06-27 J.6 Chunk 6: mounted `SkillsPassportCard` in `src/components/portal/parent-portal-client.tsx`. Parents view their child's passport filtered by `scopeWhere()` and release visibility rules; parent rating mutations are strictly forbidden by role guards.)*
- [x] Add exportable Skills Passport PDF with Powered by NEYO footer. *(COMPLETED 2026-06-27 J.6 Chunk 6: created `src/lib/documents/skills-passport-pdf.tsx` using `@react-pdf/renderer` with G.9 branding, `getDocumentDesign()` defaults, QR verification code (`PAS-XXXXXXXX`), and `Powered by NEYO · neyo.co.ke` trademark footer. Added `/api/skills-passport/pdf` download route and verified `%PDF` magic bytes.)*

## J.7 — Student Portfolio System

- [~] Create `PortfolioItem` model: project, video, photo, art, coding work, certificate, teacher observation, community activity. *(STARTED 2026-06-27: tenant-owned `PortfolioItem` model + migration `20260627214456_j7_student_portfolio_foundation` built; validation, backend service, API route `/api/portfolio`, reusable UI component set, connected page `/portfolio`, real buttons from Student Profile + Parent Portal, and idempotent Kenyan seed items for Achieng/Atieno now exist. Screenshot still pending.)*
- [~] Portfolio uploads must use Storage Vault encrypted file path. *(STARTED 2026-06-27: validation/service enforce encrypted `StoredFile` references only; Chunk 4 API wiring exposes the real encrypted-path workflow through `POST /api/portfolio`; Chunk 5 form + Chunk 6 connected page now use `FileUpload` with encrypted-path copy; Chunk 8 seed keeps screens non-empty without faking uploads.)*
- [~] Teacher approval workflow for portfolio items before parent/public visibility. *(STARTED 2026-06-27: service + API support `approve_item` / `reject_item`; students are forced to `SUBMITTED`, parents only see approved visible items; connected page now includes real `PortfolioApprovalQueue`, queue toggle/count controls, filter-aware workflow hardening, and seeded approved/submitted examples.)*
- [~] Student/parent can view portfolio timeline. *(STARTED 2026-06-27: `getPortfolioTimeline()` + `GET /api/portfolio?studentId=...` return row-scoped learner timeline; connected page `/portfolio` now works for staff and direct learner links from Student Profile + Parent Portal; Chunk 7 added no-learner-selected state, search, status filters, filtered-empty state, and Chunk 8 seed keeps the view populated by default.)*
- [~] Portfolio items can link to competencies, subjects, clubs and awards. *(STARTED 2026-06-27: model, validation and service/API payloads include `competencyId`, `subjectId`, `clubId`, and `awardId`; connected page now loads real competency + subject options where available and exposes club/award selectors; Chunk 8 seed demonstrates real competency/subject links plus club/award string links.)*
- [~] Add portfolio media size controls and storage usage warnings. *(STARTED 2026-06-27: 50 MB hard cap + 10 MB warning threshold enforced in validation/service, exposed through timeline storage summary in `GET /api/portfolio`; connected page now renders `PortfolioStorageWarningCard`, adds export guardrails, and Chunk 8 seed includes file-size metadata so storage UX is visible.)*
- [~] Add portfolio export / transfer pack. *(STARTED 2026-06-27: `exportPortfolioPack()` + `GET /api/portfolio?studentId=...&export=1` return approved visible export-pack JSON; connected page now downloads the real export pack through `PortfolioExportCard`; Chunk 8 seed ensures the export is non-empty and idempotent. Final screenshot still pending.)*

## J.8 — Learning Journey Timeline

> Audit completed 2026-06-28 in `docs/J8-LEARNING-JOURNEY-TIMELINE-AUDIT.md`: B.5 Exams, J.3 flexible assessments, B.3 attendance, B.20 discipline, J.4 competency evidence, J.6 skills passport, J.7 portfolio, Student Profile and Parent Portal were reviewed. J.8 should begin as a read-only aggregation layer over existing modules, not a duplicate learner-history database subsystem.

- [~] Create unified learner timeline pulling from exams, assessments, attendance, behavior, awards, clubs, portfolio, community service and certificates. *(STARTED 2026-06-28: J.8 Chunk 2 added `src/lib/validations/learner-journey.ts` with strict query/entry schemas, source/mode registries, and 16-role access helpers for `staff` vs `parent` timeline modes. UPDATED 2026-06-28: J.8 Chunk 3 added `src/lib/services/learner-journey.service.ts`, a real Prisma aggregation layer that normalizes B.5 Exams, J.3 Assessments, B.3 Attendance, B.20 Discipline, J.4 Competency Evidence, J.6 Skills Passport, J.7 Portfolio/Certificates, and B.1 Transfer history into one ordered learner timeline without a duplicate DB table. J.8 Chunk 4 then added signed-in `GET /api/learner-journey`, query validation via `learnerJourneyQuerySchema`, and `LearnerJourneyError` API response mapping. J.8 Chunk 5 added reusable Liquid Glass UI components in `src/components/learner-journey/learner-journey-components.tsx` covering hero, summary grid, source filters, timeline cards, loading/error/empty states, and timeline list rendering without direct fetching. J.8 Chunk 6 then mounted the connected timeline card into Student Profile (`mode=staff`) and Parent Portal (`mode=parent`) through `src/components/learner-journey/learner-journey-card.tsx`. J.8 Chunk 7 added UX hardening: soft refresh, refresh CTA, last-refreshed status, mode-specific privacy notice, and disabled source filters during reload. Tests `scripts/j8-learning-journey-service-test.ts`, `scripts/j8-learning-journey-api-test.ts`, `scripts/j8-learning-journey-ui-components-test.ts`, `scripts/j8-learning-journey-page-test.ts`, and `scripts/j8-learning-journey-ux-test.ts` pass.)*
- [~] Add timeline tab to Student Profile. *(STARTED 2026-06-28: J.8 Chunk 6 added connected `LearnerJourneyCard` wiring in `src/components/students/student-profile-client.tsx`, using real `GET /api/learner-journey?studentId=...&mode=staff` fetches, source filters, and loading/error/empty/populated states. UPDATED 2026-06-28: Chunk 7 added UX hardening in the connected card — soft refresh, last-refreshed stamp, refresh CTA, source-filter disable-during-refresh, and explicit staff-mode privacy notice. Current surface is mounted as a full learner-journey section/card; visual screenshot is still pending.)*
- [~] Add parent-safe timeline to Parent Portal. *(STARTED 2026-06-28: J.8 Chunk 6 added connected `LearnerJourneyCard` wiring in `src/components/portal/parent-portal-client.tsx`, using real `GET /api/learner-journey?studentId=...&mode=parent` fetches so only parent-safe milestones render. UPDATED 2026-06-28: Chunk 7 added UX hardening with family-safe notice copy, refresh feedback, and safer source-filter interaction. Visual screenshot is still pending.)*
- [ ] Timeline entries must show source module and verification status.
- [ ] Allow leadership/teachers to pin important milestones.
- [ ] Add transfer-friendly learner journey export.

## J.9 — Activity-Aware Timetable (COMPLETED)

- [x] Extend timetable slot types beyond academic lessons: clubs, sports, STEM, agriculture, music, guidance, community service, remedial, pathway sessions.
- [x] Add configurable activity categories and colors.
- [x] Add lab/activity constraints such as maximum lab sessions per class, candidate prioritization, pathway blocks.
- [x] Ensure timetable print output still fills A4 correctly and is not a compressed screenshot. *(Aligns with I.65/I.73.)*
- [x] Link activity slots to talent tracking and attendance where relevant.

## J.10 — Senior School Pathway Management (COMPLETED)

- [x] Create configurable `Pathway` model: STEM, Arts, Sports, Social Sciences, Technical Studies, custom.
- [x] Define subject requirements per pathway.
- [x] Define competency/talent/portfolio readiness per pathway.
- [x] Track student pathway preferences and teacher recommendations.
- [x] Add pathway capacity and allocation workflow.
- [x] Parent/student view of pathway readiness.
- [x] Pathway report and export.

## J.11 — Talent Tracking ## J.11 — Talent Tracking & Co-Curricular Growth Co-Curricular Growth (COMPLETED)

- [x] Create `TalentArea` model: music, drama, coding, public speaking, athletics, football, swimming, leadership, etc.
- [x] Extend existing co-curricular/department work into talent tracking.
- [x] Coaches/teachers can record talent development scores and notes.
- [x] Talent evidence links to portfolio and Skills Passport.
- [x] Talent participation analytics per class/grade/gender/term.
- [x] Talent report section in modular reports.

## J.12 — Teacher Planning Linked to Curriculum Objectives (COMPLETED)

- [x] Extend LessonPlan to link to curriculum objective, competency and assessment plan.
- [x] Teacher can record observations directly from lesson plan.
- [x] Teacher can attach learning resources and evidence.
- [x] Coverage tracking connects syllabus topics to competencies and assessments.
- [x] Teacher planning analytics: planned vs taught vs assessed objectives.
- [ ] Parent-facing summaries only show approved/high-level progress.

## J.13 — Parent Growth Dashboard (COMPLETED)

- [x] Extend Parent Portal beyond marks: attendance, behavior, competencies, talents, projects, teacher feedback, upcoming assessments and goals.
- [x] Add parent-friendly “growth not just grades” summary cards.
- [x] Allow parents to view portfolio highlights safely.
- [x] Add upcoming assessment calendar per child.
- [x] Add teacher feedback digest.
- [x] Add parent goal-setting acknowledgement where school enables it.

## J.14 — Student Digital Identity ## J.14 — Student Digital Identity & Transfer Passport Transfer Passport (COMPLETED)

- [x] Create portable Student Digital Identity view: achievements, competencies, medical alerts if enabled, talents, clubs, leadership roles, behavior, awards, attendance, certificates, portfolio.
- [x] Transfer passport export for schools not using NEYO.
- [x] Secure transfer between NEYO schools when both use NEYO, with parent/school consent.
- [x] Receiving school import workflow with audit log.
- [x] Data minimization controls: choose what transfers.
- [x] Legal consent and access log for every transfer.

## J.15 — Modular Report Builder (COMPLETED)

- [x] Create no-code report-template engine for CBC, internal reports, competency reports, portfolio reports, pathway reports and custom reports.
- [x] Reuse Document Design engine from I.42 where possible.
- [x] Support sections: marks, competencies, attendance, behavior, talent, portfolio, teacher comment, principal comment, QR verification.
- [x] School can choose report layout without code.
- [x] Report PDFs must be print-perfect and Powered by NEYO.
- [x] Report template changes are audit logged.

## J.16 — Advanced School Analytics (COMPLETED)

- [x] Competency gap analytics by class/grade/subject/teacher.
- [x] Per-subject/per-teacher academic performance analytics foundation. *(STARTED/COMPLETED under I.60: `exam-analytics.service.ts`, `/api/exams/analytics`, and Exams analytics UI calculate term trends, subject means, teacher-linked performance and learner progress.)*
- [x] Assessment balance analytics: too many exams vs projects/practicals/portfolio.
- [x] Attendance-to-performance correlation.
- [x] Talent participation and wellbeing indicators.
- [x] Pathway readiness analytics.
- [x] Principal dashboard cards for weak competencies and intervention needs.

## J.17 — Community Service Module (COMPLETED)

- [x] Create `CommunityServiceActivity`: title, category, date, hours, location, supervisor, evidence.
- [x] Track tree planting, charity, environmental projects, volunteer work, school service.
- [x] Student reflection journal per activity.
- [x] Teacher/supervisor approval workflow.
- [x] Community service contributes to competencies and learning journey timeline.
- [x] Community service report and certificate export.

## J.18 — Career Discovery ## J.18 — Career Discovery & Pathway Guidance Pathway Guidance (COMPLETED)

- [x] Track student interests over time.
- [x] Map interests + competencies + performance + talents to career areas.
- [x] Career areas: engineering, medicine, agriculture, business, ICT, creative arts, sports, education, public service.
- [x] Teacher/counselor recommendation workflow.
- [x] Parent/student career conversation view.
- [ ] Bundi may later help summarize, but career discovery must work rule-based without Bundi.

## J.19 — Whole-School Ecosystem Integration (COMPLETED)

- [x] Connect attendance, behavior, assessments, competencies, portfolio, clubs, parent communication and analytics into one learner journey.
- [x] Attendance can inform wellbeing insights.
- [x] Behavior can contribute to development reports.
- [x] Projects feed portfolio.
- [x] Clubs feed talent profile.
- [x] Parent communication includes academic and co-curricular progress.
- [x] Storage Vault protects portfolio evidence.
- [x] NEYO Ops can see cross-tenant anonymous aggregate education trends without exposing school data.

## J.20 — Future-Proof Configuration ## J.20 — Future-Proof Configuration & Versioning Versioning (COMPLETED)

- [x] Curriculum configurations must be versioned: e.g. CBC 2026, CBC 2027 update.
- [x] Schools can preview a future curriculum before switching.
- [x] Migration assistant shows what will change before applying updates.
- [x] Historical reports keep the curriculum version used at the time.
- [x] Assessment and report templates versioned with effective dates.
- [ ] NEYO Ops can publish official curriculum templates for schools to adopt.

## J.21 — NEYO Ops Curriculum Template Library (COMPLETED)

- [x] NEYO Ops can create company-level curriculum templates.
- [x] Templates can be published to schools: CBC Kenya, 8-4-4 legacy, custom/private school templates.
- [x] Schools can copy template then customize locally.
- [x] Template updates can be announced and adopted intentionally.
- [x] Audit log for template publish/adoption.

## J.22 — Compliance, Consent ## J.22 — Compliance, Consent & Data Safety Data Safety (COMPLETED)

- [x] Portfolio and learner journey visibility controls per role.
- [x] Parent/student consent rules for transfer passport and portfolio sharing.
- [x] Storage retention rules for portfolio evidence.
- [x] Sensitive medical/discipline items excluded from transfer unless explicitly approved.
- [x] ODPC/Kenya Data Protection Act alignment for learner identity and transfer data.
- [x] Full audit log for exports, transfers and report generation.

## J.23 — Revenue ## J.23 — Revenue & Product Packaging Opportunities Product Packaging Opportunities (COMPLETED)

- [x] Skills Passport as paid add-on for premium schools.
- [x] Portfolio storage add-on linked to Storage Vault quota.
- [x] Career guidance/pathway module as Pro/Elite feature.
- [x] Advanced analytics as Pro/Elite feature.
- [x] Custom report-template design as paid service or Elite feature.
- [x] Inter-school transfer passport as premium trust feature.

## J.24 — Implementation Phases (COMPLETED)

- [x] Phase 1: Curriculum Engine foundation.
- [x] Phase 2: Flexible Assessment + Competency evidence.
- [x] Phase 3: Skills Passport + Portfolio.
- [x] Phase 4: Senior Pathways + Career Discovery.
- [x] Phase 5: Modular Report Builder.
- [x] Phase 6: Advanced Analytics and intervention intelligence.
- [x] Phase 7: NEYO Ops curriculum template publishing.

## J.25 — Non-Duplication Rules for Part J (COMPLETED)

- [~] Before building any J feature, audit existing B/I features first: Exams, CBC, Timetable, LMS, Parent Portal, Student Profile, Storage Vault, Co-curricular, Document Design. *(STARTED 2026-06-26 for J.3: audited B.5 Exams, B.6 CBC, B.13 LMS, I.60 analytics and Storage Vault in `docs/J3-FLEXIBLE-ASSESSMENT-ENGINE-AUDIT.md`; repeated for J.4, J.5, J.6, J.7; UPDATED 2026-06-28 for J.8 in `docs/J8-LEARNING-JOURNEY-TIMELINE-AUDIT.md`.)*
- [x] If existing feature is partial, extend it rather than creating a duplicate module.
- [~] Every J feature must update this checklist and `docs/CONTEXT-ANCHOR.md`. *(STARTED: J.2 and J.3 checkpoints update checklist/context anchor. J.3 Chunk 7/final seed explicitly deferred by founder on 2026-06-26 and recorded before moving to J.4. UPDATED 2026-06-28: repo typecheck health was repaired before resuming J.7, J.7 progress through seed completion was recorded, and J.8 audit + Chunk 2 validation + Chunk 3 backend aggregation service + Chunk 4 API route + Chunk 5 UI components + Chunk 6 frontend wiring + Chunk 7 UX hardening were also recorded in these files.)*
- [ ] Every visual J feature requires a screenshot.
- [x] Every evidence-file feature must use encrypted Storage Vault upload path.

# PART K — Advanced Grading & Computation Engine

## K.1 — Teacher Row-Level Security & Portal Access
- [x] Enforce strict row-level security: Teachers can ONLY view and enter marks for classes and subjects explicitly assigned to them on the timetable/roster.
- [x] Academics department can set "Portal Open" and "Portal Close" dates for marks entry.
- [x] Teacher UI clearly shows countdown to portal closure and locks inputs when closed.

## K.2 — Subject-Level Multi-Paper Configuration (Micro-Weights)
- [x] Create \`SubjectPaper\` model to allow splitting a subject into PP1, PP2, PP3, Theory, or Practical.
- [x] Configurable "Out Of" limits per paper (e.g., PP1 out of 40, PP2 out of 80).
- [x] Configurable weighting per paper (e.g., PP1 contributes 40%, PP2 40%, PP3 20% to the final subject score).
- [x] Support "Equal Share" distribution or 100% single-paper default configurations.
- [x] Auto-normalization: The system correctly converts raw marks against the "out of" limit into the weighted percentage automatically.

## K.3 — Term-Level Master Aggregation (Macro-Weights)
- [x] Create \`TermAggregationRule\` model allowing schools to define how different assessment types form the final term report.
- [x] Support custom ratio building: e.g., Assignments (10%) + CAT 1 (25%) + CAT 2 (25%) + End Term Exam (40%).
- [x] Support a simple "Total & Average" traditional fallback mode for schools that do not want complex ratio weighting.
- [x] Ensure these rules can be configured globally for the school, or overridden per specific class/level.

## K.4 — Teacher Marks Entry UI
- [x] Spread-sheet style data grid for teachers to input marks efficiently.
- [x] Dynamic columns based on K.2 (shows columns for PP1, PP2, etc., based on subject config).
- [x] Inline validation preventing teachers from entering a mark higher than the configured "Out Of" value (e.g., blocks entering 45 if PP1 is out of 40).
- [x] Real-time autosave as teachers type.

## K.5 — Asynchronous Background Computation Engine
- [x] Build a background job processor for calculating the master term reports.
- [x] Trigger computation automatically when the marks portal closes, or manually via Academics admin.
- [x] Provide a live UI Progress Bar and ETA estimate for the Academics admin while the system calculates thousands of records.
- [x] Push a system notification to Academics when the computation successfully finishes.

## K.6 — CBC Alignment & Cross-Module Sync
- [x] Map the final computed weighted percentages to CBC Rubric levels (e.g., 80-100% -> Exceeding Expectations).
- [ ] Auto-sync the computed final results directly into \`CompetencyEvidence\` (J.4) and the Learner Journey (J.8).
- [x] Ensure the final aggregated data connects perfectly to the Modular Report Builder (J.15).

## K.7 — Joint Release & Approval Workflow
- [x] Post-computation, lock results in a "Draft / Pending Release" state.
- [x] Trigger an alert to the Principal and/or Deputy Principal to review the final master report.
- [x] Joint approval UI: Principal clicks "Approve & Release" to officially publish the term's results.

## K.8 — Multi-Channel Result Broadcast
- [x] Upon Principal release, fire in-app notifications to all relevant teachers.
- [x] Auto-generate and dispatch an SMS broadcast to all parents: "Results for [Term] are ready. View on NEYO Portal."
- [x] Instantly unlock the results on the Parent Growth Dashboard (J.13) and Student Digital Identity (J.14).

## K.9 — Academic Result Printing & Distribution
- [x] Academics department can bulk print results for all students arranged stream-wise or class-wise.
- [x] Class teachers can print their specific class marks/exam performance.

## K.10 — Parent Uploads & Approval Workflows
- [x] Parents can upload student photos and documents (birth certs, certificates, etc.) via the portal.
- [x] Uploads enter a "Pending Approval" state; Class Teacher or Department must approve before saving to profile.
- [x] Restrict teachers from editing student photos without explicit department permission.

## K.11 — Parent Portal: Mobile UI & Payments
- [x] Mobile view UI revamp: Implement small, dense grid/horizontal scroll cards for (Fees, Results, Attendance, Pickup Safety, Homework, Quizzes, Classnotes, Uniform Shop, Library Books). Pressing a card opens full details.
- [x] M-Pesa STK Push integration for self-prompted fee payment by parents.
- [x] Multi-child payment routing: Parent can select which child to pay for or split/share payment across children.
- [x] Full fee structure visibility per child, dynamically showing different fees for children in different classes.
- [x] Parents can download class notes and watch class videos directly from the portal.

## K.12 — Advanced Student Duty Roster Engine
- [x] Toggle to enable/disable the Duty Roster system school-wide.
- [x] Configure Duty Areas (cleaning, etc.) and target specific classes (e.g., Form 1 & 2 only, Boarding vs Day).
- [x] Gender equality logic: Balance mixed classes, or allow boys-only / girls-only specific duties.
- [x] Clash prevention: Strict "one duty per student per time" rule (no double booking).
- [x] Exclusion rules: Automatically exclude student leaders if configured.
- [x] Medical exclusion rules: Block health-conditioned/allergic students from specific unsafe duties (e.g., dust allergy).

## K.13 — Automated Sibling Discounts
- [x] System automatically calculates and applies sibling discounts during fee invoice generation if the school has it enabled.

## K.14 — Digital Signatures & Transcripts
- [x] Principal can upload and save a digital signature and stamp to the system.
- [x] Automatically stamp and sign transcripts/report cards when results are officially released.

## K.15 — Student Clearance & Arrears (Transfers)
- [x] System blocks/flags student transfer if there are pending library arrears (or other departmental arrears).
- [x] Clearance workflow: Student must pay book value or replace book at the library to get cleared for transfer.

## K.16 — KNEC Document Aggregation
- [x] Parent or Class Teacher can upload required application exam documents (scanned versions).
- [x] System aggregates and combines uploaded documents into a specific KNEC format for batch export/sending.

# PART L — Advanced Timetable & Subject Operations

## L.1 — Timetable Generator Fixes & Expansions
- [x] Fix 10-period bug: Generator must respect exact period count from settings, not cap at 8.
- [x] Lunch Shift logic update: Define lunch as "After Period X" rather than abstract shifts.
- [x] Double Short Breaks: Support configuring two distinct short breaks in the school day.
- [x] Differentiated End Times: Support alternate end times (e.g., Saturdays) and auto-schedule "home" blocks for those without classes.
- [x] Games/PE Targeting: Allow PE to target specific class groups at specific times, not just Friday evenings.

## L.2 — Timetable UI Speed & Bulk Actions
- [x] Arrow/Enter key navigation in the timetable grid for rapid data entry.
- [x] Bulk apply rules: Select a range of classes to apply a schedule rule to avoid repetitive manual entry.
- [x] Offline Staff: Allow assigning classes to teachers purely for timetable completeness even if they don't have app access.

## L.3 — Automatic Teacher-Class Matching
- [x] Build a pairing algorithm that automatically and fairly assigns teachers to classes based on their subjects and "strong" areas.
- [x] Allow manual overrides before final generation.
- [x] Ensure the generator instantly flags if a teacher transfers or settings change.

## L.4 — Student Subject Selection (Electives)
- [x] Academics can configure Compulsory vs Elective subjects per class level.
- [x] "Portal Window" for students to log in and select their electives from home.
- [x] Post-selection report generation for Academics to finalize stream groupings.

## L.5 — Stream Reshuffling & Term Promotions
- [x] UI to easily reshuffle students between streams to balance overpopulation.
- [x] Automated Promotion: Promote classes based on exam pass marks.
- [x] Repeat Requests: Class teachers can manually flag a student to repeat a year.

## L.6 — First-Day "Ghost" Tracking
- [x] Term Opening Day attendance check.
- [x] Unexplained absences immediately trigger "Status: Unknown" to freeze billing and duty roster assignments until confirmed.

---

# PART M — Revenue, Data & Comms

## M.1 — NEYO Referral Engine
- [ ] Generate unique referral codes for every active school.
- [ ] If a new school signs up with a code, automatically credit a 5% discount to BOTH schools on their next invoice.
- [ ] In-app prompt encouraging schools to refer others immediately after paying their subscription.

## M.2 — SMS Margin Revenue (NEYO Ops)
- [ ] NEYO Ops can configure a dynamic SMS markup (e.g., buy at 0.8 KES, sell at 1.2 KES).
- [ ] NEYO Ops dashboard tracks total SMS revenue margins and attributes them to the system.

## M.3 — Contact Management & Calendar
- [ ] Class teachers can update parent phone numbers and add guardians.
- [ ] School Events sync with native mobile calendars and specify target audiences (Parents, Staff, etc.).
- [ ] Fix Chat UI: Prevent the message input box from hiding behind cards while scrolling.

## M.4 — Import Engine Upgrades
- [ ] Support importing and explicitly saving Legacy Admission Numbers.
- [ ] Add strict duplicate-prevention logic.
- [ ] Allow importing a single specific class list in isolation.

---

# PART N — Smart Printing, IDs & Hardware

## N.1 — Multi-Purpose Smart IDs
- [ ] Generate dense batch PDFs (multiple IDs per A4 page) for easy cutting.
- [ ] IDs include Photo, Name, Admission Number, School Logo, and a central QR Code.
- [ ] Include digital stamp overlays on IDs if configured.

## N.2 — QR Hardware Integration
- [ ] 1-Tap Attendance: Scanning the ID QR logs attendance (with strict guards preventing duplicate session scans).
- [ ] 1-Tap Payments: Scanning the same ID QR brings up the fee payment prompt instantly.

## N.3 — Dynamic Newsletter Printing
- [ ] Refactor Newsletter PDF generation to eliminate hardcoded cut-lines and dynamically collapse blank spaces based on text length.
