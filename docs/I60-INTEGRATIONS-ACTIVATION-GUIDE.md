# I.60 — NEYO Integrations Activation Guide

Updated: 2026-06-25  
Audience: NEYO founder / non-coder operator

## 1. What I.60 is

I.60 is the activation layer for integrations that need real external accounts or credentials.

The rule is:

> Credentials are edited inside NEYO Ops, not in code.

NEYO Ops path:

```txt
NEYO Ops → Business Operations → Integration Credential Vault
```

The credentials are stored encrypted in:

```txt
NeyoIntegrationSecret
```

They are masked in the UI and audit logged when saved.

## 2. What must never happen

Do not put credentials in:

- public landing page copy;
- screenshots;
- WhatsApp messages;
- GitHub issues;
- docs meant for the public;
- school settings unless they are school-owned credentials;
- source code.

Do not expose:

- API keys;
- client secrets;
- passkeys;
- private keys;
- tokens;
- database URLs;
- Redis URLs;
- provider passwords.

## 3. Current I.60 status

| Integration | Status |
|---|---|
| NEYO central Daraja | Activated from NEYO Ops vault |
| Resend email | Activated from NEYO Ops vault |
| Web Push / VAPID | Activated from NEYO Ops vault |
| Africa’s Talking SMS | Activated from NEYO Ops vault |
| WhatsApp Business outbound | Activated from NEYO Ops vault |
| Redis / Upstash worker queue | Activated from NEYO Ops vault |
| Sentry / Better Stack / PostHog | Activated from NEYO Ops vault |
| TURN / WebRTC | Activated from NEYO Ops vault |
| YouTube Data API key | Activated from NEYO Ops vault |
| OAuth Google/Apple/Microsoft | Start/status/disconnect seam built; final token/profile exchange still needs live provider validation |
| WhatsApp inbound bot | Future chunk |
| Multi-term transcripts/analytics | Future product build |
| Bundi KCSE/photo-grading | Future Bundi-gated chunk |

## 4. Integration Credential Vault fields

The vault currently supports these keys.

### OAuth

```txt
oauth_google_client_id
oauth_google_client_secret
oauth_apple_client_id
oauth_apple_client_secret
oauth_microsoft_client_id
oauth_microsoft_client_secret
```

### NEYO central Daraja

```txt
central_daraja_shortcode
central_daraja_environment
central_daraja_consumer_key
central_daraja_consumer_secret
central_daraja_passkey
```

### Web Push

```txt
vapid_public_key
vapid_private_key
vapid_subject
```

### WhatsApp Business

```txt
whatsapp_business_token
whatsapp_phone_number_id
whatsapp_api_version
```

### Africa’s Talking SMS

```txt
africas_talking_api_key
africas_talking_username
africas_talking_sender_id
```

### Resend Email

```txt
resend_api_key
resend_from_email
```

### Redis / Queue

```txt
redis_url
```

### Observability

```txt
sentry_dsn
better_stack_token
better_stack_ingest_url
posthog_key
posthog_host
```

### WebRTC / TURN

```txt
stun_server_url
turn_server_url
turn_server_username
turn_server_secret
```

### YouTube

```txt
youtube_api_key
```

### Bundi

```txt
bundi_provider_key
```

Bundi stays platform-paused until founder launch.

## 5. NEYO central Daraja

Purpose:

- central NEYO subscription payments;
- instant reconnect after payment;
- expired school account renewal;
- outside-NEYO Paybill callback matching.

Where to get values:

- Safaricom Daraja portal;
- NEYO company Paybill/Till credentials;
- app consumer key/secret;
- passkey;
- shortcode.

Paste in NEYO Ops:

```txt
central_daraja_shortcode
central_daraja_environment = sandbox or production
central_daraja_consumer_key
central_daraja_consumer_secret
central_daraja_passkey
```

Callback URL:

```txt
https://YOUR-DOMAIN/api/billing/central-callback
```

How it works:

- expired school enters phone;
- NEYO sends central STK;
- Safaricom calls central callback;
- NEYO marks `SubscriptionPayment` paid;
- NEYO activates subscription;
- school reconnects.

Test file:

```txt
scripts/i60-central-daraja-from-vault-test.ts
```

## 6. Resend Email

Purpose:

- magic links;
- system emails;
- document-share emails;
- future onboarding/demo emails;
- notification cascade email channel.

Where to get values:

- Resend dashboard;
- create API key;
- verify sending domain;
- choose sender email.

Paste in NEYO Ops:

```txt
resend_api_key
resend_from_email
```

Example sender:

```txt
NEYO <hello@neyo.co.ke>
```

Test file:

```txt
scripts/i60-resend-email-from-vault-test.ts
```

## 7. Web Push / VAPID

Purpose:

- phone/laptop native notifications;
- notifications can arrive even when not inside Messages screen;
- PWA-style alerts.

Where to get values:

Generate VAPID keys using a trusted tool/library, or provider dashboard.

You need:

```txt
vapid_public_key
vapid_private_key
vapid_subject
```

Example subject:

```txt
mailto:support@neyo.co.ke
```

Paste in NEYO Ops.

How it works:

- user clicks notification permission prompt;
- browser subscribes using public VAPID key;
- NEYO stores browser subscription;
- NEYO sends Web Push using private VAPID key.

Test file:

```txt
scripts/i60-vapid-webpush-from-vault-test.ts
```

## 8. Africa’s Talking SMS

Purpose:

- parent SMS;
- fee reminders;
- receipt SMS;
- attendance SMS;
- school alerts;
- fallback when WhatsApp/push is unavailable.

Where to get values:

- Africa’s Talking dashboard;
- create app/API key;
- get username;
- optional sender ID if approved.

Paste in NEYO Ops:

```txt
africas_talking_api_key
africas_talking_username
africas_talking_sender_id
```

School-name behavior:

If a caller passes `tenantId`, NEYO prefixes the message with the school name when needed.

Example:

```txt
Karibu High School: Fee reminder for invoice INV-001
```

OTP/system messages can disable prefixing.

Test file:

```txt
scripts/i60-africas-talking-sms-from-vault-test.ts
```

## 9. WhatsApp Business outbound

Purpose:

- WhatsApp notification cascade;
- reminders;
- parent alerts;
- future support flows.

Where to get values:

- Meta Business / WhatsApp Cloud API;
- create app;
- connect WhatsApp Business number;
- get permanent/long-lived token;
- get phone number ID;
- choose API version.

Paste in NEYO Ops:

```txt
whatsapp_business_token
whatsapp_phone_number_id
whatsapp_api_version
```

Example API version:

```txt
v20.0
```

How it works:

- NEYO sends to Graph API `/messages` endpoint;
- phone is normalized to `2547...`;
- if `tenantId` is passed, NEYO can prefix the school name.

Test file:

```txt
scripts/i60-whatsapp-business-from-vault-test.ts
```

Important:

This is outbound WhatsApp. The inbound WhatsApp bot is a separate future chunk.

## 10. Redis / Upstash queue

Purpose:

- background jobs;
- reminders;
- storage health checks;
- webhooks;
- PDF batches;
- broadcasts;
- large async tasks.

Where to get value:

- Upstash Redis;
- Redis Cloud;
- self-hosted Redis.

Paste in NEYO Ops:

```txt
redis_url
```

Example:

```txt
rediss://default:xxxxx@your-upstash-host:6379
```

How it works:

- `enqueue()` checks vault-aware Redis readiness;
- if Redis exists, job goes to BullMQ;
- worker drains `neyo-jobs` queue;
- if Redis missing in dev, job runs in-process.

Worker command:

```bash
npm run worker
```

Test file:

```txt
scripts/i60-redis-worker-from-vault-test.ts
```

## 11. Sentry / Better Stack / PostHog

Purpose:

- Sentry: errors/exceptions;
- Better Stack/Logtail: logs/uptime logs;
- PostHog: product analytics.

Where to get values:

- Sentry project settings → DSN;
- Better Stack source settings → token and ingest URL;
- PostHog project settings → project key and host.

Paste in NEYO Ops:

```txt
sentry_dsn
better_stack_token
better_stack_ingest_url
posthog_key
posthog_host
```

How it works:

- `captureError()` sends to Sentry + Better Stack;
- `captureMessage()` sends warning/info to observability seams;
- `track()` sends analytics events to PostHog.

Test file:

```txt
scripts/i60-observability-from-vault-test.ts
```

## 12. TURN / WebRTC

Purpose:

- online live classes;
- disappearing class voice rooms;
- improves connection success behind routers/NAT/firewalls.

Where to get values:

- TURN server provider;
- self-hosted coturn;
- WebRTC infra provider.

Paste in NEYO Ops:

```txt
stun_server_url
turn_server_url
turn_server_username
turn_server_secret
```

Examples:

```txt
stun:stun.neyo.co.ke:3478
turn:turn.neyo.co.ke:3478
```

How it works:

- clients call `/api/webrtc/ice`;
- API returns signed-in ICE server config;
- Online Classes and Class Voice Rooms use it in `RTCPeerConnection`.

Test file:

```txt
scripts/i60-turn-webrtc-from-vault-test.ts
```

## 13. YouTube Data API key

Purpose:

- live YouTube educational search inside Learning Videos;
- saved videos work without it.

Where to get value:

1. Google Cloud Console.
2. Enable YouTube Data API v3.
3. Create API key.
4. Restrict key to YouTube Data API and app domains where possible.

Paste in NEYO Ops:

```txt
youtube_api_key
```

How it works:

- NEYO searches YouTube using safe education filters;
- NEYO returns embeddable videos only;
- videos play inside NEYO using privacy-enhanced embed.

Test file:

```txt
scripts/i60-oauth-youtube-vault-test.ts
```

## 14. OAuth: Google / Apple / Microsoft

Purpose:

- social/enterprise sign-in;
- account linking;
- future faster login.

Credentials:

```txt
oauth_google_client_id
oauth_google_client_secret
oauth_apple_client_id
oauth_apple_client_secret
oauth_microsoft_client_id
oauth_microsoft_client_secret
```

Callback URLs:

```txt
https://YOUR-DOMAIN/api/oauth/callback/google
https://YOUR-DOMAIN/api/oauth/callback/apple
https://YOUR-DOMAIN/api/oauth/callback/microsoft
```

Current implementation:

- provider status API exists;
- start URL exists;
- state storage exists;
- disconnect exists;
- callback receiver exists;
- final token/profile exchange remains live-provider validation work.

Test file:

```txt
scripts/i60-oauth-youtube-vault-test.ts
```

## 15. Bundi provider key

Credential:

```txt
bundi_provider_key
```

Bundi remains platform-paused until founder launch.

Rules:

- no feature depends on Bundi;
- do not use the word “AI” in product UI;
- Bundi only adds convenience after launch.

## 16. What to activate first in production

Recommended order:

1. Resend email.
2. Africa’s Talking SMS.
3. Web Push / VAPID.
4. Central Daraja.
5. Redis worker queue.
6. Observability.
7. WhatsApp Business.
8. TURN/WebRTC.
9. YouTube Data API.
10. OAuth providers.

Reason:

Email/SMS/payment/queue/observability are core operational systems. OAuth and YouTube can wait until core reliability is stable.

## 17. Testing after saving credentials

After saving any credential:

1. Refresh NEYO Ops.
2. Confirm status shows configured.
3. Run the specific feature test if local.
4. Try one real small action.
5. Check audit logs.
6. Check provider dashboard.
7. Rotate key immediately if exposed.

## 18. Key rotation rules

Rotate keys when:

- a screenshot exposed a key;
- a staff member with access leaves;
- provider warns of compromise;
- GitHub accidentally receives a secret;
- production incident happens.

Rotation process:

1. Create new key in provider.
2. Save new key in NEYO Ops.
3. Test live feature.
4. Revoke old key in provider.
5. Log rotation in NEYO Ops notes.

## 19. Legal and privacy notes

- Integration credentials are company secrets.
- School fee credentials are school-owned and belong in Settings → Payments.
- NEYO company credentials belong in NEYO Ops.
- Public pages must show only features/outcomes.
- Logs must never include secrets.
- Access to NEYO Ops must be SUPER_ADMIN-only.

## 20. Emergency rule

If an integration misbehaves:

1. Disable/revoke provider key in the provider dashboard.
2. Remove or replace key in NEYO Ops.
3. Use maintenance mode if needed.
4. Check audit logs.
5. Check provider usage logs.
6. Rotate credentials.

Do not edit code for emergency credential changes unless the integration code itself is broken.
