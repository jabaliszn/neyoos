import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { configureStorageProvider, requestStorageUpgrade, storageVaultSummary } from "../src/lib/services/storage-vault.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260625001000_i56_storage_vault_mvp/migration.sql"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/storage-vault.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/storage-vault/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/settings/storage-vault-client.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/storage/page.tsx"), "utf8");
  const nav = readFileSync(join(process.cwd(), "src/lib/core/navigation.ts"), "utf8");

  assert(schema.includes("model TenantStorageProvider") && schema.includes("model StorageUsageSnapshot"), "Schema has storage provider and usage snapshot models");
  assert(schema.includes("encrypted    Boolean") && schema.includes("checksumSha256") && schema.includes("wrappedKeyRef"), "StoredFile has encrypted-file metadata fields");
  assert(migration.includes("CREATE TABLE \"TenantStorageProvider\"") && migration.includes("ALTER TABLE \"StoredFile\" ADD COLUMN \"encrypted\""), "Migration creates storage vault tables and file metadata columns");
  assert(service.includes("GOOGLE_WORKSPACE_MANAGED") && service.includes("AES_256_GCM_ENVELOPE") && ui.includes("NEYO_STORAGE_ADDON_500_PLUS"), "Service/UI support managed Google, encryption mode and NEYO add-on path");
  assert(api.includes("requirePermission(\"tenant.manage_settings\")") && api.includes("configureStorageProvider"), "API is tenant settings-gated and configures provider");
  assert(ui.includes("NEYO Storage Vault") && ui.includes("No plaintext Google passwords") && ui.includes("Upgrade paths"), "Settings UI explains storage vault, password safety and upgrade paths");
  assert(page.includes("StorageVaultClient") && nav.includes("/settings/storage"), "Storage settings page and navigation entry exist");

  const user = await db.user.findFirst({ where: { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } } }) || await db.user.findFirst();
  assert(user, "Test user exists");
  const old = await db.tenantStorageProvider.findUnique({ where: { tenantId: user!.tenantId } });
  try {
    const initial = await storageVaultSummary(user as any);
    assert(initial.provider.encryptionMode === "AES_256_GCM_ENVELOPE", "Default vault uses AES-256-GCM envelope mode");
    const configured = await configureStorageProvider(user as any, { provider: "GOOGLE_WORKSPACE_MANAGED", accountEmail: "karibu-high.storage@storage.neyo.co.ke", storageLimitGb: 15, notes: "Managed Workspace vault seam" });
    assert(configured.provider === "GOOGLE_WORKSPACE_MANAGED" && configured.accountEmail?.includes("storage@storage.neyo.co.ke"), "Can configure a managed Google Workspace storage account seam");
    const upgraded = await requestStorageUpgrade(user as any, { plan: "NEYO_STORAGE_ADDON_500_PLUS" });
    assert(upgraded.upgradePlan === "NEYO_STORAGE_ADDON_500_PLUS", "Can record storage upgrade request for NEYO KES 500+ add-on path");
    const audit = await db.auditLog.findFirst({ where: { tenantId: user!.tenantId, action: "storage.provider_configured" } });
    assert(audit, "Storage provider changes are audit logged");
  } finally {
    await db.tenantStorageProvider.deleteMany({ where: { tenantId: user!.tenantId } });
    if (old) await db.tenantStorageProvider.create({ data: old as any });
  }

  console.log("\nI.56 Storage Vault MVP test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
