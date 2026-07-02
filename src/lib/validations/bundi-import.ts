import { z } from "zod";
import { IMPORT_FIELDS } from "@/lib/validations/student-import";

/**
 * PART M.5 — Bundi Handwritten Import (founder-controlled premium import path).
 *
 * Kept in its own file, deliberately NOT reusing student-import's schemas
 * wholesale — this path has extra gates (unlock code, cost tracking) that the
 * standard CSV/Excel engine must never need or depend on.
 */

export const BUNDI_PROVIDER_SETTING_KEY = "neyo_bundi_provider_config";

// --- NEYO Ops: provider + cost configuration -------------------------------
// Mirrors the M.2 SMS-margin pattern: NEYO Ops centrally configures the
// provider and the USD->KES conversion so cost visibility is always accurate,
// never hardcoded. No API key lives here — that's a company secret (same
// vault as Africa's Talking/WhatsApp/Daraja), only non-secret config does.
export const bundiProviderConfigSchema = z.object({
  enabled: z.boolean().default(false), // master switch — OFF until a real provider key exists
  provider: z.enum(["NONE", "OPENAI_VISION", "GOOGLE_VISION", "ANTHROPIC_VISION"]).default("NONE"),
  model: z.string().trim().max(60).default(""),
  usdToKes: z.coerce.number().min(50).max(500).default(130),
  maxPagesPerSession: z.coerce.number().int().min(1).max(50).default(10),
  notes: z.string().trim().max(400).optional().default(
    "Provider must be configured with a real company secret before any session can extract rows. Never fake extraction output."
  ),
});
export type BundiProviderConfig = z.infer<typeof bundiProviderConfigSchema>;

export function defaultBundiProviderConfig(): BundiProviderConfig {
  return bundiProviderConfigSchema.parse({});
}

// --- NEYO Ops: unlock code minting ------------------------------------------
export const mintUnlockCodeSchema = z.object({
  tenantId: z.string().trim().min(1).optional(), // omit = a company-wide code (rare)
  // Omitted -> defaults to 1 (the founder's chosen default model: one-time,
  // per-session codes). Explicit `null` -> unlimited (standing approval),
  // an intentional opt-in NEYO Ops must ask for, never an accidental default.
  maxUses: z.union([z.coerce.number().int().min(1).max(1000), z.null()]).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  note: z.string().trim().max(300).optional(),
});
export type MintUnlockCodeInput = z.infer<typeof mintUnlockCodeSchema>;

export const revokeUnlockCodeSchema = z.object({
  codeId: z.string().trim().min(1),
});

// --- School: redeem a code to start/continue access -------------------------
export const redeemUnlockCodeSchema = z.object({
  code: z.string().trim().min(4).max(40),
});

// --- School: describe their own register fields before any AI mapping -------
export const bundiFieldDescriptionSchema = z.object({
  label: z.string().trim().min(1, "Give this column a label.").max(60),
  description: z.string().trim().max(200).optional().default(""),
  // maps to a real IMPORT_FIELD (same fixed set the standard engine uses) OR
  // "custom" (goes to a StudentCustomField, exactly like M.4) OR "ignore".
  mapsTo: z.enum([...IMPORT_FIELDS] as [string, ...string[]]).default("ignore"),
  customLabel: z.string().trim().max(60).optional(),
}).refine((v) => v.mapsTo !== "custom" || Boolean(v.customLabel), {
  message: "A custom field needs a label.",
  path: ["customLabel"],
});

export const saveFieldTemplateSchema = z.object({
  fields: z.array(bundiFieldDescriptionSchema).min(1).max(30),
});
export type SaveFieldTemplateInput = z.infer<typeof saveFieldTemplateSchema>;

// --- School: start a new import session (upload) -----------------------------
export const startImportSessionSchema = z.object({
  unlockCode: z.string().trim().min(4).max(40),
  storedFileId: z.string().trim().min(1), // id of the StoredFile already uploaded via /api/files/encrypted
  fileName: z.string().trim().min(1).max(200),
  pageCount: z.coerce.number().int().min(1).max(50).default(1),
});
export type StartImportSessionInput = z.infer<typeof startImportSessionSchema>;

// --- School: review/edit extracted rows before commit ------------------------
export const bundiExtractedRowSchema = z.object({
  cells: z.record(z.string(), z.string()), // { columnLabel: cellValue } as extracted/edited
  confidence: z.number().min(0).max(1).optional(),
});
export type BundiExtractedRow = z.infer<typeof bundiExtractedRowSchema>;

export const reviewImportSessionSchema = z.object({
  rows: z.array(bundiExtractedRowSchema).max(1000),
});
export type ReviewImportSessionInput = z.infer<typeof reviewImportSessionSchema>;

// --- School: commit reviewed rows through the REAL standard import engine ---
export const commitBundiSessionSchema = z.object({
  targetClassId: z.string().trim().min(1).optional(), // same single-class-only mode as M.4
  seedRequirements: z.boolean().default(true),
  skipInvalid: z.boolean().default(true),
});
export type CommitBundiSessionInput = z.infer<typeof commitBundiSessionSchema>;
