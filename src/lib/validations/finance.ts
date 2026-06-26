/**
 * B.7 Finance — validation.
 * WHO: finance.manage_structure (bursar/leadership) for structures+batch;
 *      finance.create_invoice for manual invoices; finance.view to read.
 */
import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const feeStructureSchema = z.object({
  level: z.string().trim().min(2).max(40),
  classId: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  items: z.array(
    z.object({
      label: z.string().trim().min(2).max(60),
      amountKes: z.coerce.number().int().min(1).max(10_000_000),
    })
  ).min(1, "Add at least one fee item.").max(20),
});
export type FeeStructureInput = z.infer<typeof feeStructureSchema>;

export const batchInvoiceSchema = z.object({
  structureId: z.string().min(1),
  dueDate: dateYmd,
});

export const manualInvoiceSchema = z.object({
  studentId: z.string().min(1),
  description: z.string().trim().min(3).max(160),
  totalKes: z.coerce.number().int().min(1).max(10_000_000),
  dueDate: dateYmd,
  year: z.coerce.number().int().min(2000).max(2100),
  term: z.coerce.number().int().min(1).max(3),
});
export type ManualInvoiceInput = z.infer<typeof manualInvoiceSchema>;
