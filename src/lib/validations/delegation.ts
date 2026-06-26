import { z } from "zod";

export const DELEGATION_CATEGORIES = [
  "GENERAL",
  "ACADEMICS",
  "ATTENDANCE_FOLLOWUP",
  "PARENT_FOLLOWUP",
  "DUTY",
] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.");

export const createDelegationTaskSchema = z.object({
  title: z.string().trim().min(3, "Task title is required.").max(120),
  details: z.string().trim().max(600).optional().or(z.literal("")),
  category: z.enum(DELEGATION_CATEGORIES).default("GENERAL"),
  assignedToId: z.string().min(1, "Choose a teacher."),
  dueDate: ymd.optional().or(z.literal("")),
});

export const delegationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }).merge(createDelegationTaskSchema),
  z.object({ action: z.literal("complete"), taskId: z.string().min(1) }),
  z.object({ action: z.literal("cancel"), taskId: z.string().min(1) }),
]);

export type CreateDelegationTaskInput = z.infer<typeof createDelegationTaskSchema>;
export type DelegationActionInput = z.infer<typeof delegationActionSchema>;
