import { z } from "zod";

export const subjectPaperConfigSchema = z.object({
  subjectId: z.string().cuid(),
  classId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(50),
  outOfMarks: z.number().int().min(1).max(1000).default(100),
  weightPct: z.number().int().min(0).max(100).default(100),
});

export const paperResultInputSchema = z.object({
  studentId: z.string().cuid(),
  paperConfigId: z.string().cuid(),
  marksScored: z.number().min(0).max(1000).optional().nullable(), // Null means absent or unentered
});

export const savePaperResultsSchema = z.object({
  examId: z.string().cuid(),
  subjectId: z.string().cuid(),
  results: z.array(paperResultInputSchema),
});

export const marksPortalSchema = z.object({
  termId: z.string().cuid(),
  name: z.string().min(3).max(100),
  openDate: z.string().datetime().or(z.date()),
  closeDate: z.string().datetime().or(z.date()),
});

export const termAggregationRuleSchema = z.object({
  classId: z.string().cuid().optional().nullable(),
  subjectId: z.string().cuid().optional().nullable(),
  isTraditional: z.boolean().default(false),
  weightings: z.array(z.object({
    sourceType: z.enum(["EXAM", "ASSESSMENT"]),
    sourceId: z.string(), // ID of the Exam or AssessmentType
    weightPct: z.number().int().min(1).max(100)
  })).default([])
});
