import { z } from "zod";
import { IMPORT_FIELDS } from "@/lib/validations/student-import";
import { BUNDI_DOMAINS } from "@/lib/validations/bundi-intelligent";

/**
 * PART M.5 / N.1 — Bundi Handwritten Import ("Bundi Intelligent").
 *
 * Kept in its own file, deliberately NOT reusing student-import's schemas
 * wholesale — this path has extra gates (unlock code, cost tracking) that the
 * standard CSV/Excel engine must never need or depend on.
 *
 * N.1 (2026-07-02): generalized from student-only to STUDENT | STAFF |
 * LIBRARY. `mapsTo` is now a plain string validated PER-DOMAIN in the
 * service layer (each domain has its own real field set), since a single
 * shared enum can't express three different real target field lists.
 */

// Real per-domain target fields a school's own column can map to — each set
// mirrors the exact field names each domain's own standard import engine
// already accepts, so the Bundi commit path is a byte-for-byte match.
export const STAFF_MAPPABLE_FIELDS = [
  "fullName", "role", "phone", "email", "tscNumber", "nationalId", "kraPin",
  "qualifications", "employmentDate", "contractType", "emergencyContact", "ignore",
] as const;
export const LIBRARY_MAPPABLE_FIELDS = [
  "title", "author", "isbn", "category", "shelf", "copiesTotal", "ignore",
] as const;

export function mappableFieldsForDomain(domain: string): readonly string[] {
  if (domain === "STAFF") return STAFF_MAPPABLE_FIELDS;
  if (domain === "LIBRARY") return LIBRARY_MAPPABLE_FIELDS;
  return IMPORT_FIELDS; // STUDENT (default)
}

/** Which of a domain's fields are genuinely numeric — feeds STAGE 3 of the
 * Bundi Intelligent pipeline (numeric OCR character fixes only ever apply to
 * fields the school itself has told Bundi are numeric, never free-text
 * names, where "O"/"I" are often correct letters). */
export function numericFieldsForDomain(domain: string): string[] {
  if (domain === "STAFF") return ["phone", "tscNumber", "nationalId", "kraPin"];
  if (domain === "LIBRARY") return ["isbn", "copiesTotal"];
  return ["admissionNo", "legacyAdmissionNo", "upiNumber", "birthCertNo", "guardianPhone"]; // STUDENT
}

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
// N.1 — mapsTo is validated as "at least a non-empty string" here; the REAL
// per-domain check (does this label actually exist for STUDENT/STAFF/
// LIBRARY) happens in the service layer via mappableFieldsForDomain(), since
// a single static zod enum cannot express three different domains' real
// field sets in one schema.
export const bundiFieldDescriptionSchema = z.object({
  label: z.string().trim().min(1, "Give this column a label.").max(60),
  description: z.string().trim().max(200).optional().default(""),
  mapsTo: z.string().trim().min(1).max(40).default("ignore"),
  customLabel: z.string().trim().max(60).optional(),
}).refine((v) => v.mapsTo !== "custom" || Boolean(v.customLabel), {
  message: "A custom field needs a label.",
  path: ["customLabel"],
});

export const saveFieldTemplateSchema = z.object({
  domain: z.enum(BUNDI_DOMAINS).default("STUDENT"),
  fields: z.array(bundiFieldDescriptionSchema).min(1).max(30),
});
export type SaveFieldTemplateInput = z.infer<typeof saveFieldTemplateSchema>;

// --- School: start a new import session (upload) -----------------------------
export const startImportSessionSchema = z.object({
  domain: z.enum(BUNDI_DOMAINS).default("STUDENT"),
  // Only the LEGACY provider path actually requires a real unlock code —
  // Bundi Intelligent (the default, open pipeline) needs none at all, per
  // the founder's explicit "should not require any code" instruction.
  // `startImportSession()` (legacy) itself throws a real, honest error if
  // this is blank; this schema must NOT force a min-length here, or the
  // open Bundi Intelligent path would be wrongly blocked at the API layer.
  unlockCode: z.string().trim().max(40).optional().default(""),
  storedFileId: z.string().trim().min(1), // id of the StoredFile already uploaded via /api/files/encrypted
  fileName: z.string().trim().min(1).max(200),
  pageCount: z.coerce.number().int().min(1).max(50).default(1),
  // The founder's "if one says this is grade one" requirement — real,
  // consumed context, not a decorative label. See BundiImportSession.contextNote.
  contextNote: z.string().trim().max(300).optional(),
});
export type StartImportSessionInput = z.infer<typeof startImportSessionSchema>;


// --- School: review/edit extracted rows before commit ------------------------
// N.1 — cells now carry real per-cell metadata (confidence + how the value
// was resolved) instead of a bare string, so the review UI can show the
// school exactly which fields Bundi is confident about vs which it guessed,
// and so `recordLearnedCorrection` has real (wrong, correct) pairs to learn
// from when a school edits a cell.
export const bundiExtractedCellSchema = z.object({
  value: z.string(),
  ocrConfidencePct: z.number().min(0).max(100).optional(),
  source: z.enum(["OCR", "RULE_FIXED", "TEMPLATE_KNOWN", "AI_CORRECTED", "MANUAL"]).default("OCR"),
});
export const bundiExtractedRowSchema = z.object({
  cells: z.record(z.string(), bundiExtractedCellSchema),
});
export type BundiExtractedRow = z.infer<typeof bundiExtractedRowSchema>;

export const reviewImportSessionSchema = z.object({
  rows: z.array(bundiExtractedRowSchema).max(1000),
});
export type ReviewImportSessionInput = z.infer<typeof reviewImportSessionSchema>;

// --- School: commit reviewed rows through the REAL standard import engine ---
export const commitBundiSessionSchema = z.object({
  targetClassId: z.string().trim().min(1).optional(), // STUDENT-only: same single-class-only mode as M.4
  seedRequirements: z.boolean().default(true), // STUDENT-only
  skipInvalid: z.boolean().default(true),
});
export type CommitBundiSessionInput = z.infer<typeof commitBundiSessionSchema>;
