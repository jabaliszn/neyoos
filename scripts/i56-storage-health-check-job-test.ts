import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { runStorageHealthChecks, runStorageHealthCheckForUser } from "../src/lib/services/storage-vault.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/storage-vault.service.ts"), "utf8");
  const registry = readFileSync(join(process.cwd(), "src/lib/jobs/registry.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/storage-vault/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/settings/storage-vault-client.tsx"), "utf8");

  assert(service.includes("runStorageHealthChecks") && service.includes("Storage vault needs attention"), "Service runs storage health checks and warning notifications");
  assert(service.includes("storage.quota_warning_") && service.includes("storageUsageSnapshot"), "Service records warning audits and usage snapshots");
  assert(registry.includes("storage-health-check") && registry.includes("Daily 06:15 EAT"), "Storage health check job is scheduled daily");
  assert(api.includes('"healthCheck"') && api.includes("runStorageHealthCheckForUser"), "Storage Vault API exposes manual health check action");
  assert(ui.includes("Run health check") && ui.includes("Storage health check complete"), "Storage UI has manual health-check action");

  const user = await db.user.findFirst({ where: { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } } }) || await db.user.findFirst();
  assert(user, "Test user exists");
  const old = await db.tenantStorageProvider.findUnique({ where: { tenantId: user!.tenantId } });
  try {
    await db.tenantStorageProvider.upsert({
      where: { tenantId: user!.tenantId },
      create: { tenantId: user!.tenantId, provider: "NEYO_MANAGED_OBJECT_STORAGE", status: "CONNECTED", storageLimitBytes: BigInt(100), storageUsedBytes: BigInt(0), healthStatus: "HEALTHY", encryptionMode: "AES_256_GCM_ENVELOPE" },
      update: { provider: "NEYO_MANAGED_OBJECT_STORAGE", status: "CONNECTED", storageLimitBytes: BigInt(100), storageUsedBytes: BigInt(0), healthStatus: "HEALTHY", encryptionMode: "AES_256_GCM_ENVELOPE" },
    });
    const file = await db.storedFile.create({ data: { tenantId: user!.tenantId, key: `tenants/${user!.tenantId}/i56-health/${Date.now()}.bin`, url: "/api/files/serve?key=test", fileName: "quota-warning.bin", contentType: "application/pdf", size: 96, category: "i56-health", uploadedById: user!.id, encrypted: true, encryptionMode: "AES_256_GCM_ENVELOPE", provider: "NEYO_MANAGED_OBJECT_STORAGE" } });
    const manual = await runStorageHealthCheckForUser(user as any);
    assert(manual.usage.percentUsed >= 95 && manual.usage.healthStatus === "ERROR", "Manual health check detects critical quota usage");
    const snapshot = await db.storageUsageSnapshot.findFirst({ where: { tenantId: user!.tenantId, healthStatus: "ERROR" }, orderBy: { createdAt: "desc" } });
    assert(snapshot && snapshot.percentUsed >= 95, "Health check writes usage snapshot");
    const audit = await db.auditLog.findFirst({ where: { tenantId: user!.tenantId, action: { startsWith: "storage.quota_warning" } }, orderBy: { createdAt: "desc" } });
    assert(audit, "Quota warning is audit logged");
    const summary = await runStorageHealthChecks();
    assert(summary.checked >= 1, "Global storage health job checks tenants");
    await db.storedFile.deleteMany({ where: { id: file.id } });
  } finally {
    await db.tenantStorageProvider.deleteMany({ where: { tenantId: user!.tenantId } });
    if (old) await db.tenantStorageProvider.create({ data: old as any });
  }

  console.log("\nI.56 Storage Health Check Job test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
