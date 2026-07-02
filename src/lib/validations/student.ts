/**
 * Zod validation for Student Management (B.1).
 */
import { z } from "zod";
import { normalizeKePhone } from "@/lib/validations/auth";

const kePhone = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .transform((val, ctx) => {
    const n = normalizeKePhone(val);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Kenyan phone, e.g. 0712 345 678" });
      return z.NEVER;
    }
    return n;
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "SUSPENDED"] as const;
export const CURRICULA = ["CBC", "8-4-4"] as const;

// --- Guardian (embedded in student create) ---
export const guardianInputSchema = z.object({
  fullName: z.string().trim().min(2, "Guardian name is required.").max(80),
  phone: kePhone,
  email: z.string().trim().email().optional().or(z.literal("")),
  nationalId: z.string().trim().max(20).optional().or(z.literal("")),
  relationship: z.enum(["Parent", "Mother", "Father", "Guardian", "Other"]).default("Parent"),
  isPrimary: z.boolean().default(false),
  createLogin: z.boolean().default(false), // create a PARENT NEYO login (B.10)
});

// --- Class ---
export const classSchema = z.object({
  level: z.string().trim().min(1, "Level is required, e.g. Grade 4 or Form 2.").max(40),
  stream: z.string().trim().max(40).optional().or(z.literal("")),
  curriculum: z.enum(CURRICULA).default("CBC"),
  classTeacherId: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
});
export type ClassInput = z.infer<typeof classSchema>;

// --- Student create ---
export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(40),
  middleName: z.string().trim().max(40).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required.").max(40),
  gender: z.enum(["M", "F"], { errorMap: () => ({ message: "Select a gender." }) }),
  dateOfBirth: isoDate.optional().or(z.literal("")),
  classId: z.string().optional().or(z.literal("")),
  legacyAdmissionNo: z.string().trim().max(40).optional().or(z.literal("")),
  photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  upiNumber: z.string().trim().max(40).optional().or(z.literal("")),
  birthCertNo: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  createLogin: z.boolean().default(false), // create a STUDENT NEYO login
  guardians: z.array(guardianInputSchema).max(4).optional(),
  // Seed the per-student joining checklist from the school master list (G.9).
  seedRequirements: z.boolean().default(true),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// --- Student edit (all optional) ---
export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(40).optional(),
  middleName: z.string().trim().max(40).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).max(40).optional(),
  gender: z.enum(["M", "F"]).optional(),
  dateOfBirth: isoDate.optional().or(z.literal("")),
  classId: z.string().optional().or(z.literal("")),
  legacyAdmissionNo: z.string().trim().max(40).optional().or(z.literal("")),
  photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  upiNumber: z.string().trim().max(40).optional().or(z.literal("")),
  birthCertNo: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(STUDENT_STATUSES).optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// --- List filters ---
export const studentFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  classId: z.string().optional(),
  stream: z.string().trim().max(40).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  gender: z.enum(["M", "F"]).optional(),
  view: z.enum(["list", "kanban"]).optional(),
});

/** B.1 transfer-out (school-to-school). */
export const TRANSFER_REASONS = ["relocation", "fees", "boarding", "discipline", "other"] as const;
export const transferStudentSchema = z.object({
  destinationSchool: z.string().trim().min(3, "Destination school is required.").max(120),
  destinationCounty: z.string().trim().max(40).optional().or(z.literal("")),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  reason: z.enum(TRANSFER_REASONS).default("relocation"),
  reasonNote: z.string().trim().max(300).optional().or(z.literal("")),
});
export type TransferStudentInput = z.infer<typeof transferStudentSchema>;

export const addDocumentSchema = z.object({
  label: z.string().trim().min(1).max(80),
  fileUrl: z.string().trim().min(1),
  fileName: z.string().trim().max(160).optional(),
  hardcopyLocation: z.string().trim().min(3, "Enter where the original hardcopy is kept, e.g. Cabinet 2 / File 14.").max(160),
});

export const addGuardianSchema = guardianInputSchema;

// M.3 — Class teachers (and anyone with student.edit) can correct an EXISTING
// guardian's phone/email/relationship — separate from addGuardianSchema
// because every field is optional (a partial edit) and there's no createLogin
// / isPrimary toggle here (that stays on the dedicated set_primary action).
export const updateGuardianSchema = z.object({
  fullName: z.string().trim().min(2, "Guardian name is required.").max(80).optional(),
  phone: kePhone.optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  nationalId: z.string().trim().max(20).optional().or(z.literal("")),
  relationship: z.enum(["Parent", "Mother", "Father", "Guardian", "Other"]).optional(),
});
export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;

