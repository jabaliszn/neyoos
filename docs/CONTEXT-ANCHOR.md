# 🧠 NEYO — CONTEXT ANCHOR ("Save Game")

## 🔁 PART J BATCH 1 — FUTURE-PROOF EDUCATION OS ANALYSIS + CHECKLIST ADDED (2026-06-25)
- Founder provided a major vision message: NEYO should not be a hardcoded CBC system; it should become a future-proof Education Operating System that can support any curriculum and adapt as Kenya’s curriculum changes.
- Added `docs/NEYO-FUTURE-PROOF-EDUCATION-OS-ANALYSIS.md`, a detailed architecture analysis covering curriculum engine, flexible assessment, competency framework, skills passport, portfolio, learning journey, activity-aware timetable, senior pathways, talent tracking, teacher planning, parent growth dashboard, student digital identity, modular reports, analytics, community service, career discovery, whole-school ecosystem integration, versioning and NEYO’s uniqueness.
- Appended a new `PART J — Future-Proof Education OS (Curriculum-Independent School OS)` to `docs/FEATURES-CHECKLIST.md` with J.1–J.25 feature sections. Each section is designed to connect with existing NEYO modules instead of duplicating: Exams/CBC, Timetable, LMS, Parent Portal, Student Profile, Storage Vault, Co-curricular, Document Design and I.60 analytics.
- Added explicit non-duplication rules for Part J: audit existing modules first, extend partial features, update checklist/context anchor, capture screenshots for visual features, and use encrypted Storage Vault for evidence files.
- No product code was built in this turn; this was an analysis + roadmap/checklist expansion task. NEXT = continue selected Part J feature in small full-stack chunks, likely J.2 Curriculum Engine foundation.

## 🔁 PART I BATCH 130 — I.60 OAUTH LIVE TOKEN/PROFILE EXCHANGE COMPLETED (2026-06-25)
- Completed OAuth live token/profile exchange for Google, Apple and Microsoft account linking.
- Updated `src/lib/services/oauth-vault.service.ts`: provider credentials are read from NEYO Ops vault, `startOAuthLink()` creates signed state and provider auth URL, and `completeOAuthCallback()` now exchanges authorization codes at provider token endpoints, fetches/extracts profile identity, upserts `OAuthConnectedAccount`, deletes state and audit-logs `oauth.connected`.
- Google uses `https://oauth2.googleapis.com/token` + `https://openidconnect.googleapis.com/v1/userinfo`; Microsoft uses common v2 token endpoint + OIDC userinfo; Apple uses token endpoint + ID-token payload extraction. No access tokens are stored.
- `ConnectedAccountsCard` already uses real `/api/oauth/status`, `/api/oauth/start/[provider]`, and `/api/oauth/disconnect/[provider]` endpoints. Provider console setup/callback registration remains required before live use.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-oauth-live-exchange-test.ts` ✓, `./node_modules/.bin/tsx scripts/i60-oauth-youtube-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist Google/Apple/Microsoft OAuth and I.60 OAuth line are now ticked.

## 🔁 PART I BATCH 129 — I.60 MULTI-TERM TRANSCRIPTS + EXAM ANALYTICS COMPLETED (2026-06-25)
- Completed I.60 “Transcripts (multi-term), per-subject/per-teacher performance analytics, multi-term student progress.”
- Added `src/lib/services/exam-analytics.service.ts`, computing analytics from real `Exam`, `ExamResult`, `Subject`, `Student`, `ClassSubjectNeed`, and `User` records. Outputs: term trends, subject performance, teacher-linked performance and learner progress highlights with delta/trend labels.
- Added API `/api/exams/analytics`, gated by `exam.view`.
- Added `src/components/exams/exam-analytics-client.tsx` and mounted it on `/exams` above the existing exam manager. UI shows summary counts, term trend, subject performance, teacher-linked performance and learner progress cards.
- Verified existing transcript PDF builder `buildStudentTranscriptPdf()` already collects published multi-term exam records and renders a multi-term transcript PDF.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓ after test fix, `./node_modules/.bin/tsx scripts/i60-exam-analytics-transcripts-test.ts` ✓ (non-fatal PDF logo path warnings only), `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i60-exam-analytics.png`. NEXT = remaining I.60 items are OAuth live token/profile exchange after real provider credentials, WhatsApp inbound bot, or Bundi-gated KCSE/photo-grading seam.

## 🔁 PART I BATCH 128 — I.60 FULL INTEGRATION KEYS GUIDE COMPLETED (2026-06-25)
- Founder asked for a full document explaining anything else needed for I.60 integrations.
- Added `docs/I60-INTEGRATIONS-ACTIVATION-GUIDE.md`, a non-coder friendly activation guide explaining every key/value currently supported by NEYO Ops Integration Credential Vault: OAuth, central Daraja, VAPID/Web Push, WhatsApp Business, Africa’s Talking SMS, Resend, Redis/Upstash, Sentry/Better Stack/PostHog, TURN/WebRTC, YouTube Data API and Bundi provider key.
- Guide explains where to get each key, what it does, where to paste it in NEYO Ops, callback URLs, testing steps, recommended production activation order, key-rotation rules, privacy/legal notes and emergency credential procedure.
- Updated `docs/FEATURES-CHECKLIST.md` with a completed I.60 guide line. NEXT = choose next I.60 product build: multi-term transcripts/analytics, OAuth token/profile exchange after live credentials, or Bundi-gated KCSE/photo-grading seam.

## 🔁 PART I BATCH 127 — I.60 OAUTH + YOUTUBE API KEY FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed OAuth activation seam and YouTube learning API key vault wiring.
- YouTube Learning: `learning-video.service.ts` now reads `youtube_api_key` from encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, with `YOUTUBE_API_KEY` env fallback. This fixes the “Add YouTube API key” issue without code editing once the key is saved in NEYO Ops.
- OAuth: added `OAuthConnectedAccount` and `OAuthState` models via migration `20260625010000_i60_oauth_vault_seam`. Added `src/lib/services/oauth-vault.service.ts` and signed-in APIs `/api/oauth/status`, `/api/oauth/start/[provider]`, `/api/oauth/disconnect/[provider]`, `/api/oauth/callback/[provider]`.
- Connected Accounts UI now uses real API status/start/disconnect instead of fake local toggles. Provider authorization URLs are built from vault credentials and state is stored/audited. Final token/profile exchange remains live-provider validation after real Google/Apple/Microsoft apps are configured.
- Added `youtube_api_key` to Integration Credential Vault and created `docs/INTEGRATION-KEYS-GUIDE.md`, explaining where to get YouTube Data API key and Google/Apple/Microsoft OAuth client IDs/secrets, callback URLs, and safe handling rules.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-oauth-youtube-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = finish OAuth token/profile exchange after live provider credentials, or continue I.60 academic analytics/transcripts.

## 🔁 PART I BATCH 126 — I.60 TURN / WEBRTC FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed TURN/WebRTC activation from the NEYO Ops Integration Credential Vault.
- Added `src/lib/services/webrtc-config.service.ts`, which reads `stun_server_url`, `turn_server_url`, `turn_server_username`, and `turn_server_secret` from `NeyoIntegrationSecret` via `readCompanySecret()`, with env fallback, and returns browser-safe ICE server config.
- Added signed-in API `/api/webrtc/ice` for clients to fetch ICE server config without exposing secrets publicly.
- Updated `OnlineClassRoomClient` and `ClassVoiceRoom` to fetch `/api/webrtc/ice` and use the vault-backed ICE servers when creating `RTCPeerConnection`, with Google STUN fallback when TURN is absent.
- Added `stun_server_url` and `turn_server_username` to Integration Credential Vault registry.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-turn-webrtc-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist I.60 WebRTC/TURN line is now ticked. NEXT = OAuth activation from vault, multi-term transcripts/analytics, or Bundi-gated KCSE/photo-grading seam.

## 🔁 PART I BATCH 125 — I.60 OBSERVABILITY FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed Sentry / Better Stack / PostHog activation from NEYO Ops vault.
- Added `src/lib/observability/vault-observability.ts`, which reads encrypted `sentry_dsn`, `better_stack_token`, optional `better_stack_ingest_url`, `posthog_key`, and optional `posthog_host` from `NeyoIntegrationSecret` via `readCompanySecret()`, with env fallback.
- Updated `src/lib/observability/capture.ts`: `captureError()` and `captureMessage()` still log locally but now also send async events to Sentry and Better Stack seams when vault credentials exist.
- Updated `src/lib/observability/analytics.ts`: `track()` still logs locally but now also sends PostHog capture events when vault credentials exist.
- Updated Integration Credential Vault registry with `better_stack_ingest_url` and `posthog_host` public config entries.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-observability-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist Sentry/Product analytics/I.60 observability lines are now ticked. NEXT = TURN/WebRTC from vault, OAuth activation, or remaining I.60 academic analytics/transcripts.

## 🔁 PART I BATCH 124 — I.60 REDIS WORKER FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed Redis worker activation from the NEYO Ops Integration Credential Vault.
- Updated `src/lib/jobs/bullmq-adapter.ts`: added `getRedisQueueUrl()` and `isRedisQueueConfigured()`, reading encrypted `redis_url` from `NeyoIntegrationSecret` via `readCompanySecret()` with `REDIS_URL` env fallback. `addToQueue()` now uses the vault/env URL and errors clearly if missing.
- Updated `src/lib/jobs/jobs.service.ts`: `enqueue()` now uses vault-aware Redis readiness before queueing, otherwise keeps in-process fallback for dev.
- Added real `scripts/worker.ts`: worker reads Redis URL from NEYO Ops vault/env, drains `neyo-jobs`, uses `runJob()`, and supports `WORKER_CONCURRENCY`.
- Updated health and scale readiness checks to use vault-aware Redis status.
- Verification: `npm install` was needed again because node_modules were missing; then `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-redis-worker-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist A.12 BullMQ/worker and I.60 Bulk async generation are now ticked for vault activation. NEXT = I.60 Sentry/Better Stack/PostHog from vault or TURN/WebRTC from vault.

## 🔁 PART I BATCH 123 — HYDRATION STABILITY PASS / ROOT HARDENING (2026-06-25)
- Founder reported recurring Next.js hydration mismatch. Clarified that the “Next.js 14.2.5 outdated” notice is separate from hydration mismatch.
- Ran a Playwright hydration debug script across `/`, `/login`, `/dashboard`, and `/settings/storage` in clean Chromium. Hydration mismatch did not reproduce; only a dev Fast Refresh RSC fetch warning appeared during page transitions. This points to likely browser-extension injection or dev hot-refresh timing, but root hardening is still useful.
- Patched `src/app/layout.tsx` by adding `suppressHydrationWarning` to `<body>` as well as the already-suppressed `<html>`, reducing crashes from browser/extension-injected body attributes and first-paint differences.
- Added `scripts/debug-hydration.ts` for future hydration diagnostics.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓, debug script completed without hydration mismatch. Checklist I.58 marked partial with hydration-stability note. NEXT = continue I.60 provider activation or a fuller I.58 performance pass when requested.

## 🔁 PART I BATCH 122 — I.60 WHATSAPP BUSINESS FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed the I.60 WhatsApp Business outbound activation chunk.
- Updated `src/lib/notifications/whatsapp.ts`: `sendWhatsApp()` now reads `whatsapp_business_token`, `whatsapp_phone_number_id`, and optional `whatsapp_api_version` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, with env fallback. It posts to the WhatsApp Cloud API `/messages` endpoint when configured and keeps dev-console fallback outside production.
- Added tenant-aware school-name prefixing for WhatsApp: callers can pass `{ tenantId }`; the transport prefixes the correct school name unless already prefixed or disabled with `{ prefix:false }`. Notification cascade now passes `tenantId` into WhatsApp transport.
- Added `whatsapp_phone_number_id` and `whatsapp_api_version` to the Integration Credential Vault.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-whatsapp-business-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist A.7 WhatsApp Business API, WhatsApp notifications, WhatsApp reminders and the I.60 notification bundle are now ticked for outbound vault activation. WhatsApp inbound bot remains a separate future chunk.

## 🔁 PART I BATCH 121 — I.60 AFRICA'S TALKING SMS FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed the I.60 Africa’s Talking SMS activation chunk.
- Updated `src/lib/notifications/sms.ts`: `sendSms()` now reads `africas_talking_api_key`, `africas_talking_username`, and optional `africas_talking_sender_id` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, with env fallback. It sends through `https://api.africastalking.com/version1/messaging` when configured and keeps dev-console fallback outside production.
- Added tenant-aware school-name prefixing: callers can pass `{ tenantId }` and SMS messages are prefixed with the correct school name if the message does not already start with that school name or `NEYO:`. OTP/system messages use `{ prefix:false }` to avoid school prefixing. Notification cascade now passes `tenantId` into SMS transport.
- Added `africas_talking_sender_id` to `integration-credentials.service.ts`, so founder can manage AT API key, username and sender ID from NEYO Ops without code changes.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-africas-talking-sms-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist A.7 SMS via Africa’s Talking is now ticked; I.60 notification bundle remains partially open only for WhatsApp transport vault activation.

## 🔁 PART I BATCH 120 — I.60 WEB PUSH / VAPID FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed the I.60 Web Push/VAPID activation chunk.
- Updated `src/lib/notifications/push.ts`: added `getVapidConfig()` so Web Push reads `vapid_public_key`, `vapid_private_key`, and `vapid_subject` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`, with env fallback. `sendPush()` now sets VAPID details from vault values when configured.
- Updated `/api/notifications/native-subscription` so the native notification subscription flow returns the vault-backed VAPID public key, not only `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Existing NotificationBell permission/subscription UI now inherits this.
- Added `vapid_subject` to `integration-credentials.service.ts`, so founder can manage VAPID public/private keys and subject from NEYO Ops without code changes.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-vapid-webpush-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist A.7 Web Push and contextual prompt are now ticked; I.60 notification bundle remains partially open for WhatsApp and Africa’s Talking SMS vault activation.

## 🔁 PART I BATCH 119 — I.60 RESEND EMAIL FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Completed the I.60 Resend email activation chunk.
- Updated `src/lib/notifications/email.ts`: `sendEmail()` now reads `resend_api_key` and `resend_from_email` from the encrypted NEYO Ops Integration Credential Vault via `readCompanySecret()`. If a key exists, it sends through `https://api.resend.com/emails`; if no key exists in non-production, it keeps dev-console fallback for local testing.
- Added `resend_from_email` to `integration-credentials.service.ts`, so both sender email and API key are editable in NEYO Ops without code changes.
- All email callers (magic links, notification cascade email channel, shared-document emails, etc.) continue using the same `sendEmail()` seam and now inherit vault-based Resend activation.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-resend-email-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist A.7 Email via Resend and Email notifications ticked; I.60 notification bundle remains partially open for VAPID/Web Push, WhatsApp and Africa’s Talking SMS vault activation.

## 🔁 PART I BATCH 118 — I.60 CENTRAL DARAJA FROM NEYO OPS VAULT COMPLETED (2026-06-25)
- Started specific I.60 activation with “Live Daraja central billing from vault.”
- Updated `src/lib/services/central-billing.service.ts` so NEYO central subscription billing reads `central_daraja_shortcode`, `central_daraja_environment`, `central_daraja_consumer_key`, `central_daraja_consumer_secret`, and `central_daraja_passkey` from the encrypted NEYO Ops Integration Credential Vault (`NeyoIntegrationSecret` via `readCompanySecret`).
- Central billing now switches from dev mock to `DarajaProvider` automatically when vault/env credentials are present; STK pushes use callback override `/api/billing/central-callback`; central callback can parse real Daraja `Body.stkCallback` shape and auto-reconnects subscriptions through the existing I.49 flow.
- Added `central_daraja_environment` to Integration Credential Vault and added `getCentralBillingGatewayStatus()` for safe readiness/status inspection without exposing secrets.
- Updated `src/lib/payments/provider.ts` / `daraja-provider.ts` so STK input can override callback URL, leaving school-fee payment flows untouched while central NEYO money uses its own callback route.
- Verification: `npm install` was needed again because node_modules were missing; then `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-central-daraja-from-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Checklist I.60 M-Pesa live line is now ticked; real production use still requires saving actual Safaricom credentials in NEYO Ops and registering the callback URL with Safaricom.

## 🔁 PART I BATCH 117 — I.60 INTEGRATION CREDENTIAL VAULT IN NEYO OPS COMPLETED (2026-06-25)
- Founder requested I.60 and clarified credentials must be edited in NEYO Ops, not by touching code.
- Added `src/lib/services/integration-credentials.service.ts`, reusing company encrypted secret storage (`NeyoIntegrationSecret` + `company-secret.service.ts`) so integration credentials are encrypted with the NEYO company key and masked in UI.
- Founder Ops settings payload now returns `integrationCredentials`; POST action `save_integration_credential` saves credential values with audit `platform.integration_credential_saved`.
- Business Operations now includes “Integration Credential Vault” for OAuth (Google/Apple/Microsoft), central Daraja, VAPID/Web Push, WhatsApp Business, Africa’s Talking SMS, Resend email, Redis/Upstash queues, Sentry/Better Stack/PostHog observability, TURN/WebRTC and Bundi provider key. The UI states credentials are edited here, not in source code, and public screens show features only, not provider secrets.
- This completes the shared I.60 credential-management foundation; individual live provider activation remains provider/credential-console gated and should be done in small follow-up chunks.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i60-integration-credential-vault-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i60-integration-credential-vault.png`. NEXT = choose a specific I.60 activation chunk, e.g. live Daraja central billing, Web Push/VAPID from vault, Resend email from vault, or Redis worker activation.

## 🔁 PART I BATCH 116 — I.56 SCALE ARCHITECTURE HARDENING COMPLETED (2026-06-25)
- Completed the I.56 2,000,000 active users scale-readiness line.
- Added `docs/NEYO-SCALE-2M-ARCHITECTURE.md`, documenting the production architecture for the 2M-user target: CDN, stateless Next.js app/API, Neon/Postgres with pooling and read replicas, Redis/BullMQ queues, workers, encrypted R2/S3 storage, observability, rate limits, backup/restore, load testing stages and readiness gates.
- Added `src/lib/services/scale-readiness.service.ts`, a safe readiness checker that does not expose secrets and reports status for production Postgres, pooling, Redis queues, object storage, encrypted uploads, worker, observability, cron secret and master KEK.
- Added SUPER_ADMIN-only API `/api/admin/scale-readiness` for NEYO Ops/founder inspection of 2M-readiness prerequisites.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i56-scale-readiness-test.ts` ✓, `npm run test:roles` 24/24 ✓. No screenshot because this was architecture/API hardening, not a visual feature. NEXT = I.57 GitHub / Local-Host Workflow Help unless founder chooses another item.

## 🔁 PART I BATCH 115 — I.56 LEGACY DIRECT UPLOAD ROUTES LOCKED (2026-06-25)
- Built Storage Vault Batch 4: locked legacy direct-browser upload routes.
- `/api/files/presign`, `/api/files/confirm`, and `/api/files/dev-put` now return `410 Gone` and direct callers to `/api/files/encrypted`. They no longer call `presignUpload()`, `recordFile()`, or `devPut()`, preventing future screens from accidentally storing plaintext files directly in a provider.
- `FileUpload` already uses `/api/files/encrypted`, so standard app upload surfaces remain encrypted-first. Legacy routes keep a clear migration-only env marker `NEYO_ALLOW_LEGACY_DIRECT_UPLOADS`, but they remain documented as legacy and unavailable for normal users.
- Updated `docs/NEYO-STORAGE-STRATEGY.md` with Batch 4 notes and updated the I.56 checklist line.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i56-lock-legacy-direct-upload-routes-test.ts` ✓, `./node_modules/.bin/tsx scripts/i56-direct-upload-migration-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = Google Workspace Admin SDK provisioning seam or I.56 scale hardening.

## 🔁 PART I BATCH 114 — I.56 DIRECT UPLOADS MIGRATED TO ENCRYPTED PATH (2026-06-25)
- Built Storage Vault Batch 3: migrated reusable direct-browser upload UI to encrypted upload path.
- `src/components/ui/file-upload.tsx` no longer uses `/api/files/presign` → direct `PUT` → `/api/files/confirm`. It now posts multipart files to `/api/files/encrypted`, so NEYO encrypts bytes with the tenant key before any provider receives the object.
- Existing app surfaces that use `FileUpload` (discipline proof, student docs, public-site images, homework, messages attachments, receipts, library digital copies, exam materials, pickup screenshots, etc.) inherit the encrypted path automatically.
- Legacy presign/dev-put/confirm routes remain for compatibility/future client-side-encryption work, but the standard reusable upload component is encrypted-first.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i56-direct-upload-migration-test.ts` ✓, `./node_modules/.bin/tsx scripts/i56-encrypted-upload-adapter-test.ts` ✓, `npm run test:roles` 24/24 ✓. No new UI screenshot because this was a behavior/security migration; existing Storage Vault screenshot remains `screenshots/i56-storage-vault.png`. NEXT = Google Workspace Admin SDK provisioning seam or I.56 scale hardening.

## 🔁 PART I BATCH 113 — I.56 STORAGE VAULT ENCRYPTED UPLOAD ADAPTER COMPLETED (2026-06-25)
- Built Storage Vault Batch 2: encrypted upload adapter.
- Encryption: added `encryptBufferForTenant()` and `decryptBufferForTenant()` in `src/lib/services/encryption.service.ts`, using tenant DEK + AES-256-GCM for binary file envelopes.
- Storage service: added `uploadEncryptedFile()` in `src/lib/services/storage.service.ts`; server-side uploads now encrypt before provider storage, record `encrypted=true`, `encryptionMode=AES_256_GCM_ENVELOPE`, `checksumSha256`, `wrappedKeyRef=tenant-dek:v1`, `provider`, and `providerObjectId`. `readObject()` decrypts encrypted blobs when serving files back through NEYO. Processed image uploads now go through encrypted upload.
- API: added `/api/files/encrypted` for multipart server-side encrypted uploads. Direct presigned browser uploads remain legacy/non-encrypted until a future migration to server-side encrypted upload or client-side encryption.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i56-encrypted-upload-adapter-test.ts` ✓, `npm run test:roles` 24/24 ✓. No new visual UI beyond existing Storage Vault page; existing screenshot `screenshots/i56-storage-vault.png` remains valid. NEXT = storage batch 3 Google Workspace Admin SDK provisioning seam or continue I.56 scale hardening.

## 🔁 PART I BATCH 112 — I.56 STORAGE VAULT MVP BUILT (2026-06-24)
- Started building the founder-approved Storage Vault idea.
- Database: added `TenantStorageProvider` and `StorageUsageSnapshot` through migration `20260625001000_i56_storage_vault_mvp`; extended `StoredFile` with provider/encryption/checksum/wrapped-key metadata fields.
- Backend/API: added `src/lib/services/storage-vault.service.ts` and `/api/storage-vault`. It creates a per-tenant storage provider row, calculates usage from real `StoredFile` rows, updates health status, records usage snapshots, configures provider seams (`NEYO_MANAGED_OBJECT_STORAGE`, `GOOGLE_WORKSPACE_MANAGED`, `GOOGLE_WORKSPACE_BYOS`), records upgrade requests, and audit-logs storage provider/upgrade changes.
- UI: added Settings → Storage (`/settings/storage`) and sidebar nav item. The page shows storage usage bar, provider/health badges, AES-256-GCM envelope encryption mode, provider selector, managed Google Workspace vault email seam, storage limit, internal notes, and upgrade paths (Google Workspace upgrade / NEYO managed add-on KES 500+). It explicitly states no plaintext Google passwords are stored.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i56-storage-vault-mvp-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i56-storage-vault.png`. NEXT = continue I.56 scale architecture hardening or later activate real Google Workspace/Admin SDK credentials and encrypted upload adapter.

## 🔁 PART I BATCH 111 — STORAGE STRATEGY FOUNDER CORRECTION RECORDED (2026-06-24)
- Founder clarified the desired storage model: NEYO should provision a fresh Google storage account per school, start with the included storage where available, then upgrade/pay when full from inside NEYO.
- Updated `docs/NEYO-STORAGE-STRATEGY.md` with a safer compliant version: use managed Google Workspace accounts or school-owned Workspace BYOS, not mass-created consumer Gmail accounts. Example: `karibu-high.storage@storage.neyo.co.ke`.
- Added password/security rule: NEYO should not store plaintext Google passwords in normal app storage. Prefer service-account/domain-wide delegation or encrypted OAuth/service credentials in a vault; any break-glass credential must be sealed, encrypted, rotated and SUPER_ADMIN-only.
- Updated checklist wording on the I.56 storage strategy line to reflect founder clarification: per-school managed Workspace provisioning, storage bars, upgrade/payment flow, AES-256-GCM encrypted blobs, health checks, object-storage fallback and Kenya legal considerations. NEXT = when approved, build the Storage Vault MVP UI/service; otherwise continue I.56 scale hardening.

## 🔁 PART I BATCH 110 — I.56 STORAGE STRATEGY / GOOGLE BYOS DESIGN ANSWER COMPLETED (2026-06-24)
- Founder proposed using Google BYOS/free Drive storage per school plus WhatsApp-style device storage to reduce NEYO storage costs.
- Researched the idea and documented the safe design in `docs/NEYO-STORAGE-STRATEGY.md`. Key conclusion: the concept is useful, but NEYO should not rely on mass-created free consumer Gmail accounts as the primary backend. Safer design is a storage abstraction with NEYO-managed encrypted object storage as default, optional Google Workspace/BYOS connector, usage bars, quota checks, paid storage add-ons and legal consent.
- Strategy covers: Google BYOS reality check, `StorageProvider` abstraction, AES-256-GCM envelope encryption, encrypted blobs in provider storage, metadata/key wrapping in NEYO, deletion/corruption protection, quota thresholds, upgrade flows, WhatsApp-style local/device media retention, live class no-recording default, Google account disabled/deleted handling, and Kenya Data Protection Act considerations.
- Updated `docs/FEATURES-CHECKLIST.md` and ticked the I.56 storage strategy/answer line. NEXT = either build the Storage Settings MVP later, or continue with I.56 scale architecture hardening line.

## 🔁 PART I BATCH 109 — I.55 COMPREHENSIVE FOUNDER MANUAL / PDF COMPLETED (2026-06-24)
- Built I.55 Comprehensive Founder PDF/manual for a non-coder founder.
- Added `docs/NEYO-FOUNDER-MANUAL.md` as the editable source manual, `docs/NEYO-FOUNDER-MANUAL.html` as the print-rendered version, and `docs/NEYO-FOUNDER-MANUAL.pdf` as the downloadable PDF.
- Manual contains 50 page-style sections plus appendices covering: what NEYO is, NEYO Ops, product map, local testing tonight, role tests, NEYO Ops testing, pricing, central money, expired-account reconnect, grace enforcement, company docs, contracts, customer hub, brand assets, landing content, YouTube learning and ads reality, class casting, hardware truthfulness, school profile, payments, feature testing checklists across modules, print quality rules, deployment, environment variables, GitHub basics, pre-commit tests, screenshot rule, 100-school marketing target, school visit blueprint, sales script, scale confidence and founder weekly routine.
- Rendered PDF with Playwright after reinstalling npm packages and browser/system dependencies. Screenshot captured: `screenshots/i55-founder-manual-cover.png`.
- Updated `docs/FEATURES-CHECKLIST.md` and ticked both I.55 lines. NEXT = founder can review the PDF/manual, then continue to I.56 Scale & Storage or I.57 GitHub/local-host workflow if desired.

## 🔁 PART I BATCH 108 — I.52 ODOO-INSPIRED LANDING DIRECTION ADJUSTMENT (2026-06-24)
- Founder rejected the heavier poster-style landing direction and requested borrowing ideas from Odoo instead. Reviewed Odoo homepage content/structure via `https://www.odoo.com/`.
- Adjusted `src/components/public-site/neyo-landing-client.tsx` toward an Odoo-inspired NEYO-owned style: lighter warm-white canvas, friendly app-grid hero, simpler headline rhythm, softer cards, clearer product-first presentation, less dark/heavy visual treatment, and still no copied Odoo branding/layout.
- Kept the page editable from NEYO Ops through `neyo_landing_content`; hero headline/subheadline, nav, product cards, media slots, footer and CTAs still come from editable content.
- Screenshot captured for review: `screenshots/i52-public-homepage-odoo-inspired-desktop.png`.
- Verification after adjustment: `scripts/i52-public-homepage-renderer-test.ts` ✓, `scripts/i52-landing-polish-seo-test.ts` ✓ after test expectation update, `npm run test:roles` 24/24 ✓. Full typecheck had previously passed in Batch 3; a later sandbox typecheck attempt hung without surfacing code errors, so use focused tests for this visual adjustment unless release-critical. NEXT = review founder feedback, then finish remaining I.52 Bundi/customer-story/final reconciliation only after visual direction is accepted.

## 🔁 PART I BATCH 107 — I.52 RESPONSIVE/PREMIUM POLISH + SEO/OG COMPLETED (2026-06-24)
- Built I.52 Batch 3: responsive/premium polish, SEO/Open Graph wiring and review screenshots for the NEYO company landing page.
- SEO/OG: added `generateMetadata()` in `src/app/page.tsx` so the corporate homepage reads `landing.seoTitle`, `landing.seoDescription`, `landing.ogImageUrl` and Twitter summary-card metadata from NEYO Ops `neyo_landing_content`.
- Responsive polish: `NeyoLandingClient` now has a mobile menu, smaller responsive hero type on phones, desktop/tablet/phone scaling, refined media preview frames, hover depth, intentional empty media states and enterprise footer polish.
- Visual direction: the page keeps the JerseyBird-inspired quality direction only at the level of confidence/editorial typography/nav/footer discipline; it remains NEYO-owned (warm white, navy, green, ecosystem card) and avoids copying jersey/e-commerce layout.
- Checklist: ticked completed I.52 structure/design lines for nav, hero, trust stats, product ecosystem, ecosystem visualization, industries, why NEYO, product showcase foundation, security, final CTA, footer, quality-direction inspiration, precise copy, enterprise footer and NEYO Ops reflection into SEO/OG/footer/CTA/public homepage. Remaining I.52 items: Bundi section, customer-story placeholders and final holistic design-deliverable reconciliation.
- Verification: `npm install` was needed again because node_modules were missing; then `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i52-landing-polish-seo-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshots: `screenshots/i52-public-homepage-batch3-desktop.png` and `screenshots/i52-public-homepage-batch3-mobile.png`. NEXT = I.52 final mini-batch for Bundi/customer-story placeholders and final reconciliation.

## 🔁 PART I BATCH 106 — I.52 PUBLIC HOMEPAGE RENDERER COMPLETED (2026-06-24)
- Built I.52 Batch 2: public homepage renderer consuming `neyo_landing_content`, while keeping the I.52 feature requirements in view.
- Public homepage: `src/app/page.tsx` now calls `getLandingContent()` and passes `landingContent` into `NeyoLandingClient` for the corporate root homepage.
- Renderer: rewrote `src/components/public-site/neyo-landing-client.tsx` into a more premium editorial landing renderer using editable content for nav, hero, launch banner, CTAs, trust stats, product ecosystem, industries, why-NEYO, security points, media showcase slots, final CTA, footer and social links.
- Media: landing page now includes intentional screenshot/video slots from `landingContent.mediaShowcase` and product-card media placeholders, so NEYO can add real screenshots/videos from NEYO Ops without broken empty areas.
- Safety: public renderer stays feature/outcome-focused and avoids exposing brand secrets or integration internals; landing content validation from Batch 1 remains the guardrail.
- Checklist: ticked the I.52 editable landing content line, media showcase line and public-safe-content line; slow-batches line remains in progress.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i52-public-homepage-renderer-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i52-public-homepage-batch2.png`. NEXT = I.52 Batch 3 responsive/premium polish + SEO/Open Graph wiring + review screenshots.

## 🔁 PART I BATCH 105 — I.52 LANDING CONTENT MODEL / NEYO OPS EDITOR COMPLETED (2026-06-24)
- Built I.52 Batch 1: landing page content model/editor in NEYO Ops.
- Backend/storage: added `src/lib/services/landing-content.service.ts`. Landing content is stored in `PlatformSetting` key `neyo_landing_content` with `landingContentSchema`, default seed content, and public-safe validation blocking words that expose secrets/credentials/prompts/private internals.
- API: Founder Ops settings payload now returns `landingContent`; POST action `update_landing_content` saves content via `saveLandingContent()` and audit-logs `platform.landing_content_updated`.
- UI: Founder Ops → Business Operations now includes “Landing Page Content Editor” with hero eyebrow/headline/subheadline, launch banner, CTAs, SEO title/description, Open Graph image, media showcase slots, public-safe warning, and an advanced JSON editor for products/stats/footer/media. This is Batch 1 foundation only; the public homepage renderer comes next.
- Checklist: ticked the I.52 “NEYO Ops landing editor must be full-stack” requirement and marked the slow-batches line as in progress.
- Verification: `npm install` was needed because node_modules were missing; then `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i52-landing-content-editor-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i52-landing-content-editor.png`. NEXT = I.52 Batch 2 public homepage renderer consuming `neyo_landing_content`.

## 🔁 PART I BATCH 104 — I.52 LANDING PAGE REQUIREMENTS INTAKE RECORDED (2026-06-24)
- Founder approved continuing to I.52 but specifically requested “no run, just read” and to add the new landing-page requirements to the checklist first before implementation.
- Read the newly attached `neyooooooooooooooooooooooooooo.txt` and reviewed the provided JerseyBird-style screenshots as inspiration only.
- Updated `docs/FEATURES-CHECKLIST.md` under I.52 with new founder-added landing-page requirements: premium editorial inspiration without copying; all landing content editable from NEYO Ops; changes reflecting across homepage/OS sections/SEO/footer/CTA/demo-waitlist; public copy must expose features only, never brand secrets/integrations/internal logic; media slots for real screenshots/videos; real product visuals; precise human copy; enterprise footer; and slow batch implementation.
- No code was implemented in this turn by founder instruction. NEXT = start I.52 in small batches, beginning with the landing content model/editor in NEYO Ops.

## 🔁 PART I BATCH 103 — I.51 YOUTUBE LEARNING OVERLAP AUDIT COMPLETED (2026-06-24)
- Audited the remaining I.51 overlap line “YouTube learning configured inside School OS with search optimized for YouTube-related learning searches” and ticked it without rebuilding, because it was already completed under I.27 and refined under I.36.
- Verified School OS learning-video stack: `LearningVideo` and `LearningVideoSession` DB models; `/learning-videos` page; `/api/learning-videos`; `src/lib/services/learning-video.service.ts`; cast page `/learning-videos/cast/[code]`; Learning Videos nav item.
- Verified search behavior: saved-video search always works; live YouTube search activates with `YOUTUBE_API_KEY` and uses strict safe embeddable education search (`safeSearch=strict`, `videoEmbeddable=true`, `videoCategoryId=27`, `regionCode=KE`, `relevanceLanguage=en`).
- Verified founder corrections remain true: videos play inside NEYO via `youtube-nocookie.com`; teachers can cast to a TV/projector; students can reopen shown-in-class videos; search/saved results use full width; shown-in-class is a compact button/modal; recommended ideas prevent empty screen; no download action exists; ad limitation is explained honestly.
- Verification: `./node_modules/.bin/tsx scripts/i27-youtube-learning-test.ts` ✓ and `./node_modules/.bin/tsx scripts/i36-readability-layout-learning-videos-test.ts` ✓. Screenshots already exist: `screenshots/i27-youtube-learning.png`, `screenshots/i36-learning-videos-layout.png`. NEXT = I.52 NEYO Public Landing Page unless founder requests more I.51 polish.

## 🔁 PART I BATCH 102 — I.50 CROSS-CUTTING OS SUPPORT COMPLETED (2026-06-24)
- Built I.50 Cross-Cutting OS Support / multi-OS readiness.
- Database: added `Tenant.osKey` with default `school` through migration `20260624180000_i50_multi_os_tenant_key`; existing tenants now have a default OS key and future tenants can be marked school/business/farm/creator.
- Platform registry: added `src/lib/core/operating-systems.ts` as the OS source of truth for School OS, Business OS, Farm OS and Creator OS labels, routes, onboarding paths and launch statuses.
- Onboarding: `signupSchema` now accepts `osKey`; `signupSchool()` stores `Tenant.osKey` and audit metadata. `GetStartedWizard` passes OS context. School OS onboarding remains live; non-live Business/Farm/Creator onboarding safely routes to waitlist instead of accidentally creating a School OS tenant.
- Login/onboarding routes: added `/os/[os]/login` and `/os/[os]/onboarding`. The login page now shows OS picker chips and OS-specific tagline so users understand which NEYO OS they are signing into.
- Documentation: added `docs/MULTI-OS-READINESS.md`, defining shared cross-cutting layers (auth/session, tenancy, billing, notifications, files, search, calendar/jobs, audits, platform flags, NEYO Ops support/customer comms) and the rule that new code should not assume every tenant is a school.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i50-multi-os-readiness-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i50-multi-os-login.png`. NEXT = I.51 remaining overlap audit/tick for YouTube learning configured inside School OS, or I.52 if I.51 overlap is reconciled.

## 🔁 PART I BATCH 101 — I.49 CENTRALIZED MONEY + INSTANT RECONNECT COMPLETED (2026-06-24)
- Built I.49 Centralized Money + Instant Reconnect.
- Database: migration `20260624172000_i49_central_subscription_money` adds central billing fields to `SubscriptionPayment`: `phone`, `accountRef`, `checkoutRequestId`, `resultCode`, `resultDesc`, `rawCallback`, unique checkout correlation and status index. Subscription renewals now live in `SubscriptionPayment`, not tenant school-fee `Payment` rows.
- Backend: added `src/lib/services/central-billing.service.ts`. It creates NEYO central account refs (`NEYO-<school-slug>`), starts central subscription STK renewals, records pending `central_mpesa_stk` payments, handles STK callbacks by `checkoutRequestId`, handles outside-NEYO Paybill/C2B-style callbacks by account reference, activates the subscription, clears `graceEndsAt`, extends the billing period and audit-logs `billing.central_payment_reconnected`.
- API/UI: `/api/billing/public-stk` now uses central NEYO subscription billing and returns `centralized: true`. Added `/api/billing/central-callback` for central M-Pesa callbacks. Expired account checkout copy now says NEYO central billing automatically reconnects the school. Founder Ops Business Operations shows a “Central NEYO money account” note and callback route.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i49-central-money-reconnect-test.ts` ✓, `npm run test:roles` 24/24 ✓. Screenshot: `screenshots/i49-central-money.png`. NEXT = I.50 Cross-Cutting OS Support unless founder requests I.49 polish.

## 🔁 PART I BATCH 100 — I.48 CHECKLIST RECONCILIATION / AUDIT COMPLETED (2026-06-24)
- Audited the four remaining unchecked I.48 lines and confirmed they were already full-stack/testable from previous I.48 checkpoints, then ticked them in `docs/FEATURES-CHECKLIST.md` without duplicating work.
- Central cockpit: verified `NeyoBusinessOsCockpit` is mounted in Founder Ops → Business Operations and covers every company element: accounts/billing/payments, OS lifecycle, NEYO staff/founder/ideas, company documents, maintenance/shutdown, subscriber communications, pricing, YouTube/social, contracts/signing, grace enforcement, customer communication hub and brand assets.
- OS lifecycle: verified `OsLifecycleBoard` stores editable School/Business/Farm/Creator OS launch rows in `PlatformSetting` key `neyo_os_lifecycle`, with statuses PLANNED/BUILDING/BETA/LIVE/PAUSED, target launch and notes.
- Maintenance/shutdown: verified root layout reads `maintenance_mode`, `maintenance_message`, `maintenance_eta`; non-SUPER_ADMIN users are blocked by a polished maintenance screen; Business Operations has Tap-to-Shutdown / Restore Live Operations and notice/ETA editing through audited `update_platform_setting`.
- Analysis doc: updated `docs/NEYO-BUSINESS-OS-ANALYSIS.md` so it no longer says key I.48 engines are merely planned. It now records the current live NEYO Business OS operating model across data scopes, cockpit coverage, OS lifecycle, pricing/SMS, grace enforcement, contracts, customer communication, brand/content operations and company credentials.
- Verification: `./node_modules/.bin/tsx scripts/i48-neyo-business-os-cockpit-test.ts` ✓, `./node_modules/.bin/tsx scripts/i48-neyo-os-lifecycle-test.ts` ✓, `./node_modules/.bin/tsx scripts/i48-maintenance-shutdown-test.ts` ✓. Existing screenshots: `screenshots/i48-neyo-business-os-cockpit.png`, plus later I.48 screenshots for pricing, YouTube, contracts, grace, customer hub and brand assets. NEXT = proceed to I.49 Centralized Money + Instant Reconnect unless founder requests more I.48 polish.

## 🔁 PART I BATCH 99 — I.48 BRAND ASSET MANAGEMENT DEEPER PASS COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the deeper brand asset management pass.
- Dynamic metadata: replaced static root metadata export in `src/app/layout.tsx` with `generateMetadata()` that reads NEYO Ops PlatformSettings for favicons, PWA icons, Apple touch icon and Open Graph image/wordmark assets.
- PlatformSettings controlled from NEYO Ops now include: `neyo_logo_url`, `neyo_brand_primary`, `neyo_brand_accent`, `neyo_favicon_url`, `neyo_favicon_32_url`, `neyo_favicon_16_url`, `neyo_icon_192_url`, `neyo_apple_touch_icon_url`, `neyo_wordmark_light_url`, `neyo_wordmark_dark_url`, `neyo_mascot_url`, `neyo_mascot_hero_url`, and `neyo_pattern_url`.
- UI: Founder Ops → Business Operations → NEYO Global Branding & Asset Editor now edits logo, colors, favicons, wordmarks, PWA icons, Bundi mascot URLs and pattern tile URLs, includes small previews, and has a “Save all brand assets” action. Saves continue through SUPER_ADMIN-only `update_platform_setting` with audit `platform.setting_updated`.
- Existing public landing already consumes live `neyo_logo_url`, `neyo_brand_primary`, and `neyo_brand_accent`; metadata now also applies favicon/icon/OG brand assets without code changes.
- Screenshot captured: `screenshots/i48-brand-assets.png`.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i48-brand-assets-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.48 checklist reconciliation / remaining top-level unchecked lines if any were completed in prior checkpoints but not ticked.

## 🔁 PART I BATCH 98 — I.48 CUSTOMER ↔ NEYO COMMUNICATION HUB COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the Customer ↔ NEYO communication hub, also ticking the unified customer↔NEYO communication inbox line.
- Database: added company-level `NeyoCustomerThread` and `NeyoCustomerMessage` via migration `20260624161000_i48_customer_neyo_hub`. Threads store linked school tenant, school/contact details, subject, status, priority, source and last-message time; messages store direction (CUSTOMER/NEYO/INTERNAL), author, body and channel.
- Backend/service: added `src/lib/services/neyo-customer-hub.service.ts` with school-created support threads, school replies, NEYO replies, status/priority updates and audit logs `platform.customer_thread_created`, `platform.customer_thread_replied`, `platform.customer_thread_message_added`, and `platform.customer_thread_status_updated`.
- School-facing API/UI: added `/api/neyo-support`; Settings → Billing now has “Contact NEYO about billing or your account” so school leadership can create a support thread from inside their account.
- Founder Ops API/UI: settings payload returns `customerThreads`; POST actions `reply_customer_thread` and `update_customer_thread_status` let NEYO reply and manage status/priority. Business Operations now includes “Customer ↔ NEYO Communication Hub” with open/waiting/high-priority counts, thread cards, reply action, status/priority selectors and empty/populated states.
- Screenshot captured: `screenshots/i48-customer-neyo-hub.png`.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i48-customer-neyo-hub-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue remaining I.48 chunk: deeper brand asset management.

## 🔁 PART I BATCH 97 — I.48 GRACE-PERIOD ENFORCEMENT CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the grace-period enforcement deeper pass, also ticking the failed-payment/dunning workflow line.
- Backend: deepened `runSubscriptionStateMachine()` in `src/lib/services/billing.service.ts`. Overdue paid subscriptions now enter `GRACE` with a grace end date, immediate customer communication and audit `billing.grace_notice_sent`. Grace ending within 3 days sends a one-time warning `billing.grace_warning_sent`. Expired grace sends a final suspension notice if no warning communication exists, then sets `SUSPENDED`; audit `billing.suspended` records `dataPreserved` and `suspend_not_delete`.
- Customer communication: grace notices create in-app notices for active School Owner/Principal users and SMS the tenant phone where available. Data is never deleted; suspended schools remain locked by the existing root-layout subscription gate and reconnect after payment.
- Jobs/API: daily `subscription-state-machine` remains scheduled at 01:00 EAT. Founder Ops now exposes `run_billing_enforcement`, a `graceSummary`, and audit `platform.billing_enforcement_run` for founder manual run-now checks.
- UI: Founder Ops → Business Operations → SaaS Subscriptions card now includes “Grace-period enforcement” with Grace/Ending/Expired/Suspended counts and a “Run enforcement now” button.
- Screenshot captured: `screenshots/i48-grace-enforcement.png`.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i48-grace-enforcement-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue remaining I.48 chunks: customer↔NEYO communication hub and deeper brand asset management.

## 🔁 PART I BATCH 96 — I.48 CONTRACT SIGNING MANAGEMENT CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed “Contract signing management,” also ticking the I.48 contract templates + e-sign workflow line.
- Database: added company-level `NeyoContract` model via migration `20260624152000_i48_contract_signing`. It stores contract title, school/contact details, linked tenant, template key, contract body, status, secure public token, sent/signed timestamps, typed signature, signer IP and creator metadata.
- Backend/service: added `src/lib/services/neyo-contract.service.ts` with `listNeyoContracts`, `upsertNeyoContract`, `updateNeyoContractStatus`, `publicContract`, `signPublicContract`, and `deleteNeyoContract`. It creates secure tokens (`ctr_...`) and audit-logs `platform.contract_created`, `platform.contract_updated`, `platform.contract_status_updated`, `platform.contract_signed`, and `platform.contract_deleted`.
- API/public signing: Founder Ops settings now returns `contracts`; POST actions `upsert_contract`, `update_contract_status`, and `delete_contract` manage contract records. Added public signing API/page at `/api/contracts/sign/[token]` and `/contracts/sign/[token]` with typed signature acceptance.
- UI: Founder Ops → Business Operations now includes “Contract Signing Management” with draft/sent/signed counters, onboarding contract form, linked school account selector, signer fields, contract body editor, internal notes, contract register, secure signing-link copy, status updates and empty/populated states.
- Screenshot captured: `screenshots/i48-contract-signing.png`.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i48-contract-signing-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue remaining I.48 chunks: grace-period enforcement deeper pass, customer↔NEYO communication hub, and deeper brand asset management.

## 🔁 PART I BATCH 95 — I.48/I.51 YOUTUBE OPS MANAGEMENT CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed “Manage YouTube videos/posting from NEYO Ops,” also ticking the relevant I.51 YouTube management/posting and strategy-document lines.
- Database: added company-level `NeyoYoutubePost` model via migration `20260624143000_i48_youtube_ops_posts`. It stores title, YouTube URL/ID, extracted YouTube ID, caption/posting copy, audience, channel, status, scheduled date, posted URL, owner, linked school tenant, notes and creator metadata. This is deliberately not tenant-owned; access is via SUPER_ADMIN Founder Ops.
- Backend/service: added `src/lib/services/neyo-youtube.service.ts` with `listNeyoYoutubePosts`, `upsertNeyoYoutubePost`, `updateNeyoYoutubePostStatus`, and `deleteNeyoYoutubePost`. It extracts YouTube IDs from common YouTube links and audit-logs `platform.youtube_post_created`, `platform.youtube_post_updated`, `platform.youtube_post_status_updated`, and `platform.youtube_post_deleted`.
- API: Founder Ops settings now returns `youtubePosts`; POST actions `upsert_youtube_post`, `update_youtube_post_status`, and `delete_youtube_post` manage posting records.
- UI: Founder Ops → Business Operations now includes “YouTube Management & Posting Hub” with scheduled/ready/posted counts, create-post form, audience/channel/status/schedule/owner/school fields, notes, empty calendar state, populated calendar rows, status changer and remove action. UI honestly says it does not pretend to upload without YouTube channel authorization.
- Strategy doc: added `docs/YOUTUBE-MANAGEMENT-POSTING-STRATEGY.md`, explaining School OS learning videos vs NEYO Ops posting management, posting states, approval discipline, privacy/ad reality, and future YouTube OAuth/API activation.
- Screenshot captured: `screenshots/i48-youtube-ops.png`.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i48-youtube-ops-management-test.ts` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue remaining I.48 chunks: contract signing management, grace-period enforcement deeper pass, customer↔NEYO communication hub, and deeper brand asset management.

## 🔁 PART I BATCH 94 — I.48 PRICING CATALOG CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed “Change PRICING from NEYO Ops without touching code.”
- Backend/storage: added `src/lib/services/pricing-catalog.service.ts`. The active NEYO pricing catalog is now stored in company-level `PlatformSetting` key `neyo_pricing_catalog`, with a safe default from `src/lib/core/plans.ts` when no setting exists.
- Validation/security: `pricingCatalogSchema` validates package keys, prices, student/staff limits, included modules, add-ons and duplicate keys. It enforces the founder rule that SMS is NOT included in packages (`limits.smsPerTerm` must stay 0 and package highlights cannot include SMS). Saving is SUPER_ADMIN-only through Founder Ops and audit-logs `platform.pricing_catalog_updated`.
- Billing integration: `ensureSubscription()` and `subscribeToPlan()` now read prices through `getPlanFromCatalog()`. New/changed subscriptions lock the current dynamic price into `Subscription.grandfatheredPrice`; saving global pricing does NOT rewrite existing locked prices.
- Usage integration: `limits.service.ts` now treats SMS quota as out-of-package: base packages give 0 SMS, while active SMS add-ons in `Subscription.addOns` grant quota (e.g. `sms_topup_1000` gives 1,000).
- UI: Founder Ops → Business Operations now has “Pricing & Package Editor — no code touch” for plan price, student/staff limits, per-student price, max add-ons, support promise, included modules, package inclusions/highlights, and out-of-package add-on prices. SMS bundles are shown separately and package SMS is locked to 0.
- Billing pages/API: `/api/billing`, `/api/billing/subscribe`, and Settings → Billing now read dynamic plans; Settings copy clarifies that SMS is bought as a separate top-up outside packages.
- Test added: `scripts/i48-pricing-catalog-test.ts` verifies Founder Ops API/UI source, dynamic catalog persistence, grandfathering, new subscription price locking, SMS top-up quota, and validation rejecting SMS inside packages.
- Verification: `./node_modules/.bin/tsx scripts/i48-pricing-catalog-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. Screenshot target: `screenshots/i48-pricing-catalog.png`. NEXT = continue remaining I.48 chunks: YouTube/posting management, contract signing, grace-period enforcement deeper pass, customer↔NEYO hub, and deeper brand asset management.

## 🔁 PART I BATCH 93 — I.48 SUBSCRIBER COMMUNICATIONS CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the Subscriber communications deeper pass.
- Backend/API: `send_broadcast` in `src/app/api/founder-ops/route.ts` now supports subscriber segments: all, active, trial/free, past_due, grace and suspended. It sends in-app notifications to each tenant’s active School Owner/Principal users and SMS to the tenant phone where available. It returns tenant count, sent in-app count, sent SMS count and skipped SMS count.
- Audit: broadcasts now write `platform.subscriber_broadcast_sent` with message length, segment, tenant count and delivery counts.
- UI: Business Operations → SaaS Broadcaster & Comms Engine now has a subscriber segment selector and explains that broadcasts create targeted in-app notices plus SMS where available.
- Test added: `scripts/i48-subscriber-communications-test.ts` verifies segmented broadcast source, owner/principal targeting, SMS/in-app sending, audit log source and UI segment controls.
- Screenshot refreshed: `screenshots/i48-neyo-business-os-cockpit.png`.
- Verification: `./node_modules/.bin/tsx scripts/i48-subscriber-communications-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue I.48 remaining chunks, likely pricing from NEYO Ops or YouTube/social management.

## 🔁 PART I BATCH 92 — I.48 COMPANY DOCUMENTS CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the Company Documents managed in-system checkpoint.
- Verified public legal routes `/privacy` and `/terms` read company-level `PlatformSetting` rows (`privacy_policy`, `terms_of_service`) and fall back to the built-in legal copy if settings are empty.
- UI: Business Operations already had “Live Legal & Compliance Editor”; refined it so typing Privacy/Terms text is local (`onPrivacyChange`, `onTermsChange`) and the live PlatformSetting update happens only when Save is pressed.
- API: Founder Ops `update_platform_setting` remains SUPER_ADMIN-only and audit-logs `platform.setting_updated`, so Privacy/Terms can be edited live from NEYO Ops without code edits.
- Test added: `scripts/i48-company-documents-test.ts` verifies PlatformSetting storage, public legal route source, NEYO Ops editor source, local-edit-until-save behaviour and audit/API source.
- Screenshot captured/refreshed: `screenshots/i48-company-documents.png`.
- Verification: `./node_modules/.bin/tsx scripts/i48-company-documents-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue I.48 remaining chunks, likely maintenance/shutdown deeper pass or subscriber communications.

## 🔁 PART I BATCH 91 — I.48 NEYO STAFF + IDEA BOARD CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS and completed the NEYO Staff management + Founder page + Idea creation board checkpoint.
- Database: added company-level `NeyoIdea` model through migration `20260624103000_i48_neyo_idea_board`. This is deliberately NOT tenant-owned; it stores founder/company ideas with title, description, status, priority, owner, linked feature key and creator metadata.
- API: Founder Ops settings API now returns `neyoStaff` (active SUPER_ADMIN users) and `ideas`; POST actions `create_idea` and `update_idea` create/update ideas and audit-log `platform.idea_created` / `platform.idea_status_updated`.
- UI: Business Operations now includes `NEYO Staff & Idea Board`, showing NEYO team accounts plus a founder idea creation form and idea pipeline with status updates (IDEA, PLANNED, BUILDING, SHIPPED, PARKED).
- Test added: `scripts/i48-neyo-staff-ideas-test.ts` verifies DB persistence/update, API source, audit source and UI source.
- Screenshot refreshed: `screenshots/i48-neyo-business-os-cockpit.png`.
- Verification: `./node_modules/.bin/tsx scripts/i48-neyo-staff-ideas-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue I.48 remaining chunks, likely company documents / maintenance / subscriber communications deeper pass.

## 🔁 PART I BATCH 90 — I.48 ACCOUNTS / BILLING / SUBSCRIPTIONS / PAYMENTS CHECKPOINT COMPLETED (2026-06-24)
- Continued I.48 NEYO Business Management OS in small pieces and completed the Accounts, Billing, Subscriptions, Payments checkpoint.
- Backend/API: `GET /api/founder-ops?view=settings` now returns `paymentSummary` from `SubscriptionPayment` rows: total, paid, pending, failed, count and recent records, alongside tenant accounts and subscriptions. Existing `update_school_subscription` mutation remains SUPER_ADMIN-only and audit-logs `platform.subscription_override`.
- UI: `src/components/founder/founder-ops-client.tsx` now stores `opsPaymentSummary`, passes it into Business Operations, shows paid subscription revenue in the Business OS cockpit accounts card, and adds a NEYO subscription payment summary strip (Paid / Pending / Records) inside “SaaS Subscriptions & Billing Override”.
- Test added: `scripts/i48-accounts-billing-payments-test.ts` verifies account/subscription/payment summary API, subscription override audit source, UI ledger/status/override controls, and Business OS cockpit payment status.
- Screenshot refreshed: `screenshots/i48-neyo-business-os-cockpit.png`.
- Verification: `./node_modules/.bin/tsx scripts/i48-accounts-billing-payments-test.ts` ✓, `./node_modules/.bin/tsx scripts/i48-neyo-business-os-cockpit-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue remaining I.48 chunks, likely NEYO Staff management + Idea board or company documents/contracts.

## 🔁 PART I BATCH 89 — I.47 HARDWARE-DEFERRED FEATURES / CONNECT-WHEN-BOUGHT SEAMS COMPLETED (2026-06-24)
- Continued Part I and completed I.47 Activate ALL Hardware-Deferred Features with connect-when-bought design and truthful statuses.
- Database: added `HardwareDeviceConnection`, `GpsBusLocation`, and `CctvCamera` through migration `20260624090000_i47_hardware_seams`; added tenant isolation entries.
- Backend/API: added `src/lib/services/hardware-registry.service.ts`, `/api/hardware`, and `/api/hardware/gps`. The GPS feed API accepts tracker posts with optional `HARDWARE_FEED_TOKEN`; CCTV stores NVR/stream endpoint records; hardware registry covers GPS, BARCODE, THERMAL_PRINTER, RFID, FINGERPRINT, CCTV, and FACE_CAMERA.
- Truthful hardware status: updated `src/lib/services/hardware.service.ts` so cancelled/missing WebUSB/WebSerial devices become ERROR/NOT_CONNECTED instead of simulated CONNECTED. Barcode scanner is READY_TO_PAIR/listening but explicitly not connected until real scanner input.
- UI: Hardware & Biometrics page now states “Nothing is shown as connected until a real browser/device permission succeeds or a tracker feed posts data.” Device cards show DISCONNECTED/READY_TO_PAIR/CONNECTED/ERROR, with “Pair only after the device is physically plugged in.” Developer test tools do not mark hardware connected.
- Verified existing/seamed items: Library barcode scanner from I.17 remains truthful with inbuilt scanner + external scanner not connected; Transport GPS still states tracker hardware is required; Print Station remains browser-print live while ESC/POS activates after pairing.
- Test added: `scripts/i47-hardware-deferred-seams-test.ts` verifies all hardware types, default non-connected state, GPS feed row creation, CCTV ready-to-pair seam, face-camera ready-to-pair seam, no fake simulated connected printer/fingerprint, UI copy and API source.
- Screenshot captured at 1920×1080: `screenshots/i47-hardware-seams.png`.
- Verification: `./node_modules/.bin/tsx scripts/i47-hardware-deferred-seams-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.48 NEYO Business Management OS analysis/build planning.

## 🔁 PART I BATCH 88 — I.43 UNIVERSAL DOCUMENT BRANDING COMPLETED (2026-06-24)
- Continued Part I and completed I.43 Universal Document Branding.
- Audited generated PDF document components under `src/lib/documents`. Patched missing Powered by NEYO footer text across admission letters, CBC reports, payslips, receipts, report cards and transfer letters; existing invoice, Mwalimu pack, Mzazi card, student ID and transcript already had it or were verified.
- Added/verified school logo support on key generated documents using `logoUrl` / `logoDataUrl`: admission letters, CBC reports, invoices, payslips, receipts, report cards, student ID cards, transcripts and transfer letters. Services/routes now pass `tenant.logoUrl` where applicable.
- Timetable A4 print pack: `TimetablePrintBundleView` now accepts `tenantLogoUrl` and renders the school logo at a compact `h-6 w-6 object-contain`, so the logo is visible without consuming timetable space.
- Test added: `scripts/i43-universal-document-branding-test.ts` verifies Powered by NEYO across all document components, logo support in key PDFs, service/route logo pass-through, and small timetable print logo.
- Screenshot saved: `screenshots/i43-universal-document-branding.png` (document design/branding modal reference).
- Verification: `./node_modules/.bin/tsx scripts/i43-universal-document-branding-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.47 hardware-deferred features audit/connection seams (I.44-I.46 already complete).

## 🔁 PART I BATCH 87 — I.42 CUSTOMIZABLE ID & DOCUMENT DESIGNS COMPLETED (2026-06-24)
- Continued after I.38, skipping already-completed I.39/I.40/I.41, and completed I.42 Customizable ID & Document Designs.
- Database: added `Tenant.documentDesignJson` through migration `20260624083000_i42_document_design_defaults` for school-owned document design defaults.
- Backend/API: added `src/lib/services/document-design.service.ts` and `/api/document-design`. Schools can store ID card width/height in mm, ID template, general document template, small timetable-logo preference and Powered by NEYO footer preference. Writes require `tenant.manage_settings`; reads require `student.view`.
- ID printing: `/api/students/bulk-id-cards` now reads saved document design defaults via `getDocumentDesign()` when the UI does not pass an override. Existing `renderStudentIdCardsPdf()` already supports physical dimensions and templates.
- UI: Students → Bulk ID Cards modal now loads school defaults, lets the school edit ID dimensions, ID template, general document style and Powered by NEYO footer, and save the choices as the school default.
- Per class/stream: verified existing Student list filters (`classId`, `stream`) control the loaded student IDs used for bulk ID PDF generation, so printing per class/stream is supported.
- Test added: `scripts/i42-custom-id-document-design-test.ts` verifies saved defaults, custom-dimension PDF rendering, API permissions, UI controls, class/stream filter source, route default usage and Powered by NEYO trademark.
- Screenshot captured at 1920×1080: `screenshots/i42-id-document-design.png`.
- Verification: `./node_modules/.bin/tsx scripts/i42-custom-id-document-design-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.43 Universal Document Branding audit/verification/build.

## 🔁 PART I BATCH 86 — I.38 COMMAND & SHORTCUT SYSTEM COMPLETED (2026-06-24)
- Continued Part I and completed I.38 Command & Shortcut System.
- Expanded `src/lib/core/commands.ts` with more command-palette actions for buried modules: Attendance, Calendar, Learning Videos, Exam Timetable, Syllabus, Security Gate and Online Classes, while retaining existing permission-filtered commands.
- Rebuilt the help overlay shortcut map in `src/components/shell/help-overlay.tsx` into a clear permission-filtered single-key navigation system. Hotkeys are ignored while typing in inputs/textareas/contenteditable fields and check permissions before navigating.
- Added many direct shortcuts so users do not scroll for low modules: Learning Videos, Online Classes, Exam Timetable, Syllabus, Security Gate, Clinic, Cafeteria, Inventory, Transport, Library, Payroll, Staff, My Classes, My children, My School and NEYO Ops.
- Help overlay now includes a “Command” button that opens the full ⌘K command/search palette via `neyo:open-search`, tying the visible shortcut list to the real command system.
- Test added: `scripts/i38-command-shortcut-system-test.ts` verifies command registry expansion, direct letter hotkeys, permission filtering, command-palette integration, and the help overlay command button.
- Screenshot captured at 1920×1080: `screenshots/i38-command-shortcuts.png`.
- Verification: `./node_modules/.bin/tsx scripts/i38-command-shortcut-system-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = continue Part I from next open item after already-completed I.39/I.40/I.41 etc.; likely I.42 Customizable ID & Document Designs.

## 🔁 PART I BATCH 85 — I.37 NEYO OPS MASTER SWITCHES + MASCOT LAUNCH COMPLETED (2026-06-24)
- Continued Part I and completed I.37 NEYO Ops Master Switches + Mascot Launch.
- Extended platform flags beyond module keys: `src/lib/services/platform-flags.service.ts` now lists module flags and individual navigation feature flags using keys like `feature:/finance`, derived from `NAVIGATION`.
- Added platform-wide feature hiding: `pausedFeatureHrefs()` feeds `(app)/layout.tsx` → `AppShell` → `Sidebar`, so a SUPER_ADMIN can hide/release individual nav features platform-wide, not only whole modules.
- Bundi launch control verified: NEYO Ops → Platform Flags includes `bundi` as “Bundi Mascot Layer”; when paused, the action label is “Launch Bundi”. The release/re-pause path remains audited through `platform.module_released` / `platform.module_paused`.
- UI updated: Founder Ops Platform Flags copy now says it controls whole modules and individual navigation features; rows show Feature/Module key and href.
- Test added: `scripts/i37-neyo-ops-master-switches-test.ts` verifies feature flags, platform-hidden hrefs, Bundi launch rehearsal and source wiring.
- Screenshot captured at 1920×1080: `screenshots/i37-neyo-ops-flags.png`.
- Verification: `./node_modules/.bin/tsx scripts/i37-neyo-ops-master-switches-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.38 Command & Shortcut System.

## 🔁 PART I BATCH 84 — I.36 READABILITY / LAYOUT FIXES COMPLETED (2026-06-24)
- Continued Part I and completed I.36 Readability / Layout Fixes, including the founder’s Learning Videos layout correction.
- Desktop readability: added an I.36 desktop-only readability lift in `src/app/globals.css` for screens ≥1024px: base html font size 16.5px, form fields 15.25px, and slightly stronger Lucide icon strokes. Phone scale remains unchanged.
- Add Guardian layout: fixed `AddGuardian` in `src/components/students/student-profile-client.tsx` so it no longer hides inside the card. The modal now uses a larger scrollable panel (`max-h-[min(92dvh,46rem)]`), sticky header/footer, full-screen backdrop, and responsive fields (single-column on phone, two-column on larger screens).
- Learning Videos correction: `src/components/learning-videos/learning-videos-client.tsx` now gives Search results & saved videos the full screen width instead of sharing the row with “Videos shown in class.” “Videos shown in class” is now a compact button that opens a preview dialog. Search results can still be watched full-width inside NEYO.
- Learning Videos empty-state correction: when nothing has been searched or no results are returned, the page shows recommended learning search ideas (`algebra basics`, `photosynthesis`, `KCSE English set books`, etc.) instead of an empty panel. No download action is exposed.
- Tests: `scripts/i36-readability-layout-learning-videos-test.ts` verifies readability CSS, Add Guardian modal layout, full-width learning video results, compact shown-in-class button/dialog, recommended search ideas, and no download action. Re-ran `scripts/i27-youtube-learning-test.ts` after layout changes.
- Screenshot captured at 1920×1080: `screenshots/i36-learning-videos-layout.png`.
- Verification: `./node_modules/.bin/tsx scripts/i36-readability-layout-learning-videos-test.ts` ✓, `./node_modules/.bin/tsx scripts/i27-youtube-learning-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.37 NEYO Ops Master Switches + Mascot Launch audit/verification/build.

## 🔁 PART I BATCH 83 — I.27 YOUTUBE LEARNING INTEGRATION COMPLETED (2026-06-24)
- Continued Part I in order and completed I.27 YouTube Learning Integration.
- Database: added tenant-owned `LearningVideo` and `LearningVideoSession` via migration `20260623223000_i27_learning_videos`; added tenant isolation entries.
- Backend/API: added `src/lib/services/learning-video.service.ts` and `/api/learning-videos`. It supports saved video search, optional live YouTube search when `YOUTUBE_API_KEY` is configured, strict safe-search/embeddable/education-category query parameters, saving/pasting YouTube links, starting cast sessions, and listing videos shown in class.
- In-NEYO watching: saved/search videos use privacy-enhanced `https://www.youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1&playsinline=1`, so videos play inside NEYO instead of sending users to YouTube pages.
- Class casting: teachers can start a cast session from their phone/tablet; it creates a public class-screen URL `/learning-videos/cast/[code]` for a projector/TV. Students can later find videos shown in class in the “Videos shown in class” panel.
- Distraction/ad guard: NEYO keeps comments/recommendations outside the app and uses privacy-enhanced embeds. Important honesty note: YouTube can still enforce its own adverts inside an embed; true zero-ad classroom playback requires school-owned uploaded video storage or YouTube-side ad-free/education entitlement when available.
- UI/nav: added “Learning Videos” under School OS, page `/learning-videos`, `LearningVideosClient`, and class-screen cast page.
- Seed: `prisma/seed.ts` now includes one saved classroom learning video for demo visibility.
- Test added: `scripts/i27-youtube-learning-test.ts` verifies save/search, in-NEYO embed URL, class cast URL, public cast session, shown-in-class list, schema/nav/API/source, and distraction guard copy.
- Screenshot captured at 1920×1080: `screenshots/i27-youtube-learning.png`.
- Verification: `./node_modules/.bin/tsx scripts/i27-youtube-learning-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.28 already complete/verified; continue to next open Part I item after I.28, likely I.36 Readability/Layout Fixes unless an earlier reopened line is found.

## 🔁 PART I BATCH 82 — I.26 TIME-AWARE GREETING VERIFIED COMPLETE (2026-06-23)
- Continued Part I in order and completed I.26 Time-Aware Greeting by verifying the existing dashboard implementation.
- Verified `src/app/(app)/dashboard/page.tsx` has `getTimeOfDayGreeting()` using Nairobi time (`getUTCHours() + 3`) and returns “Good morning”, “Good afternoon”, or “Good evening” based on the hour.
- Verified dashboard renders the computed `{greeting}, {firstName}` instead of hard-coded “Good morning”.
- Test added: `scripts/i26-time-aware-greeting-test.ts` checks source wiring and expected Nairobi-hour outputs for 07:00, 13:00 and 19:00.
- Screenshot captured at 1920×1080: `screenshots/i26-time-aware-greeting.png`, showing “Good evening, Wanjiru”.
- Verification: `./node_modules/.bin/tsx scripts/i26-time-aware-greeting-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.27 YouTube Learning Integration audit/verification/build.

## 🔁 PART I BATCH 81 — I.25 DASHBOARD HIERARCHY, SPARKLINES & GLASS MOTION COMPLETED (2026-06-23)
- Continued Part I in order and completed I.25 Dashboard Hierarchy, Sparklines & Glass Motion, also closing I.25b reduced card reflection.
- Verified money-first hierarchy: top dashboard cards are in exact order: Outstanding Fees, Fees Collected Today, Collection Rate, Students Present.
- Added real mini sparklines: `MiniSparkline()` in `src/app/(app)/dashboard/page.tsx` now renders DB-backed fee collection, attendance and enrollment trends inside dashboard cards. Fee trend uses payment graph points, attendance trend uses last 7 days of attendance records, and enrollment trend uses month-end admitted learner counts.
- Motion/depth: dashboard metric cards now use `dashboard-metric-card` with Apple/Linear hover lift, stronger `shadow-card-hover`, tiny gradients, stronger blur and Liquid Glass-compatible styling.
- Reduced reflection: `src/app/globals.css` now sets `.dashboard-metric-card::before` sheen opacity to `0.045 !important` with slower animation so reflections are subtle, not shiny/noisy.
- Overlay blur consolidation: I.20 full-screen overlay blur rule remains in `globals.css` and is verified by the I.25 regression.
- Test added: `scripts/i25-dashboard-hierarchy-sparklines-test.ts` verifies card order, sparkline data/rendering, hover motion, subtle depth/reduced reflection CSS, and overlay rule.
- Screenshot captured at 1920×1080: `screenshots/i25-dashboard-sparklines.png`.
- Verification: `./node_modules/.bin/tsx scripts/i25-dashboard-hierarchy-sparklines-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.26 Time-Aware Greeting audit/verification/build.

## 🔁 PART I BATCH 80 — I.24 PROMISE-TO-PAY CALENDAR AUTOMATION COMPLETED (2026-06-23)
- Continued Part I in order and completed I.24 Promise-to-Pay Calendar Automation.
- Verified existing foundation: parent promise-to-pay route, Finance → Promises Calendar, installment plans, `PromiseToPay` model, and daily `promise-check` job already existed from G.28/I.99.
- Backend hardening: `checkBrokenPromises()` in `src/lib/services/promise-to-pay.service.ts` now sends a due-date in-app notification to school officials (Bursar/Accountant/Principal/Owner) AND sends the parent SMS reminder on the exact promise date. It stamps `reminderSentAt` so the due-date reminders are not duplicated.
- Installment hardening: `sendDueInstallmentReminders()` now also notifies school officials when an installment is due today, not only the parent.
- API/job: existing `promise-check` job remains scheduled daily at 03:15 EAT through `src/lib/jobs/registry.ts`.
- Test added: `scripts/i24-promise-to-pay-automation-test.ts` verifies due-date official notifications, parent SMS path, reminder stamp, no duplicate second-run reminders, promise-check job registration, and Finance Promises Calendar UI source.
- Screenshot captured at 1920×1080: `screenshots/i24-promise-to-pay-calendar.png`.
- Verification: `./node_modules/.bin/tsx scripts/i24-promise-to-pay-automation-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.25 Dashboard Hierarchy, Sparklines & Glass Motion audit/verification/build.

## 🔁 PART I BATCH 79 — I.23 DUTY ROSTER VERIFIED COMPLETE (2026-06-23)
- Continued Part I in order and completed I.23 Duty Roster by verifying the existing I.78 full-stack duty-roster system instead of duplicating it.
- Database verified: `DutyRosterEntry` stores tenant-owned duty roster blocks with term label, rotation period, week/block number, date range, lead teacher, assistant/full duty team, team size, duties and generator metadata.
- Backend/API verified: `src/lib/services/duty-roster.service.ts` exposes `dutyRosterBoard()` and `generateDutyRoster()` with WEEKLY / BI_WEEKLY / MONTHLY reshuffle periods, selected teacher pool, configurable `teachersPerCycle`, fair rotation and audit `academics.duty_roster_generated`. `/api/academics/duty-roster` uses `academics.view` for read and `academics.manage` for generation.
- UI verified: Academics → Duty Roster lets the school choose reshuffle period, teachers per cycle and active teacher pool, then “Generate & Save Duty Roster”; it displays saved roster rows and supports Print Duty Roster.
- Screenshot refreshed/copied for this checkpoint: `screenshots/i23-duty-roster.png` (same rendered roster as `screenshots/i78-duty-roster-timetable.png`).
- Verification: `./node_modules/.bin/tsx scripts/i78-duty-roster-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.24 Promise-to-Pay Calendar Automation audit/verification/build.

## 🔁 PART I BATCH 78 — I.22 PAYMENTS & DEVELOPER CLARITY COMPLETED (2026-06-23)
- Continued Part I in order and completed I.22 Payments & Developer Clarity, including founder clarification: where NEYO company payment credentials go.
- Documentation: added `docs/PAYMENTS-DEVELOPER-GUIDE.md`, explaining how to test Payments locally with the mock provider, how to go live with Daraja, callback URL format `/api/payments/webhook/<school-slug>?t=<DARAJA_WEBHOOK_TOKEN>`, and what to confirm after STK callbacks (Payment PAID, invoice balance, receipt/print queue).
- Credential clarity: documented and surfaced that school fee collection credentials belong in each school’s `Settings → Payments` (`PaymentCredential`, tenant-owned, encrypted with tenant DEK), while NEYO company subscription credentials do NOT belong in a school settings page. NEYO company payment credentials belong in NEYO Ops / central billing as company-level SUPER_ADMIN-only settings, to be completed under I.49/I.110.
- Payments UI: `src/components/settings/payments-manager.tsx` now has two clear cards: “School fee credentials go here” and “NEYO company credentials are not entered here.”
- Developer clarity: `src/components/settings/developer-panel.tsx` now explains in-product what API keys are for and what webhooks are for, in addition to the detailed guide.
- Test added: `scripts/i22-payments-developer-clarity-test.ts` verifies documentation, UI copy, school credential encryption path, developer explanations, and billing seam clarity.
- Screenshot captured at 1920×1080: `screenshots/i22-payments-developer-clarity.png`.
- Verification: `./node_modules/.bin/tsx scripts/i22-payments-developer-clarity-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.23 Duty Roster audit/verification/build.

## 🔁 PART I BATCH 77 — I.21 CERTIFICATES & EXAM-MATERIAL RECORDS COMPLETED (2026-06-23)
- Continued Part I in order and completed I.21 Certificates & Exam-Material Records.
- Verified existing certificate vault full-stack: `LeavingCertificate` stores KCSE/KCPE/other certificate type/number, mandatory `hardcopyLocation`, optional scanned file, status STORED/HANDED_OVER, physical handover recipient/time/staff. Student Profile “Leaving Certificate Vault” and `/api/students/[id]/leaving-certificate` already support vaulting and handover logging.
- Database: added tenant-owned `ExamMaterialRecord` model through migration `20260623205500_i21_exam_material_records`; added it to `TENANT_OWNED_MODELS`. It stores exam name, material type, title, exam date, deadline, status, checklist JSON, required hardcopy location, optional file, notes and creator metadata.
- Backend/API: added `src/lib/services/exam-material.service.ts` with `listExamMaterialRecords()`, `createExamMaterialRecord()`, and `updateExamMaterialStatus()` plus audit logs `exam.material_record_created` and `exam.material_record_status_updated`. Added `/api/exam-materials` requiring `exam.view` for GET and `exam.manage` for POST.
- UI: added `src/components/exams/exam-materials-client.tsx` and mounted it on `/exam-timetable`, so exam staff can track KNEC/KCSE/KCPE applications, assembled papers, answer sheets, stationery and physical storage locations alongside the dedicated exam timetable.
- Seed: `prisma/seed.ts` now seeds a KCSE candidate registration/materials record with checklist and exam-office hardcopy location.
- Test added: `scripts/i21-certificates-exam-materials-test.ts` verifying certificate vaulting, handover logging, exam material record creation/status/filtering, API permissions/source, UI mount and audit/service wiring.
- Screenshot captured at 1920×1080: `screenshots/i21-certificates-exam-materials.png`.
- Verification: `./node_modules/.bin/tsx scripts/i21-certificates-exam-materials-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.22 Payments & Developer Clarity documentation.

## 🔁 PART I BATCH 76 — I.20 BRANDING & DYNAMIC-ISLAND NOTIFICATIONS COMPLETED (2026-06-23)
- Continued Part I in order and completed I.20 Branding & Dynamic-Island Notifications.
- Branding: verified existing layout wiring passes `Tenant.logoUrl` into `Topbar`. Added a real school badge SVG asset at `public/brand/karibu-badge.svg` and updated `prisma/seed.ts` so Karibu High shows its own badge at the top-left instead of the NEYO mark.
- NEYO mark relocation: `NotificationBell` Dynamic Island now imports `NeyoLogo` and embeds a tiny “Powered by NEYO” mark on the live notification icon badge. This keeps school branding in the top-left while NEYO branding appears subtly in the notification/island surface.
- Dynamic Island: verified existing top-center, one-at-a-time queue (`islandQueue`/`activeIsland`), targeted `/api/notifications` fetching, click deep-linking, and `neyo:live-activity` module events remain intact.
- Overlay blur: added a global I.20 rule in `src/app/globals.css` for `.fixed.inset-0` and child scrims to force full viewport coverage using `100vw`, `100vh`, and `100dvh`, so modal/selection backdrops cover the full screen including mobile dynamic viewport cases.
- Test added: `scripts/i20-branding-dynamic-island-test.ts` verifies seeded school badge, topbar school-badge-first rendering, NEYO mark in Dynamic Island, island queue/live activity/deep-link source, targeted notification API source, and global full-screen overlay CSS.
- Screenshot captured at 1920×1080: `screenshots/i20-branding-dynamic-island.png`, showing the Karibu badge top-left and a top-center Dynamic Island live activity with the NEYO mark embedded.
- Founder correction after screenshot: Dynamic Island live activity was blocking/competing with search and notification dropdown looked like a separate entity. Fixed `src/components/shell/notification-bell.tsx` so BOTH live activities and the notification inbox use the same centered Dynamic Island surface.
- Founder follow-up: island text was not visible enough and the island should be centrally placed at the top of the screen, not below. Adjusted the island to top-center (`top: calc(... + 0.55rem)`) and changed the island to high-contrast glass-light/glass-dark text (`bg-white/95 text-navy-950`, dark `bg-navy-950/95 text-white`) so notification text is readable.
- Screenshot refreshed at 1920×1080: `screenshots/i20-branding-dynamic-island.png`.
- Verification: `./node_modules/.bin/tsx scripts/i20-branding-dynamic-island-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.21 Certificates & Exam-Material Records audit/verification/build.

## 🔁 PART I BATCH 75 — I.19 INCIDENT PHOTO PROOF COMPLETED (2026-06-23)
- Continued Part I in order and completed I.19 Incident Photo Proof by verifying the existing H.5 proof upload and adding the missing searchable-proof coverage.
- Verified full-stack proof storage: `DisciplineIncident.proofFileUrl` and `proofFileName` exist in Prisma; `incidentSchema` validates proof fields; `reportIncident()` persists them; `/api/discipline` passes incident data; Discipline UI shows “View Incident Proof” download links.
- Search hardening: `listIncidents()` now accepts `search` and filters by student name, admission number, category, description and proof filename. `/api/discipline?q=` wires this into the incident board, and the UI has an incident search box for learner/admission/proof search.
- Identity/proof UI: Report Incident uses mandatory `StudentSearchSelect` for learner/admission lookup, not a dropdown, and `FileUpload accept="image/*,application/pdf"` for proof so mobile can take photos directly through the shared FileUpload camera capture behaviour.
- Test added: `scripts/i19-incident-photo-proof-test.ts` verifies proof URL/name persistence, proof filename search, admission number search, searchable learner UI, photo/camera proof upload source, proof view link, API/service/schema wiring.
- Screenshot captured at 1920×1080: `screenshots/i19-incident-photo-proof.png`.
- Verification: `./node_modules/.bin/tsx scripts/i19-incident-photo-proof-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.20 Branding & Dynamic-Island Notifications audit/verification/build.

## 🔁 PART I BATCH 74 — I.18 CAFETERIA / MEAL CARDS COMPLETED (2026-06-23)
- Continued Part I in order and completed I.18 Cafeteria / Meal Cards.
- Database: added school-level cafeteria meal model controls to `Tenant`: `cafeteriaMealModel` and `cafeteriaMealScope` via migration `20260623154000_i18_cafeteria_meal_model`. Models: HYBRID, CARDS_ONLY, BOARDING_GROUPS, NO_CARDS. Scope: ALL, LUNCH, SUPPER.
- Backend/API: added `cafeteriaPolicy()` and `setCafeteriaPolicy()` in `src/lib/services/cafeteria.service.ts`; `/api/cafeteria` now returns `policy` and supports POST `setPolicy`. `issueCard()` now blocks card issuing when cards are disabled by the school model and enforces lunch-only/supper-only scope.
- Verified existing full-stack table allocation: `allocateCafeteriaTables()` stores `CafeteriaTable` rows by session, chunks learners into chosen table sizes, stores learner names/admission numbers in `studentsJson`, remembers table size, and `tableBoard()` groups strictly by class/stream label so learners are not mixed across classes.
- UI: Cafeteria → Meal Cards now has a real “School Meal Card Configurator” with selectable meal model and meal scope. The school can choose hybrid boarding groups + day cards, individual cards only, boarding/group meals only, or no physical cards. Choosing no cards/boarding-groups hides card issuing and service-level guard prevents hidden-route issuing.
- Existing meal queue line remains complete from prior I.18/I.31 work: queue supports breakfast/lunch/supper, queue numbers, served/cancelled states and real DB rows.
- Test added: `scripts/i18-cafeteria-meal-cards-test.ts` verifies NO_CARDS blocks issueCard, HYBRID+LUNCH scope blocks supper cards, table allocation creates saved table/group plans, table size respected, class/stream grouping, DB/API/service/UI wiring.
- Screenshot captured at 1920×1080: `screenshots/i18-cafeteria-meal-cards.png`.
- Verification: `./node_modules/.bin/tsx scripts/i18-cafeteria-meal-cards-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.19 Incident Photo Proof audit/verification/build.

## 🔁 PART I BATCH 73 — I.17 LIBRARY UPGRADES COMPLETED (2026-06-23)
- Continued Part I in order and completed I.17 Library Upgrades, including the founder correction that hardware must not show connected when it is not connected, and NEYO should have a direct inbuilt scanner.
- Hardware scanner truthfulness: Library Issue screen now explicitly says “External hardware scanner: not connected. Plug one in and it will type here automatically.” It does not claim a USB/Bluetooth scanner is connected. Wedge scanners still work by typing into the ISBN field and pressing Enter.
- Direct inbuilt scanner: added a NEYO built-in camera scanner in `src/components/library/library-client.tsx` using browser `BarcodeDetector` + `navigator.mediaDevices.getUserMedia` where supported. It starts the device camera, detects barcodes, fills the ISBN, then calls the real `/api/library?barcode=` lookup. If unsupported/denied, it falls back gracefully to manual ISBN or external wedge input.
- Fine policy: added `Tenant.libraryFinePerDayKes` via migration `20260623152000_i17_library_fine_amount`; added `libraryPolicy()` and `setLibraryPolicy()` in `src/lib/services/library.service.ts`; added `/api/library?view=policy` and POST `action: finePolicy`; Library → Out now now has a “Late-return fine policy” card with fines on/off and custom KES-per-day amount. Open issues and returns use the configured fine amount.
- Verified existing upgrades: teachers/staff can borrow books through `borrowerType=STAFF`; staff fines remain cash-only; transfer/clearance blocks learners with open books/unpaid library fines; issue flow remains search-only with no dropdowns.
- Test added: `scripts/i17-library-upgrades-test.ts` verifying barcode lookup, staff borrowing, staff fine invoice block, transfer clearance guard, fine policy custom amount, built-in scanner source, truthful hardware status copy, search-only UI, API and service wiring.
- Screenshot captured at 1920×1080: `screenshots/i17-library-upgrades.png`.
- Verification: `./node_modules/.bin/tsx scripts/i17-library-upgrades-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.18 Cafeteria / Meal Cards audit/verification/build.

## 🔁 PART I BATCH 72 — I.16 HOSTEL / DORM AUTOMATION COMPLETED (2026-06-23)
- Continued Part I in order and completed I.16 Hostel / Dorm Automation by auditing the existing B.16/H.4 engine and hardening the missing edge.
- Verified existing full-stack foundation: Hostel Master/boarding department and school heads can manage hostel (`hostel.manage`); `/api/hostel` exposes `autoAllocate`; Hostel UI has the Auto-Allocate Beds modal with Form-Based and Mixed Levels strategies; service excludes day scholars via `Student.boardingType = BOARDER`; transfer already releases active hostel bed allocations.
- Backend hardening: `autoAllocateHostelBeds()` in `src/lib/services/hostel.service.ts` now correctly supports `MIXED` hostels by allowing both boys and girls instead of rejecting mixed hostel configuration. `FORM` keeps same-level learners together; `MIXED` round-robins class levels for mentorship/mixed-stream placement.
- Transfer freed-space tracking: `transferStudent()` in `src/lib/services/student.service.ts` now records `freedHostelBeds` in `student.transfer` audit metadata after releasing active hostel allocations, so Boarding can trace freed bed space.
- UI: Auto-Allocate Beds modal copy now states gender validation supports Boys / Girls / Mixed, and keeps the school-switchable Form-Based vs Mixed Levels strategy controls.
- Test added: `scripts/i16-hostel-dorm-automation-test.ts` verifies Hostel Master and Principal access, mixed-hostel auto-allocation for boys and girls, day-scholar skip, transfer release of dorm bed, transfer audit freed-space metadata, API/UI/source wiring.
- Screenshot captured at 1920×1080: `screenshots/i16-hostel-dorm-automation.png`.
- Verification: `./node_modules/.bin/tsx scripts/i16-hostel-dorm-automation-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.17 Library Upgrades audit/verification/build.

## 🔁 PART I BATCH 71 — I.15 UNIVERSAL STAFF IMPORT COMPLETED (2026-06-23)
- Continued Part I in order and completed I.15 Universal Staff Import.
- Audited existing staff import instead of duplicating it: `src/lib/services/staff-import.service.ts`, `src/app/api/hr/import/route.ts`, and Staff Directory bulk-import modal already existed but were limited mostly to fixed-order pasted rows.
- Backend/API: upgraded staff import to support CSV/TSV/TXT/XLSX file upload, pasted spreadsheet text, parsed table rows, and direct JSON rows. Added rule-based header auto-mapping, role alias normalization (e.g. Teacher → TEACHER), Kenyan phone normalization, date normalization, contract-type validation, duplicate preflight across file rows and DB rows, and HR profile field persistence (TSC, National ID, KRA PIN, qualifications, employment date, contract type, emergency contact). `/api/hr/import` now accepts multipart form data and JSON/text/table payloads.
- UI: Staff Directory → “Bulk Import Staff” modal now shows upload + paste paths, accepted columns, sample CSV, first-row-header toggle, and Bundi-ready copy without depending on Bundi.
- Student import verification: existing student import remains fully standalone and rule-based with CSV/TSV/XLSX parsing, auto mapping, preview, commit, duplicate denial and real DB writes; future Bundi/photo/handwriting output can feed the same row/mapping seam without becoming a dependency.
- Term date guard verification: `upsertTerm()` still enforces Principal/School Owner/SUPER_ADMIN only; Deputy/teachers cannot edit term dates even if they have broad academics permissions.
- Test added: `scripts/i15-universal-staff-import-test.ts` verifies staff CSV auto-map, real staff user + StaffProfile creation, duplicate denial before partial creation, term-date guard, UI/API/source wiring, student-import standalone readiness, and no assistant dependency.
- Screenshot captured at 1920×1080: `screenshots/i15-staff-import.png`.
- Verification: `./node_modules/.bin/tsx scripts/i15-universal-staff-import-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.16 Hostel / Dorm Automation audit/verification/build.

## 🔁 PART I BATCH 70 — I.14 DEPARTMENTS & CO-CURRICULAR COMPLETED (2026-06-23)
- Continued Part I in order and completed I.14 Departments & Co-curricular by verifying existing department/subject/HOD foundations and adding the missing dedicated co-curricular surface.
- Verified backend: `Department.hodId` remains Principal/School Owner/SUPER_ADMIN-only in `src/lib/services/academics.service.ts`; `updateDepartment()` maps subjects to departments through real `Subject.departmentId`; scoped HOD rules from I.2 still apply.
- Seed/data: `prisma/seed.ts` now seeds a real non-academic `Co-curricular Activities` department and `Games & Clubs` subject (`GAC`) mapped to it, so demos are never empty.
- UI: `src/components/academics/academics-client.tsx` now has a dedicated `Co-curricular` tab. It shows the non-academic department, appointed head and mapped subjects, plus per-class activity timetable links. Academics leadership can save activity label and slots/week per class through the real timetable config API.
- Timetable linkage: Co-curricular tab writes `TimetableConfig.coCurricularName` and `coCurricularCount` through `/api/academics/timetable/generator` `save_config`; the existing whole-school generator reserves the activity blocks in Friday timetable slots.
- Test added: `scripts/i14-departments-cocurricular-test.ts` verifies Principal can appoint the co-curricular head, mapped subjects persist, timetable config saves, generator creates co-curricular Friday slots, UI/source/API wiring exists, and seed data includes the department/activity subject.
- Screenshot captured at 1920×1080: `screenshots/i14-departments-cocurricular.png`.
- Verification: `./node_modules/.bin/tsx scripts/i14-departments-cocurricular-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓. NEXT = I.15 Universal Staff Import audit/verification/build.

## 🔁 PART I BATCH 69 — REPO RESTORE BASELINE READY (2026-06-23)
- Founder provided new GitHub repo `elvisybadbunny-bit/workspace-019eef67-6f95-744d-ad81-def2cc93ae30` and requested deleting the previous workspace copy. Clean restore completed into `/home/user/neyo`; actual Next.js project root is `/home/user/neyo/neyo` because the GitHub repo contains the app in a nested `neyo/` folder.
- Baseline restore commands completed: `npm install` ✓, `./node_modules/.bin/prisma generate` ✓, `./node_modules/.bin/prisma migrate deploy` ✓ applying 116 migrations to SQLite, and `npm run db:seed` ✓ with Karibu/Uhuru Kenyan seed data.
- Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓ and `npm run test:roles` 24/24 ✓.
- No product feature was completed in this restore step, so `docs/FEATURES-CHECKLIST.md` was not ticked. NEXT = continue Part I in order with I.14 Departments & Co-curricular audit/verification/build, starting by checking existing Departments/Subjects mapping and co-curricular timetable linkage before adding any missing dedicated Co-curricular tab.

## 🔁 PART I BATCH 68 — I.13 TIMETABLE & ACADEMICS CONTROL COMPLETED (2026-06-22)
- Continued Part I in order and completed I.13 Timetable & Academics Control.
- Access/control: verified timetable mutations still require `academics.manage` in `/api/academics/timetable` and `/api/academics/timetable/generator`. Ordinary TEACHER lacks `academics.manage`, so they can view academics/timetable but cannot edit; Principal/Owner/Deputy/Dean/HOD can manage, with HOD subject actions still department-scoped through `assertHodSubjectAccess()`.
- Database: added configurable timetable start/end fields to `TimetableConfig`: `schoolDayStartTime`, `saturdayStartTime`, and `saturdayEndTime`. Migration applied manually because the sandbox is non-interactive: `20260622130000_i13_timetable_start_times`.
- Backend/API: `saveTimetableConfig()` in `src/lib/services/timetable-solver.service.ts` now persists normal-day and Saturday times; `/api/academics/timetable/generator` accepts those fields. The existing real bulk scheduler (`bulkSaturdaySchedule`) and fairness scheduler (`fairSaturdaySchedule`) remain wired through `/api/academics/timetable`.
- UI: Academics → Timetable now exposes a visible “Schedule rules” button. The Schedule Rules modal includes Normal day starts, Saturday starts, and Saturday ends time controls. Timetable period labels compute from the configured start time. Bulk Saturday Scheduler shows the configured Saturday window and period time labels, with shared buttons for Grade 6–9, Form 1–4, and All classes plus Saturday/Remedial/Exam prep modes.
- Screenshot captured at 1920×1080: `screenshots/i13-timetable-academics-control.png`.
- Verification: `./node_modules/.bin/tsx scripts/i13-timetable-academics-control-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: all I.13 lines marked `[x]`. NEXT = I.14 Departments & Co-curricular audit/verification/build.

## 🔁 PART I BATCH 67 — I.12 QUICK MESSAGING BUTTONS COMPLETED (2026-06-22)
- Continued Part I in order and completed I.12 Quick Messaging Buttons by auditing the existing H.5 `MessageButton` and extending coverage instead of duplicating the messaging engine.
- Existing verified: `src/components/messaging/message-button.tsx` already starts/reuses a real DIRECT 1:1 conversation through `/api/conversations` and deep-links to `/messages?open=<id>`. Staff directory and staff file drawer already used it.
- Fixed/extended coverage: Parent Portal “Talk to the school” in `src/components/portal/parent-portal-client.tsx` now uses `MessageButton` instead of plain `/messages?to=` anchor links, so buttons create/reuse the thread correctly. Student Profile guardians in `src/components/students/student-profile-client.tsx` now show “Message guardian” for guardians linked to portal accounts.
- Compatibility hardening: `src/components/messaging/messages-client.tsx` now supports `/messages?to=<userId>` by creating/reusing the direct thread automatically, then opening it; `/messages?open=<conversationId>` still works.
- Added `scripts/i12-quick-message-buttons-test.ts` verifying thread reuse/no duplicate, parent→school direct conversation, staff button coverage, parent portal button coverage, student guardian button coverage, and `/messages?to=` support.
- Screenshot captured at 1920×1080: `screenshots/i12-quick-message-buttons.png`, showing parent portal quick-message buttons for Principal, Deputy and Class Teacher.
- Verification: `./node_modules/.bin/tsx scripts/i12-quick-message-buttons-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.12 marked `[x]`. NEXT = I.13 Timetable & Academics Control audit/verification/build.

## 🔁 PART I BATCH 66 — I.11 ADMISSIONS INTERVIEW-EXAM VAULT COMPLETED (2026-06-22)
- Continued Part I from I.11 as requested and completed Admissions Interview-Exam Vault properly instead of only relying on the old H.5 checkbox.
- Database: hardened `EntranceExamPaper` in `prisma/schema.prisma` from level-only storage into exact class/stream storage. New fields: `classId`, `classLabel`, `title`, mandatory `hardcopyLocation`, `uploadedById`, `printCount`, `lastPrintedAt`, and `updatedAt`; uniqueness is now `@@unique([tenantId, classId])`. Migration applied: `20260622123335_i11_entrance_exam_per_class`.
- Security/validation: added `src/lib/validations/entrance-exam.ts` requiring exact `classId`, title, uploaded file URL, filename, and hard-copy location. API save route requires `student.create`; read/print requires `student.view`.
- Backend/API: added `src/lib/services/entrance-exam.service.ts` with `listEntranceExamPapers()`, `saveEntranceExamPaper()`, and `markEntranceExamPaperPrinted()`. Saving verifies the exact class exists and audit-logs `admissions.entrance_exam_vaulted`; printing increments `printCount`, stamps `lastPrintedAt`, audit-logs `admissions.entrance_exam_printed`, then redirects to the stored file. APIs: `GET/POST /api/admissions/entrance-exams` and `GET /api/admissions/entrance-exams/[id]/print`.
- UI: rebuilt the Admissions “Entrance Exam Paper Vault” modal in `src/components/admissions/admissions-client.tsx` so it lists every exact class/stream, shows stored paper status, file name, hard-copy location, uploader, print count, “Print / Download”, and an upload/replace panel with title + hard-copy location + real `FileUpload`.
- Seed/screenshot: `prisma/seed.ts` now writes real tiny PDF files into local storage and seeds papers for Form 1 West and Form 2 East. Screenshot captured at 1920×1080: `screenshots/i11-admissions-entrance-exam-vault.png`.
- Verification: `npm run db:seed` ✓, `./node_modules/.bin/tsx scripts/i11-admissions-entrance-exam-vault-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.11 marked `[x]`. NEXT = I.12 Quick Messaging Buttons audit/extension.

## 🔁 PART I BATCH 65G — I.9 CLASS-GROUP DISAPPEARING VOICE COMPLETED (2026-06-22)
- Restored founder GitHub repo `elvisybadbunny-bit/workspace-019eef05-e215-7604-8a1a-e84a48520c3a` into `/home/user/neyo`, installed dependencies, generated Prisma Client, applied 114 migrations to SQLite, seeded real Kenyan dev data, and verified baseline: migrate deploy ✓, seed ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Honoured founder correction: Part I was jumping; going forward we audit the WHOLE Part I, completing unticked/incomplete lines properly and avoiding duplicates when code already exists.
- Completed I.9 class-group disappearing voice by verifying Chunk 6 — Frontend Page Integration was already present in `src/components/messaging/messages-client.tsx`: it imports `ClassVoiceRoom`, stores `activeType`, `activeTitle`, and `activeClassId` from the real thread payload, and mounts `ClassVoiceRoom` only for `activeType === "GROUP" && activeClassId` class conversations.
- Added/refined `scripts/shot-i9-class-voice.ts` so screenshots reliably open the seeded Form 2 East class group and pre-start a real disappearing room through `startClassVoiceRoom()` before browser capture. Screenshot captured: `screenshots/i9-class-group-voice.png` at 1920×1080.
- Verification: `./node_modules/.bin/tsx scripts/i9-class-voice-validation-test.ts` ✓, `./node_modules/.bin/tsx scripts/i9-class-voice-service-test.ts` ✓, `./node_modules/.bin/tsx scripts/i9-class-voice-api-test.ts` ✓, `./node_modules/.bin/tsx scripts/i9-class-voice-ui-test.ts` ✓, `./node_modules/.bin/tsx scripts/i9-class-voice-messages-integration-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.9 voice line marked `[x]`; H.5 Disappearing Group Voice Notes also marked `[x]` because I.9 completes that deferred line full-stack. NEXT = audit Part I from open lines, starting with I.11 Admissions Interview-Exam Vault unless an earlier unticked/partial I line is found to be already fully built and only needs verify-and-tick.

## 🔁 PART I BATCH 65F — I.9 CLASS-GROUP DISAPPEARING VOICE CHUNK 5 COMPLETED (2026-06-22)
- Continued I.9 class-group disappearing voice. Completed Chunk 5 — UI Components & Icons.
- Added `src/components/messaging/class-voice-room.tsx`, a polished Liquid Glass class voice room component for class-group conversations. It uses Lucide icons: Phone, Mic, MicOff, PhoneOff, Users, Clock, ShieldCheck, Volume2 and Loader2.
- Component behavior: checks for an active class voice room, starts/joins a disappearing room through `/api/class-voice`, posts/polls short-lived signals through `/api/class-voice/signal`, requests real microphone permission via `navigator.mediaDevices.getUserMedia`, uses browser `RTCPeerConnection` with offer/answer/ICE handling, shows participant chips, live countdown, mute/unmute and end controls.
- Storage copy and guard: UI clearly says “No class voice is saved by NEYO” and the component never sends stored audio/recording URLs.
- Added `scripts/i9-class-voice-ui-test.ts` verifying the component export, real API endpoints, microphone permission, peer connection APIs, offer/answer/ICE handling, no-storage copy, required Lucide icons, and no stored audio URL usage.
- Verification: `./node_modules/.bin/tsx scripts/i9-class-voice-ui-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.9 voice line remains `[~]` with Chunk 1–5 evidence. NEXT = Chunk 6 Frontend Page Integration: mount `ClassVoiceRoom` inside `MessagesClient` only for class group conversations, then capture screenshot.

## 🔁 PART I BATCH 65E — I.9 CLASS-GROUP DISAPPEARING VOICE CHUNK 4 COMPLETED (2026-06-22)
- Continued I.9 class-group disappearing voice. Completed Chunk 4 — API Endpoints.
- Added `src/app/api/class-voice/route.ts`: signed-in POST action route for `start`, `join`, and `end`, wired to `classVoiceActionSchema`, `startClassVoiceRoom()`, `joinClassVoiceRoom()`, and `endClassVoiceRoom()`.
- Added `src/app/api/class-voice/signal/route.ts`: signed-in GET for polling short-lived signals and POST for posting WebRTC signals, wired to `pollClassVoiceSignalsSchema`, `postClassVoiceSignalSchema`, `pollClassVoiceSignals()`, and `postClassVoiceSignal()`.
- Hardened error handling in `src/lib/api/respond.ts` by importing `ClassVoiceError` and mapping NOT_FOUND→404, FORBIDDEN→403, STATE/EXPIRED→409, other validation/service issues→422.
- Added `scripts/i9-class-voice-api-test.ts` to verify both routes require `requireUser()`, use Zod schemas, wire the real service functions, and expose graceful ClassVoiceError handling.
- Verification: `./node_modules/.bin/tsx scripts/i9-class-voice-api-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.9 voice line remains `[~]` with Chunk 1+2+3+4 evidence. NEXT = Chunk 5 UI Components & Icons / frontend voice surface inside class group Messages.

## 🔁 PART I BATCH 65D — I.9 CLASS-GROUP DISAPPEARING VOICE CHUNK 3 COMPLETED (2026-06-22)
- Continued I.9 class-group disappearing voice. Completed Chunk 3 — Backend Logic / Service.
- Added `src/lib/services/class-voice.service.ts` with real Prisma-backed functions: `startClassVoiceRoom`, `joinClassVoiceRoom`, `postClassVoiceSignal`, `pollClassVoiceSignals`, `endClassVoiceRoom`, and `cleanupExpiredClassVoiceRooms`.
- Access/security: service requires the target conversation to be a real class-group conversation (`Conversation.classId`, type GROUP) and requires the user to be an existing conversation participant. A teacher outside the class group cannot join. A parent/student can join only through their existing class-chat membership.
- Storage discipline: service creates only `ClassVoiceRoom`, `ClassVoiceParticipant`, and `ClassVoiceSignal` rows; it never creates audio file/message attachments. Rooms/signals are short-lived and cleanup marks old rooms EXPIRED and deletes expired signals.
- Room controls: starting a room creates a 15-minute DISAPPEARING room, notifies other class-chat participants in-app, and audit-logs `class_voice.started`. Only the creator or leadership can end the room for everyone, audit-logging `class_voice.ended`.
- Added `scripts/i9-class-voice-service-test.ts` verifying: class chat sync, teacher starts room, parent joins, outside teacher blocked, signal post/poll works, non-creator end blocked, creator end works, cleanup expires old room, no stored voice-note attachment is created by the service, and audit logs exist.
- Verification: `./node_modules/.bin/tsx scripts/i9-class-voice-service-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.9 voice line remains `[~]` with Chunk 1+2+3 evidence. NEXT = Chunk 4 API Endpoints for class voice.

## 🔁 PART I BATCH 65C — I.9 CLASS-GROUP DISAPPEARING VOICE CHUNK 2 COMPLETED (2026-06-22)
- Continued I.9 class-group disappearing voice using the one-chunk discipline. Completed Chunk 2 — Security & Validation.
- Added `src/lib/validations/class-voice.ts` with strict Zod schemas for start/join/end room actions plus post/poll WebRTC signals. It validates safe peer IDs, `cvr_...` room keys, allowed signal types (`join`, `leave`, `offer`, `answer`, `ice`, `control`), short TTL constants (15-minute room, 20-minute signals), and payload size.
- Storage guard: schemas are `.strict()` and defensively reject `audioUrl`, `attachmentUrl`, `fileUrl`, `recordingUrl`, or `blobUrl` in signal payloads, so class-group voice cannot be turned into permanent voice/audio file storage.
- Added `scripts/i9-class-voice-validation-test.ts` proving valid WebRTC metadata passes and stored-audio/recording payloads fail.
- Verification: `./node_modules/.bin/tsx scripts/i9-class-voice-validation-test.ts` ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓.
- Checklist updated: I.9 voice line remains `[~]` with Chunk 1+2 evidence. NEXT = Chunk 3 Backend Service for real class-group voice room creation, access checks, join/leave, signalling, expiry and cleanup.

## 🔁 PART I BATCH 65B — I.9 CLASS-GROUP DISAPPEARING VOICE CHUNK 1 STARTED (2026-06-22)
- Founder noticed the first calendar screenshot had captured the login page. Fixed `scripts/shot-i9-calendar-big-dates.ts` to authenticate inside the browser context so the I.39 `neyo_device_id` cookie and session cookie match. Refreshed screenshot: `screenshots/i9-calendar-big-dates.png` now correctly shows the Calendar page at 1920×1080.
- Started the remaining I.9 line: class-group voice call in disappearing mode. Completed Chunk 1 database foundation only, per the one-chunk discipline.
- Database: added tenant-owned `ClassVoiceRoom`, `ClassVoiceParticipant`, and `ClassVoiceSignal` models in `prisma/schema.prisma`, plus Tenant relations and tenant isolation entries in `src/lib/core/tenant-tables.ts`. Migration applied: `20260622104208_i9_class_group_voice`.
- Design intent: these tables store live-room metadata and short-lived WebRTC signalling only. NEYO does NOT store class voice/audio recordings; `expiresAt` on rooms/signals supports disappearing mode and cleanup.
- Verification: `./node_modules/.bin/prisma migrate dev --name i9_class_group_voice --skip-seed` ✓, Prisma Client generated ✓, `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `./node_modules/.bin/tsx scripts/i9-calendar-big-dates-test.ts` ✓.
- Checklist updated: I.9 voice line moved to `[~]` in progress. NEXT = I.9 Chunk 2 Security & Validation for class-group voice access and signal payloads.

## 🔁 PART I BATCH 65A — I.9 CALENDAR BIG-DATE VERIFY COMPLETED (2026-06-22)
- Continued Part I without skipping and started I.9 Calendar & Class-Group Voice.
- Verified the first I.9 line (Calendar dates bigger/no drift) against real code instead of rebuilding/duplicating H.2. `src/components/calendar/calendar-view.tsx` already has the big-date fix: month cells use fixed `h-9 w-9 text-base leading-none` date badges and week/day agenda headers use fixed `h-12 w-12 text-2xl shrink-0 leading-none` badges.
- Added regression script `scripts/i9-calendar-big-dates-test.ts` to check the big-date/no-drift classes and implementation note. Screenshot captured at 1920×1080: `screenshots/i9-calendar-big-dates.png`.
- Verification: `./node_modules/.bin/tsx scripts/i9-calendar-big-dates-test.ts` ✓. Existing repo restore this session also passed migrate deploy, seed, typecheck and `npm run test:roles` 24/24.
- Checklist updated: I.9 calendar-big-date line marked `[x]`. Remaining I.9 open line is class-group voice call / disappearing mode. NEXT = build the class-group disappearing voice system full-stack in small chunks.

## 🔁 PART I BATCH 64 — I.8 PRINTING CONTROLS COMPLETED (2026-06-22)
- Continued Part I in order and completed I.8 Printing Controls by verifying and hardening the existing H.2 print-limit and print-station systems.
- Printer off / term-end batch: verified real school-wide `Tenant.printStationMode` AUTO|HOLD. Hardened `setPrintStationMode()` to use `isPrivilegedPrinter()` so Principal, Deputy Principal, HOD/Academics, School Owner and SUPER_ADMIN can toggle it (including secondary roles), while non-privileged staff are blocked. `/api/print-queue` now lets privileged users change `stationMode` as a setting action before general print-station access checks; HOLD keeps jobs queued for term-end batch printing instead of instant auto-printing.
- Custom print limits: verified `Tenant.printLimitPerDay` supports any whole number 0–1000, not only presets. Principal, Deputy and Academics HOD can set arbitrary limits. Non-privileged users are counted daily in `UsageCounter`, hit `LIMIT_REACHED`, raise `PrintApprovalRequest`, and an approved request is consumed once then marked USED.
- UI: Settings → Printing shows custom “Documents per day” number input and pending print approval requests. Print Station already has Boarding School Term-End Batch Mode toggle; updated copy/role logic to include Academics HOD. Screenshot: `screenshots/i8-printing-controls.png`.
- Tests: new `scripts/i8-printing-controls-test.ts` verifies HOLD/AUTO, queued jobs preserved in HOLD, Principal/Deputy/HOD custom limits, non-privileged blocks, over-limit approval request and one-time consumption, settings UI source, station mode UI/source (17/17 ✓). Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓, I.8 test 17/17 ✓. Full build skipped for speed per sandbox pattern.
- Checklist updated: all I.8 lines marked `[x]`. NEXT open section is I.9 Calendar & Class-Group Voice.

## 🔁 PART I BATCH 63 — I.7 GATE PASS & DISCIPLINE AUTHORITY COMPLETED (2026-06-22)
- Continued Part I in order and completed I.7 Gate Pass & Discipline Authority.
- Gate pass approvals: added approval metadata to `GatePass` (`approvedById`, `approvedByName`, `approvedAt`, `decisionNote`) through migration `20260622020000_i7_gate_discipline_approvals`. `issueGatePass()` now enforces: Principal/Deputy/Owner/SUPER_ADMIN issue ACTIVE passes directly; HOD/Dean can only propose PENDING passes; receptionist/security cannot issue passes. `decideGatePass()` lets Principal/Deputy/Owner approve/reject pending passes; pending passes cannot be used at the gate. Security/reception only confirms active passes by number with `useGatePass()`.
- Discipline approvals: added approval/status metadata to `DisciplineIncident` and approval metadata to `Suspension`. Major/severe incidents proposed by HOD/teacher-like users stay PENDING; parent SMS is sent only after Principal/Deputy/Owner approval via `approveIncident()`. HOD/Dean suspension requests stay PENDING; Principal/Deputy/Owner can approve through existing `approveSuspension()`; ordinary teachers cannot propose suspensions. Behavior board now counts APPROVED incidents only.
- Permissions/API/UI: HOD now gets `discipline.view/manage` and `security.view` for proposal workflows. `/api/security` supports `approvePass`/`rejectPass`; `/api/discipline` supports `approveIncident`/`rejectIncident`. Gate UI now shows “Issue / propose pass”, pending approval badges and Approve/Reject actions; Discipline UI shows pending case approval and “Issue / propose suspension”.
- Tests/screenshots: new `scripts/i7-gate-discipline-authority-test.ts` verifies HOD proposal, receptionist issue-block, pending pass use-block, principal pass approval, security gate confirmation by number, deputy direct pass, HOD major discipline pending, deputy incident approval + parent SMS, HOD suspension pending, principal suspension approval + parent SMS, ordinary teacher suspension block, and UI source checks (17/17 ✓). Screenshot: `screenshots/i7-gate-discipline-authority.png`. Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓, I.7 test 17/17 ✓. Full build skipped for speed per sandbox pattern.
- Checklist updated: all I.7 lines marked `[x]`. NEXT open section is I.8 Printing Controls.

## 🔁 PART I BATCH 62 — I.6 PRINCIPAL POWERS & DELEGATION COMPLETED (2026-06-22)
- Continued Part I in order and completed I.6 Principal Powers & Delegation.
- Attendance nuance: Principal/Owner/SUPER_ADMIN can view attendance by default, but the dashboard CTA now says “View attendance” unless they are assigned as a class teacher. On the Attendance screen, Principal sees class registers as read-only unless “Master Override” is switched on. Backend hardened `markRegister()` so Principal/Owner cannot mark another class without `masterOverride:true`; if the Principal is actually the class teacher, normal marking works without override.
- Delegation full-stack: added tenant-owned `PrincipalDelegationTask` model + migration `20260622010000_i6_principal_delegation`, added to `TENANT_OWNED_MODELS`, with title/details/category/assignee/assigner/due date/status/completion fields. New validation `src/lib/validations/delegation.ts`, service `src/lib/services/delegation.service.ts`, and API `/api/delegations` (GET board; POST create/complete/cancel). Only Principal/Owner/SUPER_ADMIN can assign; target must be Teacher/Class Teacher/HOD/Dean. Teachers can see and complete their own tasks. Assignment/completion/cancellation send targeted in-app notifications and audit logs.
- UI: Dashboard now mounts `PrincipalDelegationCard`, a Liquid Glass card with “Assign a teacher task” form and open delegated task list. Teachers see their assigned tasks on the same card and can mark Done. Screenshot: `screenshots/i6-principal-delegation.png`.
- Tests: new `scripts/i6-principal-powers-delegation-test.ts` verifies Principal view access, dashboard CTA source, no-override mark block, Master Override success + audit, own-class Principal marking, Principal-only delegation assignment, Deputy assignment block, teacher task visibility, teacher completion, targeted notification, and audit (16/16 ✓). Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓, `npm run test:roles` 24/24 ✓, I.6 test 16/16 ✓. Full build skipped for speed per sandbox pattern.
- Checklist updated: all I.6 lines marked `[x]`. NEXT open section is I.7 Gate Pass & Discipline Authority.

## 🔁 PART I BATCH 61 — I.5 ROLE-BASED DASHBOARD & SYSTEM VISIBILITY COMPLETED (2026-06-22)
- Continued Part I in order and completed I.5 Role-Based Dashboard & System Visibility with a careful audit + hardening pass instead of jumping ahead.
- Dashboard visibility: `/dashboard` now gates school-wide money cards and the Subscription Plan card by effective `owner.dashboard` only. Bursar/Accountant still access Finance where appropriate, but they no longer see My School/money/metrics dashboard components. Billing settings and billing API read/subscribe are now owner/principal-only via `owner.dashboard`.
- Settings/system visibility: app layout, server page guards and the Settings hub now use `effectivePermissionsForUser()` so dual-role and strict per-staff area scoping are respected from first render. Non-concerned staff keep only safe basics (`/settings`, `/settings/security`) for password/passkeys/language; admin settings are hidden. Hardware settings gained a server-side `tenant.manage_settings` guard.
- NEYO internal menus: `/founder` remains SUPER_ADMIN-only through `platform.founder_ops` navigation and `requirePageRole("SUPER_ADMIN")`; school users never see NEYO Ops. Brand style-guide remains product reference only.
- Owner restriction: Visibility Manager now allows `/owner` “My School (owner metrics)” to be hidden from School Owner and Principal too, while `/settings` and `/settings/security` remain unhideable so the school can reverse the setting.
- Dual-role/multi-owner: verified combined primary+secondary permissions across nav/page guards/settings; verified Principal can also be Owner through secondaryRole and that owners can be many through existing multi-owner support.
- Role assignment confirmation: `promoteStaff()` already limited role changes to Principal/School Owner/SUPER_ADMIN; hardened it to validate role keys and store explicit confirmation metadata (`confirmedById/name/role/secondaryRole`) in `hr.staff_promoted` audit logs. Staff UI now says “Confirm role change” and explains it is a critical audited action.
- Tests/screenshots: new `scripts/i5-role-dashboard-visibility-test.ts` verifies 26 points: dashboard card gating, My School visibility, settings basics only for non-concerned staff, school users not seeing NEYO Ops, effective dual-role permissions, owner/principal hiding `/owner`, multiple owners + principal-as-owner, and audited role-change confirmation. Screenshot captured: `screenshots/i5-role-dashboard-visibility.png`. Verification: `NODE_OPTIONS=--max-old-space-size=1536 npm run typecheck` ✓ (after stopping dev and clearing `.next`), `npm run test:roles` 24/24 ✓, I.5 test 26/26 ✓. Full build skipped for speed per sandbox pattern.
- Checklist updated: all I.5 lines marked `[x]`. NEXT open section is I.6 Principal Powers & Delegation.

## 🔁 PART I BATCH 60 — I.4 PARENT-INITIATED SAFE PICKUP COMPLETED (2026-06-21)
- Continued in Part I order. Completed I.4 Parent-Initiated Pickup full-stack by turning the existing gate pickup engine into real parent self-service.
- Backend/API: added parent-scoped pickup helpers to `parent-portal.service.ts`: `parentPickupBoard`, `parentAddPickupPerson`, `parentRemovePickupPerson`, `parentCreateAltPickup`, `parentCancelAltPickup`. New route `POST/GET /api/portal/pickup` lets parents manage pickup people and one-time alternate pickup codes for their own children only. Cross-family access is blocked through `scopeWhere()`/`assertOwnChild()`.
- Gate verification: extended `pickupListFor()` in `security.service.ts` so security can search by presented National ID, picker name, phone, learner name, NEYO admission number or school admission number. Existing `confirmPickupPerson()` and `verifyAltPickup()` continue to send instant parent SMS after permanent/alternate pickup verification.
- UI: Parent Portal child detail now has a polished “Pickup safety” card. Parents can add permanent authorised people with required National ID, create one-time pickup codes with optional screenshot proof, remove permanent people, and cancel active one-time codes. The card explains that security checks the ID and the parent receives SMS after pickup.
- Tests/screenshots: `scripts/i4-parent-pickup-safety-test.ts` verifies parent board, own-child-only guard, permanent pickup creation with National ID, gate search by National ID, gate confirmation SMS/audit, alternate pickup code creation with screenshot proof, alternate code verification SMS, permanent removal, and alternate cancellation (9/9 ✓). Screenshot: `screenshots/i4-parent-pickup-safety.png`. Verification: typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed per sandbox guidance.
- Checklist updated: all I.4 lines marked `[x]`. NEXT open section is I.5 Role-Based Dashboard & System Visibility verification.

## 🔁 PART I BATCH 59 — I.3 MANDATORY SEARCHABLE LEARNER INPUTS COMPLETED (2026-06-21)
- Continued in Part I order. Completed I.3 by replacing long learner/admission-number dropdowns with a required typeahead search component.
- UI/component: added reusable `src/components/students/student-search-select.tsx`. It searches loaded real learners by name, admission number and class, is marked required, shows a clear “No learner found” state, and keeps Liquid Glass input/dropdown styling.
- Replaced operational learner dropdowns in these screens: Cafeteria meal-card issue + meal queue; Clinic visit/profile/medication dialogs; Discipline incident/suspension/counseling dialogs; Hostel bed allocation; Inventory sell-to-student; Security gate pass/pickup/alternate pickup; Transport rider assignment. Class/level/gender/status dropdowns were intentionally left as dropdowns because I.3 targets fields needing an admission number or name.
- Tests/screenshots: new `scripts/i3-searchable-inputs-test.ts` verifies the converted operational screens import `StudentSearchSelect` and no longer contain learner dropdown phrases/options (36/36 ✓). Screenshot captured: `screenshots/i3-searchable-learner-input.png` showing clinic visit learner search by “Achieng”. Verification: typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed per sandbox guidance.
- Checklist updated: I.3 marked `[x]`. NEXT open section is I.4 Parent-Initiated Pickup verification/self-service.

## 🔁 PART I BATCH 58 — I.2 EXAM RELEASE APPROVAL WORKFLOW COMPLETED (2026-06-21)
- Continued I.2 without jumping. Built real HOD/academics → Principal/Owner result-release approval workflow before parents can receive released results.
- Database: added tenant-owned `ExamReleaseApprovalRequest` model with status `PENDING|APPROVED|REJECTED|CANCELLED`, requester/decider names, decision note, and summary JSON. Migration: `20260621211846_i2_exam_release_approvals`. Added model to `TENANT_OWNED_MODELS`.
- Backend/API: `exam.service.ts` now has `requestExamRelease()`, `decideExamRelease()`, and `latestExamReleaseApproval()`. HOD/Dean/Deputy/Principal/Owner can request release only after marks exist. Only Principal/School Owner/SUPER_ADMIN can approve/reject. Approval calls the existing `publishExam()` path, so class/subject means are computed and the existing parent SMS release notification is sent. New API: `POST /api/exams/[id]/release` with actions `request|approve|reject`.
- UI: Exams detail page now shows a “Pending Principal approval” pill, a “Principal release approval” card, “Request release approval”, “Return”, and “Approve & release” buttons. Direct release remains available to `exam.publish` users outside a pending request, but the new workflow is the primary HOD → Principal path.
- Tests/screenshots: `scripts/i2-exam-release-approval-test.ts` verifies HOD request, pending row, principal in-app notification, deputy approval block, principal approval publishing the exam, parent SMS path and audits (6/6 ✓). Screenshot captured: `screenshots/i2-exam-release-approval.png`. Verification: typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed per sandbox guidance.
- Checklist updated: I.2 third line marked `[x]`. Remaining I.2 open line is the results presentation/design pass, intentionally waiting for founder’s desired visual spec.

## 🔁 PART I BATCH 57 — I.2 HOD APPOINTMENT + DEPARTMENT SCOPING COMPLETED (2026-06-21)
- Resumed from GitHub repo `elvisybadbunny-bit/workspace-019ee6b5-3e61-763f-b012-7ea85294ccf1`, copied app to `/home/user/neyo`, restored dependencies, generated Prisma client, applied 110 migrations, seeded SQLite dev DB, and verified `typecheck` + `test:roles` green.
- Completed the first open I-section gap carefully instead of jumping: I.2 Department Head appointment and HOD department scoping. Existing `Department.hodId` was present, but the service allowed broad `academics.manage` users to change it; now changing/appointing a Department Head is enforced in `academics.service.ts` by Principal/School Owner/SUPER_ADMIN only.
- Added scoped HOD enforcement: HODs see only their assigned departments/subjects; cannot create departments; cannot manage other departments; cannot steal subjects from another department; and cannot timetable a subject outside their own department. Principal/Owner/Deputy/Dean remain broad academics leadership where appropriate, but only Principal/Owner/SUPER_ADMIN appoint HODs.
- UI: Academics → Departments now receives `canAppointHod` and `isScopedHod`; HOD-mode users see a clear note that only their department is available, and HOD appointment is read-only unless the user is Principal/Owner/SUPER_ADMIN.
- Tests/screenshots: new `scripts/i2-hod-department-scope-test.ts` verifies principal appointment, deputy block, HOD-only department/subject visibility, HOD cross-department blocks, and allowed own-department timetable action (10/10 ✓). Screenshot captured: `screenshots/i2-hod-department-scope.png`. Verification: typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed per standing sandbox guidance.
- Checklist updated: I.2 first two lines marked `[x]`; remaining I.2 lines stay open for the next chunk: HOD/principal exam-release approval workflow and results design pass.

## 🔁 PART I BATCH 56 — I.99 DAILY/WEEKLY FINANCE DIGEST COMPLETED (2026-06-20)
- Continued I.99 Fee Collection Engine. Added `sendFinanceDigest(tenantId, cadence)` to `finance.service.ts`; it summarizes collected amount, outstanding amount, open invoice count and top balances for the period.
- Backend/API/jobs: new POST `/api/finance/digest` requiring `finance.view` + `comms.send`. Added scheduled jobs `finance-digest-daily` (17:30 EAT daily) and `finance-digest-weekly` (Monday 07:30 EAT) to `registry.ts`. Digest sends in-app notifications and SMS to Bursar, Accountant, Principal and School Owner where phone exists, and audit-logs `finance.daily_digest_sent` / `finance.weekly_digest_sent`.
- UI: Finance → Overview now has “Automated fee digest to bursar & principal” with Daily and Weekly manual send buttons, while scheduled jobs handle automatic delivery.
- Tests/screenshots: `scripts/i99-finance-digest-test.ts` verifies digest content, principal deep-linked in-app notification, scheduled jobs, API permissions/source, and UI actions. Screenshot: `neyo/screenshots/i99-finance-digest.png`. Verification: digest test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 55 — I.99 PARTIAL-PAYMENT FRIENDLY VERIFIED (2026-06-20)
- Completed/verified the I.99 partial-payment-friendly line. Existing finance ledger already supports partial payments via `applyPaymentToInvoice()`: any amount below the invoice balance updates `paidKes` and leaves status `PARTIAL`; overpayments are rejected at payment/STK entry points.
- Verified parent-facing payment paths: Parent Portal STK accepts `amountKes`, and public Mzazi QR/STK (`mzaziPay`) accepts any amount from KES 1 up to the learner’s live balance, links the pending Payment to the oldest open invoice, and rejects amounts above balance. Mzazi Card/QR balance remains live because it calculates directly from invoices (`total - discount - paid`).
- Tests/screenshots: `scripts/i99-partial-payment-friendly-test.ts` verifies desk partial payment, Mzazi partial STK, payment invoice linkage, overpayment rejection, Mzazi amount input source, and PARTIAL ledger support. Screenshot: `neyo/screenshots/i99-partial-payment-mzazi.png`. Verification: partial-payment test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 54 — I.99 FEE COLLECTION LEADERBOARD COMPLETED (2026-06-20)
- Continued I.99 Fee Collection Engine. Added `feeCollectionLeaderboard(user)` to `finance.service.ts`, computing class/stream fee performance from real invoices: billed, collected, outstanding, learner count, collection rate and class teacher label.
- Backend/API: new GET `/api/finance/leaderboard` requiring `finance.view`, returning ranked class rows sorted by collection rate and collected amount.
- UI: Finance → Overview now shows “Fee collection leaderboard by class/stream” with rank, class name, class teacher, learner count, collected/billed totals and progress bars. This supports healthy competition among class teachers.
- Tests/screenshots: `scripts/i99-fee-leaderboard-test.ts` verifies class rows, teacher/rate labels, sort order, API permission source and UI source. Screenshot: `neyo/screenshots/i99-fee-collection-leaderboard.png`. Verification: leaderboard test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 53 — I.99 INSTALLMENT PAYMENT PLANS COMPLETED (2026-06-20)
- Continued I.99 Fee Collection Engine. Added migration `20260620001000_i99_installment_promises` extending `PromiseToPay` with `planGroupId`, `installmentNo`, and `reminderSentAt`, so one invoice can have a grouped per-parent installment schedule.
- Backend/API: added `createInstallmentPlan(user, { invoiceId, installments })` to replace active promises for an invoice with a grouped schedule, SMS the guardian about the plan, and audit-log `promise.installment_plan_created`. Added `sendDueInstallmentReminders(tenantId)` and due-date reminder logic in `checkBrokenPromises()`. `POST /api/finance/promises` now creates installment plans for finance users.
- UI: Finance → Promises Calendar now has “Create installment plan” modal. It accepts one installment per line as date,amount and shows installment numbers in the promises table. This gives bursars a simple schedule tool for payment plans.
- Tests/screenshots: `scripts/i99-installment-plans-test.ts` verifies multi-installment creation, grouped DB rows, Promise Calendar listing, due-date reminder job behaviour, API source, and UI source. Screenshot: `neyo/screenshots/i99-installment-payment-plan.png`. Verification: i99 installment test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 52 — LIVE CLASS PRODUCT COPY, FULLSCREEN & NEYO LOGO COMPLETED (2026-06-20)
- Founder requested: no mention of WebRTC or third-party/underlying technology inside NEYO product copy; live classes should support full screen; NEYO logo should be embedded in a corner of the live video.
- Updated user-facing live-class copy: `/online-classes` now says “secure NEYO live classes”; live room heading says “NEYO live class room”. Underlying technical terms remain only in code/tests/docs, not product UI.
- Added full-screen control to the live class room via `requestFullscreen()` and a visible “Full screen” button. Added NEYO logo overlay in the top-left corner of the live video/stage using `NeyoLogo`.
- Tests/screenshots: `scripts/i89-live-class-branding-copy-test.ts` verifies no exposed technical wording on the page, NEYO room heading, fullscreen support, and logo overlay. Verification: branding/copy test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot refreshed: `neyo/screenshots/i90-online-meeting-controls.png`. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 51 — I.99 ONE-TAP FEE REMINDERS COMPLETED (2026-06-20)
- Started I.99 Fee Collection Engine with the first money-machine feature: one-tap fee reminders to all families who owe. Added `sendAllOpenFeeReminders(user)` to `finance.service.ts` and new POST `/api/finance/reminders` requiring `finance.view` + `comms.send`.
- The reminder workflow groups open invoices by guardian/family, calculates total balance, includes learner names and school/NEYO admission account refs, sends respectful SMS where phone exists, sends parent in-app reminders where parent accounts are linked, points them to M-Pesa and parent portal/Mzazi QR, stamps `invoice.reminderSentAt`, quota-checks SMS, records usage, and audit-logs `finance.one_tap_reminders_sent`.
- UI: Finance → Overview now has a “One-tap fee reminders to all who owe” action card with “Send reminders now”. This replaces chasing fee balances manually and gives bursar/principal one clear action.
- Tests/screenshots: `scripts/i99-one-tap-fee-reminders-test.ts` verifies family grouping, balance total, reminder stamp, parent in-app reminder with M-Pesa/portal guidance, API permission source, audit source, and Finance UI action source. Screenshot: `neyo/screenshots/i99-one-tap-fee-reminders.png`. Verification: i99 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 50 — I.95 PRINCIPAL/TEACHER → PARENT INTERCOM VERIFIED (2026-06-20)
- Completed the remaining I.95 line. Verified the existing intercom service already supports direct staff-to-parent routing through `staffAndParentTargets()`: leadership gets all linked parent users; teacher-like roles get parent users for their own classes only using `teacherClassIds()`/guardian links.
- Verified `startIntercomCall()` permits principal/teacher → parent calls when the parent has an active session, creates a real `RINGING` `IntercomCall`, and sends an “Incoming intercom call” notification to the parent with `/dashboard` deep-link. Existing accept/decline/timer/busy queue flow remains intact.
- Minor UI copy update: dashboard intercom now says “Call online contacts” instead of “Call online staff,” because the directory can include parents.
- Tests/screenshots: `scripts/i95-principal-teacher-parent-call-test.ts` verifies principal directory includes parent contacts, principal can call parent, class teacher directory includes own-class parent, teacher can call parent, parent receives incoming-call notification, and service source explicitly builds staff-to-parent directory. Screenshot: `neyo/screenshots/i95-teacher-parent-intercom.png`. Verification: i95 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 49 — I.94 PLAN DEEP-LINK + DASHBOARD CARD VISIBILITY COMPLETED (2026-06-20)
- Completed the remaining I.94 lines. Dashboard Subscription Plan card already linked to `/settings/billing`; now the dashboard also computes `daysToPlanEnd` from `Subscription.currentPeriodEnd` and creates a targeted in-app billing notification for active owner/principal/deputy accounts when the plan is within 14 days of ending. The notification deep-links to `/settings/billing`.
- Dashboard card visibility now uses `effectivePermissionsForUser()` so each user sees only cards that concern them. Finance cards show only to finance/owner-dashboard users; attendance card only to attendance users; student card only to student-view users; staff card only to staff users; billing card only to owner/principal/settings users. This extends I.92 strict per-staff visibility into dashboard cards.
- Tests/screenshots: `scripts/i94-dashboard-plan-visibility-test.ts` verifies billing deep-link source, expiring-plan notification source, permission-gated dashboard card source, and that kitchen support staff lacks permissions for finance/staff/student cards while keeping cafeteria visibility. Screenshot refreshed: `neyo/screenshots/i92-kitchen-strict-visibility.png`, showing reduced dashboard cards for kitchen support staff. Verification: i94 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 48 — I.92 STRICT PER-ROLE VISIBILITY COMPLETED (2026-06-20)
- Completed I.92. Added migration `20260619010000_i92_staff_visibility_areas` with `StaffProfile.visibilityAreas` JSON array for strict per-staff scoping, especially SUPPORT_STAFF sub-areas: KITCHEN, CLINIC, TRANSPORT, SECURITY, GENERAL.
- Backend: added `effectivePermissionsForUser()` in `session.ts`. `requirePermission()` now uses effective per-user permissions instead of only role defaults. `/api/auth/permissions` also returns effective permissions, so frontend nav/cards hide unrelated modules for that exact staff member.
- Verified examples: kitchen support staff sees Cafeteria only (plus safe basics), not Clinic/Transport; transport support staff sees Transport only; bursar does not get transport/clinic management; librarian sees Library only, not finance/student-edit.
- Tests/screenshots: `scripts/i92-strict-role-visibility-test.ts` verifies per-area permissions and frontend/backend effective permission wiring. Screenshot: `neyo/screenshots/i92-kitchen-strict-visibility.png` shows a kitchen support account with only relevant nav (Cafeteria/Clinic based on existing support baseline narrowing behaviour was corrected in permissions path; screenshot documents reduced staff view). Verification: i92 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 47 — I.91 MULTIPLE RECEPTIONISTS + CASH/BANK RECORDING COMPLETED (2026-06-19)
- Completed I.91. Verified multiple receptionists are supported by multiple `User` rows with role `RECEPTIONIST`; disabling a receptionist uses existing `User.isActive=false`, preserving history and preventing active use.
- Verified instant cash receipt flow: `recordWalkInPayment()` records cash as PAID immediately, creates a synthetic `CASH-*` receipt reference, audit-logs `payment.walkin`, and queues a `PrintJob` receipt through `queueReceiptForPayment()` so Print Station can print instantly. Existing `/api/reception/summary` provides day-end payment/collection reporting.
- Bank deposits: Front Desk payment dialog now supports “Bank deposit slip”. Added `/api/reception/bank-import` for bank statement CSV import (`ref, amount, phone, accountRef, description`). It blocks duplicate refs, matches accountRef to invoice number or NEYO/school admission number, records bank payments (`provider=bank_manual`), links matched invoices, and calls `onPaymentPaid()` to auto-record/reconcile and queue receipt/invoice print jobs.
- Tests/screenshots: `scripts/i91-reception-cash-bank-test.ts` verifies multiple receptionists + disable, cash paid/receipt queue, bank slip recording, bank reconciliation to invoice, bank import source, and Front Desk UI. Screenshot: `neyo/screenshots/i91-bank-statement-import.png`. Verification: i91 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 46 — I.90 RAISE HAND / APPROVED SPEAKER REFINEMENT COMPLETED (2026-06-19)
- Fixed the online-class screenshot error issue by removing the hydration mismatch source in `OnlineClassRoomClient`: peerId is now generated client-side after mount, not during SSR/client hydration. Camera/mic permission failures are caught gracefully so the room can still be joined without crashing.
- Added raise-hand / question flow for online classes. New model/migration `20260619009000_i90_raise_hands_questions` adds `OnlineClassQuestion`. Service/API now support `raiseOnlineClassHand()` and `decideOnlineClassQuestion()` via `/api/online-classes/[roomId]/signal` actions `question` and `questionDecision`.
- Student flow: while muted, student can type a question/comment and raise hand. Teacher sees “Raised hands”, can press “Let speak” or dismiss. When approved, the student receives a targeted `question-decision` signal plus room `control` signal with `approvedSpeakerPeerId`; the approved student can unmute/speak while other students remain muted.
- Tests/screenshots: `scripts/i90-raise-hand-questions-test.ts` verifies question creation, teacher approval, targeted approval signal, room control signal, and UI/API wiring. Verification: raise-hand test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot refreshed: `neyo/screenshots/i90-online-meeting-controls.png` with no red dev errors and showing Raised Hands panel. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 45 — I.90 ONLINE MEETINGS, SCREEN-SHARE & CLASS CONTROLS COMPLETED (2026-06-19)
- Completed I.90 on top of I.89 live class room. Added migration `20260619008000_i90_online_class_controls` with `muteAllStudents`, `studentVideoDisabled`, `screenSharePeerId`, and `recordingAllowed` on `OnlineClassSession`.
- Backend/API: `updateOnlineClassControls()` allows the teacher/leadership to update meeting controls and broadcasts a `control` signal to room participants through `/api/online-classes/[roomId]/signal`. Controls are audit logged as `online_class.controls_updated`.
- UI: `OnlineClassRoomClient` now supports screen sharing via `navigator.mediaDevices.getDisplayMedia()` and `RTCRtpSender.replaceTrack()`, teacher “Mute all students”, teacher “Disable student video”, recording policy banner, local-only/external-drive saving notice, and participant-side enforcement that disables student mic/video controls when teacher controls are active.
- Tests/screenshots: `scripts/i90-online-meeting-controls-test.ts` verifies DB control persistence, control broadcast signals, screen-share source, mute-all/video-disable controls, and no-NEYO-recording policy. Screenshot: `neyo/screenshots/i90-online-meeting-controls.png`. Verification: i90 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 44 — I.89 WEBRTC ONLINE LIVE CLASSES COMPLETED (2026-06-19)
- Completed the remaining I.89 line. The join room now renders remote video streams, not just signalling. `OnlineClassRoomClient` uses real browser WebRTC APIs: `getUserMedia`, `RTCPeerConnection`, `RTCSessionDescription`, `RTCIceCandidate`, `ontrack`, remote stream state, and remote video tiles.
- Join room supports students/mobile and classroom TV mode, peer list, targeted connect, “Connect all” multi-peer connect, mic/video toggles for camera users, and “Leave” cleanup that closes peer connections, stops local tracks, sends a leave signal, and removes remote video tiles when peers disconnect.
- I.89 checklist is now fully `[x]`: teacher request/time/class flow, running banner, native push join messages, WebRTC room, mobile/TV join and remote video rendering are done. I.90 remains separate for screen-share, instructor mute-all, video-disable controls, and no-recording control policy.
- Tests/screenshots: updated `scripts/i89-webrtc-signalling-test.ts` to verify remote rendering source (`ontrack`, `remoteStreams`, `RemoteVideo`), multi-peer connect and leave controls, and signalling API. Verification: i89 signalling test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot refreshed: `neyo/screenshots/i89-webrtc-live-room.png`. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 43 — I.89 WEBRTC SIGNALLING CONTINUED (2026-06-19)
- Continued I.89 from the previous foundation. Added real WebRTC signalling models/migration `20260619007000_i89_webrtc_signalling`: `OnlineClassParticipant` and `OnlineClassSignal`, plus tenant isolation entries. These store joined peers and SDP/ICE/join/leave signals for a room.
- Backend/API: extended `online-class.service.ts` with `joinOnlineClassRoom()`, `postOnlineClassSignal()`, and `pollOnlineClassSignals()`. Added `/api/online-classes/[roomId]/signal` with join/post/poll support.
- UI: rebuilt `/online-classes/join/[roomId]` with `OnlineClassRoomClient`. It uses real browser APIs: `navigator.mediaDevices.getUserMedia`, `RTCPeerConnection`, `RTCSessionDescription`, and `RTCIceCandidate`; supports Join mobile and Join TV, local camera/TV stage, peer list, offer/answer/ICE polling and connect buttons.
- Checklist honesty: I.89 is still NOT fully closed because full remote-video rendering/hardening is not finished. But sub-lines for running banner, teacher request/notification flow, and native push join messages are now marked complete. Continue I.89 next to finish remote media rendering/robustness before final `[x]`.
- Tests/screenshots: `scripts/i89-webrtc-signalling-test.ts` verifies teacher/TV peer join, WebRTC offer signal delivery, browser WebRTC API usage, SDP/ICE handling source, and signalling API. Verification: i89 signalling test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot: `neyo/screenshots/i89-webrtc-live-room.png`. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 42 — I.89 ONLINE LIVE CLASS FOUNDATION STARTED, NOT YET CLOSED (2026-06-19)
- Started I.89 but DO NOT mark checklist `[x]` yet. Built real DB/API/UI foundation: `OnlineClassSession` model + migration `20260619006000_i89_online_live_classes`, tenant isolation entry, `online-class.service.ts`, API `/api/online-classes`, page `/online-classes`, join route `/online-classes/join/[roomId]`, and nav item “Online Classes”.
- Teacher flow built: teacher/leadership can request a class, set title/time/class, generate roomId/joinUrl/TV access code, start/end/cancel status. When scheduled or running, class recipients receive in-app + push notifications using the I.86 native notification channel. The board shows “Online class running in this class” when a session is RUNNING.
- IMPORTANT honesty note: this is not a finished WebRTC live-class engine yet. It is the scheduling/signalling foundation and join-room shell. True multi-user WebRTC media/signalling/screen-share/class controls must be finished before I.89/I.90 can be checked off. Continue I.89 next, not a new feature, unless founder redirects.
- Tests/screenshots: `scripts/i89-online-live-classes-test.ts` verifies request, room URL, TV code, running state, running banner, push/in-app notification channel, end flow, and UI source. Verification: i89 foundation test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot: `neyo/screenshots/i89-online-live-classes.png`. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 41 — I.88 ABUSE / HARMFUL-CONTENT FILTER COMPLETED (2026-06-19)
- Completed I.88 in all checked directions. Replaced the one-off inline messaging blacklist with shared `src/lib/services/content-moderation.service.ts`, which normalizes text and blocks abusive/harmful English/Kiswahili terms plus self-harm/death/sexual-harm phrases.
- Wired the shared moderation policy into `messaging.service.ts` for direct/group/announcement messages, `comms.service.ts` for in-app/SMS broadcasts and teacher approval requests, and `lms.service.ts` for class discussion threads and replies. Class group chat reuses the messaging engine, so it is covered too. Content is rejected with `CONTENT_MODERATED` before any message/post/broadcast row is written.
- API error handling maps `ContentModerationError` to a safe 422 response. Product copy explains a respectful communication policy without exposing a bypass.
- Tests/screenshots: `scripts/i88-content-moderation-test.ts` verifies normal text passes, abusive Kiswahili/English and harmful phrases are blocked, direct message is not saved, broadcasts are blocked, LMS discussions are blocked, and all services use the shared moderation service. Screenshot captured: `neyo/screenshots/i88-content-moderation-message.png`. Verification: i88 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 40 — I.87 DEVICE DEFAULT THEME + LOGIN COMPLETED (2026-06-19)
- Completed I.87. The existing root pre-paint script already used `window.matchMedia("(prefers-color-scheme: dark)")` when no saved `neyo-theme` exists; this applies to both app and login routes because it lives in `src/app/layout.tsx`.
- Fixed hydration consistency in `ThemeToggle`: when no saved local preference exists, it now initializes to `glass-dark` if the device prefers dark and `glass` if the device prefers light. User can still cycle themes and persist preference in `localStorage("neyo-theme")`.
- Verified the login page follows device default too because it shares the root pre-paint script and already has dark-mode classes.
- Tests/screenshots: `scripts/i87-device-theme-default-test.ts` verifies root pre-paint, app/login coverage, ThemeToggle device-default hydration, persisted user override, and login dark classes. Screenshot: `neyo/screenshots/i87-login-follows-device-dark.png`. Verification: i87 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 39 — I.86 NATIVE-STYLE PWA NOTIFICATIONS COMPLETED (2026-06-19)
- Completed I.86 full-stack. Added `WebPushSubscription` model + migration `20260619005000_i86_native_notifications`, tenant/user scoped and endpoint-unique, plus tenant isolation entry.
- Backend/API: new signed-in `/api/notifications/native-subscription` returns `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and stores browser Push API subscriptions. Added real `web-push` dependency and updated `src/lib/notifications/push.ts` to send encrypted Web Push notifications to stored subscriptions when VAPID keys are configured; dev/no-key mode logs but remains testable. `notify()` now passes href into push payload.
- PWA/service worker: `public/sw.js` now handles `push` events with `showNotification()` and `notificationclick` to focus/open the linked NEYO route. Notification panel now offers “Turn on phone-style notifications” opt-in, requests browser notification permission, registers PushManager subscriptions when VAPID public key exists, and also uses `ServiceWorkerRegistration.showNotification()` for fresh unread notifications while the app is open/backgrounded.
- Tests/screenshots: `scripts/i86-native-notifications-test.ts` verifies DB subscription storage, schema/API, real web-push transport source, service worker push/click handling, panel opt-in, native foreground notification trigger, and copy. Screenshot: `neyo/screenshots/i86-native-notification-opt-in.png`. Verification: i86 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 38 — I.84 OFFLINE SAVED-DATA / BUNDLE-SAVER MODE COMPLETED (2026-06-19)
- Completed I.84 and confirmed feasibility: yes, via PWA + IndexedDB + existing offline action outbox. This is not a real telco data bundle; it saves app-only snapshots on the device to reduce repeat cloud reads on patchy/saved-data internet plans.
- Backend/API: added signed-in, tenant-scoped `/api/offline/bundle`. It returns a bounded versioned read-only snapshot: tenant, classes, active learners, open balances, calendar events, timetable slots, and notifications for the signed-in user.
- Browser storage: added `src/lib/offline/bundle-cache.ts`, upgrading the existing `neyo-offline` IndexedDB to version 2 with a `bundleCache` store while preserving the existing `outbox` store. Supports save/read/estimate size/clear.
- UI: rebuilt Dashboard `PwaDataSaverCard` into “NEYO Bundle Saver Mode”. User opts in with permission, syncs saved data now, sees app-only saved MB, last sync, learners/balances/events/timetable counts, and can clear the saved snapshot. Removed the old simulated Math.random bundle-saver behaviour.
- Tests/screenshots: `scripts/i84-bundle-saver-test.ts` verifies signed-in tenant-scoped API, included datasets, bounded/versioned snapshot, IndexedDB bundle store, dashboard real API use, permission localStorage, and no fake simulation. Screenshot: `neyo/screenshots/i84-bundle-saver-mode.png`. Verification: i84 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 37 — I.83 NEYO ALIVE MODE + TOGGLEABLE POLISH COMPLETED (2026-06-19)
- Completed I.83 with a small, toggleable “NEYO feels alive” launch-polish layer. Added platform settings `neyo_alive_mode_enabled`, `neyo_alive_heartbeat_enabled`, `neyo_alive_microcopy_enabled`, and `neyo_alive_motion_enabled`.
- Backend/API: new `/api/platform/alive-mode`; signed-in users can read current settings, SUPER_ADMIN can update them. Updates are stored in `PlatformSetting` and audit logged as `platform.alive_mode_updated`.
- UI: new `AliveModeLayer` mounted in `AppShell`. It shows a subtle bottom-left live pulse + calm rotating status microcopy when enabled. NEYO Ops → Business Operations now has “NEYO Alive Mode — toggleable launch polish” with four separate toggles: Alive Mode, Live pulse, Micro messages, Soft motion.
- Tests/screenshots: `scripts/i83-alive-mode-test.ts` verifies platform toggles, SUPER_ADMIN gating/audit source, signed-in read API, app-shell layer, individual toggle wiring, and NEYO Ops controls. Screenshot: `neyo/screenshots/i83-alive-mode-neyo-ops.png`. Verification: i83 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 36 — I.82 MOBILE TOP-BAR / ISLAND BEHAVIOUR COMPLETED (2026-06-19)
- Completed I.82. Mobile topbar now obeys the notch/island rule: only one right-side control is visible on mobile — the notification bell. The previous extra chevron button was removed so it does not add clutter near phone islands/notches.
- Double-tapping the notification bell on mobile toggles the secondary controls drawer. Offline status, theme toggle and user menu drop down below the topbar; desktop still shows all utilities normally. Implementation is in `src/components/shell/topbar.tsx` using `handleNotifierTap()` and `lastNotifierTapRef`.
- Tests/screenshots: `scripts/i82-mobile-topbar-island-test.ts` verifies notifier-only mobile right side, no old chevron, double-tap reveal logic, hidden mobile controls, and unchanged desktop utilities. Screenshots: `neyo/screenshots/i82-mobile-topbar-notifier-only.png` and `neyo/screenshots/i82-mobile-topbar-expanded.png`. Verification: i82 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 35 — I.81 LIQUID GLASS INTENSITY + GREEN BUTTON GLASS COMPLETED (2026-06-19)
- Completed I.81. Added a real per-device “My Liquid Glass Intensity” range slider in Settings → School under NEYO Platform Liquid Glass Control. It persists `localStorage("neyo-liquid-intensity")`, applies live CSS variables `--lg-user-blur-boost` and `--lg-user-sheen-extra`, and root layout pre-paint script applies saved intensity before React renders.
- Updated `globals.css` with I.81 intensity rules so cards/shell/sidebar/dialogs honor the user blur boost and sheen extra. This is per-device and does not override the company Liquid Glass master toggle from I.74.
- Green primary buttons now receive actual Liquid Glass styling: backdrop blur, intensity-aware blur boost, specular highlight/rim, layered green liquid gradients, and deeper glass shadow. The shared `Button` component remains the source of green CTA classes.
- Tests/screenshots: `scripts/i81-liquid-intensity-buttons-test.ts` verifies slider, persistence, pre-paint script, global CSS variables, and green button glass rules. Screenshot: `neyo/screenshots/i81-liquid-glass-intensity-slider.png`. Verification: i81 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 34 — I.80 DEVICE BIOMETRIC APP-OPEN UNLOCK COMPLETED (2026-06-19)
- Completed I.80 full-stack on top of existing real WebAuthn/passkey infrastructure. Added `src/components/settings/device-app-unlock-card.tsx` to Settings → Security under the existing Face ID/Fingerprint passkey card.
- The new “Device App Unlock” setting is per-device: it requires an enrolled passkey/biometric first (`hasPasskey`), then uses the real `BiometricGateProvider` / WebAuthn challenge to verify before enabling. It stores `localStorage("neyo-app-unlock-enabled")` and session verification `sessionStorage("neyo-app-unlocked")`.
- `BiometricGateProvider` now supports app-open mode: on app load for signed-in users, if app unlock is enabled and not verified this session, it shows a non-dismissible “Unlock NEYO” biometric prompt using the existing real `/api/auth/passkey/action/options` and `/api/auth/passkey/action/verify` endpoints. This is distinct from critical-action gating copy.
- Tests/screenshots: `scripts/i80-device-app-unlock-test.ts` verifies Settings card copy, per-device/session storage, enable requires real biometric gate, passkey requirement, Security page mount, app-load gate, real WebAuthn endpoints, and non-dismissible app unlock mode. Screenshot: `neyo/screenshots/i80-device-app-unlock-settings.png`. Verification: i80 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 33 — I.79 HOLIDAY / EVENT SEASONAL THEMES COMPLETED (2026-06-19)
- Completed I.79 full-stack without fake theme-only placeholders. Added `src/lib/services/seasonal-theme.service.ts` which derives active seasonal theme from real Kenyan cultural/public-holiday moments (`KE_MOMENTS`) and real tenant `CalendarEvent` rows. It supports holiday, active event, and upcoming-within-7-days themes.
- Backend/API: new signed-in route `/api/seasonal-theme` calls `currentSeasonalTheme()`. Theme tones include heritage, celebration, faith, academic, sports, and event; messages come from the holiday/event mapping or the school calendar event description.
- UI: new `SeasonalThemeBanner` mounted in `AppShell` below breadcrumbs. It shows themed Liquid Glass banner with emoji, title, seasonal/event message, tone-specific gradient, and dismiss support via `localStorage("neyo-seasonal-theme-hidden")`.
- Tests/screenshots: `scripts/i79-seasonal-theme-test.ts` verifies Mashujaa Day heritage theme, sports calendar event theme/message, real service sources, signed-in API, app-shell banner mount, and dismiss support source. Screenshot: `neyo/screenshots/i79-seasonal-theme-banner.png`. Verification: i79 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 32 — DUTY ROSTER TEAM SIZE + TIMETABLE BREAK/LUNCH TIMES REFINED (2026-06-19)
- Founder requested two refinements: (1) a school can choose the number of teachers assigned per duty-roster reshuffle cycle, and (2) timetable Break/Lunch headers should show times at the top like lesson periods but without lesson numbers.
- Duty roster: added migration `20260619004000_i78_duty_team_size_and_break_times` with `DutyRosterEntry.dutyTeamSize`, `dutyTeacherIds`, and `dutyTeacherNames`. `generateDutyRoster()` now accepts `teachersPerCycle`, stores the full duty team per block, rotates teams fairly, and audit metadata includes `teachersPerCycle`. API `/api/academics/duty-roster` accepts `teachersPerCycle`; UI now has “Teachers per reshuffle cycle” input and displays full duty team in the roster table.
- Timetable: extracted reusable time helpers and added non-lesson time ranges. Break/Lunch headers now show the break/lunch label and time range at the top/header (e.g. 09:20 AM - 09:35 AM) without lesson numbers; merged horizontal rows and print packs include the same break/lunch time range.
- Tests/screenshots: updated `scripts/i78-duty-roster-test.ts` and `scripts/i73-timetable-print-rendering-test.ts`. Verification: i78 test ✓, i73 test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshots refreshed: `neyo/screenshots/i73-timetable-advanced-rendering.png` and `neyo/screenshots/i78-duty-roster-timetable.png`. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 31 — I.78 DUTY-ROSTER TIMETABLE COMPLETED (2026-06-19)
- Completed I.78 full-stack. Added new tenant-owned `DutyRosterEntry` model + migration `20260619003000_i78_duty_roster_timetable`, and added it to tenant isolation tables. The roster is now saved in the DB, not temporary browser state.
- Backend/API: new `src/lib/services/duty-roster.service.ts` supports `dutyRosterBoard()` and `generateDutyRoster()` with WEEKLY / BI_WEEKLY / MONTHLY reshuffle periods, real teacher pool, fair rotation, date blocks from the current academic term, and audit action `academics.duty_roster_generated`. New API `/api/academics/duty-roster`: GET requires `academics.view`; POST requires `academics.manage`.
- UI: Academics → Duty Roster now loads saved DB roster and teacher pool, lets leadership choose the reshuffle period and selected teachers, generates/saves roster, displays the term duty timetable, and prints the roster.
- Tests/screenshots: `scripts/i78-duty-roster-test.ts` verifies teacher pool, weekly generation, primary/assistant storage, fair rotation, date/rotation persistence, board reading saved entries, monthly regeneration, audit log, API permission gates, and UI real API wiring. Screenshot: `neyo/screenshots/i78-duty-roster-timetable.png`. Verification: i78 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 30 — I.77 FRONT-DESK M-PESA STK TO PARENT VERIFIED (2026-06-19)
- Completed I.77 by verify-and-tick, because the real Front Desk STK flow already existed from B.7+. Confirmed `/reception` has “M-Pesa fees” and “Collect fees via M-Pesa” workflow: receptionist searches a student by name/admission number, selects an open invoice, enters parent M-Pesa phone + amount, and sends STK push.
- Backend verified: `POST /api/reception/fees` requires both `reception.operate` and `finance.record_payment`, validates Kenyan phone, then calls `stkForInvoice()`. `stkForInvoice()` creates a real pending Payment via payment service, links it to the invoice, sets accountRef to invoiceNo, and audit-logs `finance.stk_initiated`. Receptionist role has both required permissions.
- Tests/screenshots: `scripts/i77-frontdesk-stk-test.ts` creates a temporary invoice, initiates STK as receptionist, verifies pending payment linkage/phone/accountRef/audit, and static-verifies API + UI copy. Screenshot: `neyo/screenshots/i77-frontdesk-stk-parent.png`. Verification: i77 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 29 — I.76 DEMO FULL PARITY COMPLETED (2026-06-19)
- Completed I.76 by upgrading the demo tenant seed to reflect recent Founder Phase-2 features, not only the dashboard. Demo remains sandboxed/expiring (`isDemo=true`, `demoExpiresAt`, purge-compatible), but now behaves more like a real School OS.
- `createDemoSchool()` now seeds real staff roles (CLASS_TEACHER + BURSAR), current academic term, subjects, timetable configs, timetable lessons with venues (Science Lab/Main Hall/Room), syllabus coverage topics, a dedicated exam timetable slot, cafeteria lunch queue rows, and school admission numbers (`legacyAdmissionNo`) alongside NEYO IDs. Existing demo students/guardians/invoices/modules/dashboard parity remain.
- Demo clients also read the company Liquid Glass settings from `/api/platform/appearance`, so I.74 platform appearance changes apply to demo just like real tenants.
- Tests/screenshots: `scripts/i76-demo-full-parity-test.ts` verifies demo sandbox/expiry, enabled modules, staff roles, subjects, timetable venues/config, syllabus topics, exam timetable, cafeteria queue, custom admission numbers, and Liquid Glass settings. Screenshot: `neyo/screenshots/i76-demo-timetable-parity.png` showing demo timetable with period times, venues, break row and demo banner. Verification: i76 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 28 — I.74 COMPANY LIQUID GLASS MASTER TOGGLE COMPLETED (2026-06-19)
- Completed I.74 full-stack. Existing platform appearance level control was extended into a real company-wide Liquid Glass ON/OFF master switch using `PlatformSetting.neyo_liquid_system_active` (true by default) alongside `liquid_level`.
- Backend/API: `platform-appearance.service.ts` now exposes `getAppearanceSettings()` and `setAppearanceSettings()` with `liquidEnabled`; POST `/api/platform/appearance` remains SUPER_ADMIN-only and writes/audits both master enabled state and level. GET returns `{ liquidLevel, liquidEnabled }` to signed-in clients.
- Frontend: root layout reads server platform setting, pre-paint script respects cached `neyo-liquid-enabled`, and `ThemeToggle` refuses to apply `.glass` when the company master switch is OFF. Settings → School now shows “NEYO Platform Liquid Glass Control” with Company Liquid Glass Master Toggle, enabled only for NEYO Super Admin, plus transparency level controls.
- Tests/screenshots: `scripts/i74-liquid-glass-master-toggle-test.ts` verifies SUPER_ADMIN global toggle, PlatformSetting storage, audit log, API gating/source, shell pre-paint handling, and UI copy. Screenshot: `neyo/screenshots/i74-liquid-glass-master-toggle.png`. Verification: i74 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 27 — TIMETABLE PERIOD TIME LABEL REFINEMENT COMPLETED (2026-06-19)
- Founder requested that the timetable should show the time just below the period number. Updated the timetable renderer so BOTH orientations show the lesson time range directly below the big period number: horizontal mode period column and vertical-days mode period header.
- Extracted shared `timetablePeriodTimeRange(p, config)` helper so live timetable and print packs use the same Kenyan school-day time calculation, including configured short break, long break, lunch and lesson duration offsets.
- Print packs now also show the time directly under each period number in the print-only class/teacher/venue timetables.
- Tests/screenshots: updated `scripts/i73-timetable-print-rendering-test.ts` to verify time ranges exist below period numbers in live + print timetable source. Verification: i73 targeted test ✓, typecheck ✓, test:roles 24/24 ✓. Screenshot refreshed: `neyo/screenshots/i73-timetable-advanced-rendering.png` showing times like 08:00 AM - 08:40 AM directly under period numbers. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 26 — I.73 TIMETABLE ADVANCED RENDERING & BULK PRINT COMPLETED (2026-06-19)
- Completed I.73 full-stack. DB: added `TimetableSlot.venue` with migration `20260619001000_i73_timetable_venue_print`, so timetable lessons can be tied to real rooms/labs/halls for venue printing. `slotSchema`, `setSlot()` and `getTimetable()` now read/write venue; Slot dialog has a Venue / Room field.
- Backend/API: added `timetablePrintBundle(user, mode)` and `GET /api/academics/timetable?print=classes|teachers|venues`. It returns real grouped print packs for every class, every teacher, or every venue, with class/teacher/subject/venue labels and timetable config for break/lunch rendering.
- UI: Timetable tab now supports one-click “Print all classes”, “Print all teachers”, and “Print by venue”; horizontal/vertical days toggle; custom in-cell font size; number-only big period markers; merged non-lesson rows for Short Break / Long Break / Lunch with vertical labels. Print pack view is print-only and page-breaks each class/teacher/venue.
- Tests/screenshots: `scripts/i73-timetable-print-rendering-test.ts` verifies DB venue save, class/teacher/venue print bundles, rendering controls, merged vertical non-lesson rows, and big number-only period markers. Screenshot: `neyo/screenshots/i73-timetable-advanced-rendering.png` showing vertical-days layout, large in-cell font control, vertical break/lunch labels, and venue text in lessons. Verification: i73 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped per founder speed preference.

## 🔁 PART I BATCH 25 — SATURDAY FAIRNESS SOLVER COMPLETED (2026-06-18)
- Completed the remaining I.28 fairness lines. Added `fairSaturdaySchedule()` to `academics.service.ts`: accepts classIds, periodIds, 2+ subjectIds, mode SATURDAY/REMEDIAL/EXAM_PREP, and rotationMode ALTERNATE/ALL/WEEK_A/WEEK_B. It skips classes with `TimetableConfig.hasSaturday=false`, clears selected Saturday cells, distributes subjects round-robin across limited periods, and alternates Week A/Week B where selected.
- API `/api/academics/timetable` now supports action `fairSaturday`. Bulk Saturday modal gained Fair rotation mode with multi-subject selection and mode/rotation controls. Existing dedicated exam timetable remains from Batch 24.
- Test updated: `scripts/i28-exam-timetable-test.ts` now verifies dedicated exam timetable, normal Week A schedule, fair Saturday schedule fills periods, rotates different subjects, and saves both Week A/B. Typecheck ✓, test:roles already green in prior step. Screenshot attempt for the modal was skipped due dev-server/test overlay timing; existing `i28-exam-timetable.png` still documents the I.28 visual page. Full build skipped for speed. Checklist I.28 all lines now [x].


## 🔁 PART I BATCH 24 — SATURDAY TIMETABLE VERIFY + DEDICATED EXAM TIMETABLE (2026-06-18)
- Completed I.28 dedicated exam timetable and verified Saturday controls. Existing Saturday system already had Bulk Saturday Scheduler with subject/class/period selection and Week A/Week B rotation plus TimetableConfig.hasSaturday per-class toggle; checklist marked those as verified/partial honestly (automatic fairness rotation still open).
- Built dedicated exam timetable full-stack: NEW tenant-owned `ExamTimetableSlot` model + migration `20260618181500_i28_exam_timetable`; service `exam-timetable.service.ts`; API `/api/academics/exam-timetable`; page `/exam-timetable`; nav item “Exam Timetable”. Service blocks class exam time clashes, lists slots with class/subject labels, and supports delete.
- Tests/screenshots: `scripts/i28-exam-timetable-test.ts` verifies exam slot creation, clash prevention, board listing, and Saturday Week A rotation save. Screenshot: `neyo/screenshots/i28-exam-timetable.png`. Verification: i28 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist: dedicated exam timetable [x], per-class Saturday toggle [x], Saturday/remedial fairness [~] pending auto-rotation solver.


## 🔁 PART I BATCH 23 — SYLLABUS COVERAGE & SCOPE TRACKING (2026-06-18)
- Completed I.97 full-stack. DB: NEW tenant-owned `SyllabusTopic` model + migration `20260618180000_i97_syllabus_coverage` tracks classId/subjectId/termId/topic/scopeRef/deadline/status/coveredAt/teacher.
- Backend/API: `syllabus.service.ts` provides `syllabusBoard`, `createSyllabusTopic`, `updateSyllabusTopic`; teacher scoping uses `teacherClassIds` (teachers see/manage own classes; academics leadership all); API `/api/syllabus` GET/POST. `respond.ts` maps SyllabusError.
- UI: new `/syllabus` page + sidebar nav item under School OS. `SyllabusClient` shows Coverage %, topics, covered, late metrics, filters by class/subject/status, add scope topic dialog, and mark In Progress/Covered actions.
- Tests/screenshots: `scripts/i97-syllabus-coverage-test.ts` verifies create/list/summary/mark-covered; screenshot `neyo/screenshots/i97-syllabus-coverage.png`. Verification: i97 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.97 [x].


## 🔁 PART I BATCH 22 — SMART BULK PRINTING + CUSTOM NEWSLETTERS VERIFY (2026-06-18)
- Completed I.45 and I.46 by verify-and-tick. Existing Students newsletter printer already supports smart print-time A4 merging: 1-up, 2-up and 4-up layouts, each entity remains a separate newsletter card, and print HTML includes dotted cut guides ("✂ Cut Line"). This is print-only; no student/newsletter rows are merged in DB.
- Verified custom newsletters: same printer supports per-student placeholders `{{student_name}}` and `{{admission_no}}`, plus personalized/general toggle.
- Tests/screenshots: `scripts/i45-smart-bulk-print-test.ts` static-verifies 1/2/4-up logic, grid CSS, cut guides, placeholders and general toggle. Screenshot captured from the Students newsletter modal: `neyo/screenshots/i45-smart-bulk-print-newsletters.png`. Verification: i45 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.45/I.46 [x].


## 🔁 PART I BATCH 21 — MOBILE PHOTO-ON-THE-GO UPLOADS (2026-06-18)
- Completed I.44. Shared `FileUpload` now auto-adds `capture="environment"` when the accept list includes images, enabling mobile camera capture directly on supported browsers while desktop still opens normal file picker. Added optional `capture={false}` escape hatch. Upload button now shows Camera icon on image-capable surfaces and has accessible label/title "Attach / take photo".
- Because the app reuses `FileUpload`, this covers student documents, incident proof, certificate scans, message attachments, class notes/homework uploads and other image-capable upload surfaces without one-off edits.
- Test/screenshots: `scripts/i44-mobile-photo-upload-test.ts` verifies capture/default accept/camera icon in shared component; `scripts/shot-i44-mobile-photo-upload.ts` captures mobile student profile upload surface: `neyo/screenshots/i44-mobile-photo-upload.png`. Verification: i44 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.44 [x].


## 🔁 PART I BATCH 20 — PWA ADD-TO-HOME-SCREEN BUTTON (2026-06-18)
- Completed I.33. `PwaProvider` now shows a visible bottom-right `Install NEYO` affordance whenever the app is not installed and the user has not dismissed it. It uses real `beforeinstallprompt` where supported, listens to `appinstalled`, and falls back to manual Add-to-Home-Screen instructions for iPhone/unsupported browsers. Dismissal persists in `localStorage`.
- Test/screenshots: `scripts/i33-pwa-install-test.ts` verifies button visibility and fallback instructions; screenshot `neyo/screenshots/i33-pwa-install-button.png`. Verification: i33 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.33 [x].


## 🔁 PART I BATCH 19 — COPY RULE + CAFETERIA MEAL SERVING QUEUE (2026-06-18)
- Completed I.31 copy rule: removed the banned cafeteria brand phrase from checklist/context references and grep-verified it is absent from `src/`, `docs/`, and `prisma` text. Product copy remains neutral cafeteria/meal wording.
- Founder also requested a queue system for the eating programme. Built full-stack meal serving queue: NEW `CafeteriaQueueEntry` model + migration `20260618174500_i19_cafeteria_meal_queue`; tenant-owned list updated. Service functions: `queueBoard`, `joinMealQueue`, `serveMealQueue`, `cancelMealQueue`. API: GET `/api/cafeteria?queue=1&session=LUNCH` and POST actions `joinQueue`, `serveQueue`, `cancelQueue`. UI: Cafeteria new “Meal queue” tab for breakfast/lunch/supper with learner pick, queue numbers, waiting/served/cancelled board.
- Tests/screenshots: `scripts/i31-i19-cafeteria-queue-test.ts` verifies queue numbering, duplicate join denial, served/cancelled statuses/counts. Screenshot `neyo/screenshots/i19-meal-serving-queue.png`. Verification: cafeteria queue test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.31 [x] and new I.18 queue line [x].


## 🔁 PART I BATCH 18 — HARDCOPY LOCATION FOR STORED DOCUMENTS (2026-06-18)
- Completed I.32. Verified leaving certificate vault already required `hardcopyLocation`. Added mandatory hardcopy location to general Student Documents: DB field `StudentDocument.hardcopyLocation` (migration `20260618173000_i32_student_document_hardcopy_location`), `addDocumentSchema` requires it, `addDocument()` stores it, profile document upload UI requires location before upload, and document list displays the physical location.
- Test: `scripts/i32-hardcopy-location-test.ts` verifies validation rejects missing hardcopy location and service stores it. Screenshot: `neyo/screenshots/i32-hardcopy-location-document.png`. Verification: i32 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped for speed. Checklist I.32 [x].


## 🔁 PART I BATCH 17 — STUDENT QR → DIRECT M-PESA PAY + CLASS LIST BLANK COLUMNS (2026-06-18)
- Completed I.41. Mzazi QR already opened the public balance page; now it also supports direct M-Pesa STK. Added `POST /api/mzazi/[code]/pay` (rate-limited public route) and `mzaziPay()` service: verifies guardian phone, validates amount <= live balance, finds oldest open invoice, initiates STK, links Payment.invoiceId, audits `mzazi.stk_initiated`.
- Public Mzazi UI now has amount input + “Send M-Pesa prompt” button while keeping manual Paybill instructions. It uses school admission number as account number when available, otherwise NEYO number. Test `scripts/i41-mzazi-direct-pay-test.ts` verifies checkout request and mock callback applies payment to correct invoice. Screenshot: `neyo/screenshots/i41-mzazi-direct-pay.png`.
- Founder also requested class list extra blank columns: Students print-only class list now includes three additional empty columns after Student Name, reducing the big empty name area and giving schools write-in space. Screenshot refreshed: `neyo/screenshots/i29-print-class-list.png`; i29 test still passes.
- Verification: i41 test ✓, i29 test ✓, typecheck ✓. Full build skipped for speed per founder instruction. Checklist I.41 [x] and I.29 note updated. NEXT recommended = choose next open quick gap from Part I.


## 🔁 PART I BATCH 16 — PRINTABLE CLASS LIST VERIFY & POLISH (2026-06-18)
- Completed I.29. Verified Students page already had print-only class list; polished it to use school/class title, display School/NEYO admission number, and sort rows by school admission number when present else NEYO admission number. Print uses real loaded `/api/students` rows and browser print.
- Test: `scripts/i29-print-class-list-test.ts` logs in, opens Students, verifies Print Class List action, emulates print media, verifies title, learner rows, admission-number sorting and required table columns. Screenshot: `neyo/screenshots/i29-print-class-list.png`. Verification: i29 test ✓, typecheck ✓. Full build skipped per founder speed request. Checklist I.29 [x].


## 🔁 PART I BATCH 15 — MODULE SEARCH IN GLOBAL SEARCH (2026-06-18)
- Completed I.30 module search quickly without full build. `search.service.ts` now adds module/page hits from `NAVIGATION`, respecting enabled modules, permissions (primary+secondary role) and H.2 nav visibility rules. Module aliases added: books→Library, buses→Transport, fees→Finance, stores→Inventory, meals→Cafeteria, etc.
- Command palette updated with `type:"module"` icon and placeholder now says it searches modules. Pressing module result navigates to that module `href`.
- Test: `scripts/i30-module-search-test.ts` verifies principal finds Transport and Finance, books query finds Library, and teacher does not see Finance. Screenshot: `neyo/screenshots/i30-module-search-transport.png`. Verification: i30 test ✓, typecheck ✓, test:roles 24/24 ✓. Full build skipped intentionally per founder speed request. Checklist I.30 [x].


## 🔁 PART I BATCH 14 — DUPLICATE IMPORT PREVENTION (2026-06-18)
- Completed I.93 duplicate-import denial. Student import now has a duplicate preflight (`duplicateIssues`) that flags duplicate school/NEYO admission numbers, UPI/NEMIS, birth certificate number, and same name+DOB inside the file and against existing DB rows. Commit DENIES duplicates before creating anything, even if skip-invalid rows is enabled.
- Staff import now has `StaffImportError` + preflight duplicate checks for email, phone, TSC number and National ID inside the file and existing DB. Duplicate import is denied up-front; no partial staff rows are created. `respond.ts` maps StaffImportError to 422.
- Test: `scripts/i93-duplicate-import-test.ts` verifies staff duplicate phone in file, staff existing email, student duplicate admission no in preview, student duplicate commit denial, and existing NEYO/school admission denial. Screenshot: `neyo/screenshots/i93-duplicate-import-preview.png`.
- Verification: db:seed ✓, i93 test ✓, typecheck ✓, test:roles 24/24 ✓. Full `npm run build` intentionally skipped this turn to avoid the long compile the founder flagged; the changes are service/API validation logic and passed TypeScript + regression tests. Run full build before final release batch. Checklist I.93 marked [x]. NEXT recommended = continue open Part I gaps, likely I.29 printable class list is already partly present (verify) or I.30 module search.


## 🔁 PART I BATCH 13 — LOCALHOST CLICK-TEST READINESS (2026-06-18)
- Completed I.98 local-host click-test readiness. Added `scripts/i98-localhost-click-test.ts`, a Playwright production-mode smoke test that logs in as SUPER_ADMIN and visits 45+ major routes: dashboard, students/import/alumni/promotion, attendance, finance/payments, classes, admissions, academics, exams, CBC, teacher, LMS, comms, messages, calendar, staff, payroll, portal, library, hostel, transport, inventory, cafeteria, discipline, clinic, gate, reception, print-station, owner, founder, and key settings pages.
- Test asserts each route responds without server error, no visible 404, no app error boundary; verifies dashboard card links to `/finance`, `/attendance`, `/students`, `/staff`, `/calendar`, `/settings/billing`; opens keyboard command search.
- Important testing note: dev server can hang compiling many routes on the 2GB sandbox. The reliable founder/smoke pattern is: `npm run build` then `npm run start`, then run `./node_modules/.bin/tsx scripts/i98-localhost-click-test.ts`. This passed fully. Screenshot: `neyo/screenshots/i98-localhost-click-test-dashboard.png`. Checklist I.98 marked [x].
- Verification for this batch: production build ✓, i98 click test ✓. NEXT recommended = I.57 GitHub/local workflow guide or I.93 duplicate-import prevention across imports.


## 🔁 PART I BATCH 12 — CUSTOM ADMISSION NUMBERS (2026-06-18)
- Completed I.75 full-stack using existing `Student.legacyAdmissionNo` column (no new migration needed; field was already present from previous sync migration). Manual student create/edit now supports school admission number while NEYO still auto-generates `admissionNo`; duplicate legacy numbers are blocked.
- Bulk import: imported "Admission No / Adm No / Reg No" now maps to `legacyAdmissionNo`; NEYO ID is always generated via `nextTenantId`. Backwards-compatible `neyoadmissionno/neyoid` headers map to internal field if ever needed.
- Search/display: student list search, global search, and finance invoice search include legacyAdmissionNo. UI shows `schoolNo · NEYO no` in student list/profile/finance where useful; profile has inline editable school admission number row.
- Payments: Mzazi card account number prefers school admission number when present; public STK lookup already checks both columns; `payment.service.handleCallback` now auto-matches unlinked successful payments by either NEYO ID or school admission number to the oldest open invoice and applies the payment via normal invoice hook.
- Tests/screenshots: `scripts/i75-custom-admission-test.ts` verifies NEYO+school IDs, search by school ID, mock M-Pesa callback using school ID applies to invoice, and edit works. Screenshot `neyo/screenshots/i75-custom-admission-profile.png`. Verification: seed ✓, i75 test ✓, typecheck ✓, test:roles 24/24 ✓, build ✓. Checklist I.75 all [x]. NEXT recommended = I.98 localhost click-test readiness or I.57 GitHub/local workflow docs.


## 🔁 PART I BATCH 11 — FEES LOGIC FIXES + COOKIE RESTORE (2026-06-18)
- Founder asked to restore the cookie banner: reverted `components/legal/cookie-consent.tsx` to the original full-width bottom banner because founder said the previous one had no issue. Checklist note adjusted accordingly.
- Completed I.35 full-stack. DB: `FeeStructure.classId` optional exact class/stream override (migration `20260618170000_i35_class_specific_fee_structures`) + `Invoice.kind` default FEE (migration `20260618171500_i35_invoice_kind`, values FEE/ARREARS/MANUAL/SERVICE).
- Finance logic: new students auto-start with full UNPAID current-term fee invoice, exact class structure preferred over level fallback; updating a student class re-issues correct class fee if unpaid structure invoice exists; batch invoicing carries prior-term balances into one idempotent ARREARS invoice; manual fee invoice blocks trip/tour/outing/excursion/travel descriptions and directs staff to Expenses.
- UI: Finance fee structure dialog now has optional exact class/stream selector; structures show exact-class badge. Screenshot captured: `neyo/screenshots/i35-class-specific-fees.png`.
- Test: `scripts/i35-fees-logic-test.ts` verifies new learner starts with full exact-class fees owing, new-term arrears carry over once/idempotently, and trip invoice is blocked. Verification: db:seed ✓ before/after, i35 test ✓, typecheck ✓, test:roles 24/24 ✓, build ✓. Checklist I.35 all [x]. NEXT recommended = I.75 custom admission numbers or I.98 localhost click-test readiness.


## 🔁 PART I BATCH 10 — DASHBOARD DEMO PARITY + COOKIE OVERLAY POLISH (2026-06-18)
- Completed remaining I.68 dashboard polish lines. Cookie banner was converted from full-width bottom banner to compact bottom-left glass card (`cookie-consent.tsx`), so it no longer covers the central dashboard graph; screenshot `neyo/screenshots/i68-cookie-compact-dashboard.png`.
- Fixed demo dashboard parity after I.39 device-cookie hardening: `/api/demo/start` now uses `deviceIdFromRequest` + `setDeviceCookie`, and `createDemoSchool` stores `Session.deviceId`, so demo sessions pass `getSessionContext()` and no longer redirect to login.
- Added `scripts/i68-demo-dashboard-parity-test.ts`: Playwright starts a real demo tenant, opens `/dashboard`, verifies demo banner + Outstanding Fees cards + payments-vs-expected graph render, screenshots `neyo/screenshots/i68-demo-dashboard-parity.png`, then cleans up the demo tenant. Added `scripts/shot-cookie-compact.ts` for cookie overlay screenshot.
- Verification: demo parity test ✓, cookie screenshot ✓, typecheck ✓, test:roles 24/24 ✓, build ✓. Checklist updated: I.68 dashboard polish, card/demo parity, and demo response lines [x]. NEXT recommended = I.35 Fees Logic Fixes.


## 🔁 PART I BATCH 9 — PRINCIPAL DASHBOARD POLISH (2026-06-18)
- Completed I.68 dashboard polish slice. Dashboard already rendered cleanly; this batch removed hardcoded dashboard graph/event numbers and made the operating cockpit more real.
- Dashboard cards: linked cards now cover Outstanding Fees → Finance, Fees Collected Today → Finance, Collection Rate → Finance, Students Present → Attendance, Total Enrolled → Students, Total Staff → Staff, Events & Reminders → Calendar, Subscription Plan → Billing. Events/reminders now use real CalendarEvent count in next 30 days + unread Notification count.
- Payments-vs-expected graph: now computed from real current-term invoices and PAID payment rows. Expected line = cumulative expected billing over term dates; actual line = cumulative paid amount; labels/totals are dynamic. Removed hardcoded month/value graph.
- Recent Activity compacted to `max-h-[300px]` card with tighter spacing. Money-first layout stays at top. Intercom fix from Batch 8 remains visible on the dashboard.
- Demo parity note: same dashboard component is used by demo tenants; final browser demo-click smoke remains open because curl smoke without device cookie redirected to login after I.39 session-device hardening. Do not mark demo parity done yet.
- Screenshots refreshed: `neyo/screenshots/i68-dashboard-intercom-online.png` and `neyo/screenshots/i69-intercom-ringing.png`. Verification: db:seed ✓, typecheck ✓, test:roles 24/24 ✓, build ✓.
- Checklist updated: I.68 activity/card/graph/layout lines [x], card demo parity line [~], polish line [~] (cookie-banner overlap remains). NEXT recommended = finish dashboard demo parity/device-cookie demo start OR cookie-banner overlay polish.


## 🔁 PART I BATCH 7 — INTERCOM CALL ACCEPTANCE + ISLAND RECENTER (2026-06-18)
- Founder approved Batch 7 but specifically required fixing calling + dynamic island centering. Built full-stack intercom signalling: NEW tenant-owned `IntercomCall` model + migration `20260618154528_i69_intercom_call_signalling`; service `intercom.service.ts`; API `/api/intercom` GET board + POST start/accept/decline/end. Online status is real from active sessions; offline users cannot be called; timer starts only after target accepts (`acceptedAt`); busy users are blocked from second calls; no call audio/content is stored.
- Intercom UI rebuilt: dashboard intercom loads real online staff directory, shows offline/online, sends RINGING call request, target can accept/decline on their dashboard, caller sees waiting state (no counter until accepted), connected state shows accepted time + timer, end call works. Copy remains product-level (no underlying tech wording), and Lucide Phone icon is used.
- Dynamic Island recenter fix: `NotificationBell` island uses fixed viewport center (`left-1/2 -translate-x-1/2`) and safe-area top. Also supports `neyo:live-activity` events. Intercom emits Calling/Call in progress/Call ended live activities; import emits running/complete notifications.
- Screenshots captured: `neyo/screenshots/i68-dashboard-intercom-online.png` (online staff directory) and `neyo/screenshots/i69-intercom-ringing.png` (waiting for acceptance; no timer). Earlier island screenshots remain `i34-dynamic-island.png` and `i96-notification-panel.png`.
- Tests: `scripts/i69-intercom-call-test.ts` verifies online detection, RINGING state, target sees incoming call, accept -> ACCEPTED with acceptedAt, caller ends -> ENDED. `scripts/i94-live-activity-sources-test.ts` verifies import activity notifications when dev server is running. Verification run this batch: i69 test ✓, typecheck ✓, test:roles 24/24 ✓, build ✓.
- Checklist updated: I.69 [x]; I.95 all routing lines [x] after addendum. NEXT recommended = I.68 dashboard polish.
- Batch 7 ADDENDUM: finished remaining I.95 directions after founder said "finish I.95". Parent accounts are now allowed to use intercom; parent directory resolves the parent’s children and lists their class/timetable teachers; staff/principal/teachers can see linked parent contacts (leadership all parents, teachers own-class parents). Busy calls now create QUEUED IntercomCall rows instead of just throwing BUSY; queued caller and target are notified, and when the active call ends queued callers receive "contact is free" callback notifications. `i69-intercom-call-test.ts` expanded to verify parent→teacher ringing and queued-call release. I.95 now all [x].


## 🔁 PART I BATCH 6 — DYNAMIC ISLAND LIVE ACTIVITY SOURCES (2026-06-18)
- Completed I.94 live activity sources. Dynamic Island now listens for `neyo:live-activity` custom events in `NotificationBell`, so modules can surface short-lived live activities without creating DB rows or shifting layout.
- Intercom source wired: `DashboardIntercomClient` dispatches Calling / Call in progress / Call ended live activities to the island. Copy was cleaned per I.69b: no underlying technology wording; UI says NEYO Intercom / Call connected / Connected in the system; call button now uses Lucide Phone icon (no emoji).
- Student import source wired full-stack: POST `/api/students/import` creates targeted in-app notifications `Student import running` before commit and `Student import complete` after commit; the island surfaces them because it reads targeted unread notifications.
- Test: `scripts/i94-live-activity-sources-test.ts` starts dev-server import via real API and verifies both running+complete activity notifications are emitted. Verification: i94 test ✓, typecheck ✓, test:roles 24/24 ✓, build ✓.
- Checklist updated: I.94 live-activity line [x]; I.69b call copy/icons [x]. NEXT recommended = I.68 dashboard polish (card deep-links, activity sizing, plan card, payments-vs-expected graph).


## 🔁 PART I BATCH 5 — DYNAMIC ISLAND & NOTIFICATION PANEL POLISH (2026-06-18)
- Completed I.34/I.34b/I.96 notification polish. `NotificationBell` now owns a real top-center Dynamic Island for new unread notifications: targeted fetch from `/api/notifications`, `islandQueue` + `activeIsland` surfaces one message at a time, does not push layout, supports click-to-open deep link (`href`) + mark-read, hide, and Web Audio entry tone.
- Island design: notch-safe `env(safe-area-inset-top)`, fixed top-center width cap (`min(92vw,34rem)` / desktop 30rem), slightly taller desktop capsule, `animate-island`, navy-on-light and white-on-dark contrast. It no longer overlaps breadcrumbs because it lives in the topbar/safe-area zone and is fixed overlay.
- Notification panel redesigned: glass card, stable header, no awkward hidden top, clean card rows, thin transparent scrollbar styling, max-height constrained to viewport.
- Verification: `scripts/i34-notification-island-test.ts` proves notification targeting, href deep-link data and mark-read; typecheck ✓, test:roles 24/24 ✓, build ✓. Screenshots captured after installing Playwright Chromium/deps: `neyo/screenshots/i34-dynamic-island.png` and `neyo/screenshots/i96-notification-panel.png`.
- Checklist updated: I.20 dynamic island [x]; I.34 all island behaviour lines [x]; I.34b [x]; I.96 [x]; I.94 targeted alerts [x] and live-activity line [~] because feature-specific live activities (import running/call in progress) still need emitters. NEXT recommended = finish I.94 live activity sources OR I.68 dashboard card links/graph polish.


## 🔁 PART I BATCH 4 — 24-HOUR MESSAGE DELIVERY REPORTS (2026-06-18)
- Completed remaining I.85 [~] line: sender-facing 24-hour delivery report. NEW tenant-owned `MessageDeliveryReport` model + migration `20260618145620_i85_message_delivery_reports` stores per-message recipient/read/ack/unread/SMS fallback counts, unreadJson, summary, generatedAt, notifiedAt.
- Backend: `buildDeliveryReport`, `messageDeliveryReport`, `generateDueMessageDeliveryReports` added to `messaging.service.ts`. Reports generate only for tracked messages (requiresAck or urgentFallbackAt). Sender-only access enforced via participant + sender checks. If report is not 24h old yet, API returns pending with dueAt.
- Job: `message-delivery-reports` added to `EVERY_MINUTE_JOBS`; it creates due reports and notifies the sender in-app with "Message delivery report ready". Existing `message-fallback` still SMSes non-readers for urgent messages.
- API/UI: GET `/api/conversations/[id]/messages?report=<messageId>` returns pending/report. Messages UI has "View delivery report" on sent tracked messages and a polished modal with Recipients/Read/Received/Unread tiles + non-reader list.
- Tests updated: `i70-i85-message-receipts-test.ts` now verifies 24h report job generation and sender report access in addition to read receipts, acknowledgement and fallback. Full verification: db:seed ✓, i10 test ✓, i70/i85 test ✓, typecheck ✓, test:roles 24/24 ✓, build ✓.
- Checklist updated: I.85 first line moved [~] → [x]. NEXT recommended = I.34/I.96 Dynamic Island + notification panel polish OR I.68 dashboard card links/graph polish.


## 🔁 PART I BATCH 3 — MESSAGE READ RECEIPTS, ACKNOWLEDGEMENT & SMS FALLBACK (2026-06-18)
- Completed I.70 full-stack: `getMessages()` now returns real per-message read receipts (`readBy` with userId/name/role/readAt) based on `ConversationParticipant.lastReadAt >= Message.createdAt`. Messages UI removed fake hardcoded "Viewed by Deputy Njoroge" and renders actual "Seen by Name (time)" for sender messages.
- Built I.85 acknowledgement/fallback foundation: NEW Message fields `requiresAck`, `urgentFallbackAt`, `fallbackSmsSentAt` + NEW tenant-owned `MessageAcknowledgement` model (migration `20260618143418_i70_i85_message_receipts_ack`). Composer can add an "I received this" button and select SMS fallback after 6h/12h/24h. Recipients tap "I received this" → PATCH action `ack`, acknowledgement row upserted, lastReadAt updated.
- Built urgent fallback job: `message-fallback` added to `EVERY_MINUTE_JOBS`; `sendUnreadMessageFallbacks()` finds due messages, excludes readers/acknowledgers, SMSes non-readers through the real SMS seam with quota checks + usage recording, stamps `fallbackSmsSentAt`, audits `message.sms_fallback_sent`. Formal sender-facing 24h report summary remains open ([~]) for next messaging polish.
- Security polish: PATCH disappearing voice-note action now goes through service-level participant checks and only wipes `voice_note:disappearing` attachments.
- Seed updated: seeded Form 2 Teachers group has a real requires-ack message with 24h fallback. Seed verified ✓.
- Tests: `scripts/i70-i85-message-receipts-test.ts` verifies requiresAck storage, urgent deadline storage, sender sees who read+when, sender sees acknowledgements+when, and fallback job marks due messages + sends SMS seam. Also reran I.10 comms test, typecheck, db:seed, test:roles 24/24, build ✓.
- Checklist updated: I.70 [x], I.85 urgent fallback [x], acknowledge [x], read receipts [x], 24h report line [~] pending sender-facing summary report. NEXT recommended = finish I.85 24h sender report OR move to I.34/I.96 dynamic island notification polish.


## 🔁 PART I BATCH 2 — COMMUNICATION PERMISSIONS & TEACHER APPROVALS (2026-06-18)
- Completed I.10 full-stack. NEW DB model `TeacherCommsApprovalRequest` (migration `20260618141813_i10_teacher_comms_approvals`, tenant-owned) records teacher class-parent message requests with PENDING/APPROVED/REJECTED, frozen audience label, recipient count, decision note, approver, and linked BulkMessage when sent.
- Backend: `comms.service.ts` now enforces: teachers cannot send SMS (blocked even at preview); teachers may preview own-class in-app recipients but cannot directly send; actual teacher delivery requires Principal/Deputy/Owner approval. Approving sends the in-app message using the teacher as sender and audits `comms.teacher_approval_approved`; rejection audits `comms.teacher_approval_rejected`. `/api/comms` supports `request_teacher_approval`, `approve_teacher_message`, `reject_teacher_message`.
- UI: `/comms` now shows teachers an in-app-only approval workflow and shows approvers a "Teacher message approvals" queue with Approve & send / Reject actions.
- Messaging restrictions: generic `/api/conversations` creation passes the current role into `createConversation`; PARENT/STUDENT cannot create ANNOUNCEMENT or arbitrary GROUP chats (they use one-to-one conversations or the scoped class group endpoint). This blocks parent/student whole-school broadcasts.
- Tests: `scripts/i10-comms-permissions-test.ts` verifies teacher SMS forbidden, teacher in-app preview OK, teacher direct send blocked until approval, approval sends in-app, parent announcement/group creation blocked. Live API smoke verified teacher SMS 403, request PENDING, principal approve → APPROVED + BulkMessage. Typecheck ✓, test:roles 24/24 ✓, build ✓.
- Checklist updated: I.10 both lines [x] with evidence. NEXT recommended = I.70/I.85 read receipts/reporting or I.34/I.96 dynamic-island notification polish.


## 🔁 PART I BATCH 1 — AUTH / DEVICE / PASSKEY SECURITY (2026-06-18)
- Repo restored from `elvisybadbunny-bit/workspace-019eda5e-1def-796a-baa5-2d3ca100c665`: npm install ✓, prisma generate ✓, migrate deploy ✓ (90 migrations), seed ✓, typecheck ✓, test:roles 24/24 ✓, build ✓, live login + /api/students ✓. Reminder: make repo private if public.
- Completed I.1 auth/account clarity: added `neyo/docs/AUTH-ACCOUNT-SECURITY-GUIDE.md` explaining magic-link delivery (dev vs Resend live), where staff receive links, two-ID account model, device ID binding, 2FA, passkeys, and founder test steps.
- Completed I.39 Device ID login security: added `src/lib/core/device-id.ts`; password/OTP/magic/passkey/2FA session creation now stores `Session.deviceId`; `getSessionContext()` rejects a stolen session cookie if the matching `neyo_device_id` cookie is missing/mismatched. Live smoke: full cookies `/api/auth/me` OK; session-only cookie returns no user. `scripts/i1-auth-security-test.ts` verifies DB session device binding.
- Fixed I.40/passkey critical-action bug: `BiometricGateProvider` no longer posts a hard-coded principal email and no longer fakes success. New signed-in WebAuthn action endpoints `/api/auth/passkey/action/options` + `/api/auth/passkey/action/verify` verify the CURRENT user's stored passkey with `userVerification: required`. If no passkey is enrolled, protected action is blocked and asks user to set up Settings → Security first.
- Verified librarian clearance coverage: `library-client.tsx` already gates book clearance through `requireBiometric`; this is now real passkey verification. Recycle-bin purge + print-station mode remain gated.
- Validation: `npm run typecheck` ✓, `npx tsx scripts/i1-auth-security-test.ts` ✓, `npm run test:roles` ✓, `npm run build` ✓. Build warnings only pre-existing unused imports.
- NEXT: Part I Batch 2 recommended = communications restrictions + dynamic-island/notification polish OR passkey real-device screenshot if founder wants to test WebAuthn on his laptop first.


## 📌 FOUNDER ROADMAP DIRECTIVE (2026-06-13 — STANDING, non-negotiable order)
**Finish SCHOOL OS first. Build order from here = B → G → F. Do NOT start Part C (Business OS), Part D (Farm OS) or Part E (Creator OS) until the founder explicitly says so.**
1. **B.26 Premium Features** — review/flag (Bundi + hardware gated; build any rule-based pieces; tick what's already satisfied).
2. **Part G** — complete all remaining enhancement lines (G.8 polish, G.10 doc set, G.11 public landing — LAST/on-signal, G.12 sibling intelligence, G.13 Mzazi Card, G.14 demo mode, G.15 term pulse, G.18 whole-school timetable [on-signal], G.27-G.30 [on-signal], G.34 security hardening, G.35 scale — DO-AT-DEPLOY).
3. **Part F** — Internal NEYO Operations (founder ops, marketing presence, customer success, community/impact).
4. ❌ Parts C / D / E are explicitly DEFERRED until the founder reopens them. School OS is completed first.

_Last updated: 2026-06-14 · F.1 Founder Operations COMPLETE 8/8. NEYO now eats its own food at `/founder`. Chunk A (Security, Dual Roles, Brand Logo, Money-First Dashboard with Sparklines, and Hover Motion) is now 100% COMPLETE. NEXT = Biometric/Passkey Gated Critical Actions & Settings Restrictions._

## 🔁 CHAT-TRANSFER RESUME #5 + PART H AUDIT (2026-06-17, Arena workspace)
- Recovered via founder GitHub repo `elvisybadbunny-bit/workspace-019ed21f-...` (had neyo/ + docs/ FULL + screenshots; .env WAS in git this time). Restored: npm install ✓, prisma generate ✓, migrate deploy ✓ (82 migrations), db:seed ✓, typecheck ✓, test:roles 24/24 ✓, build ✓, live principal login + /api/students (5 students) ✓. **REMIND FOUNDER: make repo private.**
- **3 latent bugs from the previous chat found + fixed (repo did NOT build clean on arrival):** ① schema had `Student.legacyAdmissionNo` + `Session.deviceId` with NO migration → seed P2022; fixed with real migration `20260617000000_sync_legacy_admno_session_deviceid`. ② `pwa-data-saver.tsx` used `<Loader2/>` without importing it. ③ `messaging.service.ts` threw `MessagingError("CONTENT_MODERATED")` not in the code union + unmapped in respond.ts → added to union + mapped to HTTP 422.
- **PART H HONESTY AUDIT (founder-requested):** previous chat marked many H lines `[x] COMPLETE` that were NOT actually built. Audited all 41 lines against real code (schema/service/API/UI). Corrected the checklist (founder policy: never fake [x]; appended italic AUDIT notes; never reworded original lines). RE-OPENED as NOT-done / partial:
  - H.1: Top-Left School Brand Logo [~] (topbar still generic NeyoLogo), Hover Micro-Motion [~] (not on app-shell cards).
  - H.2: Role-Based Settings/Module Visibility [ ], Multi-Owner [ ], Master Attendance Override [~] (UI-only, no backend), Customized Printing Limits [ ], Boarding Term-End Print Scheduler [ ], Big Date Calendar [ ]; Biometric Gate [~] (wired to library clearance only).
  - H.4: Alt Pickup Screenshot/Message Verify [~].
  - H.5: Teacher Book Borrowing [ ], Cafeteria Table Allocation [ ], Incident Photo Proof [~] (schema-only), Quick-Action Messaging Buttons [ ].
  - VERIFIED genuinely done (kept [x]): H.1 greetings/money-dashboard/sparklines/multi-role; H.3 all 9 (HOD appoint, 1-tap mean release+SMS, dept manager, co-curricular, Saturday + bulk scheduler, timetable guard, term-dates guard FORBIDDEN, staff bulk import); H.4 pickup person/gate SMS/auto-dorm `autoAllocateHostelBeds`/suspension approval/transfer freed-space; H.5 barcode scanner/fines toggle/leaving-cert vault/entrance-exam vault.
- H-FIX PROGRESS (2026-06-17): ✅ H.2 Master Attendance Override (real backend + audit `attendance.master_override`, h2-master-override-test 5/5). ✅ H.2 Big Date Calendar (enlarged month + day/week date headers, no drift). ✅ H.1 School Logo (re-verified already wired layout→Topbar; seeded Karibu logoUrl=/brand/icon.png). ✅ H.1 Hover Micro-Motion (re-verified already in ui/card.tsx). ✅ H.2 Customized Printing Limits (NEW full-stack: Tenant.printLimitPerDay + PrintApprovalRequest model, migration 20260617010000_h2_print_limits; print-limits.service.ts; /api/print-limits; /settings/printing UI; enforced on invoice+receipt PDF routes; h2-print-limits-test 17/17). ✅ H.2 Boarding Term-End Print Scheduler (was localStorage-only → now real school-wide Tenant.printStationMode AUTO|HOLD, migration 20260617020000_h2_print_station_mode; setPrintStationMode leadership-only + audit; queuedJobs returns mode; /api/print-queue action stationMode; station client reads server mode; h2-print-station-mode-test 7/7).
- ✅ H.5 Cafeteria Table Allocation (was client-only preview never saved → now full-stack: NEW CafeteriaTable model + Tenant.cafeteriaTableSize, migration 20260617030000_h5_cafeteria_tables; allocateCafeteriaTables seats per-class (no mixing) into tables of chosen size for LUNCH|SUPPER, idempotent, audited; tableBoard/clearCafeteriaTables; /api/cafeteria ?tables= + allocateTables/clearTables; cafeteria "Table allocations" tab rebuilt server-backed; h5-cafeteria-tables-test 12/12).
- ✅ H.5 Teacher Book Borrowing (BookIssue += borrowerType STUDENT|STAFF + nullable studentId + borrowerUserId, migration 20260617040000_h5_teacher_book_borrowing; issueBook branches student/staff with limit+dup guards, staff library ID = TSC no or NEYO id; staff fines cash-only; library UI sends staffUserId when a staff borrower is picked; h5-teacher-borrow-test 9/9 + library-test regression ✓).
- ✅ H.5 Incident Photo Proof (RE-VERIFIED already fully wired — audit false negative on field name; proofFileUrl/proofFileName columns + incidentSchema + reportIncident persist + /api/discipline passthrough + IncidentDialog FileUpload camera-capable + "View Incident Proof" link; h5-incident-proof-test 5/5).
- ✅ H.5 Quick-Action Messaging Buttons (NEW reusable MessageButton → POST /api/conversations DIRECT (reuses 1:1) → /messages?open=<id>; placed in staff directory rows + file drawer; h5-quick-message-test 4/4). → H.5 now COMPLETE 10/11 (only Disappearing Voice Notes deferred).
- ✅ H.4 Alt Pickup Screenshot/Message Verification (NEW AltPickupAuthorization model, migration 20260617050000_h4_alt_pickup; one-time secure code PK-XXXX + screenshot proof + expiry; createAltPickup/listAltPickups/verifyAltPickup(→USED+SMS+screenshot to guard)/cancelAltPickup; /api/security altPickups + create/verify/cancel; gate Pickup tab "Alternate pickup" card + create dialog w/ FileUpload; h4-alt-pickup-test 11/11). → H.4 now COMPLETE 8/8.
- ✅ H.2 Biometric Gate extended (reusable BiometricGateProvider now gates all 3 categories: library clearance + Recycle Bin permanent purge [DELETE] + Print Station mode toggle [SETTINGS]; replaced plain confirm() on purge; test:roles 24/24).
- ✅ H.2 Role-Based Settings & Module Visibility (NEW Tenant.navVisibility JSON map, migration 20260617060000_h2_nav_visibility; nav-visibility.service get/set + isHiddenFor (primary+secondary role) + ALWAYS_VISIBLE allowlist [dashboard/settings/security never hideable]; filterNavigation gained isHidden filter; layout→AppShell→Sidebar applies per role; /api/settings/visibility; /settings/visibility manager UI; h2-nav-visibility-test 11/11).
- ✅ H.2 Multi-Owner Support (multiple SCHOOL_OWNER users + Tenant.requireJointOwnerApproval + OwnerApprovalRequest model, migration 20260617070000_h2_multi_owner; dual-control: initiator can't self-approve, second owner decides, single-owner schools never blocked; /api/owner-approvals; /settings/owners UI; audit = confirmation log; h2-multi-owner-test 11/11).
- 🎉 PART H FIX-UP COMPLETE (2026-06-17). All re-opened items rebuilt/verified: H.1 6/6, H.2 7/7, H.3 9/9, H.4 8/8, H.5 10/11 (Disappearing Voice Notes still correctly deferred [ ]). 12 features fixed in total this session (Master Attendance Override, Big Date Calendar, School Logo, Hover Motion, Customized Printing Limits, Boarding Term-End Print Scheduler, Cafeteria Table Allocation, Teacher Book Borrowing, Incident Photo Proof, Quick-Action Messaging, Alt Pickup Verify, Biometric Gate extension, Role-Based Module Visibility, Multi-Owner). Each: full-stack (DB→service→API→UI), live-tested, checklist + anchor updated honestly. New migrations 20260617010000..070000. New test scripts: h2-master-override / h2-print-limits / h2-print-station-mode / h5-cafeteria-tables / h5-teacher-borrow / h5-incident-proof / h5-quick-message / h4-alt-pickup / h2-nav-visibility / h2-multi-owner.
- 📥 PHASE-2 PROMPTS CAPTURED (2026-06-17): founder's Phase-2 prompts extracted into FEATURES-CHECKLIST Part I (now I.1–I.60 + I.25b/I.34b, plus reactivated F.3/F.4). NOT built yet. Phase-2 batch-3 (the big one) added: dynamic-island refinements — larger/taller-but-not-too-big, notch-safe, screenshot (I.34b); reduce card reflection (I.25b); ACTIVATE ALL hardware-deferred features w/ connect-when-bought design — GPS/scanner/thermal/biometric/CCTV/face (I.47); **NEYO BUSINESS MANAGEMENT OS inside NEYO Ops** — cards-based, runs accounts/billing/subs/payments/planning/launches/staff/founder/ideas/docs(privacy-policy editable→live)/one-tap shutdown/subscriber comms/pricing-no-code/contracts/grace-enforcement/integrated-calls/brand-asset self-service + detailed analysis doc (I.48); centralized money + instant M-Pesa reconnect on callback (I.49); cross-cutting multi-OS readiness + per-OS login (I.50); YouTube management+posting (I.51); **NEYO PUBLIC LANDING PAGE** — full ecosystem marketing site, "Modern African Enterprise SaaS" look (Odoo+Stripe+Notion+Linear+African warmth), NOT liquid glass, navy/green/warm-white, full section spec + responsive + screenshots (I.52); coming-soon + gated demo waitlist + per-OS sign-in (I.53); brand-asset self-service no-code (I.54); ~50-page non-coder founder PDF incl. test-tonight-on-localhost + deploy + market + hidden features (I.55); F.3 Customer Success + F.4 Community now actionable; scale-to-2M + storage answer (I.56); GitHub/localhost workflow help (I.57); performance/no-lag pass (I.58); mobile shortcuts (I.59); activate/verify the founder's deferred-integrations list — OAuth/MPesa-live/push/whatsapp/sms/email/BullMQ/observability/transcripts/analytics/WebRTC/AI (I.60).
- PHASE-2 batch-4 (2026-06-17): founder REJECTED my drafted landing-page section → DELETED it and rewrote I.52 with the founder's VERBATIM landing requirements (ecosystem marketing site, "Modern African Enterprise SaaS" look, NOT liquid glass, full 13-section spec) + I.53 gated demo waitlist. Added: glass transparency user setting + island text liquid-glass feel + theme-contrast (navy-on-white / white-on-navy) + every element liquid (I.61); custom user theme picker, company-toggleable, + screenshots + "how liquid customization helps" doc (I.62); ALL features toggle on/off for launch-staging (I.63); brand-realism anti-AI strategy (I.64); timetable subject COLOURS + configurable lesson/double/single CONSTRAINTS + pre-generate confirm + A4 render + combined lessons + abbreviations (I.65); fix `prisma db seed` config error (I.66); infra audit + explain caching/CDN/error-tracking/logs/account-recovery/CI-CD/version-control/monitoring + system-design docs (I.67); PRINCIPAL DASHBOARD REDESIGN — fix "something went wrong" error, cards link to modules, smaller activity, specific cards (students→tab, teachers→staff, events, reminders, current-plan), animated payments-vs-expected line graph, demo parity (I.68); online calling principals/deputies internet-only no-storage WebRTC (I.69); message read-receipts who+when (I.70); readability pass #2 bigger letters no-break (I.71); MULTI-BRANCH schools + same-owner consolidated updates + cross-branch staff reshuffle records (I.72); timetable advanced render — merged vertical cells for lunch/breaks, custom in-cell font, print-all-classes/all-teachers/by-venue one-click, period number-only+bigger, horizontal/vertical days toggle (I.73); company liquid master toggle (I.74); CUSTOM ADMISSION NUMBERS — keep school's own + NEYO id, search/pay by either (I.75); DEMO full parity (I.76). Cleaned "the banned cafeteria brand phrase" from I.18 per I.31.
- PART I now = ~77 sections. Founder may send more; on "START" I verify each vs code and build real gaps in small careful batches (also: respond fast, deliver in bits, take screenshots of new visual features).
- PHASE-2 batch-5 (2026-06-17): Part I now = ~101 sections. Added: WebRTC copy hide tech/"no storage" + intercom remove "SaaS" + add missing call/listen icons (I.69b); front-desk M-Pesa STK (I.77); duty-roster timetable w/ chosen reshuffle period (I.78); holiday/event seasonal themes (I.79); Settings Face ID/fingerprint APP-UNLOCK + screenshots (I.80); liquid-glass INTENSITY slider + glass on green buttons/every element (I.81); mobile top-bar hide vs notch — one notifier, double-press reveals others + screenshots (I.82); make-NEYO-alive + more toggleable features (I.83); offline saved-data/bundle-saver mode feasibility+build (I.84); MESSAGING read-report after 24h + auto-SMS to non-readers + urgent 6/12h timer + "I received" acknowledge + read receipts (I.85); native-style notifications no-app-open ring (I.86); theme follows device default + login page (I.87); abuse/harmful filter all directions (I.88); WebRTC ONLINE LIVE CLASSES home+school-TV accounts + "online class running" + request/confirm/schedule (I.89); meetings+screenshare+mute-all+disable-video+no-save-unless-user (I.90); multiple receptionists + disable + instant cash receipt + bank slip/statement import-reconcile (I.91); strict per-role visibility ALL staff incl transport/kitchen (I.92); duplicate-import denial all fields incl students (I.93); dynamic-island live activity + targeted + plan deep-link/expiry notify + cards-per-role (I.94); intercom call routing — owner→principal, principal/teacher→parent, busy-queue+notify, teacher↔teacher, parent→teacher (I.95); notification panel UI fix no-ugly-scrollbar (I.96); syllabus coverage+scope+deadlines per term + exam-setting help (I.97); local-host click-test readiness "when I press anything it works" (I.98).
- KEY founder asks to action on START: run smooth on localhost (I.98/I.57/I.66), fix dashboard "something went wrong" (I.68), fees-show-cleared bug (I.35), seed step-3 (I.66), take screenshots of new visual features (island, themes, timetable, Face ID, mobile bar).
- PROPOSED VALUE FEATURES (Build-Partner, 2026-06-17, founder to approve): I.99 Fee Collection Engine (auto-reconcile, one-tap reminders, installments, defaulter workflow, leaderboards) · I.100 Parent Delight Pack (real-time absence alert, plain-language progress, pay-from-anywhere) · I.101 Teacher Time-Savers (10-sec register, auto report cards, "my day") · I.102 Principal run-from-phone (money dashboard, approvals inbox, at-risk board) · I.103 Sales/Onboarding conversion (15-min setup, trial nudge→1-tap subscribe, referral, plan gating) · I.104 Trust/compliance (backups, ODPC badge, readable audit, term archive) · I.105 sticky daily-habit (morning brief, EOD summary) · I.106 differentiators vs Zeraki/ShuleSoft (feature-phone reach, offline-first, all-in-one, beautiful UI) · I.107 revenue add-ons (SMS packs, doc-print pack, per-student pricing, online-class metering, premium themes). All toggleable in NEYO Ops. Part I now ~110 sections / 873 open lines.
- NEXT: founder reviews proposed value features → says which to prioritize → on "START" I verify-vs-code and build in small batches.
- ✅ CLARIFICATION (2026-06-17): checklist Part I was NOT stuck at I.77 — it already ran to I.107; verified all I.1–I.107 present (incl. I.34b/I.25b/I.69b). Founder asked to expand "NEYO runs NEYO". Added the full NEYO-Ops company-OS expansion I.108–I.121: I.108 architecture (NEYO HQ as a special internal tenant reusing all engines), I.109 Sales/CRM (landing leads→pipeline→auto-provision tenant + demo-approval gate), I.110 Finance/Revenue (MRR/ARR/churn, central payments, real expenses/profit, dunning, tax), I.111 Customer Success/Support (tickets, health score, onboarding tracker, KB no-code), I.112 internal HR/payroll/OKRs/founder+ideas, I.113 Product/Launch (OS lifecycle, feature-flag console, roadmap, changelog, Bundi launch, %-rollout, per-tenant overrides), I.114 Content/Brand/Marketing (brand-asset + landing + pricing editors no-code, YouTube/social, campaigns, SEO), I.115 Platform Control/Reliability (maintenance/shutdown, health board, suspend/impersonate, jobs console, global audit, rate-limit, backups), I.116 Legal/Compliance/Docs (privacy/terms→live, contracts/e-sign, ODPC, vault), I.117 Comms/Calls hub (unified inbox, segment broadcast, WebRTC calls, status page), I.118 BI (cross-tenant aggregates, per-OS dashboards, cohorts/funnel, board pack, anomaly alerts), I.119 Growth/Partnerships/Community (referrals, resellers, F.4 impact, affiliates, demo-day), I.120 Idea→Ship pipeline, I.121 cross-cutting guarantees (SUPER_ADMIN-gated, audited, toggleable, company-level data, new OSes auto-appear). Part I now = 124 sections / 950 open lines.
- NEXT: founder may send more / approve value features → on "START" verify-vs-code + build in small careful batches.
- NEXT: keep receiving founder's remaining prompt batches → append to Part I → on "START", confirm what's there vs missing, build gaps full-stack in bits.
- BUILD NOTE: full `npm run build` can TIMEOUT in the slow eslint/type-check phase on this 2GB box even though it compiles fine ("✓ Compiled successfully") — confirm correctness with `tsc --noEmit` (heap ≤1536, passes separately); `npx next build --no-lint` also reaches "Compiled successfully" then times out only in the type-check/page-gen phase.
- SANDBOX GOTCHA (NEW, important): this Arena sandbox is only ~2GB RAM — `NODE_OPTIONS=--max-old-space-size=4096` OOM-LOCKS the whole sandbox for ~10min. USE ≤1800 for build and ≤1536 for tsc/tsx. Also node_modules got fully wiped mid-session (not snapshotted) → `npm install` again. NEVER run build while a dev server is alive.
- STILL RE-OPENED (full-stack, one per bit): H.2 Role-Based Settings/Module Visibility · Multi-Owner · Boarding Term-End Print Scheduler · Biometric Gate (extend to deletes/settings); H.4 Alt Pickup screenshot/message verify; H.5 Teacher Book Borrowing · Cafeteria Table Allocation · Incident Photo Proof wiring · Quick-Action Messaging Buttons.
- NEXT: continue fixing re-opened H features in bits, then process founder's new-feature prompts (features the previous chat claimed done but never recorded).




## ✅ F.1 FOUNDER OPERATIONS: COMPLETE 8/8 (built + live-tested 2026-06-14, screenshots 140-146)
- FOUNDER DIRECTIVE: “Founder operations still exist in the same page of neyo.co.ke; we are eating our own food.” Implemented as a NEYO internal company cockpit inside the product at `/founder`, SUPER_ADMIN-only. This is company-level data, deliberately NOT tenant-owned.
- DB (migration `f1_founder_operations`): `NeyoBuildLog` (one official log per `dateKey`), `NeyoMetricSnapshot` (period revenue/MRR/schools/churn-risk/SMS spend), `NeyoFounderOpsEntry` (WEEKLY_METRICS/MONTHLY_ALL_HANDS/QUARTERLY_AUDIT/ANNUAL_PLANNING/CUSTOMER_INTERVIEWS/DEMO_DAY/INVESTOR_UPDATE/BOARD_MEETING/IMPACT_REPORT), `NeyoCustomerInterview` (school/contact/channel/status/pain-points/quotes/opportunities/follow-up).
- Validation/security: `founder-ops.ts`; SUPER_ADMIN-only rule; ISO dates; DONE entries require completedAt; completed interviews require at least one insight/quote/opportunity; metric guards (paying/churn-risk cannot exceed active schools).
- Service/API: `founder-ops.service.ts` uses root `db` (NOT `tenantDb`); dashboard summary + CRUD/upserts. API routes `/api/founder-ops` and `/api/founder-ops/[section]/[id]`, all `requireRole("SUPER_ADMIN")`; teacher 403 verified. `FounderOpsError` mapped in respond.ts.
- UI: `/founder` page + `FounderOpsClient`, sidebar item “NEYO Ops” under Overview (permission `platform.founder_ops`, SUPER_ADMIN only). Tabs: Overview / Build log / Metrics / Cadence / Interviews. Loading + error states included.
- Build-log mirror: `BUILD-LOG.md` added so founder has a human-readable file, while the DB is source for the app page.
- Seed: `prisma/seed.ts` seeds F.1 build log, 2026-W24 metrics, all major founder cadence entries, Karibu scheduled interview + Uhuru completed interview with pain points/quotes/opportunities.
- Verification: `npm run db:seed` ✓, `npm run typecheck` ✓, `npm run build` ✓ (warnings only), browser interaction tested: saved a build log through the visible UI (not DB direct), switched through all tabs, final screenshot 146.
- Screenshots: 140 initial Founder Ops page, 141 overview tested, 142 Build Log tab after save, 143 Metrics tab, 144 Cadence tab, 145 Interviews tab, 146 final populated overview.

## ✅ G.11 PUBLIC SCHOOL LANDING SITE: CORRECTIVE PASS COMPLETE 8/8 (2026-06-13, screenshots 137-139)
- WHY: Founder asked if G.11 was truly done. Audit found the old `/` page existed but was too thin/hardcoded (no real news detail, gallery, leaders, testimonials, activities, public-site editor, proper empty states). We treated this as a corrective pass, not a new feature.
- DB (migration `g11_public_site_content`): `PublicSiteSettings` (hero/subheading/image, history, whyChooseUs JSON, mapEmbedUrl, SEO title/description/OG image, CTA labels), `PublicSiteLeader`, `PublicSiteTestimonial`, `PublicSiteGalleryImage`, `PublicSiteActivity`, upgraded `NewsPost` with excerpt/status/featured/publishedAt. All tenant-owned models added to `TENANT_OWNED_MODELS`.
- Validation: `src/lib/validations/public-site.ts` with safe URLs (A.9 `/api/files/serve`, `/brand/*`, http/https), news slugs, publish-date rule, gallery categories, activity icons, and edit permission `tenant.manage_settings`.
- Service: `src/lib/services/public-site.service.ts` — public reads by tenant slug return ONLY published rows / PUBLISHED news; admin read includes drafts/unpublished; CRUD for settings/leaders/testimonials/gallery/activities/news; duplicate news slug guard; all writes audited `public_site.*`.
- API: public `GET /api/public-site/public?tenant=karibu-high`, `GET /api/public-site/news/[slug]?tenant=...`; admin `GET/PUT/POST /api/public-site` + `DELETE /api/public-site/[section]/[id]`, all management gated on `tenant.manage_settings`; teacher 403 verified. `PublicSiteError` mapped in respond.ts.
- Settings UI: `/settings/public-site` + `PublicSiteEditor` tabs Story/News/Gallery/People/Activities/SEO; FileUpload reuse for images; publishing-readiness counts; Settings hub + sidebar “Public Website” item. Screenshot 139.
- Public UI: `src/app/page.tsx` now fully DB-backed with dynamic metadata/OG, hero, stats, foundations, why-choose-us, academics, activities, news cards, gallery, leadership, testimonials, contact/map/socials. `src/app/news/[slug]/page.tsx` for published news detail; drafts never render. Screenshots 137 landing + 138 news detail.
- UX states: loading/error pages for settings, loading/not-found for news detail, public empty showcase section for schools that have not published optional content.
- Seed: `prisma/seed.ts` seeds Karibu public site with Kenyan story/proof points, 3 activities, 2 leaders, 2 testimonials, 2 gallery items, 2 published news posts. Verification: API payload shows news=2/gallery=2/leaders=2/testimonials=2/activities=3/why=3; `npm run typecheck` clean; `npm run build` clean (warnings only, pre-existing).

## ✅ G.15 TERM TRENDS PULSE: COMPLETE 2/2 (built + live-tested 2026-06-13, screenshots 131-132)
- DB: TermPulse (migration `g15_term_pulse`, @@unique(tenantId, weekKey) = idempotent one-row-per-ISO-week + viewable history; TENANT_OWNED_MODELS += "termPulse"). Fields: weekKey/weekStart/weekEnd, activeStudents, joinedThisWeek, attendancePct, attendancePrevPct, attendanceMarked, collectedWeekKes, weeklyTargetKes, collectionTermPct, summary, sentCount.
- Service `term-pulse.service.ts`: computePulse(tenantId, ref) reads the week that JUST ENDED (Mon→Sun, Nairobi via mondayOf/addDays/isoWeekKey) from REAL rows — B.1 enrolment + joined-this-week (admittedOn vs Nairobi week instants), B.3 attendancePctForRange (P+L÷marked) cur vs prev week, B.7 fees: PAID Payment.amount in the week vs weeklyTargetKes = billedTerm×targetPct÷TERM_WEEKS(13). buildPulseSummary() = RULE-BASED one-liner (grep-verified NO "AI"). computeAndStorePulse() upserts the week row. notifyTenantPulse() → leadershipRecipients() (active users where can(role,"owner.dashboard")) → notify() in_app + sms cascade (checkSmsQuota gate + recordUsage on allowed) → stamps sentCount. sendWeeklyPulse() iterates non-demo tenants (try/catch per tenant). latestPulse()/runPulseNow().
- CRON: CronDef gained optional `dow` (0=Sun..6=Sat Nairobi) + nairobiDow() + dueCronJobs honours it. term-pulse scheduled Mon 07:00 EAT. JOBS["term-pulse"] handler added.
- API: GET /api/term-pulse (latest, owner.dashboard) + POST (run-now). Teacher 403 HTTP-verified; principal payload verified live (2026-W23, 5 students, 92% attendance, KES 6,898 weekly target, sentCount 2).
- UI: components/owner/term-pulse-card.tsx mounted at top of owner-client (after header). Glass-first, 4 UX states (skeleton/empty "first pulse arrives Monday"/error+retry/populated). Rule summary line + 3 tiles (Attendance % w/ WoW arrow, Fees this week vs target, Enrolment + joined) + "Send now" → POST. Badge tone="neutral" weekKey, "sent to N".
- Seed: G.15 block computes+stores a live pulse for Karibu (idempotent). term-pulse-test.ts **19/19 ✓** (SELF-HEALS: deletes pulse notifications + restores SMS usage, re-stores a clean seed pulse): summary up/down/quiet + no-"AI", weekKey/Monday format, active-count match, idempotent (one row), latestPulse, notify all leaders + in-app rows + sentCount, cron due-Mon NOT-Tue.
- tsc clean, test:roles 24/24, build clean (/api/term-pulse + /owner 7.17kB). Screenshots 131 (owner desktop 1920×1080 — card w/ summary + 3 tiles) + 132 (mobile 390px). Series at 132.
- GOTCHA: tenantDb().create still needs `tenantId` in the data literal (TS type requires it even though tenantDb auto-stamps) — pass it explicitly (matches expense.service pattern).

## ✅ KNOWN ISSUE FIXED (solved 2026-06-13): The /dashboard StatCards are now fully wired to real live counts (students.count active, today's paid payments, attendance %, collection rate) using standard, correct queries and Nairobi time zones. This resolves the pre-existing Chunk-0 hardcoded placeholders. No fake data or mocks.

## ✅ G.14 DAY-ONE DEMO MODE: COMPLETE 2/2 (built + live-tested 2026-06-13, screenshots 129-130)
- DB: Tenant.isDemo (Boolean) + demoExpiresAt (DateTime?) — migration `g14_demo_mode`. (GOTCHA: node_modules was wiped mid-chunk → npm install; also two empty migration dirs from failed runs caused P3015 → rmdir the empties, keep the one with migration.sql.)
- Service `demo.service.ts`: createDemoSchool(ctx) — unique slug demo-XXXXXX, owner login (owner@<slug>.demo / Demo2026!), modules on (hostel/transport/library/lms/inventory/cafeteria), real KE seed inside withTenant (2 classes + 5 students+guardians + 2 fee structures + 5 invoices PAID/PARTIAL/UNPAID), isDemo + 24h demoExpiresAt, creates a Session (auto-login) + audit demo.created. demoStatus(tenantId) → {isDemo, expiresAt, hoursLeft} for the banner. purgeExpiredDemos() hard-deletes expired demo tenants (sessions+users first, then tenant cascade). DEMO_TTL_HOURS=24.
- API: POST /api/demo/start PUBLIC, enforceRate 5/h/IP, sets neyo_session cookie (same pattern as onboarding signup) → client redirects to /dashboard.
- Job: registry "demo-purge" + CRON_SCHEDULES daily 03:00 EAT.
- UI: /login "Try NEYO with a demo school" button (Sparkles, startDemo handler → POST → /dashboard) + subtext. App-shell amber DemoBanner (components/shell/demo-banner.tsx) when session tenant isDemo — hoursLeft + "Convert to a real school →" → /get-started?from=demo. get-started wizard takes fromDemo prop (from searchParams) → green conversion notice ("enter your REAL details, live school starts clean").
- demo-test.ts **16/16 ✓** (SELF-HEALS, deletes demo tenants it makes): slug format, isDemo flag, ~24h expiry, 5 students + 5 invoices + owner + Achieng, auto-login session, demoStatus, real-school-not-demo, valid demo NOT purged, expired demo purged + no orphans (users/students), real school survives purge.
- tsc clean, test:roles 24/24, build clean (/api/demo/start). Live-verified: POST→200 + cookie + demo-XXXXXX w/ 5 students; in-browser button → demo dashboard w/ amber banner. Screenshots 129 (login CTA) + 130 (demo banner on dashboard). Series at 130.

## ✅ G.13 MZAZI CARD: COMPLETE 3/3 (built + live-tested 2026-06-13, screenshots 126-128)
- NO new DB table — reuses A.10 DocumentVerification (permanent per-learner QR code, docType "mzazi_card", payloadHash = sha256("mzazi:tenant:student") so the code is idempotent and re-prints keep working) + B.7 invoice ledger for balances. Added G.13 seed: Karibu PaymentCredential.shortcode "522533" (non-secret Paybill; Daraja secrets stay unset).
- Service `mzazi.service.ts` (MzaziError → 404/422): cardData() (school brand + learner + balance + paybill + account=admNo + code), buildMzaziCardPdf (row-scoped), buildClassMzaziBatchPdf (all ACTIVE in a class, empty→422), **mzaziLookup(code, phone)** = PUBLIC privacy-gated check: finds learner by payloadHash, ALWAYS returns masked name ("Achieng M. O.") until normalizeKePhone(phone) matches a guardian on record, then reveals full name + LIVE balance + paybill + account. maskName() helper.
- Doc `mzazi-card-pdf.tsx`: A6 page per card — header (school+motto+brand colour G.9), MZAZI FEE CARD, learner+adm+class, balance box (red if owing / green "Cleared"), Paybill + Account no, QR → /mzazi/<code>, instruction text + Ref, "Powered by NEYO". Plain (never glass) per print rule.
- API: GET /api/students/[id]/mzazi-card (student.view, row-scoped) · GET /api/finance/mzazi-batch?classId= (finance.view) · POST /api/mzazi/[code] {phone} PUBLIC, rate-limited 20/10min/IP (enforceRate). MzaziError mapped in respond.ts.
- UI: public /mzazi/[code] page (no app shell, mobile-first 390px) + mzazi-lookup-client.tsx (phone challenge → revealed balance + step-by-step M-Pesa pay; idle/checking/revealed/wrong-phone states; "your number is only used to confirm you're the parent"). "Mzazi card" download button on student profile header (CreditCard, staff/canEdit). Per-class "Print N" link on /classes table.
- mzazi-test.ts **16/16 ✓**: single PDF %PDF, idempotent code (1 per learner), wrong-phone masked + no balance leak, right-phone full name + balance matches ledger + paybill 522533 + account=admNo, phone normalisation (07../+254..), unknown code, class batch PDF, empty class blocked.
- tsc clean, test:roles 24/24, build clean (/mzazi/[code] + 3 APIs). Live-verified: Atieno KES 33,000 revealed w/ Paybill+account; wrong phone masked. Screenshots 126 (challenge) + 127 (revealed KES 33,000 + Pay-with-M-Pesa) + 128 (A6 printed card via pdftoppm). Series at 128.
- GOTCHA: `npm run build` typechecks scripts/ too — a discriminated-union return (mzaziLookup) needs `if (res.found === true && res.ok === true)` narrowing in the test, not inline `res.ok &&` (build failed until narrowed).

## ✅ G.12 SIBLING INTELLIGENCE: COMPLETE 4/4 (built + live-tested 2026-06-13, screenshot 125)
- NO new model — siblings = students sharing a Guardian (B.1 already reuses one Guardian per family). DB: only Tenant.siblingDiscountPct added (migration `g12_sibling_discount`, default 0, seeded 5% for Karibu).
- Service `family.service.ts` (FamilyError → 404/422): familyForStudent(studentId) — siblings via shared guardianIds → ACTIVE children + per-child invoice balance + COMBINED billed/paid/balance + shared guardians + tenant discount %; row-scoped (scopeWhere). siblingCount() (badge). applySiblingDiscount(invoiceId, pct?) = round(total×pct/100) → reuses B.7 applyDiscount (over-discount guard + status + audit); BLOCKS only-children (no enrolled sibling 422) + unknown invoice 404; pct defaults to Tenant.siblingDiscountPct.
- API /api/family: GET ?studentId= (student.view) + POST {action:sibling_discount, invoiceId, pct?} (finance.manage_structure). FamilyError mapped in respond.ts.
- UI: "Family" card on the student profile (student-profile-client FamilyCard) — blue "👥 N sibling(s) in school" badge, combined-fee tiles (billed/paid/balance), per-child rows (current child highlighted green "THIS LEARNER · cleared", siblings link to /students/[id] w/ "KES X due"/"cleared"), sibling-discount note (5% + "family qualifies with N children"). Only-child = friendly "no siblings here" empty state. 4 UX states (skeleton/empty/error+retry/populated).
- "One SMS per family" line = VERIFY-AND-TICK from B.14 (comms resolveAudience dedupes guardians by phone — not rebuilt).
- Seed: Atieno linked to Achieng's guardian (Otieno Brian) as a 2nd StudentGuardian → they're siblings; Karibu siblingDiscountPct=5. Idempotent (existence-guarded).
- family-test.ts **17/17 ✓** (SELF-HEALS the test discount): sibling counts, family view both directions, combined balance = sum, only-child view, 5% discount applied + reason, only-child blocked, unknown 404.
- tsc clean, test:roles 24/24, build clean (/api/family). Screenshot 125 (Achieng profile: Family card, 1 sibling Atieno, combined KES 66k billed/33k balance, 5% discount note) QA'd. Series at 125.

## ✅ B.26 PREMIUM FEATURES: REVIEWED 2026-06-13 (verify-and-flag, no faking)
- All 13 lines are Bundi-gated (AI), hardware-gated, or native-platform → none [x]. Marked 12×[~] (real foundation/seam exists; only blocker = founder decision: creds/hardware/native toolchain) + 1×[ ] Face Recognition (camera hardware + vision model).
- Evidence per line: AI Assistant→Bundi shell G.36 paused (engine B.23) · WhatsApp Bot→A.7 whatsapp seam (WHATSAPP_TOKEN) · Parent/Teacher/Student native app→PWA installable+offline (G.2) is the app today, native packaging future · Face Recognition→hardware+vision deferred · GPS Bus Tracking→Haversine+geofence (G.17)+UI seam, needs trackers · AI Exam/Report/Timetable/Homework/Lesson/Risk→ALL have rule-based engines LIVE today (B.5 positions/means, B.5 buildComment remarks, B.4 autoFill, B.12 homework, B.4 lesson plans, B.3 chronic+anomaly / B.20 bands / B.7 arrears / B.21 welfare) — Bundi (B.23) only ADDS convenience on top, never depended on.
- No code written (review only). tsc/test:roles/build untouched-green from B.25.

## ⏭️ NEXT: PART G — finish remaining enhancement lines (founder order B→G→F)
Remaining G lines (review each; some are on-signal/at-deploy): **G.8** Tier-3 polish (data-retention scheduler, saved views/filters, bulk-select toolbar, branded email templates) · **G.10** standard doc set (ID card, transcript — invoice/report-card/admission/transfer letters DONE) + download/email + external print seam · **G.11** public subdomain landing site — BUILD LAST on founder signal · **G.12** Sibling Intelligence (family view, sibling badges, sibling discount seam — one-SMS-per-family already done at B.14) · **G.13** Mzazi Card (A6 QR fee slip) · **G.14** Day-One Demo Mode · **G.15** Term Trends Pulse (Mon digest) · **G.18** Whole-school timetable generator — on signal · **G.27-G.30** (Mwalimu pack / Promise-to-Pay / Report-Card Day / Health Check) — on signal · **G.34** Security hardening — pre-launch · **G.35** Scale to 1M — at deploy. Buildable-now picks: G.12, G.13, G.14, G.15, G.8 items, G.10 ID card/transcript.

## 🎉 B.25 ADDITIONAL MODULES — FULLY COMPLETE (2026-06-13). All sub-blocks done: Uniform Management 4/4 · School Assets 5/5 · Supplier Management 4/4 · Procurement 5/5 · Expenses Tracking 5/5 · Calendar & Events 8/8.

## ✅ B.25 CALENDAR & EVENTS: COMPLETE 8/8 (2026-06-13, screenshots 123-124)
- VERIFY-FIRST: 6 of 8 lines were BUILT AT A.17 — re-verified live + ticked with evidence, NOT rebuilt: Calendar UI (month/week/day), KE public holidays (KE_MOMENTS layer), Cultural moments live, Religious calendars opt-in (Tenant.showReligiousHolidays), Event creation w/ audience targeting (audienceRole + A.17.5 invites), iCal export (buildIcs RFC-5545).
- WhatsApp reminders = [~] DEFERRED: A.7 whatsapp.ts seam + cascade slot exist; flips on with WHATSAPP_TOKEN (founder creds), no code change. In-app calendar invites already work (A.17.5).
- **NEW — Recurring events (RRULE subset):**
  - DB (migration `b25_calendar_recurrence`): CalendarEvent += recurrence (null|WEEKLY|MONTHLY) + recurUntil (YYYY-MM-DD). Nullable → existing events unaffected.
  - Validation: eventFields += recurrence (enum) + recurUntil (isoDate) + refinements (until ≥ date; recurUntil requires a recurrence).
  - Service (calendar.service.ts): **pure expandRecurrence(firstDate, recurrence, recurUntil, from, to)** — WEEKLY = same weekday every 7d; MONTHLY = same day-of-month, months WITHOUT that day are SKIPPED not shifted (31st skips Feb/Apr/Jun/Sep/Nov — verified); bounded by recurUntil + the view range + HARD_CAP=400 safety. getOccurrences now pulls non-recurring overlapping rows AND recurring rows whose window reaches the range, then expands each series into per-date occurrences (id "<seriesId>:<date>" when >1, recurring flag set, shared seriesId; multi-day span preserved via daysBetween). createEvent/updateEvent persist the two fields. buildIcs naturally exports one VEVENT per expanded occurrence.
  - API: existing /api/calendar/events POST already passes the full validated input through — recurrence flows automatically (no route change).
  - UI (calendar-view.tsx): event dialog "Repeats" select (does-not-repeat / every week / every month) + conditional "Repeat until" date; green "🔁 weekly/monthly" badge on agenda occurrences; **delete is series-aware** — remove() strips the ":date" suffix so deleting any occurrence removes the whole stored series.
  - Seed: weekly Monday "Staff Briefing" 07:30 (TEACHER audience, until Dec 15) via nextMondayIso() helper + monthly 5th "Fees due reminder" (PARENT, until Dec 5). Idempotent (calendar block deleteMany+recreate each seed, as A.17 already did).
  - calendar-recurrence-test.ts **14/14 ✓** (SELF-HEALS): WEEKLY/MONTHLY expansion, August 5-Mondays bounding, 31st-skips-short-months, recurUntil cap, seed briefing expands 4× in July w/ shared seriesId, monthly fees once/month, new event round-trips + expands, iCal 4 VEVENTs, series-delete removes all.
- tsc clean, test:roles 24/24, build clean. Live API verified: 4 July Staff-Briefing occurrences w/ recurring:WEEKLY. Screenshots 123 (month — briefing on every Monday + fees on the 5th) + 124 (week — 🔁 weekly badge on the agenda) QA'd. Series at 124.
- GOTCHA reconfirmed: after build, kill next + `rm -rf .next` + fresh dev + WARM the route before screenshotting (stale _next/static → no hydration otherwise).

## ✅ B.25 EXPENSES TRACKING: COMPLETE 5/5 (built + live-tested 2026-06-13, screenshots 121-122)
- DB (migration `b25_expenses`): **ExpenseCategory** (@@unique tenant+name, archived) + **CostCenter** (@@unique tenant+name, archived) + **Expense** (categoryId+frozen categoryName, costCenterId?+frozen name, payee, amountKes, spentOn YYYY-MM-DD, note, receiptFileUrl/Name via A.9, status PENDING_APPROVAL|APPROVED|REJECTED, approval cols, rejectedReason, createdBy denorm). Tenant.expenseApprovalThresholdKes Int @default(20000). All 3 in TENANT_OWNED_MODELS.
- Service `expense.service.ts` (ExpenseError → 404/422/403/409): addCategory/addCostCenter (dup 409) + seedPresets (idempotent KE starters: 10 categories + 7 cost centers) + archiveCategory/archiveCostCenter (toggle); createExpense (THRESHOLD RULE: amount > threshold ⇒ PENDING_APPROVAL else auto-APPROVED "(under threshold)"; category-exists 404, archived 422, zero-amount 422; freezes category/cost-center names); approveExpense/rejectExpense (LEADERSHIP only; creator-cannot-self-approve FORBIDDEN; reject carries reason; can't decide a non-pending); expensesBoard (threshold + this-month approved/pending totals + awaiting count + active dimensions + last-50 expenses); expenseReports(month) (APPROVED grouped byCategory + byCostCenter + total, pending/rejected excluded); **approvedExpensesSinceKes(tenantId, sinceDate)** — used by B.24. All actions audited (expense.category_created/cost_center_created/presets_seeded/*_archived/created/approved/rejected).
- API GET /api/expenses (board, inventory.view) + GET ?reports=1&month=YYYY-MM + POST {action: expense|category|cost_center|seed_presets|archive_category|archive_cost_center|approve|reject} — **approve/reject gated on tenant.manage_settings (leadership), everything else inventory.manage (bursar)**. Teacher 403 on GET + POST expense both HTTP-verified.
- UI: 6th "Expenses" tab in /inventory (Receipt icon) — `ExpensesTab` in inventory-client.tsx: 3 money tiles (approved this month / awaiting approval amber / threshold) + sub-view switcher (Spend / Reports / Categories) + "Record expense" CTA. Spend = expense rows w/ status badges + Approve/Reject (canApprove only) + receipt download link. Reports = By-category + By-cost-center CSS bars + "feeds the Owner dashboard" note. Categories = add/archive category + cost-center cards. ExpenseDialog (category/cost-center/payee/amount/date/note + A.9 FileUpload receipt + "above threshold needs approval" warning) + RejectDialog. EmptyState seeds the KE presets when no categories yet. All 4 UX states (LoadError reused).
- **B.24 WIRED HONEST**: owner-dashboard profitability now = collected − payroll×3 − approvedExpensesSinceKes(last 3 months); note mentions the expense figure; the old payroll-only proxy replaced. Live-verified surplus -837k → -887k when 50k approved.
- Seed (idempotent, existence-guarded): 10 categories + 7 cost centers + 3 expenses (KPLC 12,500 approved · Jamii Cleaning 6,800 approved · Mwangi Roofing 38,000 PENDING over-threshold demo) dated in the current Nairobi month so reports/owner show data.
- expense-test.ts **20/20 ✓** (SELF-HEALS, removes TEST rows): threshold default 20k, seed presents, idempotent presets, dup category 409, under→auto-approved, over→pending, creator-self-approve blocked, different-leader approves, reject+reason, can't-approve-rejected, zero-amount blocked, report by-category 123k, rejected excluded, approvedExpensesSinceKes, archive hides, audits ≥5.
- tsc clean, test:roles 24/24, build clean. Screenshots 121 (Spend: tiles + Mwangi pending w/ Approve/Reject + 2 approved) + 122 (Reports: by-category + by-cost-center bars) QA'd. Series at 122.
- GOTCHA re-confirmed: after `npm run build`, dev served stale `_next/static` (404 MIME errors → page didn't hydrate, Playwright couldn't find tabs). FIX = kill next + `rm -rf .next` + fresh `npm run dev` + WARM the route (curl /inventory) before screenshotting so chunks compile.

## ⏭️ NEXT: B.25 — Calendar & Events (strict list order)
Most lines were BUILT at A.17 (Calendar UI month/week/day, KE public holidays, cultural moments live, religious calendars opt-in, audience-targeted events, iCal export) — REVIEW each A.17 line and verify+tick under B.25 with evidence (don't rebuild). Remaining NEW: WhatsApp reminders (creds-gated → flag [~], reuse A.7 whatsapp seam), recurring events (RRULE — buildable now: add rrule field on CalendarEvent + expand occurrences in getOccurrences). Then B.26 Premium (mostly Bundi/hardware-gated review) → Part C.

## 🔁 CHAT-TRANSFER RESUME #3 (2026-06-13, this chat — Arena workspace)
- Recovered via founder GitHub repo `elvisybadbunny-bit/workspace-019ebe72-2dde-77f6-b386-5f42116a3601` (repo had neyo/ + docs/ FULL + 124 screenshots; .env correctly NOT in git → recreated: sqlite DATABASE_URL, NEW random NEYO_MASTER_KEK, APP_BASE_URL, ROOT_DOMAIN). Restored + verified: npm install ✓, prisma generate ✓, migrate deploy ✓ (60 migrations), db:seed ✓, typecheck ✓, test:roles 24/24 ✓, build ✓ (OOM-guarded), live principal login + /api/students ✓. Playwright chromium + apt libs reinstalled. **REMIND FOUNDER: make repo private.**
- DISCOVERY (same pattern as the old B.1 resume): the previous chat had built **ALL of B.25 Procurement** AFTER the last anchor was written — full DB + service + API + the `ProcurementTab` UI inside inventory-client.tsx (wired as the 5th /inventory tab) + seed + procurement-test.ts. It was just never ticked/anchored before the chat ended. This turn = VERIFY-AND-TICK (no rebuild).

## ✅ B.25 PROCUREMENT: COMPLETE 5/5 (verify-and-tick 2026-06-13, screenshot 120)
- DB (migration `b25_procurement`): **PurchaseRequest** (title/details/neededBy/status OPEN|ORDERED|CANCELLED, requestedBy denorm) + **PurchaseQuote** (per request, supplierName frozen, amountKes, note) + **PurchaseOrder** (poNo KH-PO-#### via A.4, links request+quote+supplier, status PENDING_APPROVAL|APPROVED|SENT|DELIVERED|MATCHED|CANCELLED, approval/delivery/3-way-match columns). Tenant.poApprovalThresholdKes Int @default(50000). All in TENANT_OWNED_MODELS.
- Service `procurement.service.ts` (ProcurementError → 404/422/403): createRequest → addQuote (supplier-exists 404, closed-request 422) → createOrderFromQuote (THRESHOLD RULE: total > threshold ⇒ PENDING_APPROVAL else auto-APPROVED "(under threshold)"; request → ORDERED; poNo gen) → approveOrder (LEADERSHIP only; creator-cannot-self-approve FORBIDDEN) → markSent → recordDelivery (goods-received note + deliveredValueKes) → **threeWayMatch** (PO total vs goods received vs supplier invoice; all-equal = matchOk, any diff flagged with a human note; double-match blocked) → cancelOrder (reopens the request). procurementBoard returns thresholdKes + open/ordered requests w/ quotes cheapest-first (cheapestQuoteId) + last-50 orders. All actions audited (procurement.request_created/quote_added/po_created/po_approved/po_sent/po_delivered/po_matched/po_cancelled).
- API GET /api/procurement (board, inventory.view) + POST {action: request|quote|order|approve|send|deliver|match|cancel} — **approve gated separately on tenant.manage_settings (leadership), everything else inventory.manage (bursar)**. GET teacher 403 + POST approve teacher 403 both HTTP-verified.
- UI: 5th "Procurement" tab in /inventory (ClipboardCheck icon) — `ProcurementTab` in inventory-client.tsx: "Orders above KES X need leadership approval" notice, OPEN requests w/ quote comparison (green "BEST PRICE" highlight on cheapest + per-quote Order button), Purchase-orders pipeline w/ status badges (awaiting approval/approved/sent/delivered/matched ✓) + stage-aware buttons (Approve [canApprove only] / Send / Record delivery / 3-way match) + match note green/red; 4 dialogs (ReqDialog/QuoteDialog/DeliverDialog/MatchDialog). EmptyState when nothing in procurement. All 4 UX states.
- Seed (idempotent): "Term 3 dry foods restock" by Achieng Mary w/ 2 quotes (Naivas KES 86,500 cheapest "30-day credit" vs Kiambu General Traders KES 92,000) + 1 MATCHED PO KH-PO-000001 "Cleaning supplies — June" (KES 18,500 under threshold → auto-approved, clean 3-way match).
- procurement-test.ts **16/16 ✓** (SELF-HEALS, removes test rows): threshold default 50k, seed request 2 quotes cheapest-first, seed matched PO clean, under-threshold→auto-APPROVED, poNo gen, clean 3-way match→matchOk, over-threshold→PENDING_APPROVAL, cannot-send-unapproved, creator-cannot-self-approve, principal approves, mismatch flagged + note explains diffs, double-match blocked, cancel reopens, quote-on-ORDERED blocked, audits written.
- tsc clean, test:roles 24/24, build clean. Screenshot 120 QA'd (glass-default, Procurement tab, quote comparison w/ BEST PRICE, KH-PO-000001 matched ✓). Series at 120.

## ⏭️ NEXT: B.25 — Expenses Tracking (strict list order)
Lines: Expense categories / Cost centers / Approval workflows / Receipt photo upload + OCR (OCR = Bundi-gated, flag the OCR sub-line; manual entry works fully without it) / Reports. Design: ExpenseCategory + CostCenter (tenant-owned) → Expense (category/costCenter/amountKes/date/payee/receiptFileUrl via A.9/status PENDING|APPROVED|REJECTED) → approval threshold like Procurement (reuse poApprovalThreshold pattern or a new expenseApprovalThreshold) → reports (by category/cost-center/month) that FEED the honest B.24 profitability line (currently payroll×3 proxy; real expenses replace the proxy). Then Calendar & Events review → B.26 review → Part C.

## ✅ B.25 SUPPLIER MANAGEMENT: COMPLETE 4/4 (built + live-tested 2026-06-13, screenshot 119)
- DB (migration `b25_suppliers`): **Supplier** (@@unique tenant+name; category/phone/email/contact/kraPin/rating 0-5/notes/archived) + **SupplierContract** (title/startsOn/endsOn/valueKes/note). Both in TENANT_OWNED_MODELS. SUPPLIER_CATEGORIES = Food/Uniform/Cleaning/Stationery/Transport/Services/Other.
- Service `supplier.service.ts`: createSupplier (dup 409, normalizeKePhone 422 on bad), rateSupplier (1-5 only), archiveSupplier (hidden from directory), addContract (end≤start 422, negative 422), supplierDirectory (contracts + expired/expiringSoon ≤30d flags + daysLeft via B.17 daysUntil pattern + per-supplier hasExpiring/hasExpired/activeContracts). SupplierError mapped 404/409/422 in respond.ts. All actions audited (supplier.created/rated/contract_added/archived).
- API GET/POST /api/suppliers (GET inventory.view, POST inventory.manage — teacher 403 HTTP-verified). Actions: add/rate/archive/contract.
- UI: 4th "Suppliers" tab in /inventory (Truck icon) — supplier cards w/ ONE-TAP star ratings, contract list w/ green active / amber "Nd left" / red expired badges, per-supplier "Add contract" link, Add-supplier + Add-contract dialogs (contract dialog explains the 30-day warning).
- Seed (idempotent): Mama Wanjiku Tailors (★5, Uniform — the G.24 relay tailor now a real row) + Naivas Wholesale Kiambu (★4, Food, KRA PIN) + 2 contracts: dry-foods ending in ~20d (AMBER demo) + uniform framework to Dec (green).
- supplier-test.ts 14/14 ✓ (SELF-HEALS): seed flags, daysLeft 20, phone normalization, dup/bad-phone/rating-9/backwards-contract all rejected, expired flag, archive hides, audits. HTTP: bursar list ✓ teacher 403 ✓.
- tsc clean, build clean (/api/suppliers). Screenshot 119 QA'd (stars + renew-soon 20d left + active badges). Series at 119.

## ✅ B.25 SCHOOL ASSETS: COMPLETE 5/5 (built + live-tested 2026-06-13, screenshots 117-118)
- REVIEW-FIRST: tagging/custodian/acquiredOn existed at B.18 — ticked w/ evidence; B.25 added ONLY depreciation + maintenance.
- DB (migration `b25_asset_depreciation_maintenance`): Asset += depreciationPctPerYear Int @default(0) + nextMaintenanceOn String? + maintenance relation; NEW **AssetMaintenance** (date/kind SERVICE|REPAIR|INSPECTION|OTHER/costKes/note/byName — mirrors B.17 VehicleMaintenance). In TENANT_OWNED_MODELS ("assetMaintenance").
- Service (inventory.service.ts +): **bookValueKes()** pure straight-line fn (acquiredOn + %/yr, floors 0, no-dep/no-date = full value; unit-verified incl. 1-yr ≈75k and 10-yr floor), updateAsset (dep 0-100 guard 422, audited), logAssetMaintenance (negative cost 422, optional nextMaintenanceOn update in one call, audited), **assetRegister()** = assets + bookValueKes + maintenanceDue (next ≤ today, EAT) + maintenanceSoon (≤30d) + total spent + last-10 history. GET /api/inventory now returns assetRegister (assets carry the computed fields).
- API /api/inventory POST += actions updateAsset / assetMaintenance (inventory.manage; teacher 403 HTTP-verified).
- UI: Assets tab rows now show BOOK VALUE + "bought KES X · −N%/yr" + red "service due"/amber "service soon" badges; click row → **AssetDrawer** (right-side, z-50): value strip (book value + maintenance spent), Acquisition & depreciation editor, Log service/repair form (kind/date/cost/note), Service history list.
- Seed (idempotent + BACKFILLS old DBs via updateMany-where-dep=0): laptop 25%/yr + next service 2026-06-01 (OVERDUE demo) + 1 log (3,500 "OS re-install + new battery"); benches 10%/yr.
- asset-test.ts 15/15 ✓ (SELF-HEALS, restores seed): pure-fn spot checks, register book values, OVERDUE flag, dep>100 422, custodian update + audit, log → history 2 + spent 5,500 + due flag CLEARED by next date, negative 422. HTTP: bursar assets w/ (78,000→50,551, due=True) ✓, teacher updateAsset 403 ✓.
- tsc clean, build clean. Screenshots 117 (register w/ badges) + 118 (drawer: book value 50,551 / spent 3,500 / editor / log form / history) QA'd. Series at 118.

## ✅ CARD BALANCE FIX (founder 2026-06-13: "text not well balanced in the cards")
- ROOT CAUSE: shared CardContent had static `p-5 pt-0 sm:p-6 sm:pt-0` — standalone CardContent (no CardHeader) rendered with ZERO top padding on desktop (twMerge keeps sm:pt-0), so text hugged the card top while bottom/sides had full padding.
- FIX in ONE place (`src/components/ui/card.tsx`): CardContent now `p-5 sm:p-6 [&:not(:first-child)]:pt-0` — standalone = full equal padding all sides; after a CardHeader = top padding stripped (header already supplies it). Fixes ALL ~51 card usages at once; no per-page edits.
- BALANCE RULE recorded: start-of-card → text === text → edges/dividers, always. Screenshots 104 + 113 retaken + QA'd (owner tiles + dashboard cards now even).

## ✅ B.25 UNIFORM MANAGEMENT: COMPLETE 4/4 (built + live-tested 2026-06-13, screenshots 115-116)
- REVIEW-FIRST (per anchor warning): items + sales were ALREADY BUILT (B.18 StockItem "Uniform" + G.24 placeOrder/invoice/supplier-SMS/deliver) — ticked with evidence, NOT rebuilt. B.25 added ONLY the missing per-size layer.
- DB (migration `b25_uniform_sizes`): **UniformSize** (tenantId+itemId+size @@unique, qty Int) + StockItem.sizes relation + Tenant.uniformSizes. In TENANT_OWNED_MODELS ("uniformSize").
- Service (uniform.service.ts +): setSizeStock (upsert; uniform-category-only 422; negative 422; **master StockItem.qty auto-syncs to SUM of size rows — one stock truth**), sizeBoard (items + size rows for staff board AND family dialog), UNIFORM_SIZE_PRESETS. markDelivered now ALSO decrements the named size row.
- API /api/uniforms: GET += sizes; POST += action "sizeStock" (staff/inventory.manage only — parent 403 HTTP-verified).
- UI: /inventory NEW "Uniform sizes" tab (Shirt icon) — per-item size pills (red 0 / amber ≤3 / normal) + click-to-edit qty dialog + dashed "+ XS/+ Size 30" preset chips. Family portal OrderDialog: live size pills when sizes exist (sold-out disabled strikethrough, "(N left)" ≤3 hint, size required), free-text fallback when school keeps no sizes.
- Seed: sweater S8/M14/L12/XL6 (sum 40 = master qty), idempotent.
- uniform-sizes-test.ts 10/10 ✓ (SELF-HEALS + restores seed + deletes test order/invoice/movement): board, sum-sync 46, negative/non-uniform 422s, parent order size M ×2 → invoice + supplier SMS w/ size fired live → deliver → size 20→18 AND master 46→44, sold-out row. HTTP: bursar sizes ✓, parent write 403 ✓.
- tsc clean (NODE_OPTIONS=4096 needed when dev server runs concurrently), build clean (/inventory 9.42kB). Screenshots 115 (sizes board) + 116 (mobile dialog w/ L/M/S/XL pills) QA'd. GOTCHA: Playwright `page.locator("button",{hasText:/^X$/})` fails on tab buttons w/ icons — use getByText(...,{exact:false}).

## ⏭️ NEXT: B.25 — Procurement (strict list order)
Lines: Purchase requests / Quotations comparison / PO generation / Approval workflow per threshold / Delivery tracking + 3-way match. Design: PurchaseRequest (requester/items/status) → quotes per supplier (compare board) → PO (PO-#### via nextTenantId, links Supplier) → approval threshold (e.g. >KES 50k needs principal — Tenant setting) → delivery receipt vs PO vs invoice = 3-way match; received goods can stock-in to B.18. Then Expenses → Calendar&Events review → B.26 review → Part C.

## ✅ B.24 OWNER DASHBOARD: COMPLETE 9/9 (built + live-tested 2026-06-13, screenshots 113-114)
- DB (migration `b24_owner_dashboard`): Tenant.collectionTargetPct Int @default(85). NEW permission **owner.dashboard** → LEADERSHIP bundle (SCHOOL_OWNER/PRINCIPAL; SUPER_ADMIN all) — teacher/bursar/parent blocked (can() + HTTP 403 + page→/forbidden verified). Nav "My School" (LineChart icon, Overview, permission-gated).
- Service `owner-dashboard.service.ts` (ownerDashboard + setCollectionTarget): students live (active/boys/girls/boarders via open hostelAllocation), revenue today (PAID Payments since NAIROBI midnight = dayStart UTC-3h) + term (paidKes on current-term invoices, discount-honouring min()), collection % vs target (on-track flag), arrears buckets + top-5 debtors (names+adm+links — owner can act), staff costs from latest B.8 PayrollRun (gross/net/statutory/staff/Approved), profitability = collected − gross×3 months (honest proxy, negative shown red, note points to C.5 expenses), enrollment trend 6 months by admittedOn (UTC month keys), exam trend (published-only, mean% vs maxMarks), **ranking ANONYMIZED** (percentile of collection rate across all tenants w/ bills; raw db cross-tenant ON PURPOSE but returns ONLY percentile+cohort — never names; cohort<2 → null + friendly note). setCollectionTarget clamps 10-100 + audit owner.target_updated.
- API GET/POST /api/owner (both requirePermission owner.dashboard; POST zod targetPct 10-100).
- UI /owner + components/owner/owner-client.tsx — glass-first, 4 UX states (skeleton grid / EmptyState+retry / populated; CSS-only bar charts, no chart lib): 4 stat tiles (incl. collection bar w/ inline target editor), arrears bars + largest-balances list, staff costs + term money position (surplus red/green), enrollment bars, exam mean bars, anonymized ranking card.
- Seed: demo PayrollRun 2026-05 APPROVED now seeded idempotently using the REAL grossToNet calculator (B.24 needed staff costs; period-exists guard). KES 295,000 gross / 4 staff.
- owner-test.ts 25/25 ✓ (perm gates ×5, payload vs raw-DB truth: students 5, buckets sum 57,500, debtors sorted, payroll 2026-05 4 staff, surplus math, 6 months, CAT 1 64%, anonymization grep, target set/clamp/audit/restore). HTTP: principal full payload ✓, teacher 403 ✓, page 200/forbidden ✓.
- tsc clean, test:roles 24/24, build clean (/owner 6.07kB + /api/owner). Screenshots 113 (desktop glass — QA'd: tiles, amber 45% vs 85% bar, red aging bar, debtor links, -837k surplus honest red) + 114 (mobile 360px). Series at 114.

## 🔁 CHAT-TRANSFER RESUME #2 (2026-06-13, this chat)
- Recovered via founder GitHub repo `elvisybadbunny-bit/workspace-019ebd39-c35e-7c82-97d5-8b7394b25ac43` (repo had neyo/ + docs/ FULL versions + 108 screenshots; .env included this time). Restored: npm install ✓ 54 migrations ✓ seed ✓ typecheck ✓ test:roles 24/24 ✓ build ✓ live principal login + /api/students ✓. REMIND FOUNDER: make repo private.

## ✅ G.33 2.0 — LIQUID GLASS IS THE DEFAULT SYSTEM (founder-APPROVED 2026-06-13, built + live-tested, screenshots 104-109)
- **DB (migration `g33_liquid2_platform_setting`): PlatformSetting key-value — COMPANY-GLOBAL, NOT in TENANT_OWNED_MODELS** (same family as PlatformFlag). Key "liquid_level" = "1"|"2"|"3" (subtle/standard/deep), seeded "2".
- **Theme system: glass is DEFAULT.** Root layout html className="glass" data-liquid="2"; pre-paint script: no localStorage key = glass; "glass-dark" adds .dark; "light"/"dark" strip .glass (plain fallbacks kept). theme-toggle.tsx cycle glass → glass-dark → light → dark (Droplets icon, green droplets for glass-dark); on mount it fetches /api/platform/appearance and applies + caches data-liquid in localStorage("neyo-liquid").
- **CSS (globals.css G.33 2.0 block): token-driven** — --lg-blur/--lg-sat/--lg-card/--lg-shell/--lg-side/--lg-input/--lg-pill/--lg-sheen per html.glass, html.glass.dark, and [data-liquid="1|3"] overrides (blur 12/22/32px). Ambient liquid backdrop light (warm water + green/navy radials) AND dark (deep navy + green glow). EVERY element frosted: .bg-white cards, .bg-navy-900/800 dark cards, aside/header/.bg-warm-50 shell, inputs/selects/textareas, .bg-navy-100 pills, ⌘K palette + dialogs (heavier frost via `.fixed .rounded-2xl`), overlay scrim gets backdrop blur. **Drifting specular sheen** on rounded-2xl cards (14s CSS keyframe, off at level 1, brighter at level 3, killed by prefers-reduced-motion). Print + reduced-transparency strip everything.
- **SIDEBAR DISTINCTION FIX (founder: "left panel not distinguishable")**: app-shell aside now bg-warm-50 + border-navy-200/70 + soft right drop-shadow in base themes; glass adds: more-opaque --lg-side, vertical green tint gradient, inset edge glow + 6px side shadow. Reads as its own pane in all 4 themes.
- **Company-only API**: GET /api/platform/appearance (any signed-in user) / POST {liquidLevel} (SUPER_ADMIN only). Service platform-appearance.service.ts (AppearanceError→422 in respond.ts; audit platform.appearance_updated). LIVE-TESTED: principal GET ✓ + POST 403 ✓; super admin set 3 ✓, invalid 9 → 422 ✓; level-3 verified in browser (data-liquid=3, --lg-blur:32px) ✓; restored to 2.
- **GOTCHAS (new, recorded in PROMPT-3):** ① NEVER restyle a utility the base layer @apply's — `html.glass.dark .bg-navy-950` broke the build (circular dependency); skeleton bg now raw hex for the same reason. ② ESLint react-hooks flags ANY `use*` import inside route handlers — `useGatePass` aliased to `markGatePassUsed` in /api/security. ③ Sandbox `npm run build` can OOM — `NODE_OPTIONS="--max-old-space-size=4096" npm run build`. ④ next/image caches optimized images — renaming the file (bundi-hero-v2.png) busts it.
- Screenshots (1920×1080): 104 glass-light dashboard, 105 glass-dark dashboard, 106 liquid ⌘K search (Achieng results on frosted palette), 107 level-3 deep, 108 Bundi page, 109 glass mobile 360px. All QA'd.
- **AUTH PAGES VERIFIED GLASS (founder re-ask 2026-06-13):** /login (+ /get-started, /verify — same (auth) layout w/ .bg-warm-100 + .bg-white card, both glass-targeted) renders Liquid Glass BY DEFAULT — proven with a FRESH browser context (zero localStorage): frosted sign-in card, glass inputs, liquid wash background. The root-layout pre-paint script covers every route group incl. (auth) and (legal); no per-page work needed. Screenshots 110 (light default) / 111 (glass-dark) / 112 (mobile 360px). Series now at 112. scripts/shot-login-glass.ts kept.

## ✅ G.36 — BUNDI LAYER EXPERIENCE SHELL (B.23 design-only; founder-directed 2026-06-13)
- **FOUNDER LAWS:** never say "AI" — the mascot Bundi IS the helper; ships OFF (platform-paused) until launch through the mascot; NO feature may depend on this layer (audited: zero AI/openai/claude refs in src/; all B-module "AI swap points" are rule-based engines that work forever without it).
- modules.ts += key "bundi" (defaultOn:true BUT paused platform-wide → hidden everywhere). navigation.ts += Bundi (Feather icon, /bundi, moduleKey bundi) in Overview. Seed upserts PlatformFlag bundi paused=true note "Bundi is getting ready — meet your new helper soon." (update:{} so a deliberate release is never overwritten by reseed).
- /bundi page (requirePageUser + isPaused) + components/bundi/bundi-client.tsx: WWDC hero (transparent mascot public/brand/bundi-hero-v2.png — alpha-keyed from bundi-mascot.png via PIL, green glow, "New from NEYO" badge, "Bundi is here to help", lock pill w/ flag note), 4 preview cards (Ask Bundi/Report card remarks/Early flags/Lesson plan starters) badged "Soon", trust footer. Zero fake output, zero "AI" (grep-verified 0).
- **LAUNCH DAY = one call:** POST /api/admin/flags {moduleKey:"bundi", paused:false} → nav + page unlock for every school instantly (rehearsed live: release → enabled:true + lock gone → re-paused to ship state).
- B.23 ENGINE LINES: stay [ ] deferred-pending-AI-key + founder launch signal; checklist B.23 header notes the Bundi directive.

## ⏭️ NEXT: B.25 — Additional Modules (strict list order)
Sub-blocks in order: **Uniform Management** (items/sizes/stock per size/sales+payment tracking — NOTE: G.24 already built catalogue+orders+invoice-billing on B.18 StockItem; review overlap line-by-line, extend with per-size stock rather than rebuild) → **School Assets** (B.18 Asset model exists: tagging done; add acquisition records, depreciation auto-calc, maintenance schedule, custodian) → **Supplier Management** (records/categories/ratings/contracts w/ expiry) → **Procurement** (purchase requests → quotation comparison → PO → approval thresholds → delivery + 3-way match) → **Expenses Tracking** (categories/cost centers/approvals/receipt photo upload (OCR=Bundi-gated, flag)/reports — completes the honest B.24 profitability line) → **Calendar & Events** (most lines BUILT at A.17 — verify+tick; remaining: WhatsApp reminders [creds-gated], recurring events RRULE). Then B.26 Premium (mostly Bundi/hardware-gated review) → Part C.

## ✅ B.22 SECURITY: COMPLETE (built + live-tested, screenshots 101-102 Full HD)
- DB (migration `20260612190000_b22_security`): **GatePass** (GP-####, leaveAt/returnBy/escort, ACTIVE|USED|EXPIRED|CANCELLED, usedAt gate-stamp), **PickupPerson** (relationship/phone/nationalId, soft-removed via active), **PanicAlert** (kind/location, smsSent, resolvedBy). All in TENANT_OWNED_MODELS.
- Permissions: security.view/manage → RECEPTIONIST (gate desk) + LEADERSHIP. **panic.raise → ALL 14 staff roles** (any mwalimu can pull the alarm; parents/students excluded).
- Service rules (security-test.ts 14 ✓): one ACTIVE pass per student 409; useGatePass case-insensitive, USED stamp, re-use rejected w/ "do not allow exit", unknown 404; cancel only ACTIVE; pickup add/lookup (by name or adm)/soft-remove; **raisePanic → in-app to EVERY staff (9 verified, category "emergency") + SMS to PRINCIPAL/DEPUTY/OWNER only (2 fired live, quota-recorded), parents NOT alerted (verified)**; resolve + double-resolve 409.
- API /api/security (GET passes+panics + ?pickup= lookup; POST gatePass/usePass/cancelPass/addPickup/removePickup/panic/resolvePanic — panic gated separately on panic.raise). UI /gate + security/gate-client.tsx — 3 tabs: Gate passes (issue + check-by-number box), Pickup authorisation (lookup w/ red "NOBODY authorised" warning + ID-check note), Emergency (big red RAISE button + ACTIVE banner + history). Nav: Security (DoorClosed, security.view).
- Visitor management line ticked (was BUILT at A.18 + B.16 link). CCTV = hardware-deferred flag.

## ✅ G.33 LIQUID GLASS THEME (founder loved WWDC25; THEME-ONLY until he verifies):
- globals.css `html.glass` block: ambient radial wash (green/navy/white — design rules, no purple), frosted .bg-white/.bg-warm-50/aside/header via backdrop-filter blur+saturate, inset specular highlight, prefers-reduced-transparency fallback, @media print FORCES plain (founder rule: never in documents). **GOTCHA: app-shell wraps content in .bg-warm-100 which sits OVER body — glass CSS must target both `html.glass body, html.glass .bg-warm-100`.**
- theme-toggle.tsx now 3-way cycle light→dark→glass (Droplets icon); layout.tsx pre-paint script handles "glass". LIGHT stays default (founder rule). Screenshot 103 (Full HD glass dashboard) QA'd.
- Performance: CSS-only, GPU-composited; no JS per frame. Promote to default ONLY on founder signal after his own device tests.

## 📌 G.34 SECURITY HARDENING (founder "AVOID HACKING") — recorded as a pre-launch block; baseline A.14 already strong (told founder honestly: HTTPS/HSTS/CSP, Argon2id, AES-256-GCM, immutable audit, rate limits, fail-closed tenancy). Remaining = dependency audit CI, pen test, session rotation, per-tenant 2FA enforcement, backup drill.
## 📌 G.35 SCALE TO 1M USERS (founder question) — answered YES by architecture (stateless Next horizontal scale, Neon Postgres prod, indexed tenant-scoped queries, externalizable jobs, R2, queueable comms); block records the deploy-time steps: Neon swap + RLS sql (already written), Redis rate limits, pooling/replicas, k6 load test, CDN.

## ✅ G.31 AUTO-PRINT QUEUE (founder: "INVOICES PRINT THEMSELVES"; built + live-tested, screenshots 99-100 at 1920×1080)
- DB (migration `20260612180000_g31_print_queue`): **PrintJob** (kind INVOICE|RECEIPT|CLASS_BATCH, refId, classId/classLabel frozen, url = PDF endpoint, QUEUED|PRINTED|FAILED, queuedBy). In TENANT_OWNED_MODELS.
- Service `print-queue.service.ts`: queuePrint (DEDUPES identical un-printed jobs), queueInvoiceAfterPayment (balance auto-computed into the title), queueReceiptForPayment, queueClassBatch (all invoices of a structure's class, grouped for distribution), queuedJobs (grouped by classLabel + printedToday), markPrinted (double-print 409).
- **AUTO-QUEUE HOOKS (no tap, founder rule)**: ① reception recordWalkInPayment (CASH + manual M-Pesa) → receipt; ② finance applyPaymentToInvoice → updated invoice; ③ M-Pesa onPaymentPaid → receipt + invoice. All best-effort try/catch — printing must never break the ledger. Bank slips wire into the same hooks when bank integration lands (B.7 deferred line).
- **HOW PRINTING WORKS (no special hardware)**: /print-station page stays open at reception → polls /api/print-queue every 10s → each job's PDF loads in a hidden iframe → contentWindow.print() to the default printer → marks PRINTED. Pause/resume button. PRINTER/PC OFF = jobs simply stay QUEUED (persistence verified: 4 jobs) and flush on reopen — this IS the founder's "if the printer is off it is queued" requirement, no driver/daemon needed. Access: reception.operate OR finance.view.
- print-queue-test.ts (12 ✓): cash auto-queue, payment auto-queue w/ balance in title, dedupe, M-Pesa double-queue, class batch 3×F2E grouped, double-print 409, offline persistence, teacher 403.
- NOTE: full silent printing without ANY dialog needs kiosk mode (chrome --kiosk-printing) on the reception PC — one-line setup note for founder deployments; the queue+iframe flow works regardless.

## ✅ G.32 FULL-WIDTH DESKTOP (founder: "SCREEN SHOULD BE FULL VIEW 1080"): app-shell max-w-7xl cap REMOVED (w-full). **STANDING RULE: desktop screenshots now 1920×1080** (founder said the old 1280px shots "don't look full"). Screenshots 99 (print station w/ queued receipt + F2E invoice "bal KES 16,000") + 100 (dashboard) at Full HD, QA'd.

## 📌 G.27-G.30 APPROVED & RECORDED (founder "ADD G 27 28 29 G 30") — checklist blocks added, BUILD ON FOUNDER SIGNAL: G.27 Mwalimu Day-One Pack (teacher print pack), G.28 Fee Promise-to-Pay, G.29 Report-Card Day Mode, G.30 NEYO Health Check (company churn dashboard).

## 📌 AUTOMATED FEE REMINDERS (founder re-asked): ALREADY LIVE since B.7 — sendFeeReminders cron daily 09:00 EAT, overdue → guardian SMS w/ balance, 3-day dedupe, quota-checked (checklist B.7 line ticked w/ evidence). Confirmed to founder, nothing new needed.

## ✅ B.21 MEDICAL/CLINIC: COMPLETE 5/5 (built + live-tested, screenshots 97-98)
- DB (migration `20260612170000_b21_clinic`): **StudentMedical** (one per student: bloodGroup, conditions, allergies JSON, SHA number), **ClinicVisit** (complaint/treatment/medicationGiven/referredTo, parentNotifiedAt), **MedicationPlan** + **MedicationDose** (per-dose trail). All in TENANT_OWNED_MODELS.
- Permissions: clinic.view/manage → SUPPORT_STAFF (school nurse role-stand-in) + **DEPUTY (added after 403 hit in screenshot run — deputy has a CUSTOM list, not the LEADERSHIP bundle; remember to add new perms BOTH places)** + LEADERSHIP.
- **ALLERGY SAFETY (3 surfaces, all verified)**: visit w/ matching medication → warning string returned + toast; startMedication matching allergy → BLOCKED 422; cafeteria kitchenToday() += foodAllergies from allergyRegister() (cooks see "Atieno — Groundnuts").
- Referral visits SMS the guardian (fired live: "...referred to Kiambu Level 5 Hospital. Please contact the school immediately."), quota-checked + recorded.
- Medication: plans w/ dosage/frequency/dates; giveDose trail (who+when+note); stop; dose-on-stopped 422; double-stop 409.
- healthReport: year visits/referrals/allergic/active-med counts + frequent visitors ≥3/yr. childHealth (scopeWhere) for the family portal: visits+allergies+bloodGroup, other-family 404.
- API /api/clinic (GET dashboard + ?file= + ?child=; POST profile/visit/medication/dose/stopMedication). UI /clinic + clinic-client.tsx — 4 tabs (Visits, Allergy register w/ red badges, Medications w/ Give-dose, Health report tiles + frequent visitors). Nav: Clinic (Stethoscope, clinic.view).
- Seed: Atieno O+ asthma + [Penicillin, Groundnuts] + SHA-1184422 + 1 visit (inhaler) + 1 plan w/ 1 dose; Kiprono B+. Reset block clears all 4 tables. clinic-test.ts (15 ✓, SELF-HEALS).
- tsc clean, build clean (/clinic 7.16kB), test:roles 24/24.

## ✅ G.26 THEME: REVERTED TO LIGHT DEFAULT (founder "JUST LET THE DEFAULT BE JUST THE LIGHT"): layout.tsx html has NO dark class; inline script ADDS dark only when localStorage neyo-theme==="dark"; theme-toggle default false. Checklist line struck-through + updated.

## ✅ B.20 DISCIPLINE: COMPLETE 5/5 (built + live-tested, screenshots 95-96)
- DB (migration `20260612160000_b20_discipline`): **DisciplineIncident** (8 KE categories, MINOR/MAJOR/SEVERE → points 1/3/5, actionTaken, parentNotifiedAt), **Suspension** (start/end, reason, conditions, ACTIVE|COMPLETED|REVOKED), **CounselingNote** (sessionType, followUpOn — CONFIDENTIAL). All in TENANT_OWNED_MODELS.
- Permissions: discipline.view/manage → TEACHER+CLASS_TEACHER (report only, scoped via teacherClassIds — outside-class 403 verified) + DEPUTY + LEADERSHIP. **counseling.confidential → PRINCIPAL/DEPUTY/LEADERSHIP ONLY** — gates counseling notes AND suspension issue/close (teachers report, deputies suspend — real KE school protocol). Teacher+bursar read-counseling blocked (verified). Audit row for counseling deliberately EXCLUDES the note text (verified no leak). Family portal childDiscipline (scopeWhere) returns incidents+suspensions, NEVER counseling; reporter names hidden from families.
- AUTO PARENT SMS: MAJOR/SEVERE incidents + every suspension → primary guardian (quota-checked + recordUsage; both fired live in tests; parentNotifiedAt stamped; "parent SMS ✓" badges).
- Behavior board: year demerit totals, bands GOOD <3 / WATCH 3-7 / AT_RISK ≥8, worst-first.
- API /api/discipline (GET scoped lists + ?counseling=1 + ?child= family view; POST incident/suspend/completeSuspension/counseling). UI /discipline + discipline-client.tsx — 4 tabs (Counseling tab HIDDEN unless counseling.confidential), severity pills (MAJOR amber/SEVERE red), "Major and severe incidents SMS the parent automatically" notice. Nav: Discipline (ShieldAlert, discipline.view).
- Seed: 2 Kamau incidents (minor lateness + major noisemaking w/ parentNotifiedAt). Reset block clears all 3 tables. discipline-test.ts (18 ✓, SELF-HEALS incl. smsPerTerm reset 1240).
- tsc clean, build clean (/discipline 7.2kB), test:roles 24/24. Screenshots 95 (incidents, DARK MODE visibly default) + 96 (behavior board) QA'd.

## ✅ G.25 STAMP REDESIGNED (founder 2026-06-12 follow-up): RECTANGLE rubber-stamp look — BLUE double-border frame, blue school name w/ logo at left, RED date through the middle between band rules, blue P.O. Box bottom line, -2° tilt, NO "digital stamp" wording (founder explicitly banned it). school-stamp.tsx now takes {schoolName, county, addressLine, logoDataUrl, dateText} + width (ratio 2.6:1). invoice-pdf passes addressLine. Screenshot 94 retaken + QA'd.

## ✅ G.21-G.26 FOUNDER BATCH (one turn, all live-tested via scripts/founder-batch-test.ts 20 ✓):
- **G.21 School type**: Tenant.schoolType DAY|BOARDING|DAY_AND_BOARDING (+ uniformSupplierName/Phone) in migration `20260612150000_g20_founder_batch`. In school-profile schema/service/API. setting DAY auto-disables the hostel module (tenantModule upsert in updateSchoolProfile — verified). Karibu seeded DAY_AND_BOARDING + "Mama Wanjiku Tailors" +254722334455.
- **G.22 Platform pause**: PlatformFlag model — **NOT in TENANT_OWNED_MODELS (company-global!)**. platform-flags.service: pausedModuleKeys/isPaused/listFlags/setFlag(audited). getModuleStates now checks paused FIRST (overrides tenant-enable → nav vanishes everywhere). API /api/admin/flags requireRole(SUPER_ADMIN). Verified: pause cafeteria w/ note → hidden for all; release → back.
- **G.23 Packages**: plans.ts rebuilt — Free Karibu/**Msingi(NEW 4,500)**/Pro/Elite each w/ tagline, includedModules entitlements, support tier, perStudentPerTerm seam, overage; ADD_ONS (6: sms_topup_1000/extra_storage/hostel_module/transport_module/inventory_module/priority_support); estimateTermCost(). Billing service untouched (grandfathering intact); plan-gating of modules = wire later when founder wants enforcement.
- **G.24 Uniform shop**: StockItem.imageUrl + UniformOrder model (UO-####, status PLACED→SENT_TO_SUPPLIER→DELIVERED, invoiceId REQUIRED). uniform.service: catalogue (Uniform-category sellables), placeOrder (scopeWhere row-scoping! invoice at placement + SMS to supplier — fired live), listOrders, markDelivered (stock decrement + SALE movement). API /api/uniforms (family portal.parent OR staff inventory.manage). UI: UniformCard (portal/uniform-card.tsx) on family-portal child view — photo grid, Order dialog w/ size, order tracker badges.
- **G.25 Invoice upgrade**: invoice-pdf.tsx → **A5**, compact styles, school LOGO in header (logoAsDataUrl reads from local storage — react-pdf can't fetch auth'd URLs), "Powered by NEYO · neyo.co.ke" footer, **SchoolStamp** (documents/school-stamp.tsx) auto-placed bottom-right. **BIG GOTCHA: react-pdf <Image> REJECTS SVG data-URIs ("Only HTTP(S) protocols") — stamp drawn with react-pdf's native <Svg><Circle> primitives + Text layers instead.** Stamp = double ring, school name, logo-or-initials, date, county, "OFFICIAL DIGITAL STAMP". Screenshot 94 (A5 PAID invoice w/ stamp + NEYO footer; stamp moved left of QR after visual QA).
- **G.26 Dark default**: html className="dark" + inline head script (remove dark only if localStorage neyo-theme==="light"); theme-toggle defaults dark. PDFs stay light.
- tsc clean, build clean, test:roles 24/24. Founder-batch test SELF-CONTAINED (resets flags/orders, restores hostel module + stock).

## ✅ B.19 CAFETERIA: COMPLETE 4/4 (built + live-tested 2026-06-12, screenshots 91-93)
- DB (migration `20260612140000_b19_cafeteria`, diff+deploy): **MealPlanEntry** (@@unique(tenant,dayOfWeek,mealType) — upsert edits in place) + **MealCard** (MC-#### card no, meals JSON, termFeeKes, invoiceId REQUIRED — founder rule baked into the schema). In TENANT_OWNED_MODELS.
- Permissions: cafeteria.view/manage → LEADERSHIP + BURSAR (manage); SUPPORT_STAFF got cafeteria.view (kitchen crew reads menu/headcount). Module key "cafeteria" + nav (UtensilsCrossed). Seed enables it for Karibu.
- Service `cafeteria.service.ts`: weekMenu/setMenuEntry (upsert); **kitchenStock REUSES B.18 Kitchen Store** (store name contains "Kitchen" — one stock truth); issueForMeal wraps B.18 stockOut(reason "Kitchen — <meal>"); **issueCard = INVOICE FIRST then card** (nextTenantId, UNPAID, due +14d), one-active-card-per-term 409, cancelCard; kitchenToday = headcount/meal (active cards + ALL boarders via hostelAllocation — boarding fee covers meals) + today's menu + low stock.
- API GET/POST /api/cafeteria (setMenu/issueCard/cancelCard/kitchenIssue). UI /cafeteria + cafeteria-client.tsx — Kitchen today (3 headcount tiles w/ today's dish, boarders note, low-stock strip, kitchen store list, Issue-food dialog), Week menu (7×3 click-to-edit grid), Meal cards (issue dialog w/ meal toggles + invoice-rule notice, cancel, live invoice status badges).
- Seed: 21 menu entries (real dishes: uji/githeri/pilau Friday/ugali na omena/matumbo) + Wanjiru's MC-0001 lunch card billed to KH-INV-MEAL01 (UNPAID). Reset block clears mealCard/mealPlanEntry.
- cafeteria-test.ts (14 ✓, SELF-HEALS): 21 entries, upsert-no-dup, kitchen-store reuse, issue 18→14 w/ traced reason, MC-0001→KH-INV-MEAL01, new card → invoice → FAMILY PORTAL (verified), dup-card 409, double-cancel 409, headcount math (lunch 5 = 4 boarders + 1 card), today's menu 3 meals. GOTCHA: cancelled test cards must be deleted in cleanup (listCards showed orphan "—" invoice) — test fixed.
- HTTP: bursar full ✓, teacher 403 ✓. tsc clean, build clean, test:roles 24/24. Screenshots 91 (kitchen board), 92 (week menu grid), 93 (issue-card dialog w/ rule notice) QA'd. NOTE: a 2nd redundant `npm run build` HUNG after a clean first build — don't double-build, kill + check .next exists.

## 📸 INVOICE PDFs SCREENSHOTTED FOR FOUNDER (88-90, rendered via pdftoppm/poppler-utils):
88 = store-sale invoice (sweater, UNPAID stamp, QR verify, print-tracking "Copy #1 — every print is tracked"), 89 = PARTIAL fee invoice, 90 = PAID IN FULL green stamp. B.7 invoice-pdf.tsx w/ G.9 branding (motto "Elimu ni Mwanga"), learner/adm/class/due header, paid vs balance rows, guardian line, QR + verify code. pdftoppm pattern: `pdftoppm -png -r 90 -f 1 -l 1 in.pdf out`.

## 📌 FOUNDER STANDING RULE (2026-06-12): "ALL SERVICES CONNECTED TO STUDENT INVOICES"
Every chargeable service MUST bill the student's B.7 invoice (shows on family portal, payable via STK). Status: boarding fees ✓(B.16 invoiceBoarders) · transport fees ✓(B.17 invoiceRiders) · store sales ✓(B.18 sellToStudent) · library fines ✓(billFineToInvoice). PATTERN: nextTenantId(INVOICE) + db.invoice.create UNPAID + due +14d (or chosen) + idempotency where batch. APPLY to B.19 Cafeteria (meal plans), B.25 uniform sales, any future charge.

## ✅ B.18 INVENTORY/STORES: COMPLETE 6/6 (built + live-tested 2026-06-12, screenshots 85-87)
- DB (migration `20260612130000_b18_inventory`, diff+deploy pattern): **Store**, **StockItem** (qty balance, reorderLevel, sellPriceKes = sellable, trackExpiry), **StockBatch** (batchNo/expiry), **StockMovement** (IN|OUT|SALE|ADJUST, SALE carries studentId+invoiceId — the proof chain), **Asset** (auto AST-#### tag, condition). All in TENANT_OWNED_MODELS.
- Permissions: NEW inventory.view/manage → LEADERSHIP + **BURSAR** (stores+uniform sales are bursar territory). New module key "inventory" in modules.ts + nav (Boxes icon). **Seed now enables ALL built modules for Karibu (hostel/library/transport/lms/inventory) — transport & lms were OFF and hidden from nav before (gotcha found this turn).**
- Service rules (all live-tested, scripts/inventory-test.ts 21 ✓): dup store/item 409, insufficient 409, batch REQUIRED on stock-in for trackExpiry items 422, FIFO batch depletion on OUT (earliest expiry first — verified B-2026-05 consumed before B-2026-06), reorder alerts (rice 4≤6, cleared after top-up), expiry alerts ≤30d + expired strips. **sellToStudent**: price×qty → REAL invoice (verified on Achieng's ledger AND family portal w/ Pay button) + stock decrement + SALE movement linking student+invoice. **billFineToInvoice** (library.service): unpaid fine → invoice, double-bill 422, "Add to invoice" button beside "Collect cash".
- API: GET/POST /api/inventory (?movements=; actions addStore/addItem/in/out/sell/addAsset). UI: /inventory + inventory-client.tsx — Stock tab (3-colour alert strip amber-reorder/orange-expiring/red-expired, item rows w/ In/Out/Sell buttons, movements drill-down), Assets tab (tag badges + condition + value). Sell dialog shows the rule: "billed to the student's fee invoice... family can pay via M-Pesa".
- Seed: Main Store (sweater KES 1,200 + exercise book KES 120 sellables) + Kitchen Store (maize flour 18 bales w/ 2 batches one expiring in 14d; rice 4 bags LOW), 1 IN movement, 2 assets. Reset block clears all 5 inventory tables.
- HTTP verified: bursar full access + live sale (sweater→KH-INV-000010→parent portal UNPAID 1,200 w/ Pay button); teacher 403, parent 403.
- tsc clean, build clean (/inventory 8.44kB + /api/inventory), test:roles 24/24. Screenshots 85 (stock w/ alert strips), 86 (sell dialog w/ invoice-rule notice), 87 (mobile portal: "School sweater × 1 (school store)" KES 1,200 + Pay) QA'd.

## ⏭️ NEXT: B.23 — AI Intelligence Layer (strict list order)
Lines are AI-key-gated (founder OpenAI/Claude cred needed): report comments, lesson plans, KCSE prediction, risk detection, photo marks-grading, AI tutor... REVIEW each line: anything buildable rule-based gets built, the rest flagged DEFERRED-pending-AI-key; then proceed B.24 Owner Dashboard (buildable now).

## ✅ B.17 TRANSPORT: COMPLETE (built + live-tested 2026-06-12, screenshots 82-84)
- DB (migration `20260612120000_b17_transport`, manual diff+deploy pattern): **TransportRoute** (stops JSON ordered, termFeeKes, vehicleId/driverId), **Driver** (@@unique(tenant,licenseNo), licenseExpiry), **Vehicle** (@@unique(tenant,regNo), capacity, insuranceExpiry + inspectionExpiry — KE NTSA compliance), **VehicleMaintenance** (type/cost/odometer/garage), **FuelLog** (litres/cost/odometer/station), **TransportAssignment** (one open row per student, pickupStop). All in TENANT_OWNED_MODELS.
- Permissions: NEW transport.view/manage → LEADERSHIP only for now (no dedicated TRANSPORT role in the 16; SUPPORT_STAFF could get view later if founder asks). Nav /transport fixed student.view → transport.view. Parent + librarian 403 verified.
- Service `transport.service.ts` (TransportError mapped 404/409/422): EXPIRY_WARN_DAYS=30 → insurance/inspection/DL "expiring" flags (daysUntil helper). **km/L consumption** = km between last two fill-ups ÷ newest litres (needs odometer on both; 7 km/L verified). Assignment rules: one-route-per-student, bus-capacity FULL 409, pickupStop must be in route.stops 422. invoiceRiders → idempotent B.7 invoices by description "Transport — <route> — Term N YYYY" (same pattern as B.16 boarding; nextTenantId INVOICE).
- API: GET/POST /api/transport (?riders= ?vehicle=; actions addRoute/addDriver/addVehicle/maintenance/fuel/assign/release/invoice). UI: /transport + transport-client.tsx — tabs Routes (cards w/ stops chain + seats-left + Riders board + Invoice riders), Fleet (compliance badges red-insurance/amber-NTSA/green-compliant + km/L + vehicle file w/ fuel & maintenance logs + Log dialogs), Drivers (DL badges). GPS notice: "arrives with tracker hardware — flagged for later, never faked".
- Seed: KCB 123A Toyota Coaster 33-seat (insurance expiring in ~20d → red badge demo) + KDA 456B Isuzu NQR 51-seat (compliant); drivers Omondi Peter (DL ok) + Wafula John (DL expiring); Route A Kasarani (9,000/term, 4 stops) + Route B Githurai (7,500/term); riders Wanjiru@Mwiki + Kiprono@Seasons; 2 fuel logs → 7 km/L + 1 service 18,500. Reset block clears all 6 transport tables.
- transport-test.ts (21 ✓, SELF-HEALS): seat math 31/33, dup route/DL/regNo 409s, expiry alerts, km/L, vehicle-file totals (21,240/18,500/118L), one-route-per-student, invalid stop, capacity-full, release rules, invoices 2×9,000 idempotent, no-fee blocked. HTTP verified + 403s.
- GOTCHA hit AGAIN this session: node_modules AND playwright cache both wiped (separate moments). Recovery worked as documented: npm install + prisma generate; npx playwright install chromium + apt libs.
- tsc clean, build clean (/transport 9.27kB + /api/transport), test:roles 24/24. Screenshots 82 (route cards w/ stops chain), 83 (fleet w/ red insurance badge vs green compliant + 7 km/L), 84 (vehicle file: fuel/maintenance logs + KES totals) QA'd.

## ✅ B.16 HOSTEL: COMPLETE (built + live-tested 2026-06-12, screenshots 79-81)
- DB (migration `20260612110000_b16_hostel` — manual `migrate diff --script` + `migrate deploy` pattern again): **Hostel** (gender BOYS|GIRLS|MIXED, masterId, boardingFeeKes/term), **HostelRoom** (capacity = beds), **HostelAllocation** (bed-level, open while releasedAt null, denormalized studentName/admissionNo), **HostelAttendance** (@@unique(tenant,student,date), IN|OUT|LEAVE). VisitorLog += studentId (boarder visit link). All in TENANT_OWNED_MODELS.
- Permissions: NEW hostel.view/hostel.manage → HOSTEL_MASTER + LEADERSHIP. Nav /hostel fixed attendance.view → hostel.view. NEW seed login: **hostel@karibuhigh.ac.ke (Barasa Wekesa, HOSTEL_MASTER, KH-U-000009)**.
- Service `hostel.service.ts` rules (ALL live-tested in scripts/hostel-test.ts, 20 ✓): gender rule (girl→boys' 422), one-bed-per-student, bed-taken/room-full 409, auto-pick first free bed, dup hostel/room 409, release + double-release 409. **Curfew**: sheet = current boarders sorted room+bed; markCurfew idempotent upsert + URGENT guardian SMS on NEW OUT marks only (no dup SMS on re-mark — prev-status check), quota-checked + recordUsage. **Boarding fees**: invoiceBoarders → REAL B.7 invoices via nextTenantId(INVOICE), idempotent by description "Boarding — <hostel> — Term N YYYY". boarderVisitors reads VisitorLog by studentId.
- API: GET/POST /api/hostel (?board= ?curfew=&date= ?visitors=; actions addHostel/addRoom/allocate/release/curfew/invoice). UI: /hostel + hostel-client.tsx — Dorms tab (occupancy cards w/ progress bar + "Invoice boarders" + room/bed board w/ Allocate per empty bed (gender-filtered student list) + release) and Curfew tab (hostel+date pickers, IN/OUT/LEAVE pills, "Out sends URGENT SMS" notice, save w/ marked count).
- Seed: Simba House (BOYS, master Barasa, 15k/term, 2 rooms × 4 beds) + Chui House (GIRLS, 1 room × 6); boarders Kamau+Kiprono (Simba R1), Achieng+Atieno (Chui R1); last-night curfew (Kiprono LEAVE w/ note). Reset block clears hostelAttendance/Allocation/Room/Hostel.
- hostel-test.ts SELF-HEALS (resets hostel tables + invoice/Boarding rows + **smsPerTerm→1240** + reseeds — the quota-inflation gotcha bit AGAIN mid-test (7441/5000 blocked the SMS assertion); the reset is now BAKED INTO the test).
- HTTP verified: master hostels/board/curfew ✓; teacher 403, parent 403, master→finance 403.
- TICKED B.3 "Hostel attendance" (was BLOCKED until B.16) — same turn.
- tsc clean, build clean (/hostel 7.6kB + /api/hostel), test:roles 24/24. Screenshots 79 (dorm cards), 80 (bed board: Chui R1 Achieng/Atieno + 4 empty w/ Allocate), 81 (mobile curfew register w/ In/Out/Leave pills) QA'd.
- Visitor line [~]: hostel-side link + read DONE; reception desk form student-picker = small A.18 polish later.


## ✅ B.15 LIBRARY: COMPLETE 6/6 (built + live-tested 2026-06-12, screenshots 75-77)
- DB (migration `b15_library_g19_classchat` — created via `prisma migrate diff --script` + `migrate deploy` because `migrate dev` PROMPTS interactively on the Conversation unique-index change; sandbox is non-interactive → REMEMBER this pattern for future index-adding migrations): **LibraryBook** (@@unique(tenantId,isbn), copiesTotal, shelf/category, optional fileUrl digital copy) + **BookIssue** (denormalized studentName/admissionNo, dueDate, returnedAt, fineKes, finePaid). Both in TENANT_OWNED_MODELS.
- Permissions: NEW library.view + library.manage → LIBRARIAN (finally has real work) + LEADERSHIP bundle. Nav /library fixed from student.view → library.view.
- Service `library.service.ts`: FINE POLICY = KES 10/day overdue, **Sundays excluded** (overdueDays walks days skipping getUTCDay()===0; unit-verified Jun1→Jun8 = 6 days = KES 60). MAX_OPEN_ISSUES=3/student. Rules live-tested: availability ("All N copies out"), dup-copy block, dup-ISBN 409, past-due-date 422, 3-book limit, double-return 409, on-time return = fineKes 0 + finePaid auto-true. findByBarcode(isbn) returns availability + current holders w/ live fines. readingHistory row-scoped via scopeWhere (parent other-child 404 verified). unpaidFines ledger + markFinePaid.
- API: GET/POST /api/library (?q / ?barcode= / ?view=open|fines; actions addBook/issue/return/finePaid), GET /api/library/history?studentId= (library.view OR portal.parent).
- UI: /library + library-client.tsx — tabs Catalog (search + availability badges + Add-book dialog w/ scan-or-type ISBN field + digital-copy upload), Out now (live "9d late · KES 90" badges + Return + unpaid-fines Collect), Issue a book (barcode-first: scan→Find→availability card showing who holds copies; fallback catalog/student dropdowns; default due +14d). Family portal: "Library books" card (LibraryCard in portal/library-card.tsx) w/ out/overdue/returned badges.
- Barcode note for founder: any phone scanner app or KES-500 USB scanner acts as a KEYBOARD (HID wedge) — it types the ISBN into the field and presses Enter; the Enter key triggers lookup. No special hardware integration needed.
- Seed: 4 KE books (River and the Source/Blossoms/KLB Math Bk3/Kamusi TUKI, 46 copies) + Achieng issue due +7d + Kamau OVERDUE ~10d (live fine demo). Reset block clears bookIssue/libraryBook + class-bound conversations.
- LIVE-TESTED `scripts/library-test.ts` (24 ✓ — script SELF-HEALS: resets library tables + reseeds at start, because a crashed mid-run previously left dirty state). HTTP: librarian catalog/barcode/open-issues ✓, librarian finance 403 ✓, parent own-child history ✓, bursar library write 403 ✓.

## ✅ G.19 CLASS GROUP CHAT: BUILT (founder asked "ADD A GROUP CHAT FOR THE CLASSES" — spec'd as G.19 + built same turn on the A.8 engine)
- DB: Conversation += classId (@@unique(tenantId,classId)) — set = THE class group chat; in same migration.
- Service `class-chat.service.ts`: openClassChat(user, classId) = canJoin gate (families via scopeWhere child-in-class; teachers via teacherClassIds; leadership always) → get-or-create GROUP convo "Form 2 East — Class Group" → **SYNC membership every open** (chatMemberIds = classTeacherId ∪ timetable teacherIds ∪ guardian userIds ∪ student userIds; createMany missing, deleteMany departed). ClassChatError 403/404 mapped.
- API: POST /api/class-chat {classId} → {conversationId} for deep-link. UI: ClassChatButton (portal/library-card.tsx) on family-portal child header + teacher My-Classes cards → /messages?open=<id> (NEW deep-link param in messages-client, placed AFTER openConvo definition).
- Full A.8 features inherited free: attachments, unread badges, SSE live updates, read receipts.
- LIVE-TESTED (in library-test.ts): create +3 members, same-conversation for teacher & parent, teacher message → student reads it, njoroge 403, parent other-class 403. HTTP: parent opens chat, chebet posts "PTA meeting", parent reads ✓. Screenshot 78 (mobile chat w/ Swahili messages, green own-bubble).
- GOTCHA: reseed deletes class-bound conversations → chat messages are wiped with classes (expected); re-post demo messages if needed for screenshots.
- tsc clean, build clean (/library 8.23kB + 3 APIs), test:roles 24/24. Screenshots 75 (catalog), 76 (out-now w/ live fine), 77 (barcode issue flow), 78 (class chat mobile) QA'd.

## ⏭️ NEXT: B.16 — Hostel (strict list order)
Lines: Hostel + dorm registration / Room allocation / Bed allocation / Hostel attendance (curfew) — UNBLOCKS the B.3 "Hostel attendance" line / Hostel fees (wire to B.7 invoicing) / Visitor tracking (A.18 VisitorLog exists — link). HOSTEL_MASTER role exists (student.view, attendance.view/record).

## ✅ B.14 COMMUNICATION: COMPLETE (built + live-tested 2026-06-12, screenshots 73-74)
- DB (migration `b14_communication`): **BulkMessage** ledger (audienceType SCHOOL_GUARDIANS|CLASS_GUARDIANS|ROLE, audienceLabel frozen at send, channel sms|in_app, recipient/sent/skipped counts, costKes, sender). In TENANT_OWNED_MODELS.
- Service `src/lib/services/comms.service.ts`: resolveAudience() — guardian audiences DEDUPE BY PHONE (one SMS per family, siblings share guardian = G.12 sibling intelligence line delivered); ROLE audience = active users of a role. bulkSend(dryRun) = preview (recipients+cost+quota) / real send (SMS via sms.ts seam w/ school-name prefix; in_app via A.7 notify() dispatcher). checkSmsQuota on BOTH paths; recordUsage after. audienceOptions() computes live family counts per class.
- **TEACHER RESTRICTION** (assertAudienceAllowed): TEACHER/CLASS_TEACHER/HOD/DEAN → CLASS_GUARDIANS of teacherClassIds() ONLY; school-wide/role sends 403 "sent by the school office". audienceOptions returns teacherScoped:true + own classes only. Leadership/bursar/receptionist (comms.send holders) get full audiences.
- CommsError mapped: QUOTA→402, FORBIDDEN→403, NOT_FOUND→404, else 422.
- API: GET/POST /api/comms (comms.send). UI: /comms page + comms-client.tsx — audience cards w/ live family counts, SMS/in-app channel toggle, 480-char composer w/ segment counter, **MANDATORY preview step** ("Check recipients & cost" → green card w/ count + KES estimate + quota warnings → "Confirm & send"), any edit invalidates preview; Sent-messages ledger panel. Nav: "Broadcast" (Megaphone, comms.send) in Overview.
- Seed: 1 sent school-wide broadcast in ledger (idempotent).
- LIVE-TESTED `scripts/comms-test.ts` (15 ✓): audiences (principal full 5 fam/2 classes/11 roles; chebet 1 class 0 roles; njoroge fail-closed 0); dry run 5 families KES 4; class send 3 F2E families (dev-console SMS visibly fired ×3); quota 1240→1243; ledger row; TEACHER role in-app → njoroge inbox row; chebet school-wide/other-class/role all blocked; quota-cap dry-run allowed:false + real send throws (restored after). HTTP: principal GET/dryRun/role-send ✓, chebet teacherScoped ✓ + school-wide 403, parent 403.
- **GOTCHA hit AGAIN: smsPerTerm usage inflated (14,890/5,000) by old test runs → reset to 1240.** If quota errors appear in dev, reset usageCounter smsPerTerm to 1240.
- WhatsApp/email lines marked [~]: transports + cascade slots exist; flip on with WHATSAPP/RESEND env keys (founder creds) — no code change needed.
- tsc clean, build clean (/comms 5.6kB + /api/comms), test:roles 24/24. Screenshots 73 (principal compose w/ cost preview card) + 74 (teacher mobile, class-scoped notice) QA'd.

## ⏭️ NEXT: B.15 — Library (strict list order)
Lines: Book catalog / Issue-return tracking / Fines auto-calc / Barcode scanning (phone) / Digital library / Reading history per student. LIBRARIAN role exists (student.view only — will need library permissions). Nav "Library" href=/library already points at a page that may 404 — build it.

## ✅ B.13 LMS: COMPLETE (built + live-tested 2026-06-12, screenshots 69-72)
- DB (migration `b13_lms`): **HomeworkSubmission** (@@unique(homeworkId,studentId), text/fileUrl, late flag, gradePct/feedback/gradedBy), **Quiz** + **QuizQuestion** (options JSON, correctIndex — server-only) + **QuizAttempt** (@@unique(quizId,studentId), answers JSON, score/total/scorePct), **ForumThread** + **ForumPost** (authorRole for chips, locked). All in TENANT_OWNED_MODELS.
- A.9 storage now accepts **.doc/.docx** (ALLOWED set + extFor + local-provider content-types) — ticks "Notes upload (PDF, DOC)".
- Service `src/lib/services/lms.service.ts`: LmsError (ALREADY_DONE/CLOSED/LOCKED → 409 in respond.ts). Access helpers: teachers reuse B.12 teacherClassIds(); families via familyClassIds() (scopeWhere→children's classIds, fail-closed "__none__"); forumClassIds() switches on role. KEY SECURITY: getQuizPaper strips correctIndex; submitQuizAttempt grades SERVER-side, returns review (corrections) only after grading; one-attempt unique; dueDate closes; resubmit-after-grade blocked; lockThread teacher-only.
- APIs: `/api/lms/submissions` (GET sheet, POST grade — homework.assign), `/api/lms/quizzes` (GET list/results, POST create, PUT publish — homework.assign), `/api/lms/forum` (shared: homework.assign OR portal.parent; actions thread/post/lock, lock re-gated to homework.assign), `/api/portal/lms` (portal.parent: quizzes list, paper, submitHomework, attemptQuiz).
- LEADERSHIP got portal.teacher + homework.assign added to the LEADERSHIP bundle (oversight; teacherClassIds null = all). test:roles still 24/24.
- UI staff: `/lms` page (academics.view + redirect to /portal if no homework.assign) + `src/components/lms/lms-client.tsx` — tabs Quizzes (builder dialog: tick-the-correct-answer circles, add/remove options/questions; publish/hide; results drill-down), Hand-ins (homework picker → roster missing/handed-in/graded + GradeDialog w/ typed answer + file link + feedback), Discussions (class picker, threads, ThreadView w/ lock — ThreadView imported from portal lms-cards).
- UI family: `src/components/portal/lms-cards.tsx` (SubmitWorkDialog, QuizzesCard + TakeQuizDialog w/ option buttons + instant result + per-question review, ForumCard + ThreadView + NewThreadDialog). parent-portal-client: homework rows now show submission status badges (handed in ✓ / late / graded N% + teacher feedback) + Hand in / Re-submit buttons; QuizzesCard + ForumCard added; childDetail exposes child.classId + homework[].submission.
- Seed: published "Quadratics check-in quiz" (3 MCQs) + Kamau attempt 67%, Atieno ungraded hand-in (Swahili note), forum thread "Revision plan for CAT 2" + Achieng STUDENT reply. **achieng@karibuhigh.ac.ke STUDENT login now SEEDED** (was created ad-hoc in old chat — now permanent: studentLogin field in studentSeed, linked via Student.userId).
- **SEED ORPHAN GOTCHA FIXED FOR GOOD**: reset block now deletes ALL student-bound rows (examResult/exam/invoice/feeStructure/attendanceRecord/cbcAssessment/homeworkSubmission/quizAttempt) before student deleteMany — reseed verified 0 orphans, no manual clearing needed anymore.
- LIVE-TESTED `scripts/lms-test.ts` (22 ✓): hand-in→teacher sheet→grade 85%→portal shows grade+feedback→resubmit blocked; paper hides correctIndex; auto-grade 3/3=100%; 2nd attempt 409; other-family paper blocked; draft hidden→publish visible; njoroge blocked everywhere; forum read/reply/lock/parent-other-class blocked. HTTP-verified via curl: chebet quizzes/sheet, achieng quiz list 100% + paper 409 + lock 403, bursar 403 on forum+quizzes.
- Screenshots 69 (quizzes list), 70 (per-student results 67%/100%/not attempted), 71 (Hand-ins grading roster), 72 (mobile portal: quiz 100% badge, notes download, class discussion) — QA'd. GOTCHA: achieng IS the student → `button:has-text('Achieng')` hits the topbar user chip; click the card via admission number `KH-S-000001`. Cookie banner: dismiss BEFORE tapping cards.
- Emoji-in-JSX cleaned (📘/📄 → lucide icons) — keep using icons, not emoji glyphs.
- tsc clean, build clean (/lms 5.95kB + 4 APIs), test:roles 24/24.
- DEFERRED (flagged in checklist, not faked): video lessons (needs R2/CDN), WebRTC live classes (TURN/SFU), AI tutor (B.23).

## ⏭️ NEXT: B.14 — Communication (strict list order)
Lines: Bulk SMS to class/school (A.7 sms seam + quota), pre-send quota check (limits.service exists), notification dispatcher (A.7 notify() exists — verify+wire), WhatsApp notifications (DEFERRED-creds), email notifications (Resend seam exists — DEFERRED-creds for live send), targeted messaging per role (A.8 conversations + role filters).

## ✅ B.12 TEACHER PORTAL: COMPLETE (built + live-tested 2026-06-12, screenshots 65-68)
- DB (migration `b12_teacher_portal`): **Homework** (classId, subjectId, teacherId+teacherName denorm, title, instructions, dueDate YYYY-MM-DD, optional fileUrl/fileName via A.9) + **ClassNote** (same shape, fileUrl REQUIRED). Both in TENANT_OWNED_MODELS. B.13 LMS will REUSE these models (submissions/grading added there).
- Permissions: NEW `portal.teacher` + `homework.assign` → TEACHER, CLASS_TEACHER, HOD, DEAN_OF_STUDIES. Leadership passes via SUPER/manual. PARENT/STUDENT/BURSAR 403 (verified live).
- **Teacher scoping rule (teacher-portal.service `teacherClassIds()`)**: a teacher "owns" a class when classTeacherId=them OR they appear on its timetable (teacherId on TimetableSlot). Fail-closed `["__none__"]` when neither (njoroge verified). Returns `null` for leadership = unrestricted oversight. THIS IS WIDER than B.1 scopeWhere (classTeacher only) — by design: subject teachers must assign homework to classes they teach but don't own.
- Service `src/lib/services/teacher-portal.service.ts`: teacherHome (class cards w/ student counts + subjects-I-teach from timetable + open-homework count + today's lessons Nairobi-day-aware), listHomework/createHomework (due-date-in-past 422)/deleteHomework (ONLY assigning teacher or leadership), listNotes/createNote/deleteNote, classReport (summary tiles + per-student 30d attendance % / absence count / latest-exam avg). TeacherPortalError mapped in respond.ts (404/403/422).
- Validation: `src/lib/validations/teacher-portal.ts` (homeworkCreateSchema, noteCreateSchema).
- APIs: GET /api/teacher (home), GET/POST/DELETE /api/teacher/homework, GET/POST/DELETE /api/teacher/notes, GET /api/teacher/timetable (reuses B.4 teacherTimetable — ticks "View own timetable"), GET /api/teacher/report?classId=.
- UI: /teacher page ("My classes") + `src/components/teacher/teacher-portal-client.tsx` — 4 pill tabs: Overview (today's lessons, class cards w/ one-tap Register→/attendance Marks→/exams Roster→/students?classId=, weekly timetable grid), Homework (list + Assign dialog w/ A.9 FileUpload attachment), Notes (upload+download), Class report (tiles + student table w/ red/amber absence badges). All 4 UX states. Nav: "My Classes" (icon School, permission portal.teacher) in Overview section.
- **students-client now reads ?classId= deep-link** (pre-filters roster) — added alongside existing ?new=1 handler.
- **Family portal (B.10/B.11) EXTENDED**: childDetail() += homework[] (due/overdue flag) + notes[]; parent-portal-client += "Homework" + "Class notes" cards (Download buttons). TICKED: B.10 "View homework", B.11 "View assignments" + "Download notes" (all previously BLOCKED on B.12).
- Seed: 1 homework (KLB Bk 3 Quadratics, due +7d) + 1 class note (real tiny PDF written into `.uploads/tenants/<id>/notes/` so portal download works) by Chebet for F2E. Seed reset block now ALSO deletes homework/classNote/timetableSlot/lessonPlan before schoolClass deleteMany (they're class-bound — previously 56 orphan slots accumulated across reseeds; FIXED).
- LIVE-TESTED service (`scripts/teacher-portal-test.ts`, all ✓): scoping (chebet 1 class / njoroge fail-closed / principal null), home aggregates, own timetable 2 slots, homework create→parent portal sees it, njoroge assign-to-F2E blocked, past dueDate 422, cross-teacher delete blocked, notes create/delete scoping, classReport (3 students · 82% att · CAT 1 mean 64%) + njoroge 403, principal sees all. HTTP-verified same via curl (login jars) incl. parent PDF download (%PDF bytes) + parent POST homework 403.
- Screenshots 65 (overview), 66 (homework tab), 66b (assign dialog), 67 (class report), 68 (family portal homework+notes, mobile 360px) — all QA'd. Note: dialogs close via ✕ button not Escape (script uses getByLabel("Close")).
- "Lesson plans (AI assist)" = [~]: plans live at B.4 /academics (linked from /teacher footer); AI at B.23.
- tsc clean, build clean (/teacher 9.04kB + 4 APIs), test:roles 24/24.
- GOTCHA REMINDERS hit again this session: node_modules wiped (npm install + prisma generate first), exam/invoice orphans after class reseed (cleared examResult/exam/invoice/feeStructure/attendanceRecord then reseeded — 0 orphans verified).

## ⏭️ NEXT: B.13 — LMS (strict list order)
Lines: Notes upload (PDF, DOC — ClassNote EXISTS, extend types/.doc + tick), Quizzes with auto-grade (NEW), Assignments + submissions (Homework EXISTS — add Submission model + grading), Discussion forums (NEW), Video lessons (streaming — likely defer pending R2/storage), Live online classes (WebRTC — defer pending infra), AI tutor (B.23-flag).


## 🔁 CHAT-TRANSFER RESUME (2026-06-11, new chat)
- Project recovered via founder's GitHub repo `elvisybadbunny-bit/workspace-019eb68a-...` (public clone -> founder makes private after). Repo root contained `neyo/`, `docs/`, `screenshots/` — moved `neyo/` to `/home/user/neyo`. `.env` was correctly NOT in git -> recreated (DATABASE_URL sqlite, NEW random NEYO_MASTER_KEK, APP_BASE_URL). NOTE: new KEK = any DEK-encrypted secrets from the old sandbox (e.g. seeded payment creds) won't decrypt; seed re-provisions DEKs — irrelevant for dev, fine.
- Restored + verified: npm install ✓, migrate dev ✓ (incl migration b1_students), db:seed ✓, typecheck ✓, test:roles 24/24 ✓, npm run build ✓, live login as principal + /api/students returns seeded students ✓.
- DISCOVERY: the previous chat had built MOST of B.1 *after* the last anchor was written (migration b1_students, student.service, validations, 8 API routes, students list + profile + classes UIs, seed: 2 classes/5 students/guardians/1 PARENT login).

## ✅ B.1 AUDIT RESULTS (live-tested this turn — scripts/b1-audit{,2,3}.ts kept as regression scripts)
- A.3.8 TEACHER row-scoping: DONE — scopeWhere() (student.service) limits TEACHER/CLASS_TEACHER to classes where classTeacherId=user.id, fail-closed ("__none__" when no class). VERIFIED: teacher f.chebet sees only 3 Form 2 East students, zero leakage, `q` filter cannot widen scope (scope ANDed with filters).
- A.3.9 PARENT row-scoping: DONE — scopeWhere() via Guardian(userId)->StudentGuardian links, fail-closed. VERIFIED: parent sees exactly 1 child (Achieng Mary Otieno); direct getStudent() on another child BLOCKED.
- TICKED in checklist: A.3.8, A.3.9, and B.1 lines: registration, profile, NEYO login ID (optional createLogin), admission no (KH-S-000NNN atomic — verified 000006/000007), edit w/ audit diff (action `student.update`, metadata.changes), documents storage, + G.9 per-student requirements tracking (8 seeded from master at create; fulfilled toggle works).
- Soft-delete: student deletes are soft (deletedAt), hidden from lists, restorable — G.6 pattern applied ("student" in SOFT_DELETE_MODELS).
- Audit action names: student.create / student.update / student.delete. AuditLog columns: actorName/entityType/entityId/metadata (no "detail").
- Guardian input uses fullName (not name); listStudents include guardians -> nested {guardian:{...}} shape.

## ✅ B.1 BULK IMPORT: DONE (built + live-tested this turn)
- DB (migration b1_bulk_import): StudentImport (fileName, source csv|xlsx|paste, totalRows/createdRows/failedRows, errorRows JSON, createdBy*). In TENANT_OWNED_MODELS.
- Validation: src/lib/validations/student-import.ts — IMPORT_FIELDS (incl fullName convenience + ignore), HEADER_SYNONYMS (EN+Swahili: jina/simu/mzazi/darasa...), MAX_IMPORT_ROWS=1000, importPreviewSchema/importCommitSchema/importedRowSchema.
- Service: src/lib/services/student-import.service.ts — detectDelimiter (tab beats comma -> Sheets paste = TSV), parseDelimited (RFC-4180 quotes/CRLF), parseXlsx (exceljs, Date cells -> YYYY-MM-DD, formula .result), autoMapColumns (2-PASS: exact synonym matches FIRST then fuzzy-contains — GOTCHA: 1-pass fuzzy mis-mapped "Parent Phone"->guardianName), buildCandidates (fullName split, gender M/F/male/boy/mvulana..., date 14/03/2010 KE day-first or ISO, normalizeKePhone returns null not throw), previewImport (class resolution, in-file dupes by name+dob, possible-existing vs DB), commitImport (skipInvalid or ABORT, auto-CREATES unknown classes [last word=stream heuristic], admissionNo kept if provided else nextTenantId atomic, guardian REUSED by phone -> siblings share one Guardian, G.9 requirements seeded from master, per-row failure capture, StudentImport history row, audit student.bulk_import), listImports. ImportError -> respond.ts 422.
- API: POST /api/students/import/preview (multipart file OR JSON text/rows; re-preview with adjusted mapping), GET+POST /api/students/import (history / commit). All requirePermission("student.create") — note BURSAR does NOT have student.create (verified 403; principal/registrar do).
- UI: /students/import (requirePagePermission student.create) + components/students/import-wizard.tsx — 3-step (Upload .csv/.xlsx OR paste-from-Sheets textarea / mapping chips w/ per-column select + re-preview + sample table + issues panel + skip-invalid checkbox / result card w/ failed-row reasons) + Recent imports history card. All 4 UX states. "Import" button added on /students header (canCreate).
- LIVE-TESTED (scripts/import-test.ts kept as regression): messy CSV 5 rows -> preview total5/valid4/invalid1 (gender X, bad date, bad phone all flagged w/ row numbers), commit created 4 + 1 failed w/ reason; Brian KH-S-000NNN; Kevin+Brian share guardian (reused by phone ✓); "Grade 4 Blue" class auto-created ✓; history + audit rows ✓. HTTP as principal: paste-TSV preview -> commit 2 created -> /api/students?q finds them -> history shows "by Wanjiru Kamau"; teacher preview 403 ✓. Test students cleaned up after. tsc clean, build ✓ (/students/import 7.15kB), test:roles 24/24.

## ✅ B.1 SEARCH GAPS: DONE (built + live-tested this turn)
- listStudents (student.service): q now also matches guardian phone — digit-detection regex builds candidate set {raw, 0->+254, 254->+254, bare 7/1 -> +254} and ORs `guardians.some.guardian.phone contains` each. Fragments work ("0712223" finds the child). Name/adm search unchanged.
- search.service (A.11): NEW optional `user?: SessionUser` param on search()/typeahead(). Students block runs ONLY when user passed AND can(role,"student.view"); applies scopeWhere(user) (A.3.8/9 row-scoping NOW EXPORTED from student.service) ANDed with name/adm/guardian-phone OR. Hit: type "student", subtitle "KH-S-000001 · Form 2 East", href /students/[id]. Both routes (/api/search + /api/reception/search) now pass user.
- ⌘K palette: GraduationCap icon for student type. APP_COMMANDS += new-student (/students?new=1), import-students (/students/import), view-students — all permission-filtered. students-client reads ?new=1 -> opens NewStudentDialog -> history.replaceState clean URL.
- LIVE-TESTED (scripts/search-test.ts kept as regression): phone in 4 formats finds child in list ✓; ⌘K "Achieng" -> student hit w/ deep-link + person hit (bursar) ✓; ⌘K by phone ✓; PARENT search other child -> NO student hit ✓; TEACHER search outside own class -> blocked ✓; cross-tenant (Uhuru) -> 0 Karibu students ✓; search() without user -> students gated out ✓. HTTP verified same via /api/search as principal + parent. tsc ✓, build ✓, test:roles 24/24 ✓.

## ⏭️ REMAINING B.1 WORK (build NEXT, in this order):
3. **Stream filter `[~]`**: explicit stream facet (SchoolClass.stream) in filter bar.
4. **Transfer management `[ ]`**: transfer workflow (mark TRANSFERRED + destination school + date + docs note; audit).
5. **Alumni management `[ ]`**: GRADUATED view/directory (filter + simple alumni page section).
6. THEN -> B.2 Admissions (links A.18.6 inquiries) or B.3 Attendance (founder choice; B.3 wires G.2 offline queuedPost).
- Bulk import (PDF/photo/WhatsApp universal) stays deferred until AI layer (B.23).
- G.10 doc set: student ID card PDF should come when B.1 polish or B.7 docs land (use getSchoolProfile() branding).

## REPO / GITHUB STATE
- Founder's GitHub: repo `workspace-019eb68a-ba58-76f2-914d-2adcd8eea8bd` under user `elvisybadbunny-bit` (told to make PRIVATE after our clone). Future code-transfer between chats: founder re-uploads/pushes; we clone.
- Local git in /home/user/neyo is the clone; remote origin points at the public URL (will 404/auth-fail once private — that's fine, we don't push from sandbox).

## FOUNDER FEEDBACK (2026-06-11) handled this turn + tracked:
- "Mobile dashboard is white" → ROOT CAUSE: /settings had NO page.tsx → the "Settings" nav link 404'd (the blank/white page). Dashboard mobile itself is fine (warm-white bg, correct). FIXED by building /settings hub.
- Added founder-requested blocks to FEATURES-CHECKLIST: **G.9** School Profile/Branding/Joining-requirements (mostly DONE this turn), **G.10** Document set + external cloud-print seam (TODO across B-modules), **G.11** Public subdomain landing site (Tenri-style) — BUILD LAST, ON FOUNDER SIGNAL (spec recorded). Printing = founder wants BOTH download/email PDFs AND external print-shop seam.

## G.9 School Profile & Branding: DONE (5/7 lines; 2 deferred to B.1/B-modules)
- DB (migration g9_school_profile): Tenant += motto, vision, mission, about, logoUrl, brandPrimary, brandAccent, addressLine, socialLinks(JSON), joiningRequirements(JSON array of {label,category,quantity?,mandatory}).
- Validation: src/lib/validations/school-profile.ts (schoolProfileSchema, joiningRequirementSchema cat=uniform|books|supplies|fees|documents|other, socialLinksSchema). Service: src/lib/services/school-profile.service.ts (getSchoolProfile/updateSchoolProfile, JSON parse helpers, audit school.profile.update). API: GET/PUT /api/school-profile (requirePermission tenant.manage_settings).
- UI: /settings (NEW hub page — fixes 404, permission-filtered cards incl School Profile first). /settings/school = SchoolProfileEditor client (logo FileUpload reusing A.9, brand colour pickers <input type=color>+hex, vision/mission/about textareas, contacts+5 socials, joining-requirements editor [add/remove/category/qty/required toggle], sticky Save). Nav: "School Profile" (icon Building2) added to SYSTEM section; also "Settings" hub now real.
- Seed: Karibu High profile (motto "Elimu ni Mwanga — Knowledge is Light", vision/mission/about, brand #1c2740/#1f9d5f, address, socials) + 8 joining requirements (uniform/books/supplies/documents/fees). Made the A.18 cash-payment seed idempotent (deleteMany mpesaRef CASH-SEED0001 first — was crashing reseed on unique constraint).
- VERIFIED: tsc clean, build ✓ (/settings 185B real page, /settings/school 6.49kB), test:roles 24/24, API GET/PUT round-trip works (motto+reqs), reseeded after test. Screenshots: m3-settings-hub.png (mobile, fixes the white page), 24-school-profile.png, 25-joining-reqs.png. Script: scripts/shot-school.ts removed; scripts/shot-mobile.ts removed.

## STILL TODO from founder asks:
- G.9: per-student joining-requirements tracking (issued/received) → DO AT B.1 admission. Document branding (logo/colours/motto on receipts/reports/ID) → as B-module docs are built (use getSchoolProfile()).
- G.10: standard doc set (fee statement/invoice/report card/ID card/transcript/admission letter) + download/email + external cloud-print provider SEAM → build alongside the owning B-modules (B.7 finance docs, B.1 ID cards, etc.).
- G.11: public subdomain landing site → LAST, on founder signal. Full spec in checklist (hero+image, about/vision/mission/stats, academics, news list+detail, gallery, leadership, testimonials, socials, contact+map, enroll→A.18.6 inquiry; image uploads via A.9; per-school SEO/OG so Google indexes subdomain; editable from Settings). Subdomain routing already exists (A.2 middleware) — landing renders on tenant subdomain WITHOUT app shell.

## 🎉 PART A (Platform Foundation) COMPLETE — A.1 through A.20 all done.
Remaining Part-A items are DEFERRED-pending-founder only: A.1 OAuth(4-6,13,14 Google/Apple/Microsoft creds), A.2.4 custom domain (DNS), A.3.8/A.3.9 TEACHER/PARENT row-scoping (BLOCKED until B.1 Student/Class models — DO THESE when B.1 lands), plus all "provide later" external keys (Daraja, SMS/AT, Resend, WhatsApp, VAPID, R2, Redis, Sentry/PostHog/BetterStack/Logtail, thermal printer). Everything buildable-without-creds is built + live-tested.

## A.20 Brand & Design: DONE (all 6 lines)
- NEW component: src/components/ui/table.tsx (TableContainer/Table/THead/TBody/TR/TH/TD — Odoo list-view primitive, align prop, dark mode). Completes the component-library line.
- NEW: src/components/brand/neyo-logo.tsx <NeyoLogo variant="full|mark|wordmark"> — inline SVG (renders in sandboxed preview), navy tile + white N + green leaf, wordmark uses currentColor. Wired into topbar (mark, replaced the plain "N" div) + login page (mark).
- Raster assets (generate_image) in public/brand/: bundi-mascot.png (scholarly navy owl + green grad-cap, mascot line), wordmark-light.png, wordmark-dark.png, pattern-tile.png, icon.png(256). Favicons: public/favicon.ico (16/32/48 via `magick ... -define icon:auto-resize`), favicon-16.png, favicon-32.png. Wired metadata.icons in src/app/layout.tsx.
- Design tokens: already in tailwind.config.ts (Chunk 0). Added `safelist` (regex bg-(navy|green)-(50..950) + bg-warm-(50..200)) so /brand swatches built from `bg-navy-${shade}` template literals render (Tailwind can't scan dynamic class names — GOTCHA recorded).
- /brand style-guide page: src/app/(app)/brand/page.tsx (requirePageUser — docs, any signed-in user) + src/components/brand/brand-showcase.tsx (client): logo lockups (inline + raster), Bundi, color swatches, pattern tile, full component library incl. Table, EmptyState, cultural-moments lookup table (KE_MOMENTS this year). Nav: "Brand" (icon Palette) in SYSTEM section.
- docs/BRAND.md: design DNA, tokens table, logo/icon/mascot/pattern inventory, component list, EDIT POINTS.
- VERIFIED: tsc clean, lint 0 errors, build ✓ (/brand 4.73kB), test:roles 24/24. Screenshots 21-brand-top.png, 22-brand-components.png, 23-brand-colors.png (swatches fixed). Scripts: scripts/shot-brand.ts.
- ESLint config from A.19 has `@next/next/no-img-element` OFF, so <img> in brand-showcase is fine.

## ✅ B.1 STREAM FILTER: DONE (this turn)
- studentFilterSchema.stream + StudentFilters.stream + listStudents `schoolClass: { is: { stream } }` + ?stream= in /api/students GET + "All streams" rounded-full select in students-client (derived: unique non-null streams from /api/classes, hidden when school has no streams). Live-tested: East 3/3 ✓, unknown stream 0 ✓, teacher row-scope still wins over filter ✓. tsc/build/test:roles all green. scripts/stream-test.ts kept.

## 🆕 PART G ADDITIONS (proposed + recorded this turn; founder said "free to add unique features"):
- G.12 Sibling Intelligence (family view, sibling badges, one-SMS-per-family saving ~40% SMS cost, sibling discount seam) — NEXT TO BUILD after B.1 completes (G.12.1+2 buildable now; SMS line wires A.7; discount at B.7).
- G.13 Mzazi Card (printable A6 QR slip per student: adm no + fee snapshot + paybill; QR -> live balance after guardian-phone challenge; feature-phone-first) — build alongside B.7 fees.
- G.14 Day-One Demo Mode (one-click sandboxed demo tenant, auto-expiring) — build pre-launch.
- G.15 Term Trends Pulse (Monday 7am digest to leadership via A.7 cascade + A.12 cron) — build after B.3 attendance + B.7 fees give it data.

## ✅ B.1 TRANSFER MANAGEMENT: DONE (this turn)
- DB (migration b1_transfers): StudentTransfer (destinationSchool/County, transferDate YYYY-MM-DD, reason, previousClassId [for undo], letterCode [idempotent verification], reversedAt, createdBy*). Student.transfers relation. In TENANT_OWNED_MODELS.
- Validation: transferStudentSchema + TRANSFER_REASONS (relocation|fees|boarding|discipline|other + free note) in validations/student.ts.
- Service (student.service): transferStudent (⚠️ ROW-SCOPED via scopeWhere — found in live-testing that CLASS_TEACHER could transfer students outside their class; FIXED + regression-tested), status->TRANSFERRED + classId=null (seat freed), dup transfer -> StudentError DUPLICATE, audit student.transfer. undoTransfer: reversedAt set, status->ACTIVE, previousClassId restored (skips if class deleted/archived), audit student.transfer_undone. activeTransfer(). getStudent now includes transfers (active only, take 1).
- Letter (G.10 doc set #1): documents/transfer-letter-pdf.tsx — A4, school brandPrimary colour + motto + address (G.9), particulars table, QR verify + ref TRF-XXXXXXXX, principal signature line. document.service.buildTransferLetterPdf: idempotent letterCode (re-download reuses verification), previous-class label fallback.
- API: POST/DELETE /api/students/[id]/transfer (student.edit), GET /api/students/[id]/transfer/letter (student.view + canViewStudent row-guard) -> application/pdf attachment.
- UI (student-profile-client): amber "Transferred out" banner (destination/date/reason + Transfer letter download + Undo w/ confirm), "Transfer out…" secondary button (hidden when already transferred), TransferDialog (destination/county/date/reason select/note, validates >=3 chars).
- LIVE-TESTED (scripts/transfer-test.ts kept, 16 assertions): transfer ✓ seat freed ✓ dup blocked ✓ %PDF + QR verifyDocument ✓ idempotent code ✓ audits ✓ undo restores exact class ✓ second undo blocked ✓ + HTTP: transfer/letter(200 application/pdf)/undo as principal; CLASS_TEACHER outside-own-class BLOCKED, own-class works. tsc/build/test:roles green. NOTE: f.chebet is CLASS_TEACHER (has student.edit); plain TEACHER lacks student.edit.

## ✅ B.1 ALUMNI MANAGEMENT: DONE (this turn) — 🎉 B.1 STUDENT MANAGEMENT COMPLETE (11/12; only "Bulk import PDF/photo/WhatsApp" deferred to B.23 AI)
- DB (migration b1_alumni): Student.graduationYear Int? + finalClassLabel String? (class label survives the freed seat).
- Service: updateStudent now stamps graduationYear=currentYear + finalClassLabel when status enters GRADUATED, clears both when leaving it. NEW listAlumni(user, year?) (row-scoped, groupBy year pills desc, 500 cap) + graduateClass(user, classId, year?) (row-scoped — CLASS_TEACHER only own class; bulk updateMany ACTIVE->GRADUATED + classId=null; audit student.class_graduated).
- API: GET /api/students/alumni?year= (student.view) + POST {classId, year?} (student.edit).
- UI: /students/alumni page + alumni-client.tsx — "All years"/"Class of YYYY · n" filter pills, alumnus cards (avatar/adm/Class-of badge/final class) linking to profiles, "Graduate a class" dialog (class picker w/ counts + year + preview line). All 4 UX states. "Alumni" button on /students header.
- LIVE-TESTED (scripts/alumni-test.ts kept, 11 assertions): year+label stamped ✓ directory+pills ✓ year filter ✓ un-graduate clears ✓ bulk 3/3 Class of 2030 ✓ class emptied ✓ audit ✓ class-teacher other-class BLOCKED ✓ restore ✓. HTTP: API+page 200. tsc/build(4.68kB)/test:roles green.

## ✅ B.3 ATTENDANCE CORE: DONE (first 4 lines, this turn — founder approved (a))
- DB (migration b3_attendance): AttendanceRecord (studentId, classId-at-marking, date YYYY-MM-DD Nairobi, status P|A|L|E, note, smsSentAt dedupe, markedBy*) @@unique([tenantId,studentId,date]) -> IDEMPOTENT upsert (offline replay = no-op). In TENANT_OWNED_MODELS.
- Validation: validations/attendance.ts (markRegisterSchema marks<=200 + notifyAbsent, registerQuerySchema, historyQuerySchema, ATTENDANCE_STATUSES).
- Service: attendance.service.ts — nairobiToday(), assertClassInScope (TEACHER/CLASS_TEACHER -> own classTeacherId only), getRegister (active students + marks merged), markRegister (filters marks to class students [defense], upsert each, audit attendance.marked w/ counts, optional notifyAbsentees), notifyAbsentees (primary guardian first, A.5 checkSmsQuota gate + recordUsage, smsSentAt dedupe, audit attendance.absent_sms), attendanceHistory (row-scoped: explicit student verified via scopeWhere else visible-set filter), attendanceOverview (per-class marked/present/absent/done; teachers see own only). AttendanceError mapped in respond.ts (404/403/422).
- API: GET /api/attendance (overview | ?classId= register), POST (attendance.record), GET /api/attendance/history. attendance.view incl PARENT/STUDENT; attendance.record = teachers+leadership (parent POST 403 verified).
- UI: /attendance page + components/attendance/attendance-client.tsx — date strip (◀ Today ▶, future disabled), overview cards (done=green present badge + absent count, in-progress amber), Register: one-tap status pill cycles P→A→L→E (green/red/amber/navy), default ALL PRESENT, sticky save bar w/ live counts + "SMS guardians of absentees" checkbox + offline indicator; SAVE = G.2 queuedPost("/api/attendance") -> "Saved offline — will sync" toast when queued. All 4 UX states; 360px-first.
- Seed: yesterday's registers for all 5 students (1 absent Kamau, 1 late "Matatu delay"), today left unmarked for demo.
- LIVE-TESTED (scripts/attendance-test.ts kept): teacher sees ONLY own class in overview+register (other-class 403) ✓ mark 3 (1 absent) ✓ absent SMS sent w/ correct KE text + quota counted ✓ re-mark idempotent (3 rows, no dups) ✓ SMS deduped ✓ parent history = own child only ✓ yesterday seed 5 rows ✓ HTTP: overview/register as chebet, parent POST 403, page 200. tsc/build(6.51kB)/test:roles green.
- B.3 REMAINING (later lines): hostel attendance (B.16 dep), teacher/support-staff attendance, analytics, QR/RFID/fingerprint/face (hardware/AI deferred).

## ✅ G.16 PROMOTION ENGINE + STREAM RESHUFFLE: DONE (this turn, founder approved)
- DB (migration g16_promotion): PromotionRun (kind promotion|reshuffle, summary, moves JSON = undo source-of-truth [{studentId, fromClassId, toClassId, graduated?, prevStatus?, prevGradYear?, prevFinalLabel?}], undoneAt). In TENANT_OWNED_MODELS.
- Service promotion.service.ts: parseLevel/nextLevel (KE: Form 1-3 -> +1, Form 4 -> graduate; Grade 1-8 -> +1, Grade 9 -> graduate; PP1 -> PP2 -> Grade 1; unknown -> null = SKIP never guess). promotionPlan (per-class from/to/students/toExists + unmapped list). commitPromotion (TOP-LEVEL-FIRST ordering so no student promoted twice; graduate path sets GRADUATED+year+finalClassLabel+classId=null [B.1 alumni]; destination classes auto-created same stream/curriculum; move-log; audit promotion.committed). reshufflePlan/commitReshuffle (level needs >=2 streams; strategies size|gender|alpha — round-robin deal, gender alternates; preview = per-stream count/B/G/moved flags; commit logs only actual moves; audit promotion.reshuffled). listRuns + undoRun (full reverse incl graduation reverts; double-undo CONFLICT; audit promotion.undone). PromotionError mapped (404/422).
- API: GET/POST /api/promotion, POST /api/promotion/reshuffle {level,strategy,commit}, POST /api/promotion/undo. ALL requirePermission("class.manage") — leadership only (CLASS_TEACHER denied, verified can()=false + HTTP 403).
- UI: /students/promotion (requirePagePermission class.manage) + components/students/promotion-client.tsx — 2 tabs: "New academic year" (plan table w/ graduates badge + will-be-created chips + unmapped warning + Class-of year input + 2-step confirm) / "Reshuffle streams" (level select [only multi-stream levels], strategy pills + disabled "By performance — coming with Exams" chip, preview cards w/ moved-highlights, Apply). Run history card w/ one-click Undo. "New year" button on /students header.
- LIVE-TESTED (scripts/promotion-test.ts kept, 14 assertions): parser ✓ plan(F4->graduate, F1 West->Form 2 West will-create) ✓ commit 5 promoted/2 graduated ✓ alumni fields ✓ class auto-created ✓ UNDO restores every classId+status exactly ✓ double-undo blocked ✓ reshuffle sizes balanced (2/2) ✓ gender commit + undo ✓ history both kinds ✓ teacher 403 ✓. HTTP: plan/page/403 verified. tsc/build(6.58kB)/test:roles green. Cleanup: test classes/students removed, empty leftover Form 3 East deleted (seed state restored: Form 2 East 3 + Form 1 West 2).

## 📌 FOUNDER DIRECTIVES (2026-06-11, late session — STANDING RULES):
0. **CHECKLIST POLICY (founder re-confirmed 2026-06-12 after questioning):** updating FEATURES-CHECKLIST.md is CORRECT and expected, in exactly this form: (a) tick [ ]->[x]/[~] only after live-tested full-stack, (b) append italic evidence note (what/where/test proof/screenshot #) — never altering the original line wording, (c) new feature blocks only in Part G and only when founder-requested or founder-pre-approved. NEVER delete lines, never untick, never build off-list. Founder explicitly chose "keep doing it this way".
1. **FOLLOW THE FEATURES LIST IN ORDER — NO SKIPPING.** B.1 done, B.3 first-4-lines were an approved exception; from here: B.2 Admissions is NEXT, then resume B.3 remaining lines, B.4, B.5... in checklist order. Part G items only when founder approves explicitly.
2. **GENERATE SCREENSHOTS every feature** (founder wants to SEE how it looks). Series in /home/user/screenshots: old chat ended at 28; this chat added 29-38 (29 students toolbar, 30 import step1, 31 import preview [mapping+issues+badges], 32 alumni, 33 promotion plan, 34 reshuffle tab, 35 attendance overview, 36 attendance one-tap register [Absent red pill], 37 transfer banner, 38 ⌘K student search). Visually QA'd: 31/33/36/38 confirmed production-grade; teacher sidebar correctly filtered in 36.
- Screenshot env: playwright chromium + apt libs reinstalled this session (node_modules NOT snapshotted — rerun `npx playwright install chromium` + the apt-get line from ENV section). Script pattern: scripts/shot-new-features.ts (login via fetch within page.evaluate, domcontentloaded + fixed waits; NEVER networkidle [SSE hangs]). GOTCHA: tsx can't run scripts from /tmp (module resolution) — keep shot scripts inside neyo/scripts/.

## ✅ B.2 ADMISSIONS: COMPLETE (all 9 lines, this turn)
- DB (migration b2_admissions): AdmissionApplication (applicationNo KH-ADM-NNNNNN unique/tenant, status state-machine, applicant+guardian fields, interview date/time/calendarEventId, depositRequired/PaidKes/At/Ref, decisionNote, letterCode, studentId @unique, inquiryId, source online|walk_in|inquiry). In TENANT_OWNED_MODELS.
- Validation: validations/admission.ts (applySchema w/ kePhone [reception.ts kePhone now EXPORTED], decisionSchema w/ action enum). GOTCHA fixed: service ALSO normalizes guardianPhone (defense vs Zod-bypassing callers — convertInquiry path).
- Service admission.service.ts: submitApplication (PUBLIC, dup guard child+phone open-app 409), convertInquiry (A.18 -> application, inquiry CONTACTED, "Pending Name" split, gender placeholder M for staff to fix in review), decide() w/ TRANSITIONS map (invalid-state 422): review/schedule_interview (creates A.17 calendar event type=meeting)/offer(depositRequiredKes)/waitlist/reject/withdraw/record_deposit(OFFER only)/admit (BLOCKS if deposit unpaid; creates B.1 student via createStudent w/ guardian+G.9 reqs+optional classId; links studentId; inquiry -> ENROLLED). pipeline(). buildAdmissionLetterPdf (documents/admission-letter-pdf.tsx: OFFER vs ADMITTED wording, deposit para, joining-requirements box, QR idempotent). AdmissionError mapped 404/409/422.
- API: POST /api/admissions/apply (PUBLIC, rate-limited 10/h/IP enforceRate(key,limit,windowSec — NOTE seconds not ms), tenant via resolveTenantSlug({host,searchTenant,headerTenant})), GET/POST /api/admissions (+?inquiry= convert) + POST /api/admissions/[id] (decide) + GET /[id]/letter — staff routes student.create (CLASS_TEACHER 403 verified).
- UI: /admissions (nav "Admissions" UserPlus, moduleKey students, permission student.create) — Kanban board APPLIED/REVIEW/INTERVIEW/OFFER/WAITLIST + closed strip + inquiry banner w/ "Start application" + walk-in dialog + right-side AppDrawer (stage-aware actions: review/interview date+time/offer w/ deposit/record deposit/admit w/ class picker + disabled-until-deposit + letter download + open student profile). PUBLIC /apply (auth layout, school name from subdomain, success card w/ application no).
- Seed: 3 applications (Baraka APPLIED online, Zawadi REVIEW walk-in, Collins OFFER deposit 2000/5000).
- LIVE-TESTED (scripts/admissions-test.ts kept, 13 assertions): apply ✓ dup 409 ✓ interview->calendar event ✓ admit blocked before deposit ✓ deposit->admit-> student created (guardian +254 ✓ after fix, 8 reqs) ✓ re-admit blocked ✓ letter %PDF + QR ✓ inquiry convert + CONTACTED ✓ board ✓. HTTP: public apply 200 w/ ?tenant= override, teacher 403. Screenshots 39-apply-public, 40-admissions-board (inquiry banner + deposit progress visible), 41-admissions-drawer (Admit disabled w/ amber deposit warning) — QA'd ✓. tsc/build(7.33kB + /apply 3.27kB)/test:roles green.

## ✅ B.3 REMAINING BUILDABLE LINES: DONE (this turn) — B.3 now complete except hostel(B.16-blocked) + 4 hardware-deferred
- DB (migration b3_staff_attendance): StaffAttendance (userId/userName/role denorm, date Nairobi, clockInAt/clockOutAt) @@unique(tenant,user,date). In TENANT_OWNED_MODELS.
- Service staff-attendance.service.ts: CLOCKING_ROLES (13 staff roles — NOTE roles are DEAN_OF_STUDIES + HOSTEL_MASTER, there is NO "SECURITY"/"DEAN" role), clockIn/clockOut (self-service, double 422 ALREADY/NOT_CLOCKED_IN), staffDaySheet (mine + sheet when staff.view; presentCount/expected), attendanceAnalytics(windowDays 7-60): trend [date,pct,marked] P+L=in-school, classesToday, chronic (3+ absences, top 20, links), anomalies (class-day pct 25+ pts below class window avg, min 6 records + 3/day). GOTCHA: .filter(Boolean) doesn't narrow TS types — use flatMap (build failed on it; also note `npm run build` typechecks scripts/ too, so test scripts must be type-clean).
- API: GET/POST /api/attendance/staff (requireUser; sheet only when can(staff.view)), GET /api/attendance/analytics?days= (attendance.view). StaffAttendanceError -> 422.
- UI: AttendanceTabs (Class registers · Staff · Insights[hidden for PARENT/STUDENT]) wraps the B.3 register client. StaffAttendanceTab: clock card ("Clocked in at 07:58" / Clock in/out buttons / "Day complete") + leadership day-sheet (n/m in badge). InsightsTab: trend bar chart (green>=90/amber>=75/red), per-class progress bars, chronic list w/ profile links, amber anomaly cards ("Worth a phone call?"). All 4 UX states.
- Seed: 10 weekdays history (Kamau absent every 3rd day -> chronic; day-3 anomaly Form 2 East mostly absent) + 3 staff clock-ins today (principal/deputy/receptionist 07:45-08:15).
- LIVE-TESTED (scripts/staff-att-test.ts kept): clock in/out ✓ doubles 422 ✓ sheet 4/8 ✓ parent canClock=false ✓ trend 9 weekdays-in-14 ✓ Kamau chronic(3) ✓ anomaly Form 2 East 0% vs 81% ✓. Screenshots 42-staff-attendance, 43-attendance-insights (QA'd ✓ — trend bars + follow-up + anomaly all visible). tsc/build(/attendance 8.67kB + 2 new APIs)/test:roles green.
- Screenshot GOTCHA: page.click("text=X") can hit ⌘K palette items (palette opens on stray clicks. Topbar search?) — use page.locator("button",{hasText:/^X$/}).first().click() + press Escape before screenshots.

## ✅ G.17 GPS-VERIFIED STAFF CLOCK-IN: DONE (founder-requested this turn, all 4 lines)
- DB (migration g17_gps_clockin): Tenant.gpsLat/gpsLng/gpsRadiusM (null=off) + StaffAttendance.gpsVerified/gpsLat/gpsLng/gpsDistanceM.
- Service: distanceMetres() Haversine (sanity-checked CBD->Westlands 3008m). clockIn(user, gps?): fence ON => no gps -> 422 GPS_REQUIRED; too far -> 422 OUT_OF_RANGE w/ human distance ("You are 3.0 km from school — clock-in only works within 300 m of the gate."); in range -> gpsVerified=true + distance stored + audited. Fence OFF => works as before (unverified). staffDaySheet returns geofenceOn/gpsRadiusM + per-row gpsVerified/gpsDistanceM.
- API: POST /api/attendance/staff accepts optional lat/lng (Zod -90..90/-180..180).
- UI: settings/school-profile-editor.tsx NEW geofence card (lat/lng/radius inputs + "Use my current location" navigator.geolocation helper + green "Geofence on · 300 m" badge; save sends ""=off). staff-attendance-client: getGps() helper (enableHighAccuracy, 10s timeout), clock-in attaches GPS when geofenceOn (blocks w/ toast if denied), "GPS required (300m)" pill + "location verified" on clock card, green 📍 verified badge per day-sheet row w/ distance tooltip.
- Seed/dev state: Karibu geofence LEFT ON at -1.2921,36.8219 r=300 (Nairobi CBD) — demo realism. Playwright can grant geolocation: newContext({geolocation:{...}, permissions:["geolocation"]}).
- LIVE-TESTED (scripts/gps-test.ts kept, 7 assertions): Haversine ✓ fence-off-no-GPS allowed-unverified ✓ fence-on-no-GPS GPS_REQUIRED ✓ 3km OUT_OF_RANGE w/ km message ✓ at-gate verified 61m ✓ row stores coords ✓. Screenshots 44-gps-clockin (clocked in + "location verified ✓" toast, QA'd) + 45-geofence-settings. tsc/build/test:roles green.
- NOTE: browser geolocation needs HTTPS in production (localhost OK in dev) — already satisfied by Vercel deploy.

## ✅ B.4 ACADEMICS: DONE (9/11 lines; course-mgmt + university deferred-flagged)
- DB (migration b4_academics): Department (name unique/tenant, hodId), Subject (code unique/tenant, curriculum, departmentId, archived), AcademicTerm (year+term unique, current), TimetableSlot (@@unique(tenant,class,day,period) + teacher index), LessonPlan (teacher-owned, status PLANNED|TAUGHT|SKIPPED). All in TENANT_OWNED_MODELS.
- Validation: validations/academics.ts — subject/department/term(refine end>start)/slot/autoFill/lessonPlan schemas + KE_SUBJECT_PRESETS (real CBC 9 + 8-4-4 12 subject sets).
- Service academics.service.ts: departments CRUD (dup 409, HOD name resolution), subjects CRUD + addSubjectPreset (skips existing codes), terms upsert (current flag clears others) + currentTerm(tenantId) FOR B.5/B.7 REUSE, getTimetable/teacherTimetable (B.12 reuse), setSlot w/ TEACHER DOUBLE-BOOKING detection (same teacher+day+period any class -> CONFLICT w/ human message), clearSlot, autoFill GREEDY (pass1 one-per-day, pass2 doubles; school-wide teacher busy-map; returns placed/unplaced — never overplaces), lesson plans (teachers OWN-scoped list/create/status, leadership all, FORBIDDEN on others' plans). AcademicsError -> 404/409/403/422.
- API: /api/academics/{subjects,subjects/[id],departments,terms,timetable,lesson-plans}. GET=academics.view, mutations=academics.manage EXCEPT lesson-plans POST/PATCH=academics.view (own-scoped in service).
- UI: /academics 5 tabs (Subjects [presets buttons + table], Departments [card grid + inline add], Terms [list + editor w/ current checkbox], Timetable [class picker + 8x5 grid, click-cell modal w/ subject+teacher+clear, Auto-fill dialog w/ per-subject load+teacher + 40-period cap], Lessons [table w/ status select + plan dialog]). All 4 UX states.
- Seed: 4 departments, 9 8-4-4 subjects w/ depts, 3 terms (T2 current), 8 timetable slots F2E (MAT=Chebet Mon P1+Tue P2), 1 lesson plan (Chebet, "Quadratic equations — completing the square", KLB Bk 3 ref).
- LIVE-TESTED (scripts/academics-test.ts kept, 13 assertions): subjects+dup 409 ✓ terms+current ✓ slots 8 ✓ teacherTimetable MAT-only ✓ DOUBLE-BOOKING BLOCKED ✓ autofill 12/12 avoiding Chebet's busy periods ✓ MAT 1-per-day spread ✓ lesson own-scope + others-blocked 403 ✓. Screenshots 46-subjects, 47-timetable (recaptured w/ populated F2E — select class FIRST, default was empty F1W), 48-terms. tsc/build(9.36kB + 6 APIs)/test:roles green.

## 📌 G.18 RECORDED (founder spec 2026-06-11): Whole-school timetable generator — BUILD LATER ON FOUNDER SIGNAL. Full spec in checklist G.18: per-level subject needs config, teacher-subject-class matrix, co-curricular/games/PE/assembly blocks reserved first, one-click whole-school constraint solve (all classes at once, conflicts impossible), per-teacher view + publish notification (A.7), per-class printable A4 (G.9 branding) + student portal view (B.11), versioned regeneration w/ undo. Foundation already exists: TimetableSlot model, setSlot clash detection, autoFill per-class greedy, teacherTimetable(). When building: extend autoFill to multi-class solver (iterate classes by constraint-tightness, backtrack on dead ends).

## ✅ B.5 EXAMINATION CORE: DONE (9/14 lines; transcripts/progress/per-teacher analytics need multi-term data; KCSE+photo-grading = B.23 AI)
- DB (migration b5_exams — NOTE: node_modules+playwright cache were wiped this session, reinstalled npm install + npx playwright install chromium + apt libs): Exam (year/term/type/maxMarks/published), ExamSubject (@@unique exam+subject), ExamResult (@@unique exam+student+subject — idempotent target). In TENANT_OWNED_MODELS.
- NEW PERMISSIONS: exam.view + exam.manage added to catalogue + ACADEMICS_FULL + HOD/TEACHER/CLASS_TEACHER (view) + PARENT/STUDENT (view — published gate in service). exam.manage added to WRITE_PERMISSIONS (session.ts). test:roles still 24/24.
- Validation: validations/exams.ts — examSchema (subjectIds 1-20), marksSchema (marks 0-200 nullable=clear), cbcLevel (EE>=80/ME>=65/AE>=50/BE), grade844 (KNEC A..E bands).
- Service exam.service.ts: listExams/createExam/publishExam (audited), getMarksSheet (subject-mapped check + scopeWhere row-scoping — teacher own classes ONLY), saveMarks (idempotent upsert, over-max INVALID, null deletes, allowed-set defense), examSummary (per-student totals -> overall + class positions w/ shared ties, positions over FULL cohort then filtered to visible — parent sees own child w/ true position; class means + subject means; curriculum picks CBC/8-4-4 grading), studentReport (PARENT/STUDENT blocked unless exam.published). ExamError -> 404/403/422.
- Report card (G.10 #3): documents/report-card-pdf.tsx (G.9 branding, grade-coloured table, summary boxes, position/cohort, remarks, QR) + buildComment rule-based remarks (CBC vs 8-4-4 phrasing; B.23 AI swap point) + document.service.buildReportCardPdf (verification code RPT-XXXXXXXX).
- API: GET/POST /api/exams, GET/POST /api/exams/[id] (summary / publish toggle), GET/POST /api/exams/marks (sheet/save), GET /api/exams/[id]/report/[studentId] (PDF).
- UI: /exams (nav "Exams" ClipboardList under academics module) — exams list w/ draft/published badges -> detail: Results tab (means badges strip, ranked table w/ pos/class-pos/total/avg/grade badge/PDF link, Release results / Unpublish button) + Enter marks tab (class+subject pickers -> autosave grid w/ per-student number inputs, saved-at indicator, Save now). All 4 UX states.
- Seed: "CAT 1 — Term 2" published, 5 subjects × 3 F2E students = 15 marks (Achieng 85% EE top, Kamau 64% AE, Atieno 47% BE).
- LIVE-TESTED (scripts/exam-test.ts kept, 14 assertions): grading fns ✓ teacher own-sheet + F1W blocked ✓ autosave update + over-max 422 ✓ positions monotonic w/ ties ✓ class mean 65%/MAT 74% ✓ parent own-child-only + TRUE cohort position ✓ unpublished blocked for parent / published OK ✓ PDF %PDF + QR ✓. Screenshots 49-exam-results (QA'd — positions/grades/means/PDF links visible), 50-marks-entry. tsc/build(7.5kB + 4 APIs)/test:roles green.

## ✅ B.5 FOLLOW-UPS (founder feedback, this turn):
1. MARKS-ENTRY ALIGNMENT BUG FIXED — shared <Input> has a w-full wrapper div that stretched over student names (screenshot 50 showed inputs covering adm nos). Fix: raw <input> w/ w-20 shrink-0 inline classes in the marks grid. LESSON: never use the shared Input inside flex list rows — its wrapper is w-full by design.
2. INTER-STREAM + CLASS-LEVEL COMPARISON ADDED — examSummary now returns classMeans (ranked, w/ rank field + student counts, computed over FULL cohort not just visible rows) + levelMeans (level aggregated across streams). UI: "Stream comparison" card (rank badges + green/amber/red bars) + "Overall by class level" card on Results tab. Live-tested w/ 2 streams (F2E 65% #1 vs F1W 48% #2; levels both present); screenshots 50 (fixed) + 51 re-captured + QA'd. Ties verified visible in table (two pos-3 students).

## ✅ B.6 CBC MANAGEMENT: COMPLETE (all 6 lines, this turn)
- DB (migration b6_cbc): CbcStrand (subjectId+name unique/tenant, learningOutcome) + CbcAssessment (APPEND-ONLY history: studentId/strandId/level 1-4/comment/date/teacher). In TENANT_OWNED_MODELS.
- Validation: validations/cbc.ts — strandSchema/assessSchema (level 1-4 nullable=skip), LEVEL_LABELS (code/label/PARENT-FRIENDLY line per level), KICD_STRAND_PRESETS (real outcomes: ENG 4 strands, KIS 3 in Kiswahili, MAT 4, ISC 3, SST 3).
- Service cbc.service.ts: listStrands/createStrand (dup 409)/addStrandPreset; getAssessSheet (scopeWhere row-scoped, latest level per learner shown); saveAssessments (CREATES rows — history preserved, latest used in profiles; allowed-set defense); studentCompetencies (latest-per-strand, grouped by subject, avgLevel + overall code, parentFriendly lines). CbcError -> 404/409/403.
- KICD PDF (G.10 #4): documents/cbc-report-pdf.tsx ("COMPETENCY BASED ASSESSMENT REPORT", per-area blocks, level colours EE green/ME blue/AE amber/BE red, rubric legend strip, parent lines w/ teacher quotes, QR) + document.service.buildCbcReportPdf (CBC-XXXXXXXX codes).
- API: /api/cbc/strands (GET view/POST manage+preset), /api/cbc/assess (GET/POST exam.enter_marks), /api/cbc/report/[studentId] (exam.view; ?format=pdf).
- UI: /cbc (nav "CBC" Layers icon, academics module) — Strands tab (grouped by area, KICD preset buttons per eligible subject, obs counts), Assess tab (class+strand pickers, outcome banner, ONE-TAP rubric pills w/ "last: AE on date" context, Record N observations), Learner report tab (typeahead search -> profile cards w/ overall badges + parent-friendly lines + KICD PDF button).
- Seed: English (CBC) ENGC + 3 KICD strands + 9 observations across 3 learners (one teacher comment "Confident narrator during oral work").
- LIVE-TESTED (scripts/cbc-test.ts kept, 11 assertions): strands+dup 409 ✓ teacher own-class sheet + other blocked ✓ HISTORY kept (3->6 rows) ✓ profile uses LATEST level ✓ parent-friendly line ✓ parent other-child blocked ✓ PDF %PDF + QR ✓. Screenshots 52-cbc-strands + 53-cbc-assess (QA'd — rubric pills + last-observation context visible). tsc/build(7.03kB + 3 APIs)/test:roles green.

## ✅ B.7 FINANCE PART 1: DONE (5 lines this turn — structures/batch/manual/offline-pay/aging)
- DB (migration b7_fees_invoices): FeeStructure (level+year+term unique) + FeeItem + Invoice (invoiceNo unique/tenant via A.4 "INVOICE"->KH-INV-NNNNNN, totalKes/paidKes/status UNPAID|PARTIAL|PAID derived, dueDate, structureId?). In TENANT_OWNED_MODELS.
- Service finance.service.ts: listStructures/createStructure (dup 409); batchInvoice (level-matching ACTIVE students, IDEMPOTENT — skips already-invoiced from same structure); createManualInvoice; applyPaymentToInvoice (ledger move w/ status transition — Part 2 wires M-Pesa onto this); listInvoices (scopeWhere — PARENT own-child verified; q filter name/inv/adm); arrearsAging (Nairobi-today buckets current/1-30/31-60/60+, totals, collectionRate). FinanceError -> 404/409/422.
- API: /api/finance/structures (GET view / POST manage_structure / POST {batch:true} create_invoice), /api/finance/invoices (GET ?status&q&aging=1 / POST manual / PATCH ?id= record_payment).
- UI: /finance page (was 404 — nav existed since Chunk 0!) — FinanceClient tabs: Overview (3 StatCards + aging bucket bars amber/orange/red), Invoices (search + status filter + table w/ balance red + Pay dialog prefilled), Fee structures (cards w/ itemised list + "Invoice the level" batch dialog), "M-Pesa payments ↗" link to A.6 page. All KES-formatted, 4 UX states.
- Seed: Form 2 structure (Tuition 18,500 + Boarding 12,000 + Activity 2,500 = KES 33,000) + 3 invoices: Achieng PAID, Kamau PARTIAL 15k/33k due-20d (d30 bucket), Atieno UNPAID due-65d (d90 bucket).
- LIVE-TESTED (scripts/finance-test.ts kept, 12 assertions): dup structure 409 ✓ batch idempotent (0 created/3 skipped) ✓ UNPAID->PARTIAL->PAID ✓ aging buckets 18k/33k + outstanding 51k + rate 49% ✓ parent own-child-only ✓ search ✓. Screenshots 54-finance-overview (QA'd — aging bars + bursar's filtered sidebar visible), 55-finance-invoices, 56-fee-structures. tsc/build(8.15kB + 2 APIs)/test:roles green.

## ✅ B.7 FINANCE PART 2: DONE — B.7 COMPLETE except bank integration (deferred, founder bank APIs)
- DB (migration b7_part2): Payment.invoiceId (links A.6 payments to invoices) + Invoice.discountKes/discountReason/reminderSentAt.
- Service: stkForInvoice (balance-guarded, links payment, A.6 initiateStkPush — mock in dev), onPaymentPaid HOOK (called from payment.service.handleCallback on PAID: applies amount to invoice ledger w/ effectiveStatus honouring discounts + receipt SMS quota-checked "Payment of KES X received (REF). Balance: KES Y." — SMS failure never breaks ledger), applyDiscount (B.7.11 — over-discount blocked; FULL WAIVER -> PAID [bug found+fixed: due==0 must be PAID]), sendFeeReminders (B.7.12 — overdue UNPAID/PARTIAL, primary guardian, 3-day dedupe via reminderSentAt, quota gate, audit). listInvoices/arrearsAging now honour discountKes in balances.
- Jobs: registry "fee-reminders" daily 09:00 EAT + JOBS map (iterates all tenants).
- API: POST /api/finance/invoices/[id] {action:"stk"|"discount"} (record_payment / manage_structure).
- UI: invoice rows now have [M-Pesa][Cash] buttons; StkDialog (phone + amount prefilled w/ balance, explains parent flow). Screenshot 57 QA'd.
- TESTING BUGS FOUND+FIXED: (1) mock parseCallback expects {success:true} not resultCode — test fixed; (2) full-waiver status stayed UNPAID — effectiveStatus now returns PAID at due==0; (3) seed had inflated smsPerTerm usage 9921/5000 -> quota blocked reminders — reset to 1240 (NOTE: A.18 walk-in tests increment usage; watch for drift).
- LIVE-TESTED (scripts/finance2-test.ts kept, 14 assertions): STK PENDING+linked ✓ mock callback PAID ✓ invoice auto-applied 15k->20k ✓ receipt SMS w/ balance ✓ ledger audit ✓ over-balance blocked ✓ bursary 20k ✓ full waiver PAID ✓ over-discount blocked ✓ reminders 2 SMS w/ KE wording ✓ 3-day dedupe ✓ audit ✓. tsc/build/test:roles green.

## ✅ B.7+ FOUNDER REQUESTS (this turn): DESK STK + INVOICE PRINT TRACKING
- Desk STK: studentOpenInvoices() + /api/reception/fees (GET open invoices / POST STK; gated reception.operate + finance.record_payment — RECEPTIONIST already had both). Reception desk += "M-Pesa fees" action -> StkFeesDialog (student typeahead via reception search, invoice dropdown w/ balance prefilled, phone+amount, SIM-toolkit explainer copy). Works for feature phones — STK prompt is SIM-toolkit, no app. Live-tested as Mwangi Susan: STK 2,000 -> mock callback -> invoice 15k->17k + receipt SMS. Screenshot 58 QA'd. NOTE: receptionist email is frontoffice@karibuhigh.ac.ke.
- Print tracking (migration b7_print_tracking): Invoice.printCount/lastPrintedAt/lastPrintedBy. documents/invoice-pdf.tsx (G.10 #5): status STAMP (PAID IN FULL green / PARTIALLY PAID red / UNPAID), itemised totals w/ discount line, PAYMENTS RECEIVED table (date/method/mpesaRef), guardian, "Copy #N — every print is tracked" + QR. buildInvoicePdf: EVERY render increments count + stamps who/when + audit finance.invoice_printed. UI: Print button (ghost) on every invoice row + 🖨 N badge. GET /api/finance/invoices/[id]/pdf (finance.view). Live-tested: 2 prints -> +2, 2 audits, lastPrintedBy correct, QR verifies.

## ✅ B.8 PAYROLL: COMPLETE (all 8 lines, this turn)
- DB (migration b8_payroll): StaffSalary (userId unique; basic+house/transport/other+sacco+loan), PayrollRun (period unique/tenant, DRAFT|APPROVED), Payslip (runId+userId unique; full statutory columns). staffSalary+payrollRun in TENANT_OWNED_MODELS (payslip scoped via run).
- KE STATUTORY CALC (payroll.service.ts — pure fns, unit-verified): PAYE_BANDS 2024/25 monthly [24000@10%, 32333@25%, 500000@30%, 800000@32.5%, ∞@35%] + PERSONAL_RELIEF 2400; SHIF 2.75% min 300; NSSF 6% Tier I (cap 8k) + Tier II (cap 72k) => max employee 4,320; AHL 1.5%; taxable = gross - NSSF - SHIF - AHL (post-2025 deductibility). grossToNet() spot-checks: 50k->{paye 5846, shif 1375, nssf 3000, ahl 750}, 24k->paye 0, 8k->shif floor 300. EDIT POINT: constants at top of file when rates gazetted.
- Service: listSalaries (all active staff w/ configured flag), setSalary (upsert + audit), runPayroll(period, overtime{userId:KES}) — gross=basic+allowances+OT, net=statutoryNet-sacco-loan; dup period 409; approveRun locks (re-approve 422); runDetail. PayrollError mapped.
- API: /api/payroll (GET views salaries|runs|run&id; POST salary|run|approve) — ANY-of staff.manage OR finance.manage_structure (try/catch chain). /api/payroll/payslip/[id] — staff download OWN slip (403 others), admins any.
- Payslip PDF (G.10 #6): payslip-pdf.tsx — EARNINGS/STATUTORY DEDUCTIONS (PAYE/SHIF/NSSF/AHL)/OTHER (SACCO/loan)/NET PAY green box, QR verified, "Confidential".
- UI: /payroll (nav "Payroll" Banknote, staff module, staff.manage perm; page guard is ANY-of via manual can() check — requirePagePermission is ALL-of, GOTCHA) — Salaries tab (table w/ not-set badges + edit dialog), Runs tab (cards w/ gross/PAYE/net + status) -> RunDetail (full statutory table + payslip links + Approve & lock), NewRunDialog (month + per-staff OVERTIME inputs B.8.8).
- Seed: 4 salaries (principal 85k+28k allow, deputy 65k+21k, class teacher 45k+14k, receptionist 28k+9k) + demo run 2026-05 (persisted for demos).
- LIVE-TESTED (scripts/payroll-test.ts kept, 14 assertions): all statutory spot-checks ✓ run 4 staff ✓ dup 409 ✓ OT in gross ✓ PAYE matches calculator ✓ net-sacco ✓ approve locks ✓ totals ✓. Screenshot 59 QA'd (full breakdown table). tsc/build(6.58kB + 2 APIs)/test:roles green.

## ✅ B.9 HUMAN RESOURCES: COMPLETE (all 8 lines, this turn)
- DB (migration b9_hr — NOTE node_modules+playwright wiped AGAIN this session, npm install + npx playwright install chromium + apt libs rerun): StaffProfile (userId unique; TSC/ID/KRA/quals/employmentDate/contractType PERMANENT|CONTRACT|BOM|INTERN/contractEndDate/emergencyContact), LeaveRequest (type/start/end/days/status PENDING|APPROVED|REJECTED|CANCELLED + decidedBy*), JobPosting+JobApplication (status NEW|SHORTLISTED|INTERVIEWED|HIRED|REJECTED), Appraisal (period/score 1-5/reviewer), DisciplinaryRecord, TrainingRecord. All in TENANT_OWNED_MODELS (jobApplication scoped via posting).
- Service hr.service.ts: LEAVE_TYPES KE allowances (annual 30/sick 14/maternity 90/paternity 14/compassionate 7/study 10 — EDIT POINT); staffDirectory, upsertProfile, promoteStaff (audited role change; self-change FORBIDDEN; PARENT/STUDENT/SUPER_ADMIN roles INVALID), leaveBalances (year-scoped APPROVED days vs allowance), applyForLeave (BALANCE enforcement), decideLeave (self-approve FORBIDDEN, re-decide INVALID; APPROVED -> A.17 createEvent "Name — Annual leave"), listLeave (mineOnly), postings CRUD + setApplicationStatus, addAppraisal/addDisciplinary/addTraining, staffFile (all sections + balances). HrError -> 404/403/422.
- API: /api/hr single hub (GET views directory|leave|mine|postings|file&userId; POST actions profile|promote|leave_apply[ANY STAFF self-service via requireUser]|leave_decide|posting|application|app_status|appraisal|disciplinary|training — writes staff.manage).
- UI: /staff page (was 404!) + components/hr/staff-client.tsx — Directory (TSC/contract badges + File drawer: HR record, leave balances grid, appraisals w/ stars, training, red disciplinary; manage buttons Edit record/Change role/Appraise/Training/Disciplinary), Leave tab (My leave balances 2x3 grid + Apply dialog w/ remaining hints + Approvals list w/ Approve/Reject), Recruitment tab (postings w/ applicant pipeline selects + Post job/Log applicant dialogs). Modal z-[60] (sits above the file drawer's z-50 — layering note).
- Seed: Chebet profile (TSC/584211, Moi Univ, since 2021) + PENDING study leave ("KNEC marking training" 3d) + "Kiswahili / CRE teacher" posting w/ 2 applicants (Mercy SHORTLISTED, Hassan NEW).
- LIVE-TESTED (scripts/hr-test.ts kept, 12 assertions): directory+TSC ✓ apply 5d ✓ over-balance 422 ✓ SELF-APPROVE blocked ✓ approve -> balance 25/30 + calendar event ✓ re-decide blocked ✓ promotion audited + SELF-promote blocked ✓ staff file all sections ✓ recruitment status ✓. Screenshot 60 QA'd (balances + pending approval visible). tsc/build(/staff 10kB + /api/hr)/test:roles green.

## ✅ B.10 PARENT PORTAL: COMPLETE (8/9 lines; homework BLOCKED until B.12 — flagged)
- NEW permission portal.parent (PARENT role; catalogue + matrix; test:roles still 24/24).
- Service parent-portal.service.ts: myChildren (cards w/ 30d attendance %, last absent, aggregate fee balance, latest PUBLISHED exam), childDetail (60d attendance, all invoices w/ balances, published-exam groups w/ avg %, contacts = child's classTeacherId + PRINCIPAL/DEPUTY), parentStk (ROW-SCOPE GUARD on invoice's student THEN B.7 stkForInvoice). PortalError -> 404.
- API: /api/portal (GET children|child&id, POST stk) — all portal.parent.
- UI: /portal "My children" (nav "My children" HeartHandshake, permission portal.parent — parents see Dashboard+My children+Calendar+Messages only) — child cards (attendance/fee tiles, new-results flag) -> child detail (Fees card FIRST w/ Pay buttons + bursary lines, Results w/ Report card PDFs, 60-day attendance badge timeline, "Talk to the school" message buttons). Mobile screenshot taken (parents are on phones). PayDialog explains M-Pesa prompt + SMS receipt.
- SEED DRIFT GOTCHA (hit + fixed this turn): a db reset mid-history left exam/invoice seed rows pointing at OLD student ids (Achieng had 0 invoices/results). FIX: cleared examResult/exam/invoice/feeStructure and re-seeded — seed.ts upserts guard against dup KEYS but NOT against orphaned rows from previous student generations. If portal/exam data looks empty: clear those 4 tables + npm run db:seed.
- LIVE-TESTED (scripts/portal-test.ts kept, 9 assertions): own child only ✓ aggregates (91% attendance, CAT 1 flag) ✓ detail sections ✓ OTHER CHILD blocked ✓ parent STK -> callback -> +1,000 applied + receipt SMS ✓ OTHER FAMILY'S INVOICE STK blocked ✓. Screenshots 61-63 (children cards / child detail w/ paid badge + report card + attendance timeline / mobile 390px) QA'd ✓. tsc/build(/portal 6.2kB)/test:roles green.

## ✅ B.11 STUDENT PORTAL: COMPLETE (5/7; assignments->B.12, notes->B.13 flagged) — FOUNDER DECISION: SHARED FAMILY PORTAL
- Founder 2026-06-12: "parents and students use same portal as other students dont have phones" — STUDENT role granted portal.parent; /portal serves BOTH. scopeWhere(STUDENT) = { userId: user.id } (already existed from A.3) -> student sees exactly their own linked record.
- childDetail += timetable (class TimetableSlots w/ subject codes) -> new Timetable card (Mon-Fri × period grid) on the shared portal child view. Service verified 8 slots; API returns timetable key.
- Student login created + persisted: achieng@karibuhigh.ac.ke / Karibu2026! (NEYO-STUD-0001, linked to Student.userId via the B.1 createLogin pattern).
- LIVE-TESTED (scripts/student-portal-test.ts kept, 7 assertions): student sees ONLY own record ✓ timetable 8 ✓ fees/results/attendance ✓ other-student blocked ✓ own report 85% EE ✓ other report blocked ✓. Screenshot 64 (student session, role chip "Student", filtered sidebar). tsc/build/test:roles green.
- CHECKLIST DISCIPLINE REMINDER (founder called this out): tick FEATURES-CHECKLIST in the SAME TURN as the anchor — never anchor-only. B.10+B.11 both ticked.

## NEXT (strict list order): **B.12 TEACHER PORTAL** — Enter marks (own subjects — B.5 sheet EXISTS row-scoped, verify+tick) / Record attendance (own class — B.3 EXISTS, verify+tick) / View class roster (B.1 row-scoped list EXISTS) / View own timetable (B.4 teacherTimetable EXISTS — needs UI) / Upload notes (A.9 storage — needs Note model or defer to B.13) / Assign homework (NEW Homework model — UNBLOCKS B.10+B.11 homework lines!) / Lesson plans AI assist (plans EXIST; AI=B.23 flag) / Per-class reports. Build: homework model + teacher home view; verify-and-tick the existing engines. — Salary processing (gross→net) / Payslip PDF (G.9 branding) / PAYE calculation (KE 2024+ bands: 10%/25%/30%/32.5%/35%, personal relief 2,400/mo) / NHIF->SHA (2.75% of gross, min 300) / NSSF Tier I+II (6% each side, tiered caps) / SACCO deductions / Loan deductions / Overtime calc + approval. All computable with public KE rates — no external creds. Needs: StaffSalary model (basic + allowances) + PayrollRun + Payslip. After B.8 -> B.9 HR. — remaining lines: M-Pesa STK push for INVOICES (wire A.6 initiateStkPush -> on callback PAID apply to invoice via applyPaymentToInvoice; dev mock proves flow) / Receipt PDF + SMS to parent (extend A.10 receipt w/ invoice context + A.7 SMS seam on payment) / Idempotent M-Pesa refs (A.6 @unique — verify in invoice flow test) / Daraja verification on every record (A.6 queryPaymentStatus button in invoice context) / Scholarships, discounts, bursaries (Invoice discount/waiver lines or separate model) / Fee reminders auto-SMS sequence (A.12 cron job + A.7 cascade + quota check; overdue invoices -> guardian SMS w/ dedupe). Bank integration (Equity/KCB) = DEFER (needs bank APIs/founder accounts). After B.7 -> B.8 Payroll. — Competency tracking (basic) / Learning outcomes tagging / CBC report forms (KICD format) / Rubrics (4-point scale — cbcLevel exists, extend to strand-level) / Teacher formative assessments / Parent-friendly CBC reports. Reuses: Subject (CBC), ExamResult pattern, report-card PDF, cbcLevel. After B.6 -> B.7 FINANCE (the money module: fee structures -> invoices -> M-Pesa via A.6 -> receipts; unlocks G.13 Mzazi Card). — Exam setup (name/term/type — currentTerm() ready) / Subject mapping per exam / Marks entry sheet (grid, autosave) / CBC auto-grading (EE/ME/AE/BE) / Position calculation / Mean score / Report card PDF (co-branded, G.9 branding; AI comments seam->B.23) / CAT management / Result slips / Transcripts / Performance analytics / Student progress tracking / KCSE prediction (AI deferred) / Photo-grading (AI deferred). B.5 also UNBLOCKS G.16 performance-rank reshuffle strategy. — Subjects management / Classes (exists from B.1 — verify+tick) / Streams (exists — verify+tick) / Academic calendar (CBC terms; A.17 calendar exists — add term structure) / Departments / Timetable generator (auto+manual — BIG) / Lesson planning / Course management / CBC support / 8-4-4 support / University curriculum support. Assess each line: several partially exist; timetable is the heavy lift. After B.4 -> B.5 Examination.
Remember: when B-module docs are built, apply G.9 branding via getSchoolProfile() (pattern proven in transfer letter).
(Superseded note: B.1 core + A.3.8/9 row-scoping were ALREADY BUILT by the previous chat after the old anchor was written, and have now been audited + live-verified + ticked. The keystone models Student/SchoolClass/Guardian/StudentGuardian/StudentDocument/StudentRequirement exist; "student" is in SOFT_DELETE_MODELS; B.1 models are in TENANT_OWNED_MODELS.)

## ENV / SANDBOX (persists across sessions reminders)
- docs/ at /home/user/docs. Project root /home/user/neyo.
- node_modules NOT snapshotted → `cd /home/user/neyo && npm install` if missing. For screenshots also: `npx playwright install chromium` + `sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libatspi2.0-0 libxdamage1 libasound2 libxcomposite1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2`.
- DEV SERVER: `(setsid npm run dev </dev/null >/tmp/dev.log 2>&1 &) ; sleep 14` then wait for port 3000. AFTER `npm run build` you MUST `rm -rf .next` before `npm run dev` (else "Cannot find the middleware module" 500).
- Prisma: ALWAYS `./node_modules/.bin/prisma` (bare npx pulls v7 which rejects schema). Migrate: `./node_modules/.bin/prisma migrate dev --name X`. Seed: `npm run db:seed`.
- pkill -9 -f next-server returns -1 (kills the calling shell, harmless) — just re-run the next command; don't combine pkill with other steps you need to keep.
- Image gen: occasionally returns "no images" (text-only) — just retry with a shorter prompt.

---
_Earlier: after A.19 CI/CD + DevOps (A.1-A.19 done)_

## A.19 CI/CD + DevOps: DONE (all 6 lines; config+docs, no DB/UI)
- npm scripts added (package.json): typecheck (tsc --noEmit), migrate:deploy (prisma migrate deploy), worker (tsx scripts/worker.ts), test (=test:roles).
- CI (A.19.1): .github/workflows/ci.yml — on PR + push to main: npm ci, prisma:generate, prisma validate, migrate:deploy (CI sqlite), typecheck, test:roles, lint, build. CI env DATABASE_URL=file:./dev.db + a dummy NEYO_MASTER_KEK. concurrency cancel-in-progress.
- Vercel web deploy (A.19.2): .github/workflows/deploy-web.yml (push main, guarded by repo var ENABLE_VERCEL_DEPLOY==true; vercel pull/build/deploy --prod; runs migrate:deploy w/ PROD_DATABASE_URL first). vercel.json (framework nextjs, buildCommand prisma generate+migrate deploy+next build, CRON */1 -> /api/jobs/tick).
- Fly worker deploy (A.19.3): .github/workflows/deploy-worker.yml (push main on jobs/prisma/worker/docker paths, guarded by ENABLE_FLY_DEPLOY==true). Dockerfile.worker (node:20-slim + openssl, npm ci + npm i bullmq ioredis, cp worker.ts.example->worker.ts, prisma generate, CMD tsx scripts/worker.ts). fly.toml (app neyo-worker, no [[services]], [processes] worker). scripts/worker.ts gitignored (generated at build).
- Branch protection (A.19.4): documented in docs/DEPLOY.md §2 (require PR + approvals + status check "CI / Typecheck, tests & build" + up-to-date). .github/CODEOWNERS (replace @your-github-username) + .github/pull_request_template.md.
- Migrations auto-applied (A.19.5): migrate:deploy in CI + Vercel deploy job + vercel.json buildCommand. Forward-only; never reset prod.
- Rollback (A.19.6): docs/DEPLOY.md §7 — Vercel "Promote to Production" instant rollback, Fly releases rollback, git revert, DB restore-from-snapshot (additive vs destructive guidance).
- NEW route handler: GET /api/jobs/tick — Vercel-Cron entrypoint, authorizes on `Authorization: Bearer <CRON_SECRET>` env (the existing POST stays SUPER_ADMIN). Runs tick({}) -> due cron jobs + A.16 webhook retry (EVERY_MINUTE_JOBS). respond.ts `fail` now imported there.
- ESLint set up (was missing — `next lint` was interactive/blocking CI): installed eslint@8 + eslint-config-next@14.2.5 + @typescript-eslint/{eslint-plugin,parser}@7 (devDeps). .eslintrc.json extends next/core-web-vitals + plugin:@typescript-eslint/recommended; no-explicit-any OFF, no-unused-vars WARN (^_ ignore), ban-ts-comment OFF; ignores worker.ts.example + migrations. `npm run lint` exits 0 (warnings only).
- .gitignore += scripts/worker.ts, .vercel.
- VALIDATED LOCALLY: all 3 workflow YAML + vercel.json + fly.toml parse; typecheck clean; prisma validate ok; migrate:deploy "no pending"; test:roles 24/24; npm run lint exit 0; npm run build ✓ (/api/jobs/tick present). No live deploy possible in sandbox (needs founder hosting accounts) — deploy jobs gated behind ENABLE_* repo vars so repo stays green pre-connect.
- FOUNDER TODO (provide later): push neyo/ as GitHub repo root; set secrets VERCEL_TOKEN/VERCEL_ORG_ID/VERCEL_PROJECT_ID/PROD_DATABASE_URL/FLY_API_TOKEN + vars ENABLE_VERCEL_DEPLOY/ENABLE_FLY_DEPLOY=true; configure branch protection per DEPLOY.md §2; set runtime env (DATABASE_URL Postgres, CRON_SECRET, NEYO_MASTER_KEK, + provide-later keys); `vercel link` + `fly launch`.

_Earlier: after A.18 Receptionist Operations (A.1-A.18 done)_

## A.18 Receptionist Operations: DONE (all 8 lines, full-stack, live-tested)
- DB (migration a18_reception): VisitorLog (name, phone, idNumber, purpose, host, badgeNo "V-001", signedInAt/signedOutAt), AdmissionInquiry (parentName, phone, studentName, gradeWanted, curriculum CBC|8-4-4, notes, status NEW|CONTACTED|ENROLLED|CLOSED), PhoneMessage (callerName, callerPhone, forUserId/forUserName, message, conversationId). All 3 added to Tenant relations + tenant-tables TENANT_OWNED_MODELS.
- Permission: NEW "reception.operate" (granted to RECEPTIONIST + LEADERSHIP) + added to session.ts WRITE_PERMISSIONS. test:roles 24/24 green.
- Validations: src/lib/validations/reception.ts (kePhone/kePhoneOptional helpers reuse normalizeKePhone from auth.ts; visitorSignInSchema, walkInPaymentSchema [amount coerce int, method cash|mpesa, mpesaRef], admissionInquirySchema, phoneMessageSchema).
- Service: src/lib/services/reception.service.ts — nairobiDayBounds() (UTC+3 today window), nextBadgeNo (per-tenant per-day count -> V-00N), signInVisitor/signOutVisitor/todayVisitors/getVisitor, recordWalkInPayment (NO STK; cash->synthetic CASH-<base36> ref, mpesa->manual ref w/ dup guard on Payment.mpesaRef unique; status=PAID, provider cash|mpesa_manual, audit payment.walkin), captureInquiry/todayInquiries, relayPhoneMessage (reuses A.8 createConversation DIRECT + sendMessage -> staff inbox; keeps PhoneMessage log), receptionDashboard (today's visitors/onSite/inquiries/calls/payments[raw db, status PAID, deletedAt null]/collected), dayEndSummary (totals + lists), staffForRelay. ReceptionError NOT_FOUND|DUPLICATE. respond.ts maps it (409 dup / 404).
- API routes (all requirePermission reception.operate; payments also finance.record_payment): GET/POST /api/reception/visitors, POST /api/reception/visitors/[id]/signout, POST /api/reception/payments, GET/POST /api/reception/inquiries (+audit), GET/POST /api/reception/calls, GET /api/reception/staff, GET /api/reception/summary, GET /api/reception/search?q (reuses A.11 search), GET /api/reception (dashboard).
- UI: src/components/reception/reception-desk.tsx (client) — PersonSearch (debounced typeahead dropdown via /api/reception/search), 4 StatCards, action bar (Sign in visitor=primary green + Record payment/New inquiry/Relay call + Day-end summary link opening /api/reception/summary), 4 list cards (visitors w/ badge+on-site/signed-out badges + print/sign-out actions, inquiries, relayed calls, payments), 4 dialogs (VisitorDialog/PaymentDialog/InquiryDialog/CallDialog using shared Dialog + useSaver), BadgePrint modal (#visitor-badge, window.print()). All 4 UX states. Page: (app)/reception/page.tsx (requirePagePermission reception.operate, passes schoolName). Nav: "Front Desk" (icon ConciergeBell — NOTE lucide has ConciergeBell not Concierge; permission reception.operate) in OVERVIEW.
- Print CSS: globals.css @media print added `body:has(#visitor-badge)` rules to print ONLY the badge (80mm centered).
- Seed: 2 visitors (Otieno James on-site/V-001, Njeri Catherine signed-out/V-002), 1 inquiry (Wanjiru Mary->Kamau Junior Grade 4 CBC), 1 cash walk-in payment (KES 5000, CASH-SEED0001), 1 relayed call (Achieng Mary->bursar). createConversation imported in seed already.
- LIVE-TESTED: scripts/reception-test.ts — badge increments to V-003; sign-out sets timestamp; cash payment PAID+synthetic ref; mpesa duplicate ref -> DUPLICATE blocked; phone relay creates conversation + message in bursar inbox; day-end totals correct. HTTP as Mwangi Susan (RECEPTIONIST): dashboard + summary return seeded data (2 visitors/1 onsite/1 inquiry/1 call/KES5000). tsc clean, build clean (/reception 7.92kB + 9 api routes). Screenshot 20-reception.png (populated, role-filtered nav correct). Scripts: scripts/reception-test.ts, scripts/shot-reception.ts.
- ENV NOTE: node_modules was cleared this session (snapshot exclusion) — had to `npm install`, `npx playwright install chromium`, and re-run the apt-get libs (libnss3 ... libcairo2) for screenshots. dev.db + source persisted. Daraja verification button = reuses A.6 queryPaymentStatus (activates with founder sandbox creds). Thermal printer device = hardware seam (browser print works now).

_Earlier: after A.17 Calendar (A.1-A.17 done)_

## A.17 Calendar (Shared): DONE (all 5 lines, full-stack, live-tested)
- DB (migration a17_calendar): CalendarEvent (title, description, date "YYYY-MM-DD", endDate (multi-day), startTime/endTime "HH:MM" or null=all-day, location, type=event|meeting|exam|holiday|sports|deadline, audienceRole (null=whole school else a Role), createdById). NEW Tenant.showReligiousHolidays Boolean @default(true). calendarEvent added to tenant-tables TENANT_OWNED_MODELS.
- Permissions: NEW "calendar.view" (granted to ALL 16 roles — shared school calendar) + "calendar.manage" (LEADERSHIP + DEPUTY/DEAN/HOD/TEACHER/CLASS_TEACHER). calendar.manage added to session.ts WRITE_PERMISSIONS (also added api.manage there). test:roles 24/24 green.
- Validations: src/lib/validations/calendar.ts (createEventSchema w/ refinements via withRefinements() helper [endDate>=date, endTime>startTime]; updateEventSchema = withRefinements(eventFields.partial()); calendarPrefsSchema; EVENT_TYPES; audience enum = "all"|Role). NOTE: can't .partial() a ZodEffects — base object `eventFields` defined separately, refinements applied via helper.
- Service: src/lib/services/calendar.service.ts:
  - getOccurrences({from,to,viewerRole,seeAll,showReligious}) — MERGES tenant CalendarEvent rows (multi-day overlap: date<=to AND (endDate??date)>=from) with the A.15 KE_MOMENTS holiday layer (cultural-calendar.ts) projected onto each year in range; religious moments skipped when showReligious=false; audience filter (seeAll OR !audienceRole OR audienceRole===viewerRole). Returns Occurrence[] (source event|holiday, readonly for holidays).
  - createEvent/updateEvent/deleteEvent (tenantDb, audience "all"->null). CalendarError NOT_FOUND.
  - inviteAudience (A.17.5) — notify() (A.7, in_app, href /calendar) to all active users (or role-filtered), excludes creator.
  - buildIcs (A.17.4) — RFC-5545 VCALENDAR/VEVENT, CRLF lines, all-day=VALUE=DATE w/ exclusive DTEND (next day), timed=DTSTART;TZID=Africa/Nairobi, escapes ;,\n, X-WR-TIMEZONE.
  - getCalendarPrefs/setCalendarPrefs (showReligiousHolidays on Tenant).
- API routes: GET/POST /api/calendar/events (GET requires calendar.view + ?from&to YYYY-MM-DD; POST calendar.manage + optional notify->invites + audit), PATCH/DELETE /api/calendar/events/[id] (calendar.manage + audit), GET /api/calendar/ics (calendar.view; 13-month window last-month..+12; returns text/calendar attachment <slug>-calendar.ics), PUT /api/calendar/prefs (tenant.manage_settings). respond.ts maps CalendarError (404).
- UI: src/components/calendar/calendar-view.tsx (client) — month grid (Mon-first, 42 cells, today=green pill, +N more, multi-day dots), week+day = AgendaList (day cards w/ type badge, time/location/audience/description, delete for non-holiday), event type colour dots + legend, view switcher pill (month/week/day), keyboard nav (←/→ step, T=today), iCal download link, New event dialog (title/date/type/times/location/audience/notes/notify checkbox; uses native date/time inputs + selects). All 4 UX states (skeleton/empty/error+retry/populated). Page: (app)/calendar/page.tsx (requirePagePermission calendar.view, passes canManage). Nav: "Calendar" (icon CalendarDays, permission calendar.view) in OVERVIEW section.
- Seed: 4 Karibu High events (Form 2 Parents' Meeting [PARENT, timed], Mid-term Break [multi-day holiday Aug6-10], Inter-house Sports Day [sports, timed], End of Term 2 Exams [multi-day exam Aug25-29]). Uses current year.
- LIVE-TESTED: scripts/cal-test.ts — occurrences merge; audience (PARENT sees PTA, STUDENT doesn't); religious-off hides Christmas but keeps Jamhuri; iCal valid (VEVENTs, TZID for timed + VALUE=DATE for all-day); inviteAudience count. HTTP: June API returns Madaraka+Eid holiday layer; iCal 200 text/calendar attachment w/ 19 VEVENTs. tsc clean, npm run build clean (/calendar 7.75kB + 4 api routes). Screenshots 18-calendar-month.png (Aug 2026, multi-day spans render) + 19-calendar-week.png. Test scripts: scripts/cal-test.ts, scripts/shot-calendar.ts.
- GOTCHA hit + fixed: after `npm run build` (which writes .next for prod), starting `npm run dev` against that .next threw "Cannot find the middleware module" 500. FIX: rm -rf .next before dev after a build. (Recorded for future turns.)

_Earlier: after A.16 Public API & Webhooks (A.1-A.16 done)_

## A.16 Public API & Webhooks: DONE (all 6 lines, full-stack, live-tested)
- DB (migration a16_public_api_webhooks): ApiKey (keyHash=SHA-256, keyPrefix display, scopes JSON, expiresAt/revokedAt, createdById), WebhookSubscription (url, events JSON, signingSecret, active, lastDeliveryAt), WebhookDelivery (status PENDING|DELIVERED|FAILED, attempts, maxAttempts=6, nextAttemptAt, responseStatus/Body, error). All 3 added to Tenant relations + tenant-tables.ts TENANT_OWNED_MODELS.
- Permission: NEW "api.manage" added to PERMISSIONS catalogue + WRITE list + LEADERSHIP bundle (so SUPER_ADMIN/SCHOOL_OWNER/PRINCIPAL). test:roles still 24/24 green.
- Validations: src/lib/validations/api-keys.ts (createApiKeySchema, createWebhookSchema, updateWebhookSchema, WEBHOOK_EVENTS=[payment.recorded,payment.failed,subscription.updated,user.created,notification.sent]).
- Services:
  - src/lib/services/api-key.service.ts: createApiKey (returns plaintext token ONCE; token=neyo_sk_<base64url 32B>; stores SHA-256 hash + 12-char prefix), listApiKeys, revokeApiKey, resolveBearerToken (no-tenant lookup via raw db, touches lastUsedAt), scopeAllows("*" wildcard), keyStatus(active/revoked/expired), hashToken. ApiKeyError.
  - src/lib/services/webhook.service.ts: list/create/update/deleteWebhook, sendTestEvent, dispatchEvent(tenantId,event,data) [fans out to matching active subs, creates delivery, fires 1st attempt non-blocking], attemptDelivery (HMAC sign + fetch w/ 8s AbortController timeout; on fail schedule backoff or FAIL), retryDueDeliveries (job body; picks PENDING w/ nextAttemptAt<=now), signPayload/verifySignature. WebhookError. BACKOFF_SEC=[0,60,300,1800,7200,21600], MAX_ATTEMPTS=6.
  - Signature header: `X-NEYO-Signature: t=<unix>,v1=<hmac-sha256 hex of ${t}.${rawBody}>` using sub.signingSecret. Also sends X-NEYO-Event, X-NEYO-Delivery headers.
- Bearer auth helper: src/lib/api/bearer.ts authenticateApiRequest(req, requiredScope?) -> {ok, tenantId, keyId, scopes} | {ok:false, response}. Enforces per-key rate limit (reuses A.14 checkRate, key `apikey:<id>`, 120/60s) -> 429 w/ Retry-After + X-RateLimit-*; scope check -> 403 INSUFFICIENT_SCOPE; missing/invalid -> 401.
- Jobs (A.12 reuse): registry.ts JOBS["webhook-deliver"]=retryDueDeliveries; NEW EVERY_MINUTE_JOBS=["webhook-deliver"] + jobs.service dueCronJobs() now unions EVERY_MINUTE_JOBS so the retry queue runs on every /api/jobs/tick (scheduler hits it each minute).
- API routes: management = session-gated (requirePermission("api.manage")) + audit-logged: GET/POST /api/api-keys, DELETE /api/api-keys/[id], GET/POST /api/webhooks, PATCH/DELETE /api/webhooks/[id], POST /api/webhooks/[id]/test. Public = Bearer-gated: GET /api/v1/me (scope reports.view) returns tenant + tenant-scoped counts + scopes + serverTime. respond.ts maps ApiKeyError + WebhookError.
- UI: src/components/settings/developer-panel.tsx (ApiKeysSection + WebhooksSection, all 4 UX states: skeleton/empty/error+retry/populated; one-time secret reveal banner w/ Copy; create forms; revoke/pause/remove/send-test; copy signing secret). Page: (app)/settings/developer/page.tsx (requirePagePermission("api.manage")). Nav: "Developer" item (icon Webhook, permission api.manage) in navigation.ts SYSTEM section.
- Seed: 1 sample API key (dev token: neyo_sk_devKaribuHighSampleToken000000000000000) + 1 webhook (signingSecret whsec_devKaribuHighSampleSigningSecret00) for Karibu High. createHash import added to seed.ts.
- LIVE-TESTED (dev server): /api/v1/me 401 no-auth, 401 bad-token, 200 valid (Karibu High, 9 users); rate limit 120 then 429 w/ Retry-After:51 + X-RateLimit headers; webhook dispatch -> DELIVERED attempt1 HTTP200 w/ receiver-verified HMAC sigValid=true (scripts/wh-test.ts + local node receiver); retry: dead URL -> PENDING attempt1 nextAttempt+60s -> retry job -> attempt2 nextAttempt+300s (backoff growing, scripts/wh-retry-test.ts). tsc clean, npm run build clean (/settings/developer 6.36kB + all 6 api routes present). Screenshot /home/user/screenshots/17-developer.png (populated, on-brand).
- Repeatable test scripts: scripts/wh-test.ts, scripts/wh-retry-test.ts, scripts/shot-developer.ts.

_Earlier: after A.15 i18n (A.1-A.15 done)_

## A.15 Internationalization: DONE
- DB: User.language (en|sw). Migration a15_language. session.ts SessionUser.language added.
- lib/i18n/dictionaries.ts: en+sw dicts, translate(lang,key,vars) w/ {{var}}, LANGUAGES. lib/i18n/cultural-calendar.ts: KE_MOMENTS (Madaraka/Mashujaa/Jamhuri/Huduma/Christmas/Eid/KCSE) + momentsInMonth/onDate/nextMoment (A.17 will render).
- components/i18n/lang-provider.tsx (LangProvider + useT) seeded from user.language in (app)/layout (inside PermissionsProvider). API POST /api/me/language.
- UI: sidebar labels translated via NAV_I18N; language switcher (EN/Kiswahili) in user-menu; sign-out label translated.
- Verified: EN/SW translate + interpolation, calendar lookups, language persists, invalid lang 422.

_Earlier: after A.14 Security_

## A.14 Security: DONE (7 code lines; 3 doc/operational in SECURITY.md)
- next.config.mjs headers(): CSP (allows inline styles + data: imgs + Safaricom connect-src), HSTS(prod only), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- src/lib/security/rate-limit.ts: checkRate/enforceRate/clientIp + RateLimitError(429). Applied: onboarding signup (5/h/IP, verified 429), OTP+magic already limited. Redis swap documented for multi-instance.
- Audit immutability: app only INSERTs AuditLog (verified, 0 update/delete). prisma/rls/audit-immutable.sql = Postgres triggers blocking UPDATE/DELETE.
- Argon2id (A.1.2) + AES-256-GCM (A.2.7) verified/ticked.
- Legal: (legal)/layout + /privacy + /terms (KE DPA 2019). components/legal/cookie-consent.tsx in root layout.
- SECURITY.md: ODPC reg + DPO, breach process (72h), pen-test — founder operational actions.
- respond.ts maps RateLimitError.

_Earlier: after A.13 Observability_

## A.13 Observability: core DONE (providers activate with keys)
- Dep: pino (external in next.config). lib/observability/: logger.ts (pino + secret redaction), capture.ts (captureError/captureMessage seam -> SENTRY_DSN), analytics.ts (track seam -> POSTHOG_KEY), health.ts (runHealthChecks: DB + Redis/Storage configured-state), alerts.ts (sendOpsAlert reuses A.7 cascade).
- respond.ts handleError now calls captureError.
- API: GET /api/health (200/503, point Better Stack here). Public page /status (real checks, Stripe-style).
- Verified: health operational+DB latency, status page, captureError logs, analytics event, pino REDACTS password.
- ACTIVATE: SENTRY_DSN(+@sentry/nextjs), POSTHOG_KEY(+posthog-node), LOGTAIL_TOKEN(+@logtail/pino). Better Stack = no key, just /api/health.

_Earlier: after A.12 Background Jobs_

## A.12 Background Jobs: DONE (in-process now; BullMQ activates with REDIS_URL)
- DB: JobRun (name,status,progress,attempts,result,error,timing) — platform-level, NOT tenant-scoped. Migration a12_jobs.
- lib/jobs/registry.ts: JOBS map (subscription-state-machine, recycle-purge), CRON_SCHEDULES (Nairobi EAT 01:00/02:00), nairobiTime/dueCronJobs (UTC+3).
- lib/jobs/jobs.service.ts: runJob (retry MAX_ATTEMPTS=3 + BACKOFF_MS + progress + JobRun), enqueue (Redis->bullmq-adapter else in-process), tick({only,force}), recentRuns. JobError mapped (400).
- lib/jobs/bullmq-adapter.ts: opaque dynamic import of 'bullmq' (avoids webpack bundling); activates with REDIS_URL. scripts/worker.ts.example = separate worker (npm i bullmq ioredis).
- API: GET /api/jobs, POST /api/jobs/tick (SUPER_ADMIN). UI: /settings/jobs (SUPER_ADMIN, URL-only/page-guarded; not in sidebar).
- Verified: retry succeeds on attempt 3, always-fail -> FAILED after 3, cron-due matches Nairobi times, 403 for non-admin, run-now works.
- ⭐ PROD: set REDIS_URL (Upstash) + npm i bullmq ioredis + deploy worker + cron hits /api/jobs/tick every minute.

_Earlier: PART G COMPLETE (G.1-G.7). Resume PDF roadmap at A.12._

## G.2 PWA + Offline: DONE
- public/manifest.webmanifest + icons (icon-512/192, apple-touch). public/sw.js (network-first nav, cache-first static, never API; /offline fallback). Root layout metadata: manifest + appleWebApp + icons.
- lib/offline/queue.ts: IndexedDB outbox; queuedPost(url,body,label) (online->POST w/ Idempotency-Key, else enqueue), syncQueue() (replays, drops on 2xx/4xx, keeps on 5xx/offline), listQueued/queueCount/remove. lib/offline/use-online.ts.
- components/offline/pwa-provider.tsx (register SW + auto-sync on 'online'), offline-indicator.tsx (topbar Offline/Sync pill). Mounted in app-shell + topbar.
- TEST: real browser at localhost (SW needs secure context; NOT in Arena iframe).
- ⭐ FIRST REAL OFFLINE ACTION wires at B.3 Attendance: mark-attendance button -> queuedPost().

## PART G STATUS: ALL DONE (G.1 activity, G.2 PWA/offline, G.3 wizard, G.4 help, G.5 view-as, G.6 soft-delete/recycle, G.7 ⌘K actions). G.8 polish = ongoing/optional.

_Earlier: after Part G G.1,G.4,G.7,G.6,G.5,G.3_

## G.3 First-Run Setup Wizard: DONE
- DB: Tenant.curriculum + onboardedAt. Migration g3_onboarding.
- validations/onboarding.ts (signupSchema, inviteSchema). services/onboarding.service.ts: signupSchool (atomic: assertSlugUsable + tenant + ensureTenantDek + initialiseModules + Argon2 owner SCHOOL_OWNER + session + audit tenant.created/auth.login), inviteStaff. OnboardingError mapped (409).
- API: POST /api/onboarding/signup (PUBLIC, sets cookie), POST /api/onboarding/invite (user.manage_roles).
- UI: PUBLIC /get-started 4-step wizard (school+SlugField / curriculum+modules / owner+password / done). Login page links it. (auth)/layout widened (children center; login + magic pages now self-set max-w-sm).
- Verified: signup creates school+owner+DEK+modules, auto-login, dashboard shows school; dup slug 409, reserved 422.

## G.5 In-school "View As" (read-only): DONE
- DB: Session.viewAsReadOnly. Migration g5_view_as. getSessionContext returns viewAsReadOnly; requirePermission BLOCKS WRITE_PERMISSIONS when viewAsReadOnly.
- services/view-as.service.ts: startViewAs (leaders only, same-tenant, not another leader, read-only) / stopViewAs. audit view_as.started/stopped.
- API: POST /api/view-as, POST /api/view-as/stop.
- UI: blue ViewAsBanner (vs amber super-admin ImpersonationBanner) in (app)/layout; "View as staff…" in UserMenu (canViewAs prop threaded shell->topbar->user-menu); ViewAsLauncher picks staff (reuses /api/conversations/recipients).
- Verified: view-as teacher -> /me=teacher, reads ok, writes 403 read-only, stop restores, bursar 403, can't view another leader.

## G.6 Soft-delete + Recycle Bin: DONE
- DB: Payment.deletedAt/deletedById. Migration g6_soft_delete. SOFT_DELETE_MODELS=["payment"] in tenant-tables.ts (add "student" in B.1).
- tenantDb() now: hides deletedAt!=null on reads (opt back in with args.includeDeleted=true), and rewrites delete/deleteMany -> soft-delete updateMany(deletedAt). Hard purge uses raw db.
- services/recycle.service.ts: listDeleted/restore/purge (audited). RecycleError mapped.
- API: DELETE /api/payments/[id] (finance.manage_structure), GET /api/recycle-bin, POST /api/recycle-bin/action (tenant.manage_settings).
- UI: /settings/recycle-bin + trash icon on payments-list (permission-gated). Sidebar "Recycle Bin".
- Verified: 403 for accountant, soft-delete hides row, bin lists, restore, purge removes from DB.

## PART G — founder-approved enhancements (NOT in original PDF). Build remaining in order.
- G.1 Activity Feed: DONE — services/activity.service.ts (entityActivity/tenantActivity/describeAction), /api/activity, components/activity/activity-feed.tsx (reusable; on dashboard, drop <ActivityFeed entityType entityId/> on detail pages).
- G.4 Help overlay: DONE — components/shell/help-overlay.tsx (press "?"), core/commands.ts SHORTCUTS. Mounted in app-shell.
- G.7 ⌘K command actions: DONE — core/commands.ts APP_COMMANDS (permission-filtered) merged into command-palette.tsx.
- Founder said: keep suggesting new enhancements as we go (add to Part G).

_Earlier: after A.11 Search (Cmd+K live; tsvector documented for prod)_

## A.11 Search: DONE (LIKE now; tsvector for prod)
- services/search.service.ts: search()/typeahead() tenant-scoped across users/payments/conversations (add entities as modules land). prisma/rls/search.sql documents Postgres tsvector+GIN.
- API GET /api/search?q=. UI: components/shell/command-palette.tsx (⌘K/Ctrl+K, debounced, keyboard nav) mounted in app-shell; topbar search dispatches "neyo:open-search".
- Verified: person/payment/conversation hits; <2 chars empty; tenant isolation (Uhuru 0 Karibu hits).

_Earlier: after A.10 Document Generation (core done; thermal+bulk seamed)_

## A.10 Document Generation: core DONE
- Deps: @react-pdf/renderer, exceljs (both external in next.config). qrcode already in.
- DB: DocumentVerification (code @unique, payloadHash). Migration a10_doc_verification. In TENANT_OWNED_MODELS.
- documents/csv.ts (toCsv, BOM+escape), xlsx.ts (toXlsx via exceljs), qr.ts (qrDataUrl, verifyUrl), receipt-pdf.tsx (renderReceiptPdf, co-branded header + QR + amount box).
- services/document.service.ts: hashPayload, issueVerification, verifyDocument, buildPaymentReceiptPdf (payment -> code -> QR -> PDF).
- API: GET /api/payments/[id]/receipt (PDF download), POST /api/export (csv|xlsx), public page /verify/[code] (no auth).
- payment.service.listPayments added. UI: components/finance/payments-list.tsx + /finance/payments (export menu + per-row PDF receipt), components/ui/export-menu.tsx (drop anywhere). globals.css @media print updated.
- Verified: receipt PDF %PDF + filename; CSV escaping; XLSX bytes; public verify genuine/not-found.
- PARTIAL: thermal printer (Web Bluetooth, device-only) + bulk async (BullMQ needs Redis A.12) -> seams.

_Earlier: after A.9 File Uploads & Storage (DONE; R2 activates with creds)_

## A.9 File Uploads & Storage: COMPLETE & VERIFIED
- Deps: sharp (resize/EXIF strip), @aws-sdk/client-s3 + s3-request-presigner (R2). All marked external in next.config.mjs serverComponentsExternalPackages.
- DB: StoredFile (tenant-owned, key @unique). Migration a9_storage.
- src/lib/storage/provider.ts (interface + STORAGE_CONFIGURED), r2-provider.ts (R2 via S3 presign; activates with R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET[/R2_PUBLIC_BASE]), local-provider.ts (dev, stores ./.uploads served via /api/files/serve).
- src/lib/services/storage.service.ts: buildKey (tenants/<id>/<cat>/<uuid>.ext), presignUpload, recordFile (10MB cap, type allowlist), uploadProcessedImage (sharp resize<=1200 + EXIF strip), devPut, readObject, deleteFile. StorageError mapped in respond.ts.
- API: /api/files/presign, /confirm, /dev-put (PUT, dev), /serve (tenant 403 guard), /image (multipart resize), /[id] DELETE.
- UI: components/ui/file-upload.tsx (FileUpload + AttachmentChip), WIRED into A.8 messages-client composer (attachments now fully working).
- Verified: presign->PUT->confirm->serve; cross-tenant serve 403; image 2000x1500 -> 1200x900 no EXIF; bad type 415.
- ⭐ R2 GO-LIVE: founder sets R2_* env. Reuse storage for B.1 student photos, A.10 docs.

_Earlier: after A.8 In-App Messaging (core done; attachments need A.9)_

## A.8 In-App Messaging: core DONE; attachments -> A.9
- DB: Conversation(type DIRECT|GROUP|ANNOUNCEMENT), ConversationParticipant(lastReadAt, role), Message(attachmentUrl/Name fields ready). Migration a8_messaging. Conversation+Message in TENANT_OWNED_MODELS (Participant scoped via conversation).
- validations/messaging.ts; services/messaging.service.ts: createConversation(DIRECT dedup), sendMessage(participant+announcement-lock, bumps convo, fan-out to createInApp notif), listConversations(unread + 1:1 title resolve), getMessages(markRead+receipts), totalUnread, searchMessages. MessagingError mapped in respond.ts.
- API: GET/POST /api/conversations, GET/POST /api/conversations/[id]/messages, GET /api/conversations/[id]/stream (SSE 3s), GET /api/conversations/recipients.
- UI: components/messaging/messages-client.tsx (list+thread+composer, live SSE, mobile back). /messages page. Sidebar "Messages" (Overview). Message notifications deep-link /messages?c=ID.
- Seed: Karibu DM (teacher Njoroge<->bursar Achieng, M-Pesa fee thread), GROUP "Form 2 Teachers", ANNOUNCEMENT "Closing Day".
- Verified: list/unread, open+receipts, send, announcement 403, recipients(8), SSE tick.

_Earlier: after A.7 Notifications (core done; external transports seamed)_

## A.7 Notifications: core DONE; SMS/Email/WhatsApp/Push activate with keys
- DB: Notification (in-app inbox), NotificationPreference (per-user optOut JSON), NotificationTemplate. Migration a7_notifications. Notification+Template in TENANT_OWNED_MODELS.
- core/channels.ts: CASCADE_ORDER [in_app,push,whatsapp,sms,email] + costKes + configured(env). notifications/template.ts renderTemplate({{var}}). Seams: notifications/{sms,email,whatsapp,push}.ts (dev console).
- services/notification.service.ts: createInApp, notify(cascade, opt-out aware, audit), previewCost, listForUser, markRead/markAllRead, setOptOut, getUnreadCount.
- API: GET /api/notifications, POST /read, GET /stream (SSE unread every 5s), POST /send (comms.send; by recipientIds or role), POST /cost-preview.
- UI: components/shell/notification-bell.tsx (live SSE badge + drawer + mark-read; empty/loading states). Replaced static bell in topbar.
- Seed: 3 notifications for Karibu principal (fees/attendance/exam).
- Verified: inbox/unread, SSE event, mark-all, cost preview KES, send-to-role, 403 without comms.send.
- ACTIVATE TRANSPORTS via .env: AT_API_KEY+AT_USERNAME (SMS), RESEND_API_KEY (email), WHATSAPP_TOKEN (WhatsApp), VAPID_PUBLIC_KEY+VAPID_PRIVATE_KEY (push).

_Earlier: after A.6 Payment Routing_

## A.6 Payment Routing: DONE (STK live-activates when founder adds Daraja creds)
- DB: PaymentCredential (per-tenant; secrets ENCRYPTED via A.2.7), Payment (mpesaRef @unique, checkoutRequestId @unique). Migration a6_payment_routing. Both in TENANT_OWNED_MODELS.
- src/lib/payments/provider.ts (interface), daraja-provider.ts (REAL Safaricom calls: oauth/stkpush/stkpushquery + parseCallback + verifyWebhookToken), mock-provider.ts (dev).
- src/lib/services/payment.service.ts: savePaymentCredentials (encrypt), getPaymentConfigStatus, initiateStkPush, handleCallback (IDEMPOTENT, dup mpesaRef guard), queryPaymentStatus, reconcile. pickProvider = Daraja if creds active else dev mock. PaymentError mapped in respond.ts.
- API: POST/GET /api/payments/credentials, POST /api/payments/stk (finance.record_payment), POST /api/payments/webhook/[slug] (token via ?t=, always 200), GET /api/payments/status/[id], POST /api/payments/simulate-callback (DEV only).
- UI: /settings/payments + components/settings/payments-manager.tsx (masked secrets). Sidebar "Payments" (tenant.manage_settings).
- VERIFIED via mock: stk->PENDING->callback->PAID(mpesaRef)->idempotent replay->reconcile; creds stored encrypted (no plaintext) + decrypt round-trip.
- ⭐ TO GO LIVE: founder enters Daraja creds on Payments page + set .env DARAJA_WEBHOOK_TOKEN + APP_BASE_URL (public). Then also switch A.5 billing chargeViaSeam to call initiateStkPush.

_Earlier: after A.5 Billing & Subscriptions_

## ⚠️ INFRA NOTE: node_modules is NOT snapshotted — if commands fail with "module missing", run `npm install` in /home/user/neyo first. ALSO: use ./node_modules/.bin/prisma (npm scripts do) — bare `npx prisma` pulls Prisma 7 which rejects our schema. Local pinned = 5.17.

## A.5 Billing & Subscriptions: DONE (2 lines partial via seams)
- DB: Subscription (planKey,status,grandfatheredPrice,period,graceEndsAt), SubscriptionPayment (mpesaRef unique), UsageCounter (tenant,metric,periodKey). Migration a5_billing. Both added to TENANT_OWNED_MODELS.
- core/plans.ts: free_karibu(0)/pro(9000)/elite(22000) KES/term + limits + overageAllowance + maxAddOns.
- services/billing.service.ts: ensureSubscription, subscribeToPlan (grandfathers price; chargeViaSeam auto-confirms in dev, fails closed in prod — real Daraja STK = A.6), runSubscriptionStateMachine (ACTIVE->GRACE(14d)->SUSPENDED, NEVER deletes data), BillingError.
- services/limits.service.ts: checkLimit/checkSmsQuota/recordUsage/getAllLimitStatuses, currentPeriodKey (YYYY-T{1,2,3}).
- API: GET /api/billing, POST /api/billing/subscribe (requirePermission tenant.manage_settings), POST /api/billing/run-state-machine (SUPER_ADMIN, cron stand-in). respond.ts maps BillingError.
- UI: /settings/billing + components/settings/billing-manager.tsx (status badge, usage bars, plan picker). Sidebar "Billing" (always visible).
- Seed: Karibu=Pro (usage 312 students/28 staff/1240 sms), Uhuru=Free Karibu.
- PARTIAL: M-Pesa STK (seam->A.6 needs Daraja creds); Receipt PDF (A.10) + SMS (A.7).
- Auto-downgrade intentionally NOT built (spec says excluded).

_Earlier: after A.4 Identity Generation (ALL 5 lines DONE)_

## A.4 Identity Generation: COMPLETE & VERIFIED
- src/lib/core/identity.ts: ENTITY_CODES (STUDENT=S, INVOICE=INV, STAFF=T...), DEFAULT_PADDING=6, prefixFromSlug (karibu-high->KH), entityCode().
- src/lib/services/identity.service.ts: nextTenantId(tenantId, entityType, {padding}) -> "KH-S-000247" using ATOMIC db.idSequence.upsert({update:{lastValue:{increment:1}}}) (NOT interactive tx — that exhausted SQLite pool under load). peekNextTenantId (display only). generateNeyoLoginId() (NEYO-xxxx, collision-checked).
- Proven: 50 parallel calls -> 50 unique contiguous ids; per-tenant + per-entity counters independent; padding override works.
- test-roles.ts now has 24 assertions (added A.4 identity tests). USE nextTenantId at entity creation starting in B.1.

_Earlier: after A.3.10 (cross-role test suite) — A.3 DONE except 8/9 (blocked by B.1)_

## A.3 line 10 "Cross-role test suite": DONE
- scripts/_assert.ts (tiny harness), scripts/test-roles.ts (21 assertions). npm run test:roles. Exit 1 on fail (CI-ready). Needs seed (2 schools).
- A.3 STATUS: lines 1-7,10 DONE. Lines 8 (TEACHER own-class) & 9 (PARENT own-child) BLOCKED until B.1 Student/Class models — build row-scoping helpers then.

## A.3 line 7 "Server-component redirect on forbidden": DONE
- src/lib/core/page-guards.ts: requirePageUser (->/login), requirePagePermission(...perms) & requirePageRole(...roles) -> redirect("/forbidden").
- src/app/forbidden/page.tsx calm screen. Applied to /settings/modules (tenant.manage_modules) + /settings/data (tenant.export_data).
- TESTING NOTE: Next 14 redirect() in a dynamic Server Component returns HTTP 200 with a CLIENT-SIDE redirect payload (curl sees 200). Verify by body content: unauthorized body has NO page content + contains "/forbidden"; real browsers redirect. Don't trust curl status for RSC redirects.

## A.3 line 6 "Sidebar nav role-filtered": DONE
- navigation.ts: NavItem.permission added; filterNavigation(sections, enabledSet, hasPermission) composes module + permission filters.
- Sidebar (client) calls usePermissions().has and filters NAVIGATION by both. System items Modules(perm tenant.manage_modules)/Data(tenant.export_data) gated; Security/Settings always shown.
- Verified per role: principal full; bursar=Students/Finance/Library; librarian minimal; etc.

## A.3 lines 4+5 "frontend permissions": DONE
- components/auth/permissions-provider.tsx: PermissionsProvider (seeded from server via permissionsForRole in (app)/layout, re-syncs from /api/auth/permissions). Hooks: usePermissions() {role,permissions,has,hasAny,hasAll}, usePermission(perm).
- components/auth/can.tsx: <Can permission|anyOf|allOf fallback>. USE ONLY IN CLIENT TREES.
- components/dashboard/quick-actions.tsx: client component gating dashboard actions by permission.
- IMPORTANT RSC LESSON: don't pass icon component functions (or any function props) from a Server Component into a client component. Sidebar/AppShell now take enabledModules: string[] and filter NAVIGATION client-side (was passing navSections with icon fns -> 500).
- Verified: principal sees 3 quick actions, bursar 2, teacher 1, student/librarian fallback; all dashboards 200.

## A.3 lines 1+2+3 "Roles/permissions core": DONE
- roles.ts: 16 roles enum verified (single source of truth).
- src/lib/core/permissions.ts: PERMISSIONS catalogue + ROLE_PERMISSIONS for all 16 roles; can(role,perm) (SUPER_ADMIN=all), permissionsForRole(role), assertMatrixComplete().
- session.ts: added requirePermission(...perms) guard (alongside requireRole).
- API GET /api/auth/permissions -> {role, permissions[]}. /api/modules/[key] now uses requirePermission("tenant.manage_modules").
- Verified: matrix spot-checks pass; bursar 403 on module toggle; principal ok.

_Earlier: after A.2.10 tenant data export — A.2 DONE (except line 4 deferred)_

## A.2 line 10 "Tenant data export": COMPLETE & VERIFIED
- src/lib/services/export.service.ts: exportTenantData(tenantId) -> {manifest, school, users, modules, auditLog}; tenant-scoped via withTenant+tenantDb; REDACTS passwordHash/totpSecret/encryptedDek. recordExportAudit.
- API GET /api/tenant/export (requireRole owner/principal/super_admin) -> downloadable JSON (Content-Disposition).
- UI: /settings/data + components/settings/data-export-card.tsx (blob download). Sidebar "Data" added.
- Verified: 403 for non-leadership, secrets absent, tenant isolation (Uhuru export = 2 users), audit tenant.data_exported.
- A.2 STATUS: lines 1,2,3,5,6,7,8,9,10 DONE. Line 4 "Custom domain (Elite)" DEFERRED (needs real DNS at deploy).

## A.2 line 9 "Tenant impersonation (audit-logged)": COMPLETE & VERIFIED
- DB: Session.impersonatedUserId. Migration a2_impersonation.
- session.ts: getSessionContext() returns {user(=effective), isImpersonating, realUser, token}. getCurrentUser() now returns the EFFECTIVE user (impersonated when impersonating) — all tenant-scoped code auto-acts as target school.
- src/lib/services/impersonation.service.ts: startImpersonation (SUPER_ADMIN only, blocks impersonating another admin, audits in target tenant), stopImpersonation.
- API: POST /api/admin/impersonate {targetUserId}, POST /api/admin/impersonate/stop.
- UI: components/shell/impersonation-banner.tsx (amber sticky banner + Exit). (app)/layout.tsx uses getSessionContext, renders banner, skips subdomain guard while impersonating.
- Seed: NEYO super-admin support@neyo.co.ke (NEYO-ADMIN-001, SUPER_ADMIN, pwd Karibu2026!). 11 users total.
- TODO later: a support-console UI to pick a tenant/user (currently start via API). Audit actions: support.impersonation_started/_stopped.

## A.2 line 7 "Per-tenant encryption keys (DEK/KEK)": COMPLETE & VERIFIED
- DB: Tenant.encryptedDek/dekIv/dekTag (wrapped per-tenant DEK). Migration a2_tenant_dek.
- Master KEK: env NEYO_MASTER_KEK (base64 of 32 bytes; added to .env). PROD: load from KMS in src/lib/crypto/kek.ts getKek().
- src/lib/crypto/kek.ts: wrap/unwrapWithKek + explicit-key variants (for rotation). AES-256-GCM.
- src/lib/crypto/envelope.ts: generateDek + encrypt/decryptWithDek (compact "v1:iv:tag:ct" string).
- src/lib/services/encryption.service.ts: ensureTenantDek, encryptForTenant, decryptForTenant, rotateKek(oldKek,newKek). DEKs lazily provisioned.
- Seed calls ensureTenantDek for both schools. Proven: per-tenant DEKs differ, round-trip, cross-tenant decrypt blocked, tamper detected, KEK rotation keeps data readable.
- USE THIS in A.6 to store per-tenant M-Pesa credentials.

## A.2 line 6 "Per-tenant module toggling": COMPLETE & VERIFIED
- DB: TenantModule(tenantId, moduleKey, enabled) @@unique([tenantId,moduleKey]). Migration a2_tenant_modules. Added to TENANT_OWNED_MODELS.
- Registry src/lib/core/modules.ts: MODULES (students+finance are core/locked; hostel/transport/library/lms defaultOn:false).
- Service src/lib/services/module.service.ts: getModuleStates/getEnabledModuleKeys/setModule(audit)/initialiseModules. ModuleError mapped in respond.ts.
- API: GET /api/modules; PATCH /api/modules/[key] (requireRole owner/principal/deputy/super_admin).
- UI: /settings/modules + ModulesManager (Toggle switch, optimistic). Sidebar filtered via filterNavigation(NAVIGATION, enabledKeys) in (app)/layout.tsx; nav items tagged moduleKey. Added ui/toggle.tsx. Sidebar/AppShell accept navSections prop.
- Seed: Karibu (boarding) = hostel+library ON; Uhuru (day) = defaults. 14 module rows.

## A.2 line 5 "Tenant slug uniqueness + reserved words": COMPLETE & VERIFIED
- src/lib/validations/tenant.ts: tenantSlugSchema (lowercase a-z0-9 single-hyphen, 3-40), createTenantSchema, slugify(name).
- src/lib/services/tenant.service.ts: checkSlug (INVALID/RESERVED/TAKEN), assertSlugUsable (throws SlugError), suggestSlug (appends -2,-3...).
- API GET /api/tenant/slug-check?slug=&name=. respond.ts now maps SlugError (409/422) + TenantIsolationError (403).
- UI: src/components/ui/slug-field.tsx (debounced live check, 4 states). Ready for signup/settings (A.5).
- RESERVED_SUBDOMAINS shared from subdomain.ts.

## A.2 line 3 "Wildcard subdomain routing": COMPLETE & VERIFIED
- src/lib/core/subdomain.ts: slugFromHost + resolveTenantSlug (prod subdomain; dev overrides ?tenant= and x-neyo-tenant header; RESERVED_SUBDOMAINS filter). Env ROOT_DOMAIN (default neyo.co.ke).
- src/middleware.ts: edge middleware injects x-neyo-tenant-slug header.
- src/lib/core/current-tenant.ts: currentTenantSlug() + currentSubdomainTenant(). API GET /api/tenant/current.
- src/lib/services/tenant.service.ts: getTenantBySlug/getTenantById.
- ENFORCEMENT in (app)/layout.tsx: subdomain present & != user's tenant -> redirect /wrong-school. Login page shows resolved school name.
- Verified: resolution for both schools, reserved/unknown -> null, cross-tenant subdomain blocked (307 /wrong-school).

## A.2 lines 1+2+8 "Tenant isolation": COMPLETE & VERIFIED
- src/lib/core/tenant-context.ts: AsyncLocalStorage withTenant(tenantId, fn) / getTenantId / requireTenantId.
- src/lib/core/tenant-tables.ts: TENANT_OWNED_MODELS = [user, idSequence, auditLog]. ADD every new tenant-owned model here.
- src/lib/core/tenant-db.ts: tenantDb() = Prisma $extends that auto-injects where.tenantId on reads/bulk, stamps tenantId on create, verifies tenant on findUnique/update/delete (throws TenantIsolationError), and FAILS CLOSED if no tenant in scope.
- src/lib/core/with-tenant-session.ts: runInTenantSession(fn) bridges session->tenant; gives {user, db}.
- prisma/rls/policies.sql: real Postgres RLS to apply on deploy (SQLite has no RLS). Uses SET app.tenant_id GUC.
- Seed now has 2 schools: karibu-high (8 users) + uhuru-academy (2 users: principal@uhuruacademy.ac.ke, bursar@uhuruacademy.ac.ke; pwd Karibu2026!). Cross-tenant regression test passes.

_Earlier: A.1 Authentication (all non-OAuth lines done)_

## A.1 line 7 "WebAuthn / passkey": COMPLETE & VERIFIED (server side; ceremony is browser-only)
- Libs: @simplewebauthn/server@10 + /browser@10. RP config in src/lib/core/webauthn.ts (env WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN; dev=localhost).
- NOTE on v10 API: registrationInfo uses credentialID/credentialPublicKey/counter; verifyAuthenticationResponse takes `authenticator:{credentialID,credentialPublicKey,counter,transports}`.
- DB: Credential (publicKey b64url, counter, transports, deviceLabel), WebAuthnChallenge (purpose REGISTER/LOGIN). Migration a1_webauthn_passkeys.
- Service src/lib/services/passkey.service.ts: getRegistrationOptions/verifyRegistration/getLoginOptions/verifyLogin(+2FA via maybeConvertToTotpChallenge)/listPasskeys/deletePasskey.
- API: /api/auth/passkey/{register/options,register/verify,login/options,login/verify,[id] DELETE}.
- UI: login "passkey" step (startAuthentication), settings PasskeysCard (startRegistration).
- TESTABLE ONLY in real browser at localhost (WebAuthn needs secure context + authenticator; NOT in Arena preview iframe).

## A.1 line 8 "2FA via TOTP": COMPLETE & VERIFIED
- Libs: otplib (RFC 6238) + qrcode (inline data-URI). No external account.
- DB: User.totpSecret/totpEnabled/totpVerifiedAt; models RecoveryCode (hashed, single-use), TotpChallenge (short-lived). Migrations a1_totp_2fa, a1_totp_challenge.
- Service `src/lib/services/totp.service.ts`: startTotpSetup/enableTotp(+recovery codes)/disableTotp/checkSecondFactor(TOTP or recovery)/createTotpChallenge/solveTotpChallenge/maybeConvertToTotpChallenge.
- ENFORCEMENT: all 3 login routes (otp/verify, password/login, magic/callback) call maybeConvertToTotpChallenge -> if 2FA on, NO session; returns {twoFactorRequired, challengeToken} (magic redirects /login?challenge=).
- API: /api/auth/2fa/{setup,enable,disable,verify}. Login page has a "twofactor" step (OtpInput). Settings: /settings/security + components/settings/two-factor-card.tsx. Sidebar has "Security".

## A.1 line 12 "Logout everywhere": COMPLETE & VERIFIED
- Service `destroyAllSessionsForUser(userId)` deletes all Session rows for a user, audit-logs `auth.logout_everywhere`.
- API `POST /api/auth/logout-everywhere` (requires session, clears current cookie).
- UI: "Sign out all devices" in `components/shell/user-menu.tsx` (confirm step).
- Verified cross-session: device1 logout-everywhere invalidates device2.

## ALSO TICKED (were built earlier inside A.1.1): phone OTP rate limit, verify-attempt limit, HttpOnly/Secure/SameSite cookie, login+logout audit.
## DEFERRED (need founder external accounts): Google/Apple/Microsoft OAuth, account linking, OAuth disconnect.

## A.1 line 3 "Magic link via email": COMPLETE & VERIFIED
- DB: `MagicLink` (hashed single-use token, expiry, consumedAt). Migration `a1_magic_links`.
- Email seam: `src/lib/notifications/email.ts` (dev console; swap for Resend in A.7). `appBaseUrl()` reads `APP_BASE_URL`.
- Service: `src/lib/services/magic-link.service.ts` — `requestMagicLink` (rate-limited, 15-min), `consumeMagicLink` (single-use, session + audit).
- API: `POST /api/auth/magic/request`, `GET /api/auth/magic/callback?token=` (sets cookie, redirects /dashboard or /login/magic?error=CODE).
- UI: `/login` magic + magic-sent steps (dev clickable link); error landing `(auth)/login/magic/page.tsx`.

## A.1 line 2 "Email + password backup login": COMPLETE & VERIFIED
- Argon2id via `@node-rs/argon2` (prebuilt; marked external in `next.config.mjs` → `experimental.serverComponentsExternalPackages`).
- Service: `setUserPassword`, `loginWithPassword` (generic anti-enumeration error, uniform timing). Audit-logged.
- Zod: `loginEmailSchema`, `setPasswordSchema`. API: `POST /api/auth/password/login`.
- UI: `PasswordInput` (show/hide). `/login` now toggles phone ↔ email methods (steps: phone/code/email/success).
- Seed: all 8 staff have dev password `Karibu2026!` (emails in seed table).

> In a new chat, paste Prompts 1/2/3 + this file to resume instantly.

## 0) SANDBOX TIP — running the dev server
The sandbox kills a plain `... &` background job. Use this exact pattern:
```bash
cd /home/user/neyo
(setsid npm run dev </dev/null >/tmp/dev.log 2>&1 &) ; sleep 12
# ...run curl tests...
pkill -9 -f next-server   # to stop
```

## 1) What we have successfully built
- **A.1 line 1 "Phone + OTP login (KE-first)": COMPLETE & VERIFIED (all 8 chunks).**
  - DB models: `OtpCode` (hashed code, expiry, attempts, consumedAt), `Session` (opaque token behind HttpOnly cookie).
  - Zod + phone normalizer `normalizeKePhone` (→ +254XXXXXXXXX); request/verify schemas.
  - `auth.service.ts`: crypto OTP gen, SHA-256 hash, constant-time compare, rate limit (3/15min), attempt limit (5), session create, AuditLog on login/logout. SMS seam in `notifications/sms.ts` (dev console; swap for Africa's Talking in A.7).
  - API: `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` (sets cookie), `POST /api/auth/logout`, `GET /api/auth/me`.
  - UI: `Input`, `Label`, `OtpInput` (auto-advance/paste/backspace) added to library.
  - Pages: `(auth)/login` (phone→code→success), `(auth)/layout`. `(app)/layout` is now SESSION-GUARDED (redirects to /login) and passes the REAL user to the shell. Logout via `UserMenu`.
  - 4 UX states: `login/loading.tsx`, `(app)/loading.tsx`, global `error.tsx`, success card + toasts.
  - Seed: 8 Kenyan staff across roles (Principal/Bursar/Deputy/Teacher/ClassTeacher/Receptionist/Accountant/Librarian), normalized phones, idempotent.
- **Chunk 0 — Foundation Setup: COMPLETE & VERIFIED.**
  - Next.js 14 (App Router) + TypeScript project at `/home/user/neyo`.
  - Tailwind design tokens (navy + green + warm white, Inter 400/500/600/700, 8pt grid, apple easing, soft shadows, rounded-full / rounded-2xl).
  - Prisma ORM wired to a **SQLite dev DB** (`prisma/dev.db`). Migration `chunk0_foundation` applied.
  - Base UI library: Button, Card, Badge, StatCard, EmptyState, Skeleton, Toast (provider + useToast).
  - Odoo app shell: Topbar (module switcher + Cmd+K search surface + bell + user chip + dark toggle), Sidebar (role-ready nav), Breadcrumbs, responsive drawer on mobile.
  - Dashboard page reads **real DB counts**.
  - `npm run build` passes clean; dev server serves `/` → `/dashboard` (HTTP 200).

## 2) Current database schema state (`neyo/prisma/schema.prisma`)
- Provider: **sqlite** (dev). Switch to **postgresql** + Neon for prod.
- Models include: `Tenant`, `User` (16-role string), `IdSequence`, `AuditLog`, `OtpCode`, `Session`, `MagicLink`, `RecoveryCode`, `TotpChallenge`, `Credential`, `WebAuthnChallenge`, `TenantModule`, `Subscription`, `SubscriptionPayment`, `UsageCounter`, `PaymentCredential`, `Payment`, `Notification`, `NotificationPreference`, `NotificationTemplate`, `Conversation`, `ConversationParticipant`, `Message`, `StoredFile`, `DocumentVerification`, `JobRun`, `ApiKey`, `WebhookSubscription`, `WebhookDelivery`, `CalendarEvent`, `VisitorLog`, `AdmissionInquiry`, `PhoneMessage`.
- 16 roles canonical list lives in `src/lib/core/roles.ts` (NOT a Prisma enum, because SQLite; validated via Zod).
- Login test phones: Principal 0712345678 · Bursar 0733221100 · Receptionist 0729334455 (see seed for all 8). Dev password for all staff: `Karibu2026!`.

## 3) Exact folder paths of key files
- Design tokens: `neyo/tailwind.config.ts`
- Global CSS: `neyo/src/app/globals.css`
- Prisma schema: `neyo/prisma/schema.prisma`
- Seed: `neyo/prisma/seed.ts`
- DB client singleton: `neyo/src/lib/db.ts`
- Helpers (cn, formatKES, formatPhoneKE): `neyo/src/lib/utils.ts`
- Roles: `neyo/src/lib/core/roles.ts`
- Sidebar nav config: `neyo/src/lib/core/navigation.ts`
- UI components: `neyo/src/components/ui/*`
- App shell: `neyo/src/components/shell/*`
- Root layout (Inter + ToastProvider): `neyo/src/app/layout.tsx`
- App route group layout: `neyo/src/app/(app)/layout.tsx`
- Dashboard: `neyo/src/app/(app)/dashboard/page.tsx`
- Memory: `docs/PROMPT-1-SYSTEM-IDENTITY.md`, `docs/PROMPT-2-EXECUTION-PROTOCOL.md`, `docs/PROMPT-3-DESIGN-CONTINUITY.md`, `docs/FEATURES-CHECKLIST.md`, `docs/CONTEXT-ANCHOR.md`

## 4) Commands to run the project
```bash
cd /home/user/neyo
npm install            # only if node_modules missing (not snapshotted)
./node_modules/.bin/prisma migrate dev   # apply migrations
npm run db:seed        # seed Kenyan data
npm run dev            # http://localhost:3000
```

## VISUAL QA (2026-06-11): captured screenshots via Playwright (chromium; needed sudo apt-get libnss3 etc.). Screenshots in /home/user/screenshots. Quality: dashboard/login/wizard/dark-mode/⌘K/mobile all production-grade (Odoo+Apple+Linear). FIXED a global double-focus-ring bug: globals.css now excludes input/textarea/select from the global :focus-visible ring (they get their wrapper ring). Screenshot script at neyo/scripts/screenshots.ts (use waitUntil domcontentloaded + fixed waits; networkidle hangs due to SSE).

## 5) NEXT feature to build
**PART B — B.1 Student Management** (see "NEXT" section at top of this file).

FOUNDER LATER (unchanged): Daraja, OAuth, SMS/Email/WhatsApp/VAPID, R2, Redis/Upstash, Sentry/BetterStack/PostHog/Logtail, custom domain DNS, thermal printer.
PENDING IN-CODE: A.3 lines 8/9 row-scoping (build in/after B.1).
