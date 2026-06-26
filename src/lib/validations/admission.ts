/**
 * B.2 Admissions — validation.
 * WHO: public can apply online (rate-limited, no auth). Staff pipeline ops
 * need "student.create" (registrar/leadership) — admissions create students.
 */
import { z } from "zod";
import { kePhone } from "@/lib/validations/reception";

export const APPLICATION_STATUSES = [
  "APPLIED", "REVIEW", "INTERVIEW", "OFFER", "ADMITTED", "WAITLISTED", "REJECTED", "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applySchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  middleName: z.string().trim().max(60).optional().or(z.literal("")),
  lastName: z.string().trim().min(2).max(60),
  gender: z.enum(["M", "F"]),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gradeWanted: z.string().trim().min(2).max(40),
  curriculum: z.enum(["CBC", "8-4-4"]).optional(),
  previousSchool: z.string().trim().max(120).optional().or(z.literal("")),
  guardianName: z.string().trim().min(2).max(80),
  guardianPhone: kePhone,
  guardianEmail: z.string().trim().email().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const decisionSchema = z.object({
  action: z.enum(["review", "schedule_interview", "offer", "waitlist", "reject", "withdraw", "record_deposit", "admit"]),
  // schedule_interview
  interviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  interviewTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  interviewNote: z.string().trim().max(300).optional().or(z.literal("")),
  // offer
  depositRequiredKes: z.coerce.number().int().min(0).max(10_000_000).optional(),
  // record_deposit
  amountKes: z.coerce.number().int().min(1).max(10_000_000).optional(),
  reference: z.string().trim().max(40).optional().or(z.literal("")),
  // admit
  classId: z.string().optional(),
  // generic
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type DecisionInput = z.infer<typeof decisionSchema>;
