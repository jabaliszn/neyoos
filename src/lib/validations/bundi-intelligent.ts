import { z } from "zod";

/**
 * N.1 — "Bundi Intelligent" pipeline types.
 *
 * The founder's cost-cutting brief, translated into a real pipeline:
 *   Image -> Enhancement -> Local OCR -> Table/Field detection ->
 *   Deterministic rules/validation -> AI ONLY for genuinely low-confidence
 *   cells (batched, field-level, never whole-page) -> school review ->
 *   commit through the real standard engine.
 *
 * Every stage here is REAL and runs today at zero AI cost:
 *   - Image enhancement: sharp (already a dependency).
 *   - OCR + per-word confidence: tesseract.js (new, local, free, open-source).
 *   - Deterministic correction rules: OCR_CHARACTER_FIXES + phone/date rules.
 *   - Validation-against-school-data: real class list / subject list lookups.
 *   - Learned corrections: BundiLearnedCorrection (per-tenant, real DB rows).
 *   - Template memoization: BundiDocumentTemplate (real DB rows).
 * Only the LAST stage (AI escalation for the fields still uncertain after
 * all of the above) requires a configured provider — and it is field-level
 * and batched, never a whole-page/whole-document call.
 */

/** The domains Bundi Intelligent currently supports (extendable). */
export const BUNDI_DOMAINS = ["STUDENT", "STAFF", "LIBRARY"] as const;
export type BundiDomain = (typeof BUNDI_DOMAINS)[number];

/** Confidence thresholds — deliberately NOT hidden inside a function; a
 * founder/Ops setting that trades off cost vs accuracy, so it can be tuned
 * without code changes. Below LOW_CONFIDENCE_PCT, a cell is escalated to AI.
 * Below MIN_ROUTABLE_PCT is treated the same as "no OCR result" (OCR
 * confidence that low is not worth trusting even as an AI hint). */
export const BUNDI_CONFIDENCE = {
  HIGH_CONFIDENCE_PCT: 90, // >= this: trust OCR output directly, zero AI
  LOW_CONFIDENCE_PCT: 75, // < this: escalate the cell to AI (batched)
} as const;

const bundiBboxSchema = z.object({
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
});

/** One extracted cell with its real OCR confidence and correction lineage.
 * `bbox` (when present) is the real union bounding box of the OCR words
 * that produced this cell — used ONLY to crop the source image for a
 * targeted, field-level AI re-read (never a whole-page AI call). */
export const bundiCellSchema = z.object({
  value: z.string(),
  ocrConfidencePct: z.number().min(0).max(100).optional(),
  source: z.enum(["OCR", "RULE_FIXED", "TEMPLATE_KNOWN", "AI_CORRECTED", "MANUAL"]).default("OCR"),
  bbox: bundiBboxSchema.optional(),
});
export type BundiCell = z.infer<typeof bundiCellSchema>;

export const bundiIntelligentRowSchema = z.object({
  cells: z.record(z.string(), bundiCellSchema),
});
export type BundiIntelligentRow = z.infer<typeof bundiIntelligentRowSchema>;

/** Real, itemized pipeline stats returned after extraction — never fabricated. */
export interface BundiPipelineStats {
  fieldsTotal: number;
  fieldsHighConfidence: number; // resolved by OCR alone, zero cost
  fieldsRuleFixed: number; // resolved by deterministic correction rules, zero cost
  fieldsTemplateKnown: number; // resolved by a memoized document template, zero cost
  fieldsAiEscalated: number; // genuinely sent to AI
  aiCallsMade: number; // real count of Vision HTTP requests actually issued (the true cost driver — a call still costs money even if it fails or finds nothing clearer)
  ocrConfidenceAvgPct: number;
  aiInvoked: boolean;
  templateMatchId: string | null;
}

/** Start a Bundi Intelligent session — same shape as the existing
 * startImportSessionSchema but domain + context aware. */
export const startBundiIntelligentSessionSchema = z.object({
  domain: z.enum(BUNDI_DOMAINS).default("STUDENT"),
  unlockCode: z.string().trim().min(4).max(40),
  storedFileId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(200),
  pageCount: z.coerce.number().int().min(1).max(50).default(1),
  // The founder's "if one says this is grade one" requirement — free-text
  // context the school provides BEFORE extraction, used as a real filter
  // signal in the rules stage (e.g. narrows valid class-name matches).
  contextNote: z.string().trim().max(300).optional(),
});
export type StartBundiIntelligentSessionInput = z.infer<typeof startBundiIntelligentSessionSchema>;
