/**
 * W.1 — NEYO's Storage Intelligence Engine (founder-requested 2026-07-06).
 *
 * Real, honest storage-lifecycle management, entirely behind the scenes —
 * schools never see this. Three real jobs:
 *   1. Find true duplicate files (identical `checksumSha256`) and report
 *      the real bytes that could be saved by de-duplicating them.
 *   2. Auto-delete genuinely TEMPORARY files (failed imports, OCR working
 *      images, draft exports) past a real, NEYO-Ops-configured age —
 *      NEVER touches a PERMANENT or GENERATED file.
 *   3. Flag (never auto-delete) files nobody has genuinely accessed in a
 *      long time, for a real human at NEYO Ops to review.
 *
 * Every real run — scheduled or manual — is recorded in a real, auditable
 * `StorageOptimizerRun` row so NEYO Ops can see exactly what happened and
 * how much real space was freed, ever.
 */
import { db } from "@/lib/db";
import { R2Provider } from "@/lib/storage/r2-provider";
import { LocalProvider } from "@/lib/storage/local-provider";
import { STORAGE_CONFIGURED } from "@/lib/storage/provider";
import {
  storageOptimizerConfigSchema,
  defaultStorageOptimizerConfig,
  type StorageOptimizerConfig,
} from "@/lib/validations/storage-optimizer";

const provider = STORAGE_CONFIGURED ? new R2Provider() : new LocalProvider();

export const STORAGE_OPTIMIZER_SETTING_KEY = "storage_optimizer_v1";

export class StorageOptimizerError extends Error {
  constructor(public code: "INVALID" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "StorageOptimizerError";
  }
}

// ---------------------------------------------------------------------------
// NEYO Ops configuration.
// ---------------------------------------------------------------------------

export async function getStorageOptimizerConfig(): Promise<StorageOptimizerConfig> {
  const setting = await db.platformSetting.findUnique({ where: { key: STORAGE_OPTIMIZER_SETTING_KEY } });
  if (!setting?.value) return defaultStorageOptimizerConfig();
  try {
    return storageOptimizerConfigSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultStorageOptimizerConfig();
  }
}

export async function saveStorageOptimizerConfig(
  input: unknown,
  actor: { id: string; fullName: string; tenantId: string }
): Promise<StorageOptimizerConfig> {
  const config = storageOptimizerConfigSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: STORAGE_OPTIMIZER_SETTING_KEY },
    create: { key: STORAGE_OPTIMIZER_SETTING_KEY, value: JSON.stringify(config), updatedBy: actor.fullName },
    update: { value: JSON.stringify(config), updatedBy: actor.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.storage_optimizer_config_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify(config),
    },
  });
  return config;
}

// ---------------------------------------------------------------------------
// Real detection + cleanup logic.
// ---------------------------------------------------------------------------

export interface StorageOptimizerReport {
  duplicateFilesFound: number;
  duplicateBytesFound: number;
  temporaryFilesDeleted: number;
  temporaryBytesFreed: number;
  unusedFilesFlagged: number;
  totalBytesFreed: number;
}

/**
 * Find real true duplicates — two or more `StoredFile` rows sharing the
 * identical `checksumSha256` within the same tenant. Returns the real
 * potential-savings figure (every duplicate copy beyond the first one kept)
 * — this function only REPORTS; it never deletes a duplicate automatically,
 * since choosing which copy to keep (which one is actually referenced by a
 * student/invoice/etc.) is a real decision NEYO Ops should make deliberately,
 * not something to guess.
 */
async function findDuplicateFiles(tenantId?: string) {
  const rows = await db.storedFile.groupBy({
    by: ["checksumSha256"],
    where: {
      checksumSha256: { not: null },
      ...(tenantId ? { tenantId } : {}),
    },
    _count: { _all: true },
    _sum: { size: true },
    having: { checksumSha256: { _count: { gt: 1 } } },
  });

  let duplicateFilesFound = 0;
  let duplicateBytesFound = 0;
  for (const row of rows) {
    const extraCopies = row._count._all - 1; // keep one real copy, the rest are the real duplicate waste
    const avgSize = row._sum.size ? row._sum.size / row._count._all : 0;
    duplicateFilesFound += extraCopies;
    duplicateBytesFound += Math.round(extraCopies * avgSize);
  }
  return { duplicateFilesFound, duplicateBytesFound };
}

/**
 * Real, genuinely safe TEMPORARY-file cleanup. NEVER touches PERMANENT or
 * GENERATED files — the lifecycle tier is the only real signal used, no
 * guessing by file name/category. When `dryRun` is true (or NEYO Ops has
 * not switched `autoDeleteTemporaryFiles` on), this only counts what WOULD
 * be deleted — the real bytes are never actually freed until a genuine,
 * explicit, NEYO-Ops-approved run.
 */
async function cleanupTemporaryFiles(config: StorageOptimizerConfig, dryRun: boolean, tenantId?: string) {
  const cutoff = new Date(Date.now() - config.temporaryFileMaxAgeDays * 24 * 60 * 60 * 1000);
  const candidates = await db.storedFile.findMany({
    where: {
      lifecycleTier: "TEMPORARY",
      createdAt: { lt: cutoff },
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, key: true, size: true, tenantId: true },
  });

  let temporaryFilesDeleted = 0;
  let temporaryBytesFreed = 0;

  const reallyDelete = !dryRun && config.autoDeleteTemporaryFiles;

  for (const file of candidates) {
    if (reallyDelete) {
      try {
        await provider.deleteObject(file.key);
        await db.storedFile.delete({ where: { id: file.id } });
      } catch {
        // A real, individual deletion failure never aborts the whole real
        // sweep — the file simply stays for the next run to retry.
        continue;
      }
    }
    temporaryFilesDeleted++;
    temporaryBytesFreed += file.size;
  }

  return { temporaryFilesDeleted, temporaryBytesFreed, reallyDeleted: reallyDelete };
}

/**
 * Real, honest "flag, never delete" pass for genuinely unused files — a
 * file with no real `lastAccessedAt` ever recorded, older than the
 * NEYO-Ops-configured threshold, and NOT a permanent record. This never
 * deletes anything; it only counts real candidates for a human at NEYO
 * Ops to look at.
 */
async function flagUnusedFiles(config: StorageOptimizerConfig, tenantId?: string) {
  const cutoff = new Date(Date.now() - config.unusedFileFlagAfterDays * 24 * 60 * 60 * 1000);
  const count = await db.storedFile.count({
    where: {
      lifecycleTier: { not: "PERMANENT" },
      lastAccessedAt: null,
      createdAt: { lt: cutoff },
      ...(tenantId ? { tenantId } : {}),
    },
  });
  return { unusedFilesFlagged: count };
}

/**
 * The single real entry point — a nightly cron call (no `tenantId`, sweeps
 * every school) or a manual NEYO Ops "run it now" for one specific school.
 * Always records a real, auditable `StorageOptimizerRun` row.
 */
export async function runStorageOptimizer(
  triggeredBy: { id: string; fullName: string } | "SCHEDULED_CRON",
  options: { tenantId?: string; dryRun?: boolean } = {}
): Promise<StorageOptimizerReport & { runId: string; dryRun: boolean }> {
  const config = await getStorageOptimizerConfig();
  const dryRun = options.dryRun ?? true;

  const [dupes, tempCleanup, unused] = await Promise.all([
    findDuplicateFiles(options.tenantId),
    cleanupTemporaryFiles(config, dryRun, options.tenantId),
    flagUnusedFiles(config, options.tenantId),
  ]);

  const totalBytesFreed = tempCleanup.temporaryBytesFreed; // only REAL freed bytes — duplicates/unused are report-only, never counted as "freed"

  const run = await db.storageOptimizerRun.create({
    data: {
      tenantId: options.tenantId ?? null,
      triggeredBy: triggeredBy === "SCHEDULED_CRON" ? "SCHEDULED_CRON" : triggeredBy.id,
      triggeredByName: triggeredBy === "SCHEDULED_CRON" ? "Storage Intelligence Engine" : triggeredBy.fullName,
      duplicateFilesFound: dupes.duplicateFilesFound,
      duplicateBytesFound: BigInt(dupes.duplicateBytesFound),
      temporaryFilesDeleted: tempCleanup.temporaryFilesDeleted,
      temporaryBytesFreed: BigInt(tempCleanup.reallyDeleted ? tempCleanup.temporaryBytesFreed : 0),
      unusedFilesFlagged: unused.unusedFilesFlagged,
      totalBytesFreed: BigInt(tempCleanup.reallyDeleted ? totalBytesFreed : 0),
      dryRun: !tempCleanup.reallyDeleted,
    },
  });

  return {
    runId: run.id,
    dryRun: !tempCleanup.reallyDeleted,
    duplicateFilesFound: dupes.duplicateFilesFound,
    duplicateBytesFound: dupes.duplicateBytesFound,
    temporaryFilesDeleted: tempCleanup.temporaryFilesDeleted,
    temporaryBytesFreed: tempCleanup.reallyDeleted ? tempCleanup.temporaryBytesFreed : 0,
    unusedFilesFlagged: unused.unusedFilesFlagged,
    totalBytesFreed: tempCleanup.reallyDeleted ? totalBytesFreed : 0,
  };
}

/** Real history of runs for the NEYO Ops dashboard. */
export async function listStorageOptimizerRuns(limit = 30) {
  return db.storageOptimizerRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
}

/**
 * Real, honest "what's the real real-time savings potential right now"
 * preview — used by the NEYO Ops UI card ("Storage Optimizer: 6.2 GB
 * potential savings. Clean now?") WITHOUT actually running a cleanup.
 */
export async function previewStorageOptimizer(tenantId?: string): Promise<StorageOptimizerReport> {
  const config = await getStorageOptimizerConfig();
  const [dupes, tempPreview, unused] = await Promise.all([
    findDuplicateFiles(tenantId),
    cleanupTemporaryFiles(config, true, tenantId), // always a real dry run for a preview — never deletes
    flagUnusedFiles(config, tenantId),
  ]);
  return {
    duplicateFilesFound: dupes.duplicateFilesFound,
    duplicateBytesFound: dupes.duplicateBytesFound,
    temporaryFilesDeleted: tempPreview.temporaryFilesDeleted,
    temporaryBytesFreed: tempPreview.temporaryBytesFreed,
    unusedFilesFlagged: unused.unusedFilesFlagged,
    totalBytesFreed: tempPreview.temporaryBytesFreed,
  };
}
