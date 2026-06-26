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
