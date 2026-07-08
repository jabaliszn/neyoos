/**
 * Part V — NEYO Capacity-Based Pricing System 2.0 (founder-confirmed pivot,
 * 2026-07-06). Validation for the real, live-editable pricing-engine config
 * (NEYO Ops), quote requests, and the discretionary-decrease exception.
 *
 * Every weight/constant below is a real NEYO-Ops-editable number — never
 * hardcoded — following the exact same config-JSON-in-`PlatformSetting`
 * pattern already used by the pricing catalog, referral rules, SMS margin,
 * sibling %, and the S.1/S.2 shell-version release gate.
 */
import { z } from "zod";

/** Founder-resolved (V.8): "you shouldnt hard code it... the company can
 * change what they would like to change in the neyo ops" — a real,
 * NEYO-Ops-editable choice between a time-boxed trial and "everyone pays
 * from day one," never a fixed platform decision. */
export const FREE_TIER_MODES = ["TRIAL", "EVERYONE_PAYS"] as const;
export type FreeTierMode = (typeof FREE_TIER_MODES)[number];

export const pricingEngineConfigSchema = z.object({
  // Core size-score weights (V.2).
  weightStudent: z.number().min(0),
  weightStaff: z.number().min(0),
  weightParent: z.number().min(0),
  weightStorageGb: z.number().min(0),
  weightAiOcrUsage: z.number().min(0), // V.8-resolved: folded in, marketed as "no setup fee"

  // The real pricing floor + conversion rate.
  baseFloorKes: z.number().int().min(0),
  kesPerScorePoint: z.number().min(0),

  // Storage-estimate sub-formula (V.2).
  avgGbPerStudent: z.number().min(0),
  avgGbPerStaff: z.number().min(0),
  flatSchoolOverheadGb: z.number().min(0),

  // AI/OCR-estimate sub-formula (V.8-resolved: folded into the score).
  avgAiOcrUsagePerStudent: z.number().min(0),

  // Fair Use safety net (V.2): real measured storage vs. the estimate.
  fairUseStorageMultiplier: z.number().min(1), // e.g. 1.5 = 150% of the estimate before it's "above fair use"

  // Reprice-trigger thresholds (V.0: "both" — one overall default, plus
  // optional per-factor overrides that fall back to the default).
  defaultRepriceThresholdPct: z.number().min(0).max(500),
  studentRepriceThresholdPct: z.number().min(0).max(500).nullable(),
  staffRepriceThresholdPct: z.number().min(0).max(500).nullable(),
  parentRepriceThresholdPct: z.number().min(0).max(500).nullable(),
  storageRepriceThresholdPct: z.number().min(0).max(500).nullable(),

  // Free tier (V.8-resolved: NEYO Ops choice, never hardcoded).
  freeTierMode: z.enum(FREE_TIER_MODES),
  freeTrialDays: z.number().int().min(0), // only meaningful when freeTierMode === "TRIAL"

  // W.2 — Real, honest, NEYO-Ops-controlled long-term alumni-storage
  // factor (founder-requested 2026-07-06). OFF by default — a genuine
  // no-op for every school until they actually import/graduate alumni
  // records AND NEYO Ops has switched this on. When ON, a school's real
  // GRADUATED student count adds a real, disclosed amount of estimated
  // storage to their score, reflecting the long-term record-keeping NEYO
  // is committing to for historical records — never a silent price bump.
  alumniStorageFactorEnabled: z.boolean(),
  avgGbPerAlumniRecord: z.number().min(0), // real per-alumnus estimated GB (their own historical file volume), only applied when the toggle above is ON
});
export type PricingEngineConfig = z.infer<typeof pricingEngineConfigSchema>;

/** A real, honest, sensible starting point — NEYO Ops can (and should)
 * refine every one of these over time as real usage/cost data comes in,
 * per the founder's own "as you gather real data, improve the estimates"
 * framing carried over from the original ideas conversation. */
export function defaultPricingEngineConfig(): PricingEngineConfig {
  return {
    weightStudent: 1,
    weightStaff: 2.5,
    weightParent: 0.3,
    weightStorageGb: 4,
    weightAiOcrUsage: 2,
    baseFloorKes: 1500,
    kesPerScorePoint: 15,
    avgGbPerStudent: 0.15,
    avgGbPerStaff: 0.3,
    flatSchoolOverheadGb: 2,
    avgAiOcrUsagePerStudent: 0.02,
    fairUseStorageMultiplier: 1.5,
    defaultRepriceThresholdPct: 20,
    studentRepriceThresholdPct: 15,
    staffRepriceThresholdPct: null,
    parentRepriceThresholdPct: null,
    storageRepriceThresholdPct: 40,
    freeTierMode: "TRIAL",
    freeTrialDays: 30,
    alumniStorageFactorEnabled: false,
    avgGbPerAlumniRecord: 0.1,
  };
}

/** Real declared counts for an instant quote (V.6) — a genuinely honest
 * "unsure, estimate for me" fallback is explicitly supported. */
export const quotePriceInputSchema = z.object({
  studentCount: z.coerce.number().int().min(0).optional(),
  staffCount: z.coerce.number().int().min(0).optional(),
  parentCount: z.coerce.number().int().min(0).optional(),
  requestedEstimate: z.boolean().default(false),
}).refine(
  (v) => v.requestedEstimate || (v.studentCount !== undefined && v.staffCount !== undefined),
  "Provide real student and staff counts, or ask NEYO to estimate for you."
);
export type QuotePriceInput = z.infer<typeof quotePriceInputSchema>;

/** A real quote-request submission (V.4/V.6). */
export const createQuoteRequestSchema = z.object({
  schoolName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().toLowerCase(),
  contactPhone: z.string().trim().min(7).max(20),
  declaredStudentCount: z.coerce.number().int().min(0).optional(),
  declaredStaffCount: z.coerce.number().int().min(0).optional(),
  declaredParentCount: z.coerce.number().int().min(0).optional(),
  requestedEstimate: z.boolean().default(false),
  formalQuoteRequested: z.boolean().default(false),
  onboardingAssistanceRequested: z.boolean().default(false),
  onboardingAssistanceNote: z.string().trim().max(500).optional(),
});
export type CreateQuoteRequestInput = z.infer<typeof createQuoteRequestSchema>;

/** NEYO Ops reviewing/sending a formal quotation (V.6). */
export const sendFormalQuoteSchema = z.object({
  requestId: z.string().min(1),
  finalQuotedPriceKes: z.coerce.number().int().min(0),
  note: z.string().trim().max(500).optional(),
});
export type SendFormalQuoteInput = z.infer<typeof sendFormalQuoteSchema>;

/** The real, rare, human-reviewed discretionary decrease (V.5/V.8). */
export const discretionaryDecreaseSchema = z.object({
  tenantId: z.string().min(1),
  newMonthlyPriceKes: z.coerce.number().int().min(0),
  note: z.string().trim().min(10, "Explain why this decrease is being granted.").max(500),
});
export type DiscretionaryDecreaseInput = z.infer<typeof discretionaryDecreaseSchema>;

/** SUPER_ADMIN delegating the discretionary-decrease capability to a
 * specific staff member (V.8: "when the ceo allows a staff to do so no
 * issue"). */
export const setDiscretionaryDecreaseDelegateSchema = z.object({
  userId: z.string().min(1),
  canApplyDiscretionaryDecrease: z.boolean(),
});
export type SetDiscretionaryDecreaseDelegateInput = z.infer<typeof setDiscretionaryDecreaseDelegateSchema>;
