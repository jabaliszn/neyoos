/**
 * B.20 Discipline — Zod validation.
 */
import { z } from "zod";

export const INCIDENT_CATEGORIES = [
  "FIGHTING", "BULLYING", "LATENESS", "NOISEMAKING", "SNEAKING",
  "VANDALISM", "CHEATING", "OTHER",
] as const;

export const incidentSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(["MINOR", "MAJOR", "SEVERE"]),
  description: z.string().trim().min(5, "Describe what happened.").max(2000),
  actionTaken: z.string().trim().max(300).optional(),
  proofFileUrl: z.string().trim().max(500).optional(),
  proofFileName: z.string().trim().max(200).optional(),
});
export type IncidentInput = z.infer<typeof incidentSchema>;

export const suspensionSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5, "State the reason.").max(1000),
  conditions: z.string().trim().max(500).optional(),
});
export type SuspensionInput = z.infer<typeof suspensionSchema>;

export const counselingSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionType: z.enum(["INDIVIDUAL", "GROUP", "FAMILY", "REFERRAL"]),
  note: z.string().trim().min(5, "Write the session note.").max(5000),
  followUpOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CounselingInput = z.infer<typeof counselingSchema>;
