import { z } from "zod";

export const TALENT_CATEGORIES = ["SPORTS", "ARTS", "STEM", "LEADERSHIP", "OTHER"] as const;

export const talentAreaSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  category: z.enum(TALENT_CATEGORIES),
  description: z.string().max(500).optional().nullable(),
});

export const talentRecordSchema = z.object({
  studentId: z.string().cuid(),
  talentAreaId: z.string().cuid(),
  termId: z.string().cuid().optional().nullable(),
  score: z.number().int().min(1).max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  portfolioItemId: z.string().cuid().optional().nullable(),
});

export type TalentAreaInput = z.infer<typeof talentAreaSchema>;
export type TalentRecordInput = z.infer<typeof talentRecordSchema>;
