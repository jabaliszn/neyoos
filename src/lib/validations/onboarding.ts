import { z } from "zod";
import { tenantSlugSchema } from "@/lib/validations/tenant";
import { setPasswordSchema, normalizeKePhone } from "@/lib/validations/auth";
import { MODULE_KEYS } from "@/lib/core/modules";
import { OS_KEYS } from "@/lib/core/operating-systems";

/** Full school signup (G.3). Creates tenant + first SCHOOL_OWNER user. */
export const signupSchema = z.object({
  // Operating system + tenant
  osKey: z.enum(OS_KEYS).default("school"),
  // School / organisation
  schoolName: z.string().trim().min(2, "Enter the school or organisation name").max(120),
  slug: tenantSlugSchema,
  county: z.string().trim().max(60).optional(),
  curriculum: z.enum(["CBC", "8-4-4", "BOTH"]),
  // Optional modules to enable beyond defaults
  modules: z.array(z.enum(MODULE_KEYS as [string, ...string[]])).optional(),
  // Owner account
  ownerName: z.string().trim().min(2, "Enter your name").max(120),
  ownerEmail: z.string().trim().email("Enter a valid email").toLowerCase(),
  ownerPhone: z
    .string()
    .trim()
    .min(1, "Enter your phone")
    .transform((v, ctx) => {
      const n = normalizeKePhone(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Kenyan phone" });
        return z.NEVER;
      }
      return n;
    }),
  password: setPasswordSchema.shape.password,
  // Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06):
  // "they get their price in their first launch so that they know the
  // amount of money they would pay" — real declared numbers collected at
  // signup, feeding the real pricing engine immediately. All optional so a
  // school that genuinely doesn't know yet can still sign up; the pricing
  // engine falls back to 0 (which simply means "no size-based charge yet"
  // until a school completes this step) rather than blocking signup.
  expectedStudentCount: z.coerce.number().int().min(0).max(50000).optional(),
  expectedStaffCount: z.coerce.number().int().min(0).max(5000).optional(),
  expectedParentCount: z.coerce.number().int().min(0).max(100000).optional(),
});

/** Invite staff during onboarding (or later). */
export const inviteSchema = z.object({
  invites: z
    .array(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().toLowerCase(),
        role: z.string().min(1),
      })
    )
    .max(50),
});

export type SignupInput = z.infer<typeof signupSchema>;
