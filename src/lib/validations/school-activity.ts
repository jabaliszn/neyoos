/**
 * R.6 — School Activities / Trips (a "Form 4 trip"-style optional
 * fee-collection tracker, separate from B.7 compulsory fee invoicing).
 * WHO: finance.manage_structure to create/edit activities, finance.record_payment
 * to record a real payment or waiver, finance.view to read.
 */
import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createActivitySchema = z.object({
  name: z.string().trim().min(3, "Name the activity, e.g. \"Form 4 Mombasa Trip\".").max(120),
  description: z.string().trim().max(500).optional(),
  amountKes: z.coerce.number().int().min(1, "Enter the real per-student amount.").max(10_000_000),
  year: z.coerce.number().int().min(2000).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  eventDate: dateYmd.optional(),
  classIds: z.array(z.string().min(1)).min(1, "Choose at least one class."),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const recordActivityPaymentSchema = z.object({
  participantId: z.string().min(1),
  amountKes: z.coerce.number().int().min(1).max(10_000_000).optional(), // defaults to the activity's real amountKes
  phone: z.string().trim().min(1).optional(),
  method: z.enum(["cash", "mpesa", "bank"]).default("cash"),
  mpesaRef: z.string().trim().max(40).optional(),
  biometricTicket: z.string().trim().max(80).optional(),
});
export type RecordActivityPaymentInput = z.infer<typeof recordActivityPaymentSchema>;

export const waiveActivityParticipantSchema = z.object({
  participantId: z.string().min(1),
  reason: z.string().trim().min(3, "Give a real reason, e.g. \"Parent asked to pay after half-term.\"").max(300),
});
export type WaiveActivityParticipantInput = z.infer<typeof waiveActivityParticipantSchema>;

export const unwaiveActivityParticipantSchema = z.object({
  participantId: z.string().min(1),
});
