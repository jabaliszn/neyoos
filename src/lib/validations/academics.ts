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

/** Real KE subject sets (B.4 CBC + 8-4-4 support) — used by seed + "quick add".
 * P.6 (2026-07-02): Religious Education is a real Kenyan school subject choice
 * offered as CRE (Christian) / IRE (Islamic) / HRE (Hindu) — a school picks
 * whichever the learner's family practises. Previously this quick-add preset
 * (used by the "Add CBC set" / "Add 8-4-4 set" buttons that bootstrap a
 * school's whole subject list, independent of Senior School pathways) only
 * ever offered CRE, silently leaving IRE/HRE unavailable for any school that
 * hadn't separately gone through the Senior School official-pathway seeding
 * flow (P.1) where all three already existed. Now all three real options are
 * offered together at this general level too, matching the founder's "HRE
 * alongside the existing CRE/IRE options wherever Religious Education is
 * offered as a subject choice" instruction. */
export const KE_SUBJECT_PRESETS: Record<"CBC" | "8-4-4", { name: string; code: string }[]> = {
  CBC: [
    { name: "English", code: "ENG" },
    { name: "Kiswahili", code: "KIS" },
    { name: "Mathematics", code: "MAT" },
    { name: "Integrated Science", code: "ISC" },
    { name: "Social Studies", code: "SST" },
    { name: "Christian Religious Education", code: "CRE" },
    { name: "Islamic Religious Education", code: "IRE" },
    { name: "Hindu Religious Education", code: "HRE" },
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
    { name: "Christian Religious Education", code: "CRE" },
    { name: "Islamic Religious Education", code: "IRE" },
    { name: "Hindu Religious Education", code: "HRE" },
    { name: "Business Studies", code: "BST" },
    { name: "Agriculture", code: "AGR" },
    { name: "Computer Studies", code: "CMP" },
  ],
};
