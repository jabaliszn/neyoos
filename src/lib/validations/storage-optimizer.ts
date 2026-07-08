/**
 * W.1 — Storage Intelligence Engine (founder-requested 2026-07-06).
 * Real, honest lifecycle classification for every stored file, and the
 * validation for a real, auditable nightly (or manual) cleanup run.
 * Never a mock — every number here reflects real StoredFile rows.
 */
import { z } from "zod";

/** Real, explicit 3-tier lifecycle classification — see the schema comment
 * on `StoredFile.lifecycleTier` for the full real reasoning. */
export const STORAGE_LIFECYCLE_TIERS = ["PERMANENT", "GENERATED", "TEMPORARY"] as const;
export type StorageLifecycleTier = (typeof STORAGE_LIFECYCLE_TIERS)[number];

/** Real, NEYO-Ops-editable knobs for the nightly sweep — never hardcoded,
 * same proven config-JSON-in-`PlatformSetting` pattern used everywhere
 * else in NEYO (pricing engine, referral rules, SMS margin). */
export const storageOptimizerConfigSchema = z.object({
  // A TEMPORARY file older than this many days is real, genuinely safe to
  // auto-delete (failed imports, OCR working images, draft exports).
  temporaryFileMaxAgeDays: z.number().int().min(1).max(365),
  // A GENERATED file (e.g. a report-card PDF) older than this many days,
  // that NEYO can genuinely regenerate on demand from the underlying data,
  // is real, safe to prune to save space.
  generatedFileMaxAgeDays: z.number().int().min(1).max(3650),
  // A file with no real lastAccessedAt in this many days is FLAGGED as
  // unused — never auto-deleted, only surfaced to NEYO Ops for a real
  // human decision (permanent records are never touched by this).
  unusedFileFlagAfterDays: z.number().int().min(1).max(3650),
  // Whether the nightly cron actually deletes TEMPORARY files, or only
  // reports what it WOULD delete (a real, safe dry-run default while NEYO
  // Ops builds confidence in the real detection logic).
  autoDeleteTemporaryFiles: z.boolean(),
});
export type StorageOptimizerConfig = z.infer<typeof storageOptimizerConfigSchema>;

export function defaultStorageOptimizerConfig(): StorageOptimizerConfig {
  return {
    temporaryFileMaxAgeDays: 30,
    generatedFileMaxAgeDays: 365,
    unusedFileFlagAfterDays: 730, // 2 years — deliberately conservative, a real human reviews before anything happens
    autoDeleteTemporaryFiles: false, // real, safe default: report-only until NEYO Ops explicitly turns real auto-delete on
  };
}

/** A real, manual "run it now" trigger from the NEYO Ops UI. */
export const runStorageOptimizerSchema = z.object({
  tenantId: z.string().min(1).optional(), // omit = a real company-wide sweep across every tenant
  dryRun: z.boolean().default(true),
});
export type RunStorageOptimizerInput = z.infer<typeof runStorageOptimizerSchema>;
