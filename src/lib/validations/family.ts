/**
 * G.12 — Sibling Intelligence validation.
 * Siblings = students sharing a Guardian (no new model needed). The bursar can
 * apply a sibling discount to a specific invoice; pct defaults to the tenant's
 * Tenant.siblingDiscountPct but can be overridden per application.
 */
import { z } from "zod";

export const familyQuerySchema = z.object({
  studentId: z.string().min(1),
});

export const siblingDiscountSchema = z.object({
  invoiceId: z.string().min(1),
  // Optional override; when omitted the service uses Tenant.siblingDiscountPct.
  pct: z.coerce.number().int().min(1).max(100).optional(),
  // R.3 — real single-use server ticket, required only if the school has
  // turned on requireBiometricForFinance (see applyDiscount()).
  biometricTicket: z.string().trim().max(80).optional(),
});

export type SiblingDiscountInput = z.infer<typeof siblingDiscountSchema>;
