/**
 * B.4 Academics — validation.
 * WHO: academics.manage (leadership/HOD) for subjects/departments/terms/
 * timetable; teachers manage their OWN lesson plans (academics.view+own).
 */
import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const subjectSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z.string().trim().min(2).max(8).transform((s) => s.toUpperCase()),
  curriculum: z.enum(["CBC", "8-4-4", "BOTH"]).default("BOTH"),
  departmentId: z.string().optional().or(z.literal("")),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  hodId: z.string().optional().or(z.literal("")),
  subjectIds: z.array(z.string()).optional(),
});

export const termSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  startDate: dateYmd,
  endDate: dateYmd,
  current: z.boolean().default(false),
}).refine((v) => v.endDate > v.startDate, { message: "End date must be after start date." });

export const slotSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().optional().or(z.literal("")),
  venue: z.string().trim().max(80).optional().or(z.literal("")),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  period: z.coerce.number().int().min(1).max(8),
});

export const autoFillSchema = z.object({
  classId: z.string().min(1),
  /** subjectId -> lessons per week */
  weeklyLoad: z.record(z.string(), z.coerce.number().int().min(1).max(10)),
  /** subjectId -> teacherId (optional per subject) */
  teachers: z.record(z.string(), z.string()).default({}),
  clearExisting: z.boolean().default(false),
});

export const lessonPlanSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  date: dateYmd,
  topic: z.string().trim().min(2).max(160),
  objectives: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  activities: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  strandId: z.string().cuid().optional().nullable(),
  competencyId: z.string().cuid().optional().nullable(),
  assessmentPlanId: z.string().cuid().optional().nullable(),
  resources: z.array(z.object({ fileUrl: z.string().url(), fileName: z.string().optional() })).optional(),
});

export const lessonStatusSchema = z.object({ status: z.enum(["PLANNED", "TAUGHT", "SKIPPED"]) });

/** J.12 — a quick observation recorded directly from a lesson plan. */
export const lessonObservationSchema = z.object({
  lessonPlanId: z.string().cuid(),
  studentId: z.string().cuid().optional().nullable(), // null = whole-class
  strandId: z.string().cuid().optional().nullable(),
  competencyId: z.string().cuid().optional().nullable(),
  level: z.coerce.number().int().min(1).max(4).optional().nullable(),
  note: z.string().trim().min(2).max(1000),
  date: dateYmd.optional(),
});

/** Real KE subject sets (B.4 CBC + 8-4-4 support) — used by seed + "quick add". */
export const KE_SUBJECT_PRESETS: Record<"CBC" | "8-4-4", { name: string; code: string }[]> = {
  CBC: [
    { name: "English", code: "ENG" },
    { name: "Kiswahili", code: "KIS" },
    { name: "Mathematics", code: "MAT" },
    { name: "Integrated Science", code: "ISC" },
    { name: "Social Studies", code: "SST" },
    { name: "CRE", code: "CRE" },
    { name: "Agriculture & Nutrition", code: "AGN" },
    { name: "Pre-Technical Studies", code: "PTS" },
    { name: "Creative Arts & Sports", code: "CAS" },
  ],
  "8-4-4": [
    { name: "English", code: "ENG" },
    { name: "Kiswahili", code: "KIS" },
    { name: "Mathematics", code: "MAT" },
    { name: "Biology", code: "BIO" },
    { name: "Chemistry", code: "CHE" },
    { name: "Physics", code: "PHY" },
    { name: "History & Government", code: "HIS" },
    { name: "Geography", code: "GEO" },
    { name: "CRE", code: "CRE" },
    { name: "Business Studies", code: "BST" },
    { name: "Agriculture", code: "AGR" },
    { name: "Computer Studies", code: "CMP" },
  ],
};
