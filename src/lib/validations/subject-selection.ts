import { z } from "zod";
import { dateYmd } from "./date";

export const selectionPortalRuleSchema = z.object({
  minElectives: z.number().int().min(0),
  maxElectives: z.number().int().min(0),
  compulsorySubjectIds: z.array(z.string()).default([]),
  electiveSubjectIds: z.array(z.string()).default([]),
});

export const createSelectionPortalSchema = z.object({
  name: z.string().min(3).max(100),
  targetLevel: z.string().min(1),
  openDate: z.string().datetime().or(z.date()),
  closeDate: z.string().datetime().or(z.date()),
  rules: selectionPortalRuleSchema,
});

export type CreateSelectionPortalInput = z.infer<typeof createSelectionPortalSchema>;
