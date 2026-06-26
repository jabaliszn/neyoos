import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { readCompanySecret } from "../src/lib/services/company-secret.service";
import { listIntegrationCredentialStatuses, saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");
  const secret = readFileSync(join(process.cwd(), "src/lib/services/company-secret.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

  assert(schema.includes("model NeyoIntegrationSecret"), "Company-level encrypted integration secret model exists");
  assert(secret.includes("aes-256-gcm") && secret.includes("getKek"), "Company secrets use AES-256-GCM with NEYO company key");
  for (const key of ["oauth_google_client_secret", "central_daraja_passkey", "vapid_private_key", "whatsapp_business_token", "africas_talking_api_key", "resend_api_key", "redis_url", "sentry_dsn", "posthog_key", "turn_server_secret", "bundi_provider_key"]) {
    assert(service.includes(key), `Integration credential registry includes ${key}`);
  }
  assert(api.includes("save_integration_credential") && api.includes("listIntegrationCredentialStatuses"), "Founder Ops API returns and saves integration credentials");
  assert(ui.includes("Integration Credential Vault") && ui.includes("credentials are edited here, not in source code"), "NEYO Ops UI has integration credential vault with founder rule");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const old = await db.neyoIntegrationSecret.findUnique({ where: { key: "resend_api_key" } }).catch(() => null);
  try {
    await saveIntegrationCredential(actor!, { key: "resend_api_key", value: "re_123456789_secret" });
    const statuses = await listIntegrationCredentialStatuses();
    const row = statuses.find((item) => item.key === "resend_api_key");
    assert(row?.configured && row.masked?.includes("••••"), "Saved credential appears configured and masked in status list");
    const raw = await readCompanySecret("resend_api_key");
    assert(raw === "re_123456789_secret", "Encrypted credential can be decrypted by company secret service");
    const dbRow = await db.neyoIntegrationSecret.findUnique({ where: { key: "resend_api_key" } });
    assert(dbRow && !dbRow.ciphertext.includes("re_123456789_secret"), "Credential plaintext is not stored in ciphertext field");
    const audit = await db.auditLog.findFirst({ where: { action: "platform.integration_credential_saved", entityType: "NeyoIntegrationSecret", entityId: dbRow!.id } });
    assert(audit, "Saving integration credential is audit logged");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: "resend_api_key" } });
    if (old) await db.neyoIntegrationSecret.create({ data: old as any });
  }

  console.log("\nI.60 Integration Credential Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
