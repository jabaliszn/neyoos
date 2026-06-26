/**
 * Zod validation for Receptionist Operations (A.18).
 */
import { z } from "zod";
import { normalizeKePhone } from "@/lib/validations/auth";

/** Required KE phone — normalizes 07.. / +254.. / 254.. to +2547XXXXXXXX. */
export const kePhone = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .transform((val, ctx) => {
    const n = normalizeKePhone(val);
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid Kenyan phone, e.g. 0712 345 678",
      });
      return z.NEVER;
    }
    return n;
  });

/** Optional KE phone — empty string allowed, else must be valid. */
const kePhoneOptional = z
  .string()
  .trim()
  .optional()
  .transform((val, ctx) => {
    if (!val) return undefined;
    const n = normalizeKePhone(val);
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid Kenyan phone, e.g. 0712 345 678",
      });
      return z.NEVER;
    }
    return n;
  });

// A.18.5 — visitor sign-in
export const visitorSignInSchema = z.object({
  name: z.string().trim().min(2, "Enter the visitor's name.").max(80),
  phone: kePhoneOptional,
  idNumber: z.string().trim().max(20).optional(),
  purpose: z.string().trim().min(2, "What is the visit about?").max(120),
  host: z.string().trim().max(80).optional(),
});
export type VisitorSignInInput = z.infer<typeof visitorSignInSchema>;

// A.18.3 — walk-in payment (cash or already-paid M-Pesa, recorded manually)
export const walkInPaymentSchema = z.object({
  amount: z.coerce.number().int().min(1, "Enter the amount in KES.").max(10_000_000),
  phone: kePhone,
  method: z.enum(["cash", "mpesa", "bank"]).default("cash"),
  accountRef: z.string().trim().max(40).optional(), // adm no / invoice
  mpesaRef: z.string().trim().max(40).optional(), // when method=mpesa/bank slip ref
  description: z.string().trim().max(120).optional(),
});
export type WalkInPaymentInput = z.infer<typeof walkInPaymentSchema>;

// A.18.6 — admission inquiry capture
export const admissionInquirySchema = z.object({
  parentName: z.string().trim().min(2, "Enter the parent's name.").max(80),
  phone: kePhone,
  studentName: z.string().trim().max(80).optional(),
  gradeWanted: z.string().trim().max(30).optional(),
  curriculum: z.enum(["CBC", "8-4-4"]).optional(),
  notes: z.string().trim().max(300).optional(),
});
export type AdmissionInquiryInput = z.infer<typeof admissionInquirySchema>;

// A.18.7 — phone message relay to a staff member
export const phoneMessageSchema = z.object({
  callerName: z.string().trim().min(2, "Who called?").max(80),
  callerPhone: kePhoneOptional,
  forUserId: z.string().min(1, "Choose who the message is for."),
  message: z.string().trim().min(2, "Enter the message.").max(500),
});
export type PhoneMessageInput = z.infer<typeof phoneMessageSchema>;
