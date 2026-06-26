import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { readCompanySecret } from "../src/lib/services/company-secret.service";
import { provisionGoogleWorkspaceVault, saveGoogleWorkspaceStorageConfig } from "../src/lib/services/google-workspace-storage.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260625003000_i56_google_workspace_secret_seam/migration.sql"), "utf8");
  const secretService = readFileSync(join(process.cwd(), "src/lib/services/company-secret.service.ts"), "utf8");
  const googleService = readFileSync(join(process.cwd(), "src/lib/services/google-workspace-storage.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");

  assert(schema.includes("model NeyoIntegrationSecret"), "Schema has encrypted company integration secret model");
  assert(migration.includes("CREATE TABLE \"NeyoIntegrationSecret\""), "Migration creates encrypted company integration secret table");
  assert(secretService.includes("aes-256-gcm") && secretService.includes("getKek"), "Company secrets are encrypted with the NEYO master key");
  assert(googleService.includes("google_workspace_storage_private_key") && googleService.includes("slugStorageEmail"), "Google storage service stores private key as secret and derives school vault email");
  assert(api.includes("update_google_workspace_storage_config") && api.includes("provision_google_workspace_storage_vault"), "Founder Ops API exposes Google storage config/provision actions");
  assert(ui.includes("Google Workspace Storage Provisioning") && ui.includes("Save encrypted Google config") && ui.includes("Prepare vault"), "NEYO Ops UI has Google Workspace storage provisioning panel");
  assert(ui.includes("no plaintext Google passwords") || ui.includes("No plaintext Google passwords"), "UI explicitly avoids plaintext Google password storage");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(actor && tenant, "SUPER_ADMIN and tenant exist");

  const oldSetting = await db.platformSetting.findUnique({ where: { key: "google_workspace_storage_config" } });
  const oldSecret = await db.neyoIntegrationSecret.findUnique({ where: { key: "google_workspace_storage_private_key" } }).catch(() => null);
  const oldProvider = await db.tenantStorageProvider.findUnique({ where: { tenantId: tenant!.id } });
  try {
    await saveGoogleWorkspaceStorageConfig(actor!, {
      storageDomain: "storage.neyo.co.ke",
      adminEmail: "admin@storage.neyo.co.ke",
      customerId: "C123",
      serviceAccountClientEmail: "service@project.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
      defaultStorageGb: 15,
      legalConsent: true,
    });
    const secret = await db.neyoIntegrationSecret.findUnique({ where: { key: "google_workspace_storage_private_key" } });
    assert(secret && !secret.ciphertext.includes("abc123") && secret.masked?.includes("private key"), "Private key is stored encrypted and masked, not plaintext");
    const decrypted = await readCompanySecret("google_workspace_storage_private_key");
    assert(decrypted?.includes("BEGIN PRIVATE KEY"), "Encrypted private key can be recovered by company secret service");

    const provider = await provisionGoogleWorkspaceVault(actor!, tenant!.id);
    assert(provider.provider === "GOOGLE_WORKSPACE_MANAGED" && provider.accountEmail?.endsWith("@storage.neyo.co.ke"), "Provision seam prepares per-school managed Workspace vault email");
    assert(provider.status === "READY_TO_CONNECT" && provider.encryptionMode === "AES_256_GCM_ENVELOPE", "Provision seam marks vault ready-to-connect and encrypted");
    const audit = await db.auditLog.findFirst({ where: { action: "platform.google_workspace_storage_vault_provisioned", entityId: provider.id } });
    assert(audit?.metadata?.includes("liveGoogleCall") && audit.metadata.includes("false"), "Provision seam audit records that no live Google call was made yet");
  } finally {
    await db.platformSetting.deleteMany({ where: { key: "google_workspace_storage_config" } });
    if (oldSetting) await db.platformSetting.create({ data: { key: oldSetting.key, value: oldSetting.value, updatedBy: oldSetting.updatedBy } });
    await db.neyoIntegrationSecret.deleteMany({ where: { key: "google_workspace_storage_private_key" } });
    if (oldSecret) await db.neyoIntegrationSecret.create({ data: oldSecret as any });
    await db.tenantStorageProvider.deleteMany({ where: { tenantId: tenant!.id } });
    if (oldProvider) await db.tenantStorageProvider.create({ data: oldProvider as any });
  }

  console.log("\nI.56 Google Workspace Provisioning Seam test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
