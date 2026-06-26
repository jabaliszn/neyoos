/**
 * B.19 Cafeteria — Zod validation.
 */
import { z } from "zod";

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SUPPER"] as const;

export const menuEntrySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  mealType: z.enum(MEAL_TYPES),
  menu: z.string().trim().min(2, "What's on the menu?").max(200),
});
export type MenuEntryInput = z.infer<typeof menuEntrySchema>;

export const issueCardSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  meals: z.array(z.enum(MEAL_TYPES)).min(1, "Pick at least one meal."),
  termFeeKes: z.coerce.number().int().min(1, "Set the plan fee.").max(1_000_000),
  year: z.coerce.number().int().min(2020).max(2100),
  term: z.coerce.number().int().min(1).max(3),
});
export type IssueCardInput = z.infer<typeof issueCardSchema>;

export const kitchenIssueSchema = z.object({
  itemId: z.string().min(1, "Pick the item."),
  qty: z.coerce.number().positive(),
  meal: z.string().trim().min(2).max(80), // "Tuesday lunch — githeri"
});
export type KitchenIssueInput = z.infer<typeof kitchenIssueSchema>;
