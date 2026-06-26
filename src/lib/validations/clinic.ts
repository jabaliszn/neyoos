/**
 * B.21 Medical / Clinic — Zod validation.
 */
import { z } from "zod";

export const medicalProfileSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().or(z.literal("")),
  conditions: z.string().trim().max(500).optional().or(z.literal("")),
  allergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  shaNumber: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type MedicalProfileInput = z.infer<typeof medicalProfileSchema>;

export const visitSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  complaint: z.string().trim().min(3, "What is the complaint?").max(500),
  treatment: z.string().trim().min(2, "What was done?").max(500),
  medicationGiven: z.string().trim().max(200).optional(),
  referredTo: z.string().trim().max(120).optional(), // set = referral -> guardian SMS
});
export type VisitInput = z.infer<typeof visitSchema>;

export const medicationPlanSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  drug: z.string().trim().min(2, "Drug name.").max(120),
  dosage: z.string().trim().min(1, "Dosage.").max(80),
  frequency: z.string().trim().min(1, "Frequency.").max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type MedicationPlanInput = z.infer<typeof medicationPlanSchema>;
