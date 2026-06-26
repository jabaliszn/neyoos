import { z } from "zod";

/**
 * NEYO Auth validation (Feature A.1).
 * Single source of truth for phone-OTP login rules — used by the API (Chunk 4)
 * and the login form (Chunk 6).
 */

/**
 * Normalize any Kenyan phone input to canonical E.164: +254XXXXXXXXX
 * Accepts:  0712345678 | 712345678 | 254712345678 | +254 712 345 678 | etc.
 * Returns null if it is not a valid KE mobile number (07.. or 01.. ranges).
 */
export function normalizeKePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");

  let local: string | null = null;
  if (digits.length === 12 && digits.startsWith("254")) local = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 9) local = digits; // already without leading 0

  if (!local) return null;

  // KE mobile prefixes start with 7 (Safaricom/Airtel) or 1 (Airtel/Telkom new range)
  if (!/^[17]\d{8}$/.test(local)) return null;

  return `+254${local}`;
}

/** Step 1 — request an OTP. We validate + normalize the phone here. */
export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number")
    .transform((val, ctx) => {
      const normalized = normalizeKePhone(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid Kenyan phone number, e.g. 0712 345 678",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

/** Step 2 — verify the 6-digit code for a phone. */
export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is missing")
    .transform((val, ctx) => {
      const normalized = normalizeKePhone(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number is not valid",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

// TypeScript types inferred from the schemas (zero duplication).
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** Email + password backup login (A.1). */
export const loginEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address")
    .toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Setting/changing a password — enforces a sensible strength policy.
 * (Used by the seed and, later, by account settings.)
 */
export const setPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[a-z]/, "Add at least one lowercase letter")
    .regex(/[A-Z]/, "Add at least one uppercase letter")
    .regex(/\d/, "Add at least one number"),
});

export type LoginEmailInput = z.infer<typeof loginEmailSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/** Magic link request — just a valid email (A.1). */
export const requestMagicLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address")
    .toLowerCase(),
});

export type RequestMagicLinkInput = z.infer<typeof requestMagicLinkSchema>;

/** Verify a 2FA token — a 6-digit TOTP OR an 8-char recovery code (A.1). */
export const verifyTotpSchema = z.object({
  token: z
    .string()
    .trim()
    .min(6, "Enter your 6-digit code")
    .max(14, "Code is too long"),
});

export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

/** WebAuthn passkey payloads (A.1). The response object comes from the browser
 *  library; we validate the wrapper fields and pass the response through. */
export const passkeyRegisterVerifySchema = z.object({
  response: z.any(),
  deviceLabel: z.string().trim().max(60).optional(),
});

export const passkeyLoginOptionsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address")
    .toLowerCase(),
});

export const passkeyLoginVerifySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1)
    .email()
    .toLowerCase(),
  response: z.any(),
});

export type PasskeyLoginOptionsInput = z.infer<typeof passkeyLoginOptionsSchema>;
