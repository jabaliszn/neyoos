import { z } from "zod";

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
  sections: z.array(reportSectionSchema).default([]),
});

export type ReportSectionInput = z.infer<typeof reportSectionSchema>;
export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;
