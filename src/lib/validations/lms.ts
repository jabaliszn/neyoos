/**
 * B.13 LMS — Zod validation.
 * Homework submissions + grading, quizzes (MCQ, auto-grade), class forums.
 */
import { z } from "zod";

// --- Homework submissions ---
export const submissionCreateSchema = z
  .object({
    homeworkId: z.string().min(1),
    text: z.string().trim().max(8000).optional(),
    fileUrl: z.string().trim().max(500).optional(),
    fileName: z.string().trim().max(200).optional(),
  })
  .refine((v) => (v.text && v.text.length > 0) || v.fileUrl, {
    message: "Type your answer or upload your work.",
  });
export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>;

export const gradeSchema = z.object({
  submissionId: z.string().min(1),
  gradePct: z.coerce.number().int().min(0, "0-100").max(100, "0-100"),
  feedback: z.string().trim().max(2000).optional(),
});
export type GradeInput = z.infer<typeof gradeSchema>;

// --- Quizzes ---
export const quizQuestionSchema = z.object({
  prompt: z.string().trim().min(3, "Write the question.").max(1000),
  options: z
    .array(z.string().trim().min(1, "Option cannot be empty.").max(300))
    .min(2, "At least 2 options.")
    .max(6, "At most 6 options."),
  correctIndex: z.coerce.number().int().min(0),
});

export const quizCreateSchema = z
  .object({
    classId: z.string().min(1, "Pick a class."),
    subjectId: z.string().min(1, "Pick a subject."),
    title: z.string().trim().min(3, "Give the quiz a title.").max(160),
    instructions: z.string().trim().max(2000).optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD.")
      .optional(),
    questions: z.array(quizQuestionSchema).min(1, "Add at least one question.").max(50),
  })
  .refine(
    (v) => v.questions.every((q) => q.correctIndex < q.options.length),
    { message: "Each correct answer must point at one of its options." }
  );
export type QuizCreateInput = z.infer<typeof quizCreateSchema>;

export const quizAttemptSchema = z.object({
  quizId: z.string().min(1),
  answers: z.array(z.coerce.number().int().min(-1)).min(1), // -1 = unanswered
});
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;

// --- Forums ---
export const threadCreateSchema = z.object({
  classId: z.string().min(1, "Pick a class."),
  title: z.string().trim().min(3, "Give the thread a title.").max(160),
  body: z.string().trim().min(1, "Write something.").max(8000),
});
export type ThreadCreateInput = z.infer<typeof threadCreateSchema>;

export const postCreateSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1, "Write something.").max(8000),
});
export type PostCreateInput = z.infer<typeof postCreateSchema>;
