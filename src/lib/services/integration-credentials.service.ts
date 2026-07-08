import { z } from "zod";
import { db } from "@/lib/db";
import { saveCompanySecret, secretStatus } from "@/lib/services/company-secret.service";

export const INTEGRATION_CREDENTIALS = [
  { key: "oauth_google_client_id", provider: "OAUTH", label: "Google OAuth client ID", kind: "public" },
  { key: "oauth_google_client_secret", provider: "OAUTH", label: "Google OAuth client secret", kind: "secret" },
  { key: "oauth_apple_client_id", provider: "OAUTH", label: "Apple OAuth client ID", kind: "public" },
  { key: "oauth_apple_client_secret", provider: "OAUTH", label: "Apple OAuth client secret", kind: "secret" },
  { key: "oauth_microsoft_client_id", provider: "OAUTH", label: "Microsoft OAuth client ID", kind: "public" },
  { key: "oauth_microsoft_client_secret", provider: "OAUTH", label: "Microsoft OAuth client secret", kind: "secret" },
  { key: "central_daraja_shortcode", provider: "CENTRAL_DARAJA", label: "NEYO central M-Pesa shortcode", kind: "public" },
  { key: "central_daraja_environment", provider: "CENTRAL_DARAJA", label: "NEYO central Daraja environment (sandbox/production)", kind: "public" },
  { key: "central_daraja_consumer_key", provider: "CENTRAL_DARAJA", label: "NEYO central Daraja consumer key", kind: "secret" },
  { key: "central_daraja_consumer_secret", provider: "CENTRAL_DARAJA", label: "NEYO central Daraja consumer secret", kind: "secret" },
  { key: "central_daraja_passkey", provider: "CENTRAL_DARAJA", label: "NEYO central Daraja passkey", kind: "secret" },
  { key: "vapid_public_key", provider: "WEB_PUSH", label: "Web Push VAPID public key", kind: "public" },
  { key: "vapid_private_key", provider: "WEB_PUSH", label: "Web Push VAPID private key", kind: "secret" },
  { key: "vapid_subject", provider: "WEB_PUSH", label: "Web Push VAPID subject email", kind: "public" },
  { key: "whatsapp_business_token", provider: "WHATSAPP", label: "WhatsApp Business token", kind: "secret" },
  { key: "whatsapp_phone_number_id", provider: "WHATSAPP", label: "WhatsApp phone number ID", kind: "public" },
  { key: "whatsapp_api_version", provider: "WHATSAPP", label: "WhatsApp Graph API version", kind: "public" },
  { key: "africas_talking_api_key", provider: "SMS", label: "Africa's Talking API key", kind: "secret" },
  { key: "africas_talking_username", provider: "SMS", label: "Africa's Talking username", kind: "public" },
  { key: "africas_talking_sender_id", provider: "SMS", label: "Africa's Talking sender ID", kind: "public" },
  { key: "resend_api_key", provider: "EMAIL", label: "Resend API key", kind: "secret" },
  { key: "resend_from_email", provider: "EMAIL", label: "Resend sender email", kind: "public" },
  { key: "redis_url", provider: "QUEUE", label: "Redis / Upstash queue URL", kind: "secret" },
  { key: "sentry_dsn", provider: "OBSERVABILITY", label: "Sentry DSN", kind: "secret" },
  { key: "better_stack_token", provider: "OBSERVABILITY", label: "Better Stack / Logtail token", kind: "secret" },
  { key: "better_stack_ingest_url", provider: "OBSERVABILITY", label: "Better Stack ingest URL", kind: "public" },
  { key: "posthog_key", provider: "OBSERVABILITY", label: "PostHog project key", kind: "secret" },
  { key: "posthog_host", provider: "OBSERVABILITY", label: "PostHog host", kind: "public" },
  { key: "stun_server_url", provider: "WEBRTC", label: "STUN server URL", kind: "public" },
  { key: "turn_server_url", provider: "WEBRTC", label: "TURN server URL", kind: "public" },
  { key: "turn_server_username", provider: "WEBRTC", label: "TURN server username", kind: "public" },
  { key: "turn_server_secret", provider: "WEBRTC", label: "TURN server secret", kind: "secret" },
  { key: "youtube_api_key", provider: "YOUTUBE", label: "YouTube Data API key", kind: "secret" },
  { key: "bundi_provider_key", provider: "BUNDI", label: "Bundi provider key (legacy/manual provider)", kind: "secret" },
  // N.1 (2026-07-02) — Google Cloud Vision OCR for "Bundi Intelligent".
  // Vision's `images:annotate` REST endpoint accepts simple API-key auth
  // (no service-account JSON/OAuth needed), so this is deliberately a single
  // pasted key — exactly as easy to configure as the SMS/email keys already
  // above, per the founder's "add credentials easily" instruction. Vision
  // OCR is real, and priced per 1,000 units (first 1,000/month free on
  // Google's own published pricing) — genuinely cheap at NEYO's likely
  // volume once local OCR + rules have already resolved most cells for free.
  { key: "google_vision_api_key", provider: "GOOGLE_VISION", label: "Google Cloud Vision API key (Bundi Intelligent OCR)", kind: "secret" },
] as const;

const keys = INTEGRATION_CREDENTIALS.map((item) => item.key) as [string, ...string[]];

export const integrationCredentialSaveSchema = z.object({
  key: z.enum(keys),
  value: z.string().trim().min(1).max(8000),
});

export async function listIntegrationCredentialStatuses() {
  const statuses = await Promise.all(INTEGRATION_CREDENTIALS.map(async (item) => ({ ...item, status: await secretStatus(item.key) })));
  return statuses.map((item) => ({
    key: item.key,
    provider: item.provider,
    label: item.label,
    kind: item.kind,
    configured: Boolean(item.status),
    masked: item.status?.masked ?? null,
    updatedAt: item.status?.updatedAt ?? null,
    updatedBy: item.status?.updatedBy ?? null,
  }));
}

export async function saveIntegrationCredential(actor: { id: string; fullName: string; tenantId: string }, input: z.infer<typeof integrationCredentialSaveSchema>) {
  const data = integrationCredentialSaveSchema.parse(input);
  const def = INTEGRATION_CREDENTIALS.find((item) => item.key === data.key)!;
  const saved = await saveCompanySecret({ key: def.key, provider: def.provider, label: def.label, value: data.value, updatedBy: actor.fullName });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.integration_credential_saved", entityType: "NeyoIntegrationSecret", entityId: saved.id, metadata: JSON.stringify({ key: def.key, provider: def.provider, label: def.label, kind: def.kind }) } });
  return { key: def.key, provider: def.provider, label: def.label, configured: true, masked: saved.masked, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy };
}
