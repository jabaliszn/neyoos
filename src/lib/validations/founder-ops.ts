/**
 * PART F.1 — Internal NEYO Founder Operations validation.
 *
 * These records belong to NEYO the company (neyo.co.ke), not to any school
 * tenant. API/service access is SUPER_ADMIN-only.
 */
import { z } from "zod";

export const FOUNDER_OPS_ALLOWED_ROLE = "SUPER_ADMIN" as const;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const requiredText = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);

export const NEYO_BUILD_LOG_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type NeyoBuildLogStatus = (typeof NEYO_BUILD_LOG_STATUSES)[number];

export const NEYO_OPS_STATUSES = ["PLANNED", "DONE", "SKIPPED"] as const;
export type NeyoOpsStatus = (typeof NEYO_OPS_STATUSES)[number];

export const NEYO_OPS_KINDS = [
  "WEEKLY_METRICS",
  "MONTHLY_ALL_HANDS",
  "QUARTERLY_AUDIT",
  "ANNUAL_PLANNING",
  "CUSTOMER_INTERVIEWS",
  "DEMO_DAY",
  "INVESTOR_UPDATE",
  "BOARD_MEETING",
  "IMPACT_REPORT",
] as const;
export type NeyoOpsKind = (typeof NEYO_OPS_KINDS)[number];

export const NEYO_INTERVIEW_CHANNELS = ["CALL", "VISIT", "WHATSAPP", "VIDEO"] as const;
export type NeyoInterviewChannel = (typeof NEYO_INTERVIEW_CHANNELS)[number];

export const NEYO_INTERVIEW_STATUSES = ["SCHEDULED", "DONE", "CANCELLED"] as const;
export type NeyoInterviewStatus = (typeof NEYO_INTERVIEW_STATUSES)[number];

export const neyoActionItemSchema = z.object({
  task: requiredText(2, 180, "Action item needs a clear task."),
  owner: z.string().trim().max(80).optional().or(z.literal("")),
  dueOn: isoDate.optional().or(z.literal("")),
  done: z.boolean().default(false),
});
export type NeyoActionItemInput = z.infer<typeof neyoActionItemSchema>;

export const neyoBuildLogSchema = z.object({
  dateKey: isoDate,
  title: requiredText(4, 120, "Build log title is required."),
  shippedSummary: requiredText(10, 600, "Write what shipped today."),
  details: optionalText(6000),
  screenshotRefs: z.array(z.string().trim().max(240)).max(40).optional(),
  commitRef: optionalText(120),
  status: z.enum(NEYO_BUILD_LOG_STATUSES).default("DRAFT"),
});
export type NeyoBuildLogInput = z.infer<typeof neyoBuildLogSchema>;

export const neyoMetricSnapshotSchema = z
  .object({
    periodKey: requiredText(4, 40, "Period key is required."),
    periodStart: isoDate,
    periodEnd: isoDate,
    revenueKes: z.coerce.number().int().min(0).default(0),
    mrrKes: z.coerce.number().int().min(0).default(0),
    payingSchools: z.coerce.number().int().min(0).default(0),
    trialSchools: z.coerce.number().int().min(0).default(0),
    activeSchools: z.coerce.number().int().min(0).default(0),
    churnRiskSchools: z.coerce.number().int().min(0).default(0),
    smsSpendKes: z.coerce.number().int().min(0).default(0),
    notes: optionalText(3000),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Period end must be on or after period start.",
    path: ["periodEnd"],
  })
  .refine((v) => v.payingSchools <= v.activeSchools || v.activeSchools === 0, {
    message: "Paying schools cannot exceed active schools.",
    path: ["payingSchools"],
  })
  .refine((v) => v.churnRiskSchools <= v.activeSchools || v.activeSchools === 0, {
    message: "Churn-risk schools cannot exceed active schools.",
    path: ["churnRiskSchools"],
  });
export type NeyoMetricSnapshotInput = z.infer<typeof neyoMetricSnapshotSchema>;

export const neyoFounderOpsEntrySchema = z
  .object({
    kind: z.enum(NEYO_OPS_KINDS),
    periodKey: z.string().trim().max(60).optional().or(z.literal("")),
    title: requiredText(4, 160, "Founder-ops entry needs a title."),
    status: z.enum(NEYO_OPS_STATUSES).default("PLANNED"),
    scheduledFor: isoDate.optional().or(z.literal("")),
    completedAt: z.coerce.date().optional().nullable(),
    summary: optionalText(3000),
    notes: optionalText(8000),
    decisions: z.array(z.string().trim().min(2).max(220)).max(40).optional(),
    actionItems: z.array(neyoActionItemSchema).max(80).optional(),
    metrics: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    audience: optionalText(80),
  })
  .refine((v) => v.status !== "DONE" || !!v.completedAt, {
    message: "Done entries need a completion date/time.",
    path: ["completedAt"],
  });
export type NeyoFounderOpsEntryInput = z.infer<typeof neyoFounderOpsEntrySchema>;

export const neyoCustomerInterviewSchema = z
  .object({
    schoolName: requiredText(2, 140, "School name is required."),
    contactName: requiredText(2, 100, "Contact name is required."),
    contactRole: optionalText(80),
    phone: optionalText(24),
    email: z.string().trim().email("Use a valid email address.").optional().or(z.literal("")),
    county: optionalText(60),
    interviewDate: isoDate,
    channel: z.enum(NEYO_INTERVIEW_CHANNELS).default("CALL"),
    status: z.enum(NEYO_INTERVIEW_STATUSES).default("SCHEDULED"),
    painPoints: z.array(z.string().trim().min(2).max(240)).max(40).optional(),
    quotes: z.array(z.string().trim().min(2).max(500)).max(40).optional(),
    opportunities: z.array(z.string().trim().min(2).max(240)).max(40).optional(),
    followUp: optionalText(1500),
  })
  .refine((v) => v.status !== "DONE" || (v.painPoints?.length || v.quotes?.length || v.opportunities?.length), {
    message: "Completed interviews need at least one insight, quote or opportunity.",
    path: ["painPoints"],
  });
export type NeyoCustomerInterviewInput = z.infer<typeof neyoCustomerInterviewSchema>;

export const founderOpsIdSchema = z.object({
  id: z.string().cuid("Invalid founder-ops record id."),
});

export const founderOpsListQuerySchema = z.object({
  kind: z.enum(NEYO_OPS_KINDS).optional(),
  status: z.enum(NEYO_OPS_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type FounderOpsListQuery = z.infer<typeof founderOpsListQuerySchema>;
