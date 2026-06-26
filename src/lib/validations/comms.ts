/**
 * B.14 / I.10 Communication validation.
 * Bulk school-office messages remain preview-first. Teacher class-parent messages
 * now go through an approval queue and are delivered in-app only after a
 * Principal/Deputy/Owner approves them.
 */
import { z } from "zod";

export const AUDIENCE_TYPES = ["SCHOOL_GUARDIANS", "CLASS_GUARDIANS", "ROLE"] as const;

export const bulkSendSchema = z
  .object({
    audienceType: z.enum(AUDIENCE_TYPES),
    classId: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    channel: z.enum(["sms", "in_app"]),
    body: z
      .string()
      .trim()
      .min(5, "Write the message (at least 5 characters).")
      .max(480, "Keep it under 480 characters (3 SMS segments)."),
    dryRun: z.boolean().optional(),
  })
  .refine((v) => v.audienceType !== "CLASS_GUARDIANS" || Boolean(v.classId), {
    message: "Pick the class.",
  })
  .refine((v) => v.audienceType !== "ROLE" || Boolean(v.role), {
    message: "Pick the role.",
  });
export type BulkSendInput = z.infer<typeof bulkSendSchema>;

export const teacherCommsRequestSchema = z.object({
  action: z.literal("request_teacher_approval"),
  classId: z.string().min(1, "Pick the class."),
  channel: z.literal("in_app", {
    errorMap: () => ({ message: "Teachers can request in-app messages only." }),
  }),
  body: z
    .string()
    .trim()
    .min(5, "Write the message (at least 5 characters).")
    .max(480, "Keep it under 480 characters."),
});
export type TeacherCommsRequestInput = z.infer<typeof teacherCommsRequestSchema>;

export const teacherCommsDecisionSchema = z.object({
  action: z.enum(["approve_teacher_message", "reject_teacher_message"]),
  requestId: z.string().min(1),
  note: z.string().trim().max(240).optional(),
});
export type TeacherCommsDecisionInput = z.infer<typeof teacherCommsDecisionSchema>;
