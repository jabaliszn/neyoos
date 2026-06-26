/**
 * B.15 Library — Zod validation.
 */
import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().trim().min(2, "Give the book a title.").max(200),
  author: z.string().trim().max(120).optional(),
  isbn: z.string().trim().max(32).optional(), // barcode value (scanned or typed)
  category: z.string().trim().max(60).optional(),
  shelf: z.string().trim().max(20).optional(),
  copiesTotal: z.coerce.number().int().min(1, "At least 1 copy.").max(10000),
  fileUrl: z.string().trim().max(500).optional(), // digital copy (A.9)
  fileName: z.string().trim().max(200).optional(),
});
export type BookInput = z.infer<typeof bookSchema>;

// H.5 Teacher Book Borrowing: a borrower is a STUDENT (studentId) or STAFF
// (staffUserId). Exactly one must be provided.
export const issueSchema = z
  .object({
    bookId: z.string().min(1, "Pick the book."),
    studentId: z.string().min(1).optional(),
    staffUserId: z.string().min(1).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD."),
  })
  .refine((d) => !!d.studentId !== !!d.staffUserId, {
    message: "Pick exactly one borrower — a student or a staff member.",
    path: ["studentId"],
  });
export type IssueInput = z.infer<typeof issueSchema>;

export const returnSchema = z.object({
  issueId: z.string().min(1),
  /** Mark the computed fine as paid at the desk right now. */
  finePaid: z.boolean().optional(),
});
export type ReturnInput = z.infer<typeof returnSchema>;
