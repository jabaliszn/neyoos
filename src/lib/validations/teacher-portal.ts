/**
 * B.12 Teacher Portal — Zod validation.
 * Homework + class notes a teacher shares with their class.
 */
import { z } from "zod";

export const homeworkCreateSchema = z.object({
  classId: z.string().min(1, "Pick a class."),
  subjectId: z.string().min(1, "Pick a subject."),
  title: z.string().trim().min(3, "Give the homework a title.").max(160),
  instructions: z.string().trim().max(4000).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD."),
  fileUrl: z.string().trim().max(500).optional(),
  fileName: z.string().trim().max(200).optional(),
});
export type HomeworkCreateInput = z.infer<typeof homeworkCreateSchema>;

export const noteCreateSchema = z.object({
  classId: z.string().min(1, "Pick a class."),
  subjectId: z.string().min(1, "Pick a subject."),
  title: z.string().trim().min(3, "Give the notes a title.").max(160),
  description: z.string().trim().max(2000).optional(),
  fileUrl: z.string().trim().min(1, "Upload the notes file first.").max(500),
  fileName: z.string().trim().min(1).max(200),
});
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
