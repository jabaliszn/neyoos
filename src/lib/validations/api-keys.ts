/**
 * Zod validation for the Public API & Webhooks feature (A.16), extended by
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06): a real key
 * TIER (a school's own key vs. a NEYO-issued Partner key for NEYO's own
 * future first-party accessories), a real sandbox/live ENVIRONMENT, and a
 * much wider real webhook event catalogue matching what NEYO's own
 * services actually emit today.
 */
import { z } from "zod";
import { PERMISSIONS } from "@/lib/core/permissions";

// Scopes an API key may hold = the same fine-grained permissions the platform
// uses, plus a "*" wildcard for "everything this key's tenant can do".
const scopeEnum = z.enum(["*", ...PERMISSIONS] as [string, ...string[]]);

/** Founder-resolved (Part X): a NEYO Partner key is the SAME real
 * ApiKey/auth/rate-limit mechanism as a school's own key — just a more
 * privileged, explicitly NEYO-vetted tier, issuable only by SUPER_ADMIN via
 * NEYO Ops, never self-service from a school's own Settings page. */
export const API_KEY_TIERS = ["SCHOOL", "NEYO_PARTNER"] as const;
export type ApiKeyTier = (typeof API_KEY_TIERS)[number];

export const API_KEY_ENVIRONMENTS = ["live", "sandbox"] as const;
export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[number];

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, "Give the key a name.").max(60),
  // Optional list of scopes; defaults to read-only-ish on the service side.
  scopes: z.array(scopeEnum).min(1, "Pick at least one scope.").max(40).default(["*"]),
  // Optional expiry in days (1..365). Omit for a non-expiring key.
  expiresInDays: z.number().int().min(1).max(365).optional(),
  // A school self-issuing its own key from Settings → Developer can only
  // ever create a "live" key against its own real data — sandbox keys are
  // a real, deliberate, separately-issued thing (see createSandboxApiKeySchema).
  environment: z.enum(API_KEY_ENVIRONMENTS).default("live"),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/** SUPER_ADMIN-only, NEYO Ops issuance of a real NEYO Partner key — for
 * NEYO's own future first-party accessories (a NEYO-built fingerprint
 * device, ID-card printer, etc.), scoped to one real school's tenant. */
export const createPartnerApiKeySchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(2, "Give the key a name.").max(60),
  scopes: z.array(scopeEnum).min(1, "Pick at least one scope.").max(40),
  expiresInDays: z.number().int().min(1).max(730).optional(),
});
export type CreatePartnerApiKeyInput = z.infer<typeof createPartnerApiKeySchema>;

// The real, live webhook event catalogue — every event a real NEYO service
// genuinely fires today (Part X wires `dispatchEvent()` into each of the
// real call sites below; this list is deliberately kept in lockstep with
// what's ACTUALLY emitted, never an aspirational list of events nothing
// sends). Product modules may extend this over time as more real call
// sites are wired.
export const WEBHOOK_EVENTS = [
  "payment.recorded",
  "payment.failed",
  "subscription.updated",
  "user.created",
  "notification.sent",
  "student.created",
  "student.admitted",
  "invoice.created",
  "invoice.paid",
  "attendance.recorded",
  "exam.published",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const eventEnum = z.enum(["*", ...WEBHOOK_EVENTS] as [string, ...string[]]);

export const createWebhookSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), {
      message: "Webhook URLs must use HTTPS (localhost allowed for testing).",
    }),
  events: z.array(eventEnum).min(1, "Choose at least one event.").max(20).default(["*"]),
  description: z.string().trim().max(120).optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  active: z.boolean().optional(),
  events: z.array(eventEnum).min(1).max(20).optional(),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"))
    .optional(),
  description: z.string().trim().max(120).optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
