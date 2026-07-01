import { z } from "zod";

const optionalDateYmd = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional().transform((v) => v || null);

export const REPORT_SECTION_TYPES = [
  "HEADER",             // School Logo, Student Details, Term
  "ACADEMIC_MARKS",     // Traditional Subject/Marks table
  "COMPETENCIES",       // CBC Style learning areas & rubric levels
  "ATTENDANCE",         // Days present, absent
  "DISCIPLINE",         // Behavior flags / incidents
  "TALENTS",            // J.11 Co-curricular logs
  "PORTFOLIO",          // Top submitted portfolio items
  "TEACHER_REMARKS",    // Class teacher comments
  "PRINCIPAL_REMARKS",  // Principal sign-off
  "GRADING_KEY",        // Explanation of A, B, C or EE, ME, AE, BE
  "QR_VERIFICATION"     // QR code for digital validation
] as const;

export const reportSectionSchema = z.object({
  id: z.string(), // A unique client-side ID for drag & drop
  type: z.enum(REPORT_SECTION_TYPES),
  title: z.string().optional(), // e.g. "Term 2 Marks"
  config: z.record(z.any()).optional().default({}), // Section-specific config (e.g., showPosition: true)
});

export const reportTemplateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().default(false),
  version: z.string().min(1).max(60).default("v1"),
  effectiveFrom: optionalDateYmd,
  effectiveTo: optionalDateYmd,
  curriculumVersion: z.string().max(120).optional().nullable(),
  sections: z.array(reportSectionSchema).default([]),
}).refine((value) => !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
  message: "Effective end date cannot be before the start date.",
  path: ["effectiveTo"],
});

export type ReportSectionInput = z.infer<typeof reportSectionSchema>;
export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;
