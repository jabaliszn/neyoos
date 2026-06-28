import { z } from "zod";

export const ACTIVITY_COLORS = ["gray", "blue", "green", "purple", "amber", "rose"] as const;

export const activityCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  color: z.enum(ACTIVITY_COLORS).default("gray"),
  description: z.string().max(500).optional(),
  maxPerWeek: z.number().int().min(1).max(20).optional(),
});

export type ActivityCategoryInput = z.infer<typeof activityCategorySchema>;
