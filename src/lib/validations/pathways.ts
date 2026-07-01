import { z } from "zod";

export const pathwayRequirementSchema = z.object({
  subjectId: z.string().cuid(),
  isCore: z.boolean().default(true),
  minScorePct: z.number().min(0).max(100).optional().nullable(),
});

export const pathwaySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().min(2, "Code must be at least 2 characters").max(20).toUpperCase(),
  description: z.string().max(500).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  requirements: z.array(pathwayRequirementSchema).optional(),
});

export type PathwayInput = z.infer<typeof pathwaySchema>;

export const studentPathwayPreferenceSchema = z.object({
  pathwayId: z.string().cuid(),
  choiceOrder: z.number().int().min(1).max(5),
});

export const studentPathwayAllocationSchema = z.object({
  pathwayId: z.string().cuid(),
  teacherNotes: z.string().max(500).optional().nullable(),
  isRecommended: z.boolean().default(false),
  isAllocated: z.boolean().default(true),
});

export type StudentPathwayPreferenceInput = z.infer<typeof studentPathwayPreferenceSchema>;
export type StudentPathwayAllocationInput = z.infer<typeof studentPathwayAllocationSchema>;

// Payload for the "set preferences" screen: a student picks up to 5 ranked pathways.
export const setStudentPreferencesSchema = z.object({
  preferences: z
    .array(studentPathwayPreferenceSchema)
    .max(5, "A student can rank at most 5 pathway choices."),
});

export type SetStudentPreferencesInput = z.infer<typeof setStudentPreferencesSchema>;
