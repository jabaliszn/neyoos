import { z } from "zod";

export const globalCurriculumTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  country: z.string().default("Kenya"),
  context: z.string().optional().nullable(),
  version: z.string().default("v1"),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  learningAreas: z.array(z.object({
    name: z.string(),
    code: z.string(),
    description: z.string().optional().nullable()
  })).default([])
});

export type GlobalCurriculumTemplateInput = z.infer<typeof globalCurriculumTemplateSchema>;
