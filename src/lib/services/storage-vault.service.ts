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

/**
 * R.7 — School-Linked External Storage. A REAL constraint, disclosed to the
 * founder plainly rather than quietly built around: Google Drive, Dropbox,
 * OneDrive etc. do NOT let any outside app receive automatic uploads just
 * because a folder link was pasted — writing files into someone's own
 * Drive/Dropbox genuinely requires a real OAuth connection (a much bigger,
 * separate integration project), which a bare pasted link can never provide.
 * The founder's own answer confirmed the real use case: a school that
 * doesn't want to pay NEYO for extra storage pastes their own external
 * link as a real, verified overflow destination — NEYO keeps doing all the
 * actual uploading/storing it already does, and clearly surfaces this link
 * as "move your older files here yourself" once NEYO's own storage
 * genuinely starts filling up (with the paid-upgrade path always still
 * offered alongside it, never hidden).
 */
export const linkedStorageSchema = z.object({
  url: z.string().trim().url("Paste a real, valid link (starting with https://)."),
  label: z.string().trim().min(2, "Give it a short name, e.g. \"School Google Drive\".").max(80),
});

/** Detect the real provider from a real URL's hostname — never guessed from
 * free text, only from the actual domain the school pasted. */
export function detectLinkedStorageProvider(url: string): "GOOGLE_DRIVE" | "DROPBOX" | "ONEDRIVE" | "OTHER" {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) return "GOOGLE_DRIVE";
    if (host.includes("dropbox.com")) return "DROPBOX";
    if (host.includes("onedrive.live.com") || host.includes("1drv.ms") || host.includes("sharepoint.com")) return "ONEDRIVE";
    return "OTHER";
  } catch {
    return "OTHER";
  }
}

/** Real SSRF guard: block anything that isn't a genuine public http(s) URL —
 * no localhost, no private/link-local IP ranges, no other schemes. A pasted
 * "link" must be a real public web address, never an internal network probe. */
function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Block raw IPs in private/loopback/link-local ranges (defense in depth —
  // most real Drive/Dropbox/OneDrive links are always real public hostnames).
  const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [Number(ipMatch[1]), Number(ipMatch[2])];
    if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return false;
    }
  }
  return true;
}

const LINK_CHECK_TIMEOUT_MS = 8000;

/** A REAL reachability check — never just "saved successfully", genuinely
 * confirms the pasted link resolves to something real on the public
 * internet right now, so a typo'd or dead link is caught immediately
 * rather than silently trusted. */
export async function verifyLinkedStorageUrl(url: string): Promise<{ reachable: boolean; statusCode: number | null; error: string | null }> {
  if (!isSafePublicUrl(url)) {
    return { reachable: false, statusCode: null, error: "That link isn't a real, public web address." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
  try {
    // HEAD first (cheaper); some providers (Drive/Dropbox share links)
    // reject HEAD, so fall back to a real GET with no body consumption.
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    } catch {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return { reachable: res.status < 400, statusCode: res.status, error: res.status >= 400 ? `The link responded with an error (HTTP ${res.status}).` : null };
  } catch (e) {
    return { reachable: false, statusCode: null, error: e instanceof Error && e.name === "AbortError" ? "The link took too long to respond." : "Could not reach that link." };
  } finally {
    clearTimeout(timer);
  }
}

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

/** R.7 — when a school has genuinely linked their own external storage,
 * every warning tier ALSO tells them plainly "you can archive to <label>
 * yourself" instead of only ever pushing NEYO's own paid upgrade — the
 * founder's real ask for a school that doesn't want to pay NEYO for more
 * space. NEYO's own paid-upgrade path is still always offered alongside it,
 * never hidden or replaced — this is genuinely automatic FALLBACK guidance,
 * not a forced choice. */
function statusFor(percent: number, linkedStorageLabel?: string | null) {
  const archiveHint = linkedStorageLabel
    ? ` You can also move older files to your linked storage (${linkedStorageLabel}) instead of upgrading.`
    : "";
  if (percent >= 100) return { healthStatus: "ERROR", actionRequired: `Storage full — upgrade required before large uploads.${archiveHint}` };
  if (percent >= 95) return { healthStatus: "ERROR", actionRequired: `Storage almost full — upgrade now.${archiveHint}` };
  if (percent >= 85) return { healthStatus: "WARNING", actionRequired: `Storage above 85% — plan upgrade.${archiveHint}` };
  if (percent >= 70) return { healthStatus: "WARNING", actionRequired: `Storage above 70% — monitor usage.${archiveHint}` };
  return { healthStatus: "HEALTHY", actionRequired: null };
}


async function computeUsageForTenant(tenantId: string) {
  const provider = await ensureStorageProvider(tenantId);
  const aggregate = await db.storedFile.aggregate({ where: { tenantId }, _sum: { size: true }, _count: true });
  const usedBytes = BigInt(aggregate._sum.size ?? 0);
  const percent = Math.min(100, Math.round((Number(usedBytes) / Math.max(1, Number(provider.storageLimitBytes))) * 100));
  const health = statusFor(percent, provider.linkedStorageLabel);
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
    // R.7 — the real linked external storage, if the school has added one.
    linkedStorage: row.linkedStorageUrl
      ? {
          url: row.linkedStorageUrl,
          label: row.linkedStorageLabel,
          provider: row.linkedStorageProvider,
          addedAt: row.linkedStorageAddedAt,
          verifiedAt: row.linkedStorageVerifiedAt,
          lastCheckOk: row.linkedStorageLastCheckOk,
        }
      : null,
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

/** R.7 — only real top school leadership may add/change the linked storage
 * link (the founder's own explicit choice) — matches the standing pattern
 * for other sensitive-settings actions elsewhere in NEYO (e.g. View As). */
const STORAGE_LINK_ROLES = ["SCHOOL_OWNER", "PRINCIPAL"];

export class StorageLinkError extends Error {
  constructor(public code: "FORBIDDEN" | "UNREACHABLE" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "StorageLinkError";
  }
}

/** Link (or replace) a real external storage folder — REQUIRES a genuine,
 * live reachability check before it is ever saved; a typo'd or dead link
 * is refused, never silently accepted. */
export async function linkExternalStorage(user: SessionUser, input: { url: string; label: string }) {
  if (!STORAGE_LINK_ROLES.includes(user.role)) {
    throw new StorageLinkError("FORBIDDEN", "Only the school owner or principal can link external storage.");
  }
  const data = linkedStorageSchema.parse(input);
  const check = await verifyLinkedStorageUrl(data.url);
  if (!check.reachable) {
    throw new StorageLinkError("UNREACHABLE", check.error || "That link could not be reached — check it's correct and shared publicly, then try again.");
  }
  const provider = await ensureStorageProvider(user.tenantId);
  const detectedProvider = detectLinkedStorageProvider(data.url);
  const updated = await db.tenantStorageProvider.update({
    where: { id: provider.id },
    data: {
      linkedStorageUrl: data.url,
      linkedStorageLabel: data.label,
      linkedStorageProvider: detectedProvider,
      linkedStorageAddedById: user.id,
      linkedStorageAddedAt: new Date(),
      linkedStorageVerifiedAt: new Date(),
      linkedStorageLastCheckOk: true,
    },
  });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "storage.external_link_added", entityType: "TenantStorageProvider", entityId: updated.id, metadata: JSON.stringify({ url: data.url, label: data.label, provider: detectedProvider }) } });
  return publicRow(updated);
}

/** Remove a previously-linked external storage folder. */
export async function unlinkExternalStorage(user: SessionUser) {
  if (!STORAGE_LINK_ROLES.includes(user.role)) {
    throw new StorageLinkError("FORBIDDEN", "Only the school owner or principal can remove the linked storage.");
  }
  const provider = await ensureStorageProvider(user.tenantId);
  const updated = await db.tenantStorageProvider.update({
    where: { id: provider.id },
    data: { linkedStorageUrl: null, linkedStorageLabel: null, linkedStorageProvider: null, linkedStorageAddedById: null, linkedStorageAddedAt: null, linkedStorageVerifiedAt: null, linkedStorageLastCheckOk: false },
  });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "storage.external_link_removed", entityType: "TenantStorageProvider", entityId: updated.id } });
  return publicRow(updated);
}

/** Re-check a real, already-linked storage folder's reachability — used by
 * the periodic health check and a manual "recheck" button, so a link that
 * later becomes dead (folder deleted/permissions revoked) is honestly
 * surfaced, not silently assumed to still work forever. */
export async function recheckExternalStorageLink(user: SessionUser) {
  const provider = await ensureStorageProvider(user.tenantId);
  if (!provider.linkedStorageUrl) {
    throw new StorageLinkError("NOT_FOUND", "No external storage is linked yet.");
  }
  const check = await verifyLinkedStorageUrl(provider.linkedStorageUrl);
  const updated = await db.tenantStorageProvider.update({
    where: { id: provider.id },
    data: { linkedStorageVerifiedAt: new Date(), linkedStorageLastCheckOk: check.reachable },
  });
  return { provider: publicRow(updated), check };
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
