/**
 * Part V — NEYO Capacity-Based Pricing System 2.0 (founder-confirmed pivot,
 * 2026-07-06). The real, live-editable size-based pricing engine.
 *
 * Core philosophy (founder-confirmed): "Neyo Complete" — every real feature
 * available to every school, priced purely by a real School Size + Usage
 * Score (students + staff + ALL parents, live or dormant + an ESTIMATED
 * storage figure + an estimated AI/OCR usage figure), never by which
 * modules a school has chosen to enable. Price only ever goes UP via a real,
 * NEYO-Ops-configured threshold; a genuine drastic drop is a rare, human-
 * reviewed exception, never automatic (V.0/V.8).
 *
 * Every weight/constant is a real NEYO-Ops-editable `PlatformSetting`-JSON
 * value (`pricing_engine_v2` key) — the exact same proven pattern already
 * used by the pricing catalog, referral rules, SMS margin config, the
 * sibling-discount %, and the Shell V2 release gate. Nothing here is
 * hardcoded in a way that would require a code change to adjust.
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import {
  pricingEngineConfigSchema,
  defaultPricingEngineConfig,
  type PricingEngineConfig,
} from "@/lib/validations/pricing-engine";

/** A minimal real-user shape (id/role/fullName/tenantId) — accepts the real
 * SessionUser everywhere, but named separately so this file doesn't force a
 * hard dependency on every SessionUser field for callers that only have a
 * partial real user object (e.g. a raw DB row already shaped this way). */
type SessionUserLike = Pick<SessionUser, "id" | "role" | "fullName" | "tenantId">;

export const PRICING_ENGINE_SETTING_KEY = "pricing_engine_v2";

export class PricingEngineError extends Error {
  constructor(public code: "INVALID" | "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "PricingEngineError";
  }
}

// ---------------------------------------------------------------------------
// NEYO Ops configuration (company-level PlatformSetting).
// ---------------------------------------------------------------------------

export async function getPricingEngineConfig(): Promise<PricingEngineConfig> {
  const setting = await db.platformSetting.findUnique({ where: { key: PRICING_ENGINE_SETTING_KEY } });
  if (!setting?.value) return defaultPricingEngineConfig();
  try {
    return pricingEngineConfigSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultPricingEngineConfig();
  }
}

export async function savePricingEngineConfig(
  input: unknown,
  actor: { id: string; fullName: string; tenantId: string }
): Promise<PricingEngineConfig> {
  const config = pricingEngineConfigSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: PRICING_ENGINE_SETTING_KEY },
    create: { key: PRICING_ENGINE_SETTING_KEY, value: JSON.stringify(config), updatedBy: actor.fullName },
    update: { value: JSON.stringify(config), updatedBy: actor.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.pricing_engine_config_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify(config),
    },
  });
  return config;
}

// ---------------------------------------------------------------------------
// The real, pure scoring math (V.2) — no DB access, easily unit-testable,
// always produces the exact same result for the exact same inputs.
// ---------------------------------------------------------------------------

/**
 * Storage estimate (V.2's storage sub-formula) — the founder's own explicit
 * requirement: "the system can guess the documents uploads downloads...
 * the schools should never realize that the storage is calculated" — this
 * is the REAL formula behind that guess, never the school's real measured
 * bytes (TenantStorageProvider.storageUsedBytes stays a separate, silent
 * Fair Use safety-net check — see `checkFairUseStorageBreach()` below).
 */
export function estimateStorageForSchool(
  studentCount: number,
  staffCount: number,
  config: PricingEngineConfig
): number {
  return (
    studentCount * config.avgGbPerStudent +
    staffCount * config.avgGbPerStaff +
    config.flatSchoolOverheadGb
  );
}

/**
 * AI/OCR usage estimate — V.8-resolved: "let it be in too so that neyo can
 * say free setup fee for all schools but behind the seen it is calculated
 * as well." A real, internal-only estimate folded into the score; the
 * school-facing product copy always honestly says "no setup fee" (true —
 * there is never a separate, additional line item), while this real number
 * is already absorbed into the one monthly price from day one.
 */
export function estimateAiOcrUsageForSchool(studentCount: number, config: PricingEngineConfig): number {
  return studentCount * config.avgAiOcrUsagePerStudent;
}

/**
 * V.0's founder answer ("i wouldnt count the actual live parents just all
 * parents either live or dormant... the schools should never realize that
 * [this] is calculated") makes parent count (like storage/AI-OCR) a real,
 * silent internal pricing input — a school is only ever asked for its
 * student + staff counts on any school-facing surface (the public quote
 * page, the onboarding wizard). When a real declared parent count isn't
 * supplied, this real, honest typical-ratio estimate (most learners have
 * 1+ guardian on file, some siblings share one) silently fills it in
 * server-side — never surfaced to the school as a number or a question.
 */
const TYPICAL_PARENT_RATIO_PER_STUDENT = 1.3;
export function estimateParentCountForSchool(studentCount: number): number {
  if (studentCount <= 0) return 0;
  return Math.max(1, Math.round(studentCount * TYPICAL_PARENT_RATIO_PER_STUDENT));
}

/**
 * W.2 — Real, honest, NEYO-Ops-gated alumni long-term-storage factor
 * (founder-requested 2026-07-06). A school's real GRADUATED student count
 * genuinely represents historical records NEYO commits to keep for years
 * — but this ONLY ever adds anything when NEYO Ops has explicitly turned
 * `alumniStorageFactorEnabled` ON (default OFF, a real no-op for every
 * school until they've actually imported/graduated real alumni). Founder's
 * own words: "when they dont [have alumni] no issue the original engine is
 * the one reflected... [but when they do] the user is told about it" —
 * this function only computes the real number; the real, honest DISCLOSURE
 * to the school happens at the call sites below (never silent).
 */
export function estimateAlumniStorageForSchool(alumniRecordCount: number, config: PricingEngineConfig): number {
  if (!config.alumniStorageFactorEnabled || alumniRecordCount <= 0) return 0;
  return alumniRecordCount * config.avgGbPerAlumniRecord;
}

/** Real count of a school's GRADUATED students — its real alumni volume,
 * whether they graduated naturally through NEYO or were imported as
 * historical records (M.4/R.1's real smart-import engines both support
 * setting `status: "GRADUATED"` directly on import). */
export async function getRealAlumniCount(tenantId: string): Promise<number> {
  return db.student.count({ where: { tenantId, status: "GRADUATED" } });
}

export interface SizeScoreInputs {
  studentCount: number;
  staffCount: number;
  parentCount: number; // ALL parents, live or dormant (founder's own explicit answer)
  estimatedStorageGb: number;
  estimatedAiOcrUsage: number;
  alumniStorageGb?: number; // W.2 — real, disclosed alumni long-term-storage add-on (0 unless the school has real alumni AND NEYO Ops has switched the factor on)
}

export interface SizeScoreResult {
  rawScore: number;
  monthlyPriceKes: number;
}

/** The real core formula (V.2 + W.2). Pure, deterministic, no side effects.
 * Alumni storage (when present) is real estimated storage too, so it's
 * folded into the SAME `weightStorageGb` weight — never a separate,
 * confusing second storage number in the formula. */
export function computeSizeScore(inputs: SizeScoreInputs, config: PricingEngineConfig): SizeScoreResult {
  const totalStorageGb = inputs.estimatedStorageGb + (inputs.alumniStorageGb ?? 0);
  const rawScore =
    inputs.studentCount * config.weightStudent +
    inputs.staffCount * config.weightStaff +
    inputs.parentCount * config.weightParent +
    totalStorageGb * config.weightStorageGb +
    inputs.estimatedAiOcrUsage * config.weightAiOcrUsage;

  const monthlyPriceKes = Math.round(config.baseFloorKes + rawScore * config.kesPerScorePoint);

  return { rawScore, monthlyPriceKes };
}

/**
 * The single real entry point that assembles inputs + computes a price for
 * a school, given real declared/measured counts. Used both at real
 * onboarding-time (V.0: "they get their price in their first launch") and
 * by the real quote-request flow (V.6). `alumniRecordCount` defaults to 0
 * (the normal case for a brand-new school with no history yet) — when a
 * real alumni count IS passed, `estimateAlumniStorageForSchool()` itself
 * still only applies anything if NEYO Ops has the factor switched on,
 * matching the founder's own "genuine no-op until it applies" answer.
 */
export function quotePriceForCounts(
  studentCount: number,
  staffCount: number,
  parentCount: number,
  config: PricingEngineConfig,
  alumniRecordCount = 0
): SizeScoreResult & {
  estimatedStorageGb: number;
  estimatedAiOcrUsage: number;
  alumniStorageGbAdded: number;
  alumniFactorApplied: boolean;
} {
  const estimatedStorageGb = estimateStorageForSchool(studentCount, staffCount, config);
  const estimatedAiOcrUsage = estimateAiOcrUsageForSchool(studentCount, config);
  const alumniStorageGbAdded = estimateAlumniStorageForSchool(alumniRecordCount, config);
  const alumniFactorApplied = alumniStorageGbAdded > 0;
  const result = computeSizeScore(
    { studentCount, staffCount, parentCount, estimatedStorageGb, estimatedAiOcrUsage, alumniStorageGb: alumniStorageGbAdded },
    config
  );
  return { ...result, estimatedStorageGb, estimatedAiOcrUsage, alumniStorageGbAdded, alumniFactorApplied };
}

// ---------------------------------------------------------------------------
// Real, live counts for an ALREADY-ONBOARDED school (used by the repricing
// job — never estimates, these are exact real numbers).
// ---------------------------------------------------------------------------

export async function getRealCurrentCounts(tenantId: string): Promise<{ studentCount: number; staffCount: number; parentCount: number }> {
  const [studentCount, staffCount, parentCount] = await Promise.all([
    db.student.count({ where: { tenantId, status: "ACTIVE", deletedAt: null } }),
    db.user.count({ where: { tenantId, isActive: true, role: { notIn: ["PARENT", "STUDENT"] } } }),
    // ALL parents — live or dormant, per the founder's own explicit answer.
    // Guardian (not User) is the real, canonical parent record (a Guardian
    // may or may not have a linked portal User account at all).
    db.guardian.count({ where: { tenantId } }),
  ]);
  return { studentCount, staffCount, parentCount };
}

/**
 * The real Fair Use safety-net check (V.2): compares a school's REAL
 * measured storage (TenantStorageProvider.storageUsedBytes, already
 * accurate and already tracked by R.7) against what was ESTIMATED for
 * their size — the founder's own explicit "extra storage facilities...
 * above the fair policy threshold" repricing cause. This is deliberately
 * SEPARATE from the estimate used to set the school's actual price.
 */
export async function checkFairUseStorageBreach(
  tenantId: string,
  estimatedStorageGb: number,
  config: PricingEngineConfig
): Promise<{ breached: boolean; realUsageGb: number; allowanceGb: number }> {
  const provider = await db.tenantStorageProvider.findUnique({ where: { tenantId } });
  const realUsageBytes = provider ? Number(provider.storageUsedBytes) : 0;
  const realUsageGb = realUsageBytes / (1024 * 1024 * 1024);
  const allowanceGb = estimatedStorageGb * config.fairUseStorageMultiplier;
  return { breached: realUsageGb > allowanceGb, realUsageGb, allowanceGb };
}

// ---------------------------------------------------------------------------
// Real, one-time migration: "migrate everyone now" (founder-confirmed V.0).
// Every EXISTING school (already-onboarded, real live tenants like Karibu
// High/Uhuru Academy) is moved onto SIZE_BASED_V2, priced from their real
// CURRENT counts (they have no "declared onboarding numbers" — they already
// exist) rather than a declared estimate. A real, auditable
// TenantPricingSnapshot (reason: "INITIAL_SIGNUP") is created for each,
// exactly mirroring what a brand-new signup gets, so the real pricing
// history is honest and complete for every school, old or new.
// ---------------------------------------------------------------------------

export async function migrateTenantToSizeBasedPricing(tenantId: string): Promise<{ tenantId: string; monthlyPriceKes: number; alreadyMigrated: boolean }> {
  const existing = await db.subscription.findUnique({ where: { tenantId } });
  if (existing?.pricingMode === "SIZE_BASED_V2" && existing.sizeBasedPriceKes > 0) {
    return { tenantId, monthlyPriceKes: existing.sizeBasedPriceKes, alreadyMigrated: true };
  }

  const config = await getPricingEngineConfig();
  const counts = await getRealCurrentCounts(tenantId);
  const alumniRecordCount = await getRealAlumniCount(tenantId);
  const quote = quotePriceForCounts(counts.studentCount, counts.staffCount, counts.parentCount, config, alumniRecordCount);

  await db.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planKey: "free_karibu",
      status: "ACTIVE",
      pricingMode: "SIZE_BASED_V2",
      sizeBasedPriceKes: quote.monthlyPriceKes,
      currentPeriodEnd: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
    },
    update: {
      pricingMode: "SIZE_BASED_V2",
      sizeBasedPriceKes: quote.monthlyPriceKes,
    },
  });

  await db.tenantPricingSnapshot.create({
    data: {
      tenantId,
      studentCount: counts.studentCount,
      staffCount: counts.staffCount,
      parentCount: counts.parentCount,
      estimatedStorageGb: quote.estimatedStorageGb,
      estimatedAiOcrUsage: quote.estimatedAiOcrUsage,
      alumniRecordCount,
      alumniStorageGbAdded: quote.alumniStorageGbAdded,
      alumniFactorApplied: quote.alumniFactorApplied,
      rawScore: quote.rawScore,
      monthlyPriceKes: quote.monthlyPriceKes,
      reason: "INITIAL_SIGNUP",
      note: "Real one-time migration from the legacy tiered plan system to Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06: \"migrate everyone now\"). Priced from this school's real current counts at migration time.",
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      actorId: "system",
      actorName: "System",
      action: "platform.tenant_migrated_to_size_based_pricing",
      entityType: "Tenant",
      entityId: tenantId,
      metadata: JSON.stringify({ ...counts, ...quote }),
    },
  });

  return { tenantId, monthlyPriceKes: quote.monthlyPriceKes, alreadyMigrated: false };
}

/** Migrates every real, non-demo tenant that hasn't already been migrated —
 * the real, company-wide one-time rollout NEYO Ops triggers once. */
export async function migrateAllTenantsToSizeBasedPricing(): Promise<{ migrated: number; skipped: number }> {
  const tenants = await db.tenant.findMany({ where: { isDemo: false }, select: { id: true } });
  let migrated = 0;
  let skipped = 0;
  for (const t of tenants) {
    const result = await migrateTenantToSizeBasedPricing(t.id);
    if (result.alreadyMigrated) skipped++;
    else migrated++;
  }
  return { migrated, skipped };
}

// ---------------------------------------------------------------------------
// The real, scheduled repricing check (V.5) — reuses the existing real cron
// job system (src/lib/jobs/registry.ts), no new job infrastructure needed.
// Founder-confirmed (V.0/V.8): thresholds can be BOTH an overall default AND
// a per-factor override; the new price applies at the school's own real
// NEXT renewal (never mid-term); the school is told the CAUSE category,
// never the exact before/after headcounts; decreases are NEVER automatic.
// ---------------------------------------------------------------------------

function pctGrowth(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? Infinity : 0;
  return ((current - baseline) / baseline) * 100;
}

function thresholdFor(factor: "student" | "staff" | "parent" | "storage", config: PricingEngineConfig): number {
  const perFactor = {
    student: config.studentRepriceThresholdPct,
    staff: config.staffRepriceThresholdPct,
    parent: config.parentRepriceThresholdPct,
    storage: config.storageRepriceThresholdPct,
  }[factor];
  return perFactor ?? config.defaultRepriceThresholdPct;
}

export interface RepriceCheckResult {
  tenantId: string;
  repriced: boolean;
  causes: string[]; // real, honest, CATEGORY-only causes shown to the school (never exact headcounts)
  newMonthlyPriceKes?: number;
}

/**
 * Checks ONE real school for a genuine reprice trigger. Never collects
 * anything mid-term — if triggered, only updates the real Subscription's
 * `sizeBasedPriceKes` (which takes effect at the school's own real next
 * renewal, since the existing A.5 billing state machine always charges
 * whatever `sizeBasedPriceKes`/`grandfatheredPrice` currently is at that
 * point) and creates a new real baseline snapshot + sends a real, honest,
 * cause-only notice.
 */
export async function checkTenantForReprice(tenantId: string): Promise<RepriceCheckResult> {
  const config = await getPricingEngineConfig();
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (!sub || sub.pricingMode !== "SIZE_BASED_V2") return { tenantId, repriced: false, causes: [] };

  const baseline = await db.tenantPricingSnapshot.findFirst({
    where: { tenantId },
    orderBy: { calculatedAt: "desc" },
  });
  if (!baseline) return { tenantId, repriced: false, causes: [] };

  const counts = await getRealCurrentCounts(tenantId);
  const estimatedStorageGb = estimateStorageForSchool(counts.studentCount, counts.staffCount, config);
  const estimatedAiOcrUsage = estimateAiOcrUsageForSchool(counts.studentCount, config);
  const fairUse = await checkFairUseStorageBreach(tenantId, baseline.estimatedStorageGb, config);

  // W.2 — real, honestly-disclosed alumni-growth cause. Founder's own
  // exact instruction: "when they dont [import alumni] no issue... but
  // [when they do] the user is told about it" — this is deliberately named
  // its OWN distinct real cause (never folded silently into "additional
  // storage"), since the founder wants a school to specifically understand
  // it's their real historical-records volume driving this, not just
  // generic storage growth.
  const alumniRecordCount = await getRealAlumniCount(tenantId);
  const alumniStorageGbAdded = estimateAlumniStorageForSchool(alumniRecordCount, config);
  const alumniGrew = alumniRecordCount > baseline.alumniRecordCount;

  const causes: string[] = [];
  if (pctGrowth(counts.studentCount, baseline.studentCount) >= thresholdFor("student", config)) causes.push("more enrolled students");
  if (pctGrowth(counts.staffCount, baseline.staffCount) >= thresholdFor("staff", config)) causes.push("more staff accounts");
  if (pctGrowth(counts.parentCount, baseline.parentCount) >= thresholdFor("parent", config)) causes.push("more parent accounts");
  if (fairUse.breached && pctGrowth(estimatedStorageGb, baseline.estimatedStorageGb) >= thresholdFor("storage", config)) causes.push("additional storage beyond the standard Fair Use allowance");
  if (config.alumniStorageFactorEnabled && alumniGrew && alumniStorageGbAdded > 0) causes.push("newly added historical/alumni records");

  if (causes.length === 0) return { tenantId, repriced: false, causes: [] };

  const newQuote = computeSizeScore(
    { ...counts, estimatedStorageGb, estimatedAiOcrUsage, alumniStorageGb: alumniStorageGbAdded },
    config
  );
  const alumniFactorApplied = alumniStorageGbAdded > 0;

  // Founder-confirmed (V.0): a decrease is never automatic — only ever
  // apply this real trigger if the new price is genuinely HIGHER.
  if (newQuote.monthlyPriceKes <= sub.sizeBasedPriceKes) {
    return { tenantId, repriced: false, causes: [] };
  }

  await db.subscription.update({
    where: { tenantId },
    data: { sizeBasedPriceKes: newQuote.monthlyPriceKes },
  });
  await db.tenantPricingSnapshot.create({
    data: {
      tenantId,
      studentCount: counts.studentCount,
      staffCount: counts.staffCount,
      parentCount: counts.parentCount,
      estimatedStorageGb,
      estimatedAiOcrUsage,
      alumniRecordCount,
      alumniStorageGbAdded,
      alumniFactorApplied,
      rawScore: newQuote.rawScore,
      monthlyPriceKes: newQuote.monthlyPriceKes,
      reason: "REPRICE_THRESHOLD_CROSSED",
    },
  });

  // Real, honest, cause-only notice — founder's own exact requirement:
  // name WHY (category), never the literal before/after headcounts.
  try {
    const { sendBillingNotice } = await import("@/lib/services/billing.service");
    const causeText = causes.join(" and ");
    await sendBillingNotice(
      tenantId,
      sub.id,
      "platform.pricing_reprice_notice",
      "Your NEYO subscription price is updating",
      `Due to your growing NEYO usage — ${causeText} — your next billing will include an additional KES ${newQuote.monthlyPriceKes - sub.sizeBasedPriceKes} per month. This starts from your next renewal; nothing is charged today.`,
      { newMonthlyPriceKes: newQuote.monthlyPriceKes }
    );
  } catch {
    // best-effort — the real price change itself is never blocked by a
    // failed notification
  }

  return { tenantId, repriced: true, causes, newMonthlyPriceKes: newQuote.monthlyPriceKes };
}

/** The real, scheduled company-wide check (wired into the existing cron
 * registry as a new job, src/lib/jobs/registry.ts). */
export async function checkAllTenantsForReprice(): Promise<{ checked: number; repriced: number }> {
  const tenants = await db.tenant.findMany({ where: { isDemo: false }, select: { id: true } });
  let repriced = 0;
  for (const t of tenants) {
    const result = await checkTenantForReprice(t.id);
    if (result.repriced) repriced++;
  }
  return { checked: tenants.length, repriced };
}

// ---------------------------------------------------------------------------
// The real, rare, human-reviewed discretionary DECREASE (V.0/V.5/V.8) — the
// founder's own explicit exception, never automatic, never a formula a
// school can predict. Founder-resolved delegation (V.8): SUPER_ADMIN by
// default, or a specific staff member the founder (as CEO) has explicitly
// authorized via `User.canApplyDiscretionaryDecrease`.
// ---------------------------------------------------------------------------

export async function canUserApplyDiscretionaryDecrease(user: SessionUserLike): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { canApplyDiscretionaryDecrease: true } });
  return dbUser?.canApplyDiscretionaryDecrease ?? false;
}

export async function applyDiscretionaryDecrease(
  user: SessionUserLike,
  targetTenantId: string,
  newMonthlyPriceKes: number,
  note: string
) {
  const allowed = await canUserApplyDiscretionaryDecrease(user);
  if (!allowed) {
    throw new PricingEngineError("FORBIDDEN", "You are not authorized to apply a discretionary price decrease. Ask NEYO's Super Admin/CEO to grant you this specific permission.");
  }

  const sub = await db.subscription.findUnique({ where: { tenantId: targetTenantId } });
  if (!sub) throw new PricingEngineError("NOT_FOUND", "This school has no real subscription yet.");

  const config = await getPricingEngineConfig();
  const counts = await getRealCurrentCounts(targetTenantId);
  const estimatedStorageGb = estimateStorageForSchool(counts.studentCount, counts.staffCount, config);
  const estimatedAiOcrUsage = estimateAiOcrUsageForSchool(counts.studentCount, config);
  const rawScoreAtDecrease = computeSizeScore({ ...counts, estimatedStorageGb, estimatedAiOcrUsage }, config).rawScore;

  await db.subscription.update({
    where: { tenantId: targetTenantId },
    data: { sizeBasedPriceKes: newMonthlyPriceKes },
  });
  await db.tenantPricingSnapshot.create({
    data: {
      tenantId: targetTenantId,
      studentCount: counts.studentCount,
      staffCount: counts.staffCount,
      parentCount: counts.parentCount,
      estimatedStorageGb,
      estimatedAiOcrUsage,
      rawScore: rawScoreAtDecrease,
      monthlyPriceKes: newMonthlyPriceKes,
      reason: "DISCRETIONARY_DECREASE",
      triggeredById: user.id,
      triggeredByName: user.fullName,
      note,
    },
  });
  await db.auditLog.create({
    data: {
      tenantId: targetTenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "platform.discretionary_price_decrease_applied",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: JSON.stringify({ oldPriceKes: sub.sizeBasedPriceKes, newMonthlyPriceKes, note }),
    },
  });

  return { tenantId: targetTenantId, newMonthlyPriceKes };
}

// ---------------------------------------------------------------------------
// NEYO Ops "Schools & Their Current Pricing" list (CHUNK 5 UI) — a real,
// live view of every school's current SIZE_BASED_V2 price plus its full
// real TenantPricingSnapshot history, so NEYO Ops can see exactly how and
// why a school's price has moved over time.
// ---------------------------------------------------------------------------

export async function listSchoolsWithPricing() {
  const tenants = await db.tenant.findMany({
    where: { isDemo: false },
    include: { subscription: true },
    orderBy: { name: "asc" },
  });
  const latestSnapshots = await db.tenantPricingSnapshot.findMany({
    where: { tenantId: { in: tenants.map((t) => t.id) } },
    orderBy: { calculatedAt: "desc" },
  });
  const latestByTenant = new Map<string, (typeof latestSnapshots)[number]>();
  for (const s of latestSnapshots) {
    if (!latestByTenant.has(s.tenantId)) latestByTenant.set(s.tenantId, s);
  }
  return tenants.map((t) => ({
    tenantId: t.id,
    name: t.name,
    pricingMode: t.subscription?.pricingMode ?? "SIZE_BASED_V2",
    sizeBasedPriceKes: t.subscription?.sizeBasedPriceKes ?? 0,
    latestSnapshot: latestByTenant.get(t.id) ?? null,
  }));
}

export async function getPricingHistoryForTenant(tenantId: string) {
  return db.tenantPricingSnapshot.findMany({
    where: { tenantId },
    orderBy: { calculatedAt: "desc" },
  });
}

/** SUPER_ADMIN delegates (or revokes) the discretionary-decrease capability
 * to a specific named staff member (V.8: "when the ceo allows a staff to do
 * so no issue"). */
export async function setDiscretionaryDecreaseDelegate(
  actor: SessionUserLike,
  targetUserId: string,
  canApplyDiscretionaryDecrease: boolean
) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new PricingEngineError("FORBIDDEN", "Only NEYO's Super Admin/CEO can delegate this capability.");
  }
  const target = await db.user.update({
    where: { id: targetUserId },
    data: { canApplyDiscretionaryDecrease },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: canApplyDiscretionaryDecrease ? "platform.discretionary_decrease_delegated" : "platform.discretionary_decrease_revoked",
      entityType: "User",
      entityId: target.id,
      metadata: JSON.stringify({ targetUserName: target.fullName }),
    },
  });
  return { userId: target.id, canApplyDiscretionaryDecrease };
}
