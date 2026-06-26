import { z } from "zod";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export const STORAGE_PROVIDERS = ["NEYO_MANAGED_OBJECT_STORAGE", "GOOGLE_WORKSPACE_MANAGED", "GOOGLE_WORKSPACE_BYOS"] as const;
export const storageProviderSchema = z.object({
  provider: z.enum(STORAGE_PROVIDERS),
  accountEmail: z.string().trim().email().optional().or(z.literal("")),
  storageLimitGb: z.coerce.number().int().min(1).max(100_000).default(15),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const GB = 1024 ** 3;
const STARTER_BYTES = BigInt(15 * GB);

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function gbToBytes(gb: number) {
  return BigInt(gb) * BigInt(GB);
}

function bytesToGb(bytes: bigint | number) {
  return Number((Number(bytes) / GB).toFixed(2));
}

function statusFor(percent: number) {
  if (percent >= 100) return { healthStatus: "ERROR", actionRequired: "Storage full — upgrade required before large uploads." };
  if (percent >= 95) return { healthStatus: "ERROR", actionRequired: "Storage almost full — upgrade now." };
  if (percent >= 85) return { healthStatus: "WARNING", actionRequired: "Storage above 85% — plan upgrade." };
  if (percent >= 70) return { healthStatus: "WARNING", actionRequired: "Storage above 70% — monitor usage." };
  return { healthStatus: "HEALTHY", actionRequired: null };
}


async function computeUsageForTenant(tenantId: string) {
  const provider = await ensureStorageProvider(tenantId);
  const aggregate = await db.storedFile.aggregate({ where: { tenantId }, _sum: { size: true }, _count: true });
  const usedBytes = BigInt(aggregate._sum.size ?? 0);
  const percent = Math.min(100, Math.round((Number(usedBytes) / Math.max(1, Number(provider.storageLimitBytes))) * 100));
  const health = statusFor(percent);
  const updated = await db.tenantStorageProvider.update({
    where: { tenantId },
    data: { storageUsedBytes: usedBytes, healthStatus: health.healthStatus, lastHealthCheckAt: new Date() },
  });
  return { provider: updated, usedBytes, fileCount: aggregate._count, percent, health };
}

async function notifyStorageWarning(input: { tenantId: string; providerId: string; percent: number; actionRequired: string | null }) {
  if (!input.actionRequired) return { sent: 0, skipped: true };
  const dayKey = new Date().toISOString().slice(0, 10);
  const action = `storage.quota_warning_${input.percent >= 95 ? "critical" : input.percent >= 85 ? "high" : "info"}`;
  const existing = await db.auditLog.findFirst({ where: { tenantId: input.tenantId, action, entityType: "TenantStorageProvider", entityId: input.providerId, metadata: { contains: dayKey } } }).catch(() => null);
  if (existing) return { sent: 0, skipped: true };
  const { createInApp } = await import("@/lib/services/notification.service");
  const leaders = await db.user.findMany({
    where: { tenantId: input.tenantId, isActive: true, OR: [{ role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } }, { secondaryRole: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } }] },
    select: { id: true },
  });
  let sent = 0;
  for (const leader of leaders) {
    await createInApp({ tenantId: input.tenantId, recipientId: leader.id, title: "Storage vault needs attention", body: input.actionRequired, category: "storage", href: "/settings/storage" });
    sent++;
  }
  await db.auditLog.create({ data: { tenantId: input.tenantId, actorName: "Storage Vault", action, entityType: "TenantStorageProvider", entityId: input.providerId, metadata: JSON.stringify({ dayKey, percent: input.percent, actionRequired: input.actionRequired, sent }) } });
  return { sent, skipped: false };
}

function publicRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    status: row.status,
    accountEmail: row.accountEmail,
    rootFolderId: row.rootFolderId,
    storageLimitBytes: toNumber(row.storageLimitBytes),
    storageUsedBytes: toNumber(row.storageUsedBytes),
    storageLimitGb: bytesToGb(row.storageLimitBytes),
    storageUsedGb: bytesToGb(row.storageUsedBytes),
    percentUsed: Math.min(100, Math.round((toNumber(row.storageUsedBytes) / Math.max(1, toNumber(row.storageLimitBytes))) * 100)),
    encryptionMode: row.encryptionMode,
    healthStatus: row.healthStatus,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastUpgradePromptAt: row.lastUpgradePromptAt,
    upgradePlan: row.upgradePlan,
    notes: row.notes,
  };
}

export async function ensureStorageProvider(tenantId: string) {
  const existing = await db.tenantStorageProvider.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.tenantStorageProvider.create({
    data: {
      tenantId,
      provider: "NEYO_MANAGED_OBJECT_STORAGE",
      status: "DESIGN_READY",
      storageLimitBytes: STARTER_BYTES,
      storageUsedBytes: BigInt(0),
      healthStatus: "NOT_CONNECTED",
      encryptionMode: "AES_256_GCM_ENVELOPE",
      notes: "Default encrypted NEYO storage vault. Google Workspace can be connected when credentials and consent are ready.",
    },
  });
}

export async function storageVaultSummary(user: SessionUser) {
  const computed = await computeUsageForTenant(user.tenantId);
  const recentFiles = await db.storedFile.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, fileName: true, contentType: true, size: true, category: true, provider: true, encrypted: true, createdAt: true } });
  return {
    provider: publicRow(computed.provider),
    usage: {
      usedBytes: Number(computed.usedBytes),
      limitBytes: Number(computed.provider.storageLimitBytes),
      usedGb: bytesToGb(computed.usedBytes),
      limitGb: bytesToGb(computed.provider.storageLimitBytes),
      percentUsed: computed.percent,
      fileCount: computed.fileCount,
      ...computed.health,
    },
    features: [
      "AES-256-GCM envelope encryption before external storage",
      "Per-school storage vault and provider health checks",
      "Google Workspace managed/BYOS seam without plaintext passwords",
      "Storage upgrade prompts before uploads fail",
      "Device-first retention policy for heavy optional media",
    ],
    recentFiles,
  };
}

export async function configureStorageProvider(user: SessionUser, input: z.infer<typeof storageProviderSchema>) {
  const data = storageProviderSchema.parse(input);
  const accountEmail = data.accountEmail?.trim() || null;
  const provider = await ensureStorageProvider(user.tenantId);
  const status = data.provider === "NEYO_MANAGED_OBJECT_STORAGE" ? "CONNECTED" : accountEmail ? "READY_TO_CONNECT" : "DESIGN_READY";
  const healthStatus = data.provider === "NEYO_MANAGED_OBJECT_STORAGE" ? "HEALTHY" : accountEmail ? "WARNING" : "NOT_CONNECTED";
  const updated = await db.tenantStorageProvider.update({
    where: { id: provider.id },
    data: {
      provider: data.provider,
      accountEmail,
      storageLimitBytes: gbToBytes(data.storageLimitGb),
      status,
      healthStatus,
      notes: data.notes?.trim() || null,
      lastHealthCheckAt: new Date(),
    },
  });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "storage.provider_configured", entityType: "TenantStorageProvider", entityId: updated.id, metadata: JSON.stringify({ provider: updated.provider, accountEmail: updated.accountEmail, storageLimitGb: data.storageLimitGb }) } });
  return publicRow(updated);
}

export async function requestStorageUpgrade(user: SessionUser, input: { plan: string }) {
  const provider = await ensureStorageProvider(user.tenantId);
  const plan = z.string().trim().min(2).max(120).parse(input.plan);
  const updated = await db.tenantStorageProvider.update({ where: { id: provider.id }, data: { upgradePlan: plan, lastUpgradePromptAt: new Date(), healthStatus: "WARNING" } });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "storage.upgrade_requested", entityType: "TenantStorageProvider", entityId: updated.id, metadata: JSON.stringify({ plan }) } });
  return publicRow(updated);
}

export async function recordStorageSnapshot(user: SessionUser) {
  const summary = await storageVaultSummary(user);
  const snap = await db.storageUsageSnapshot.create({ data: { tenantId: user.tenantId, provider: summary.provider.provider, usedBytes: BigInt(summary.usage.usedBytes), limitBytes: BigInt(summary.usage.limitBytes), percentUsed: summary.usage.percentUsed, healthStatus: summary.usage.healthStatus, actionRequired: summary.usage.actionRequired } });
  return { id: snap.id, createdAt: snap.createdAt, ...summary };
}


export async function runStorageHealthChecks() {
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let checked = 0;
  let warning = 0;
  let error = 0;
  let notifications = 0;
  for (const tenant of tenants) {
    const computed = await computeUsageForTenant(tenant.id);
    await db.storageUsageSnapshot.create({ data: { tenantId: tenant.id, provider: computed.provider.provider, usedBytes: computed.usedBytes, limitBytes: computed.provider.storageLimitBytes, percentUsed: computed.percent, healthStatus: computed.health.healthStatus, actionRequired: computed.health.actionRequired } });
    const notice = await notifyStorageWarning({ tenantId: tenant.id, providerId: computed.provider.id, percent: computed.percent, actionRequired: computed.health.actionRequired });
    notifications += notice.sent;
    if (computed.health.healthStatus === "WARNING") warning++;
    if (computed.health.healthStatus === "ERROR") error++;
    checked++;
  }
  return { checked, warning, error, notifications };
}

export async function runStorageHealthCheckForUser(user: SessionUser) {
  const computed = await computeUsageForTenant(user.tenantId);
  await db.storageUsageSnapshot.create({ data: { tenantId: user.tenantId, provider: computed.provider.provider, usedBytes: computed.usedBytes, limitBytes: computed.provider.storageLimitBytes, percentUsed: computed.percent, healthStatus: computed.health.healthStatus, actionRequired: computed.health.actionRequired } });
  const notice = await notifyStorageWarning({ tenantId: user.tenantId, providerId: computed.provider.id, percent: computed.percent, actionRequired: computed.health.actionRequired });
  return { provider: publicRow(computed.provider), usage: { usedBytes: Number(computed.usedBytes), limitBytes: Number(computed.provider.storageLimitBytes), usedGb: bytesToGb(computed.usedBytes), limitGb: bytesToGb(computed.provider.storageLimitBytes), percentUsed: computed.percent, fileCount: computed.fileCount, ...computed.health }, notification: notice };
}
