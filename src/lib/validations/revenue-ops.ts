import { z } from "zod";

/**
 * PART M — Revenue, Data & Comms (repaired to true full-stack 2026-07-01).
 *
 * M.1 Referral Engine: referral rules (discount %, on/off) are centrally
 * configured by NEYO Ops via PlatformSetting (same pattern as the pricing
 * catalog). Rewards are credited to a real ledger (ReferralCredit) against
 * the schools' OWN NEYO subscription — never against their students' school
 * fee invoices, which is a different business (B.7) entirely.
 *
 * M.2 SMS Margin Revenue: buy/sell price per SMS is centrally configured by
 * NEYO Ops (was previously hardcoded in src/lib/notifications/sms.ts).
 */

export const REFERRAL_SETTING_KEY = "neyo_referral_rules";
export const SMS_MARGIN_SETTING_KEY = "neyo_sms_margin_config";

export const referralRulesSchema = z.object({
  enabled: z.boolean().default(true),
  discountPct: z.coerce.number().min(0).max(0.5).default(0.05), // 5% default, capped at 50%
  rewardBothSides: z.boolean().default(true), // referrer AND referred school both get the credit
  minimumPaidTermsBeforeReward: z.coerce.number().int().min(0).max(12).default(0),
  notes: z.string().trim().max(400).optional().default(
    "A referred school must become a REAL paying NEYO customer (a PAID subscription payment) before either school's discount is credited. Free/demo/trial-only accounts never trigger a reward."
  ),
});
export type ReferralRules = z.infer<typeof referralRulesSchema>;

export function defaultReferralRules(): ReferralRules {
  return referralRulesSchema.parse({});
}

export const smsMarginConfigSchema = z.object({
  costPerSmsKes: z.coerce.number().min(0).max(50).default(0.8),
  pricePerSmsKes: z.coerce.number().min(0).max(50).default(1.2),
  billingWindow: z.enum(["MONTHLY", "TERMLY", "YEARLY"]).default("TERMLY"),
}).superRefine((value, ctx) => {
  if (value.pricePerSmsKes < value.costPerSmsKes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sell price per SMS cannot be lower than NEYO's cost price — that would sell at a loss.",
      path: ["pricePerSmsKes"],
    });
  }
});
export type SmsMarginConfig = z.infer<typeof smsMarginConfigSchema>;

export function defaultSmsMarginConfig(): SmsMarginConfig {
  return smsMarginConfigSchema.parse({});
}

export const applyReferralCodeSchema = z.object({
  code: z.string().trim().min(4).max(20),
});

export const referralActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update_referral_rules"), data: referralRulesSchema }),
  z.object({ action: z.literal("update_sms_margin_config"), data: smsMarginConfigSchema }),
  z.object({ action: z.literal("apply_credit"), creditId: z.string().min(1) }),
  z.object({ action: z.literal("expire_credit"), creditId: z.string().min(1) }),
  z.object({ action: z.literal("mark_sms_ledger_invoiced"), tenantId: z.string().min(1) }),
]);
export type RevenueOpsAction = z.infer<typeof referralActionSchema>;
