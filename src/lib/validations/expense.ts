/**
 * B.25 — Expenses Tracking validation.
 * Categories + cost centers are the reporting dimensions; an Expense is a spend
 * with a threshold approval state-machine and an optional receipt photo (A.9).
 * OCR auto-extract from the receipt is Bundi-gated (deferred) — manual entry is
 * fully functional without it.
 */
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const costCenterSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const expenseSchema = z.object({
  categoryId: z.string().min(1),
  costCenterId: z.string().min(1).optional().or(z.literal("")),
  payee: z.string().trim().min(2).max(120),
  amountKes: z.coerce.number().int().min(1).max(100_000_000),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  receiptFileUrl: z.string().trim().max(500).optional().or(z.literal("")),
  receiptFileName: z.string().trim().max(200).optional().or(z.literal("")),
});

export const rejectSchema = z.object({
  expenseId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
});

export const reportQuerySchema = z.object({
  // YYYY-MM (Nairobi). Defaults to current month in the service when omitted.
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/** One-click KE starter dimensions (offered on the empty state, like B.6/B.18 presets). */
export const EXPENSE_CATEGORY_PRESETS = [
  "Utilities (water, power, internet)",
  "Repairs & Maintenance",
  "Cleaning & Sanitation",
  "Stationery & Printing",
  "Food & Kitchen",
  "Transport & Fuel",
  "Staff Welfare",
  "Examinations (KNEC/KICD)",
  "Licenses & Statutory",
  "Other",
] as const;

export const COST_CENTER_PRESETS = [
  "Whole school",
  "Administration",
  "Academics",
  "Boarding",
  "Kitchen",
  "Transport",
  "Co-curricular",
] as const;
