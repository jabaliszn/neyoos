/**
 * B.5 Examination — validation.
 * WHO: exam.manage (leadership/dean) creates exams + publishes.
 *      exam.enter_marks (teachers) enter marks for their classes.
 *      exam.view / published results for parents+students (B.10/B.11).
 */
import { z } from "zod";

export const examSchema = z.object({
  name: z.string().trim().min(2).max(80),
  year: z.coerce.number().int().min(2000).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  type: z.enum(["EXAM", "CAT"]).default("EXAM"),
  maxMarks: z.coerce.number().int().min(10).max(200).default(100),
  subjectIds: z.array(z.string().min(1)).min(1, "Pick at least one subject.").max(20),
});
export type ExamInput = z.infer<typeof examSchema>;

/** Bulk marks entry: one class+subject sheet at a time (autosave-friendly). */
export const marksSchema = z.object({
  examId: z.string().min(1),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  marks: z.array(
    z.object({
      studentId: z.string().min(1),
      marks: z.coerce.number().int().min(0).max(200).nullable(), // null = clear
    })
  ).min(1).max(200),
});
export type MarksInput = z.infer<typeof marksSchema>;

/**
 * Grading (B.5.4):
 * - CBC rubric: EE (Exceeding Expectations) >=80, ME (Meeting) >=65,
 *   AE (Approaching) >=50, BE (Below) <50  — KICD 4-level scale on %.
 * - 8-4-4 letter grades: standard KNEC-style A..E bands on %.
 */
export function cbcLevel(pct: number): "EE" | "ME" | "AE" | "BE" {
  if (pct >= 80) return "EE";
  if (pct >= 65) return "ME";
  if (pct >= 50) return "AE";
  return "BE";
}

const BANDS_844: [number, string][] = [
  [80, "A"], [75, "A-"], [70, "B+"], [65, "B"], [60, "B-"],
  [55, "C+"], [50, "C"], [45, "C-"], [40, "D+"], [35, "D"], [30, "D-"],
];
export function grade844(pct: number): string {
  for (const [min, g] of BANDS_844) if (pct >= min) return g;
  return "E";
}
