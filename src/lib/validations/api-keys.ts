/**
 * Zod validation for the Public API & Webhooks feature (A.16).
 * Chunk 2 of A.16: input contracts for API keys + webhook subscriptions.
 */
import { z } from "zod";
import { PERMISSIONS } from "@/lib/core/permissions";

// Scopes an API key may hold = the same fine-grained permissions the platform
// uses, plus a "*" wildcard for "everything this key's tenant can do".
const scopeEnum = z.enum(["*", ...PERMISSIONS] as [string, ...string[]]);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, "Give the key a name.").max(60),
  // Optional list of scopes; defaults to read-only-ish on the service side.
  scopes: z.array(scopeEnum).min(1, "Pick at least one scope.").max(40).default(["*"]),
  // Optional expiry in days (1..365). Omit for a non-expiring key.
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// A small allow-list of webhook event names. Product modules (B+) will add to
// this; for Module A we expose the platform events that already exist.
export const WEBHOOK_EVENTS = [
  "payment.recorded",
  "payment.failed",
  "subscription.updated",
  "user.created",
  "notification.sent",
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
