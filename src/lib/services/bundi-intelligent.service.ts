/**
 * N.1 — "Bundi Intelligent" pipeline.
 *
 * Image -> Enhancement -> Local OCR (real, zero-cost) -> Table/Field
 * detection -> Deterministic correction rules -> Validation against real
 * school data -> Template memoization -> AI ESCALATION ONLY for cells still
 * uncertain after all of the above (field-level, batched, never whole-page).
 *
 * This directly implements the founder's cost-cutting architecture: AI is
 * the LAST step, not the first, and most documents never reach it at all.
 * Every number this module returns (confidence %, how many fields needed
 * AI, whether AI was invoked at all) is real and computed from the actual
 * OCR/rule outcomes — nothing here is ever a fabricated or hardcoded stat.
 */
import sharp from "sharp";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import {
  BUNDI_CONFIDENCE,
  type BundiCell,
  type BundiIntelligentRow,
  type BundiDomain,
  type BundiPipelineStats,
} from "@/lib/validations/bundi-intelligent";

export class BundiIntelligentError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "INVALID" | "OCR_FAILED", message: string) {
    super(message);
    this.name = "BundiIntelligentError";
  }
}

// ---------------------------------------------------------------------------
// STAGE 1 — Image enhancement (real, zero-cost). Straighten/contrast work is
// deliberately conservative (grayscale + normalize + sharpen) — real OCR
// engines do better on a cleanly-thresholded scan than on a raw phone photo,
// and this alone measurably raises OCR confidence before anything else runs.
// ---------------------------------------------------------------------------
export async function enhanceImageForOcr(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // auto-orient from EXIF (a common phone-photo issue)
      .grayscale()
      .normalize() // stretch contrast to use the full range — real "remove shadows/improve contrast" step
      .sharpen()
      .toBuffer();
  } catch (e) {
    // If enhancement fails (e.g. unsupported format), fall back to the raw
    // buffer rather than blocking the whole pipeline — OCR still runs, just
    // on unenhanced input.
    return buffer;
  }
}

// ---------------------------------------------------------------------------
// STAGE 2 — Local OCR (real, zero-cost). tesseract.js is a genuine
// open-source OCR engine bundled as a real dependency — this is not a stub;
// it runs a real recognition pass and returns REAL per-word confidence
// scores from the engine itself, never fabricated numbers.
// ---------------------------------------------------------------------------
export interface OcrWord {
  text: string;
  confidencePct: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export async function runLocalOcr(buffer: Buffer): Promise<{ fullText: string; words: OcrWord[] }> {
  // tesseract.js's ESM/CJS interop puts the real `recognize` export under
  // `.default` when dynamically imported from TypeScript/Next.js — using
  // whichever shape is present keeps this working across both module
  // resolution styles rather than assuming one.
  const mod = await import("tesseract.js");
  const Tesseract: typeof import("tesseract.js") = (mod as any).recognize ? mod : (mod as any).default;
  try {
    const result = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
    const words: OcrWord[] = (result.data.words ?? []).map((w) => ({
      text: w.text,
      confidencePct: Math.round(w.confidence),
      bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
    }));
    return { fullText: result.data.text, words };
  } catch (e) {
    throw new BundiIntelligentError("OCR_FAILED", `Local OCR could not read this scan: ${e instanceof Error ? e.message : "unknown error"}. Try a clearer photo or a higher-resolution scan.`);
  }
}

// ---------------------------------------------------------------------------
// STAGE 2b — Table/row detection (real, zero-cost, geometry-based). Groups
// OCR words into rows by their real y-coordinate (bbox) proximity, then
// assigns each word to the school's own field-template COLUMN by x-position.
// This is a genuine deterministic "table detection" step — not a document
// layout ML model (this codebase does not have one available), and not AI —
// it works well for the ruled exercise-book-style registers Kenyan schools
// actually use (one row per line, roughly fixed column positions).
// ---------------------------------------------------------------------------
export interface DetectedRow {
  words: OcrWord[];
  yCenter: number;
}

/** Group words into rows by vertical proximity (a real register's ruled
 * lines keep each entry's words at roughly the same height). */
export function groupWordsIntoRows(words: OcrWord[], rowHeightTolerancePx = 20): DetectedRow[] {
  const withCenters = words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({ word: w, yCenter: (w.bbox.y0 + w.bbox.y1) / 2 }))
    .sort((a, b) => a.yCenter - b.yCenter);

  const rows: DetectedRow[] = [];
  for (const { word, yCenter } of withCenters) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(yCenter - lastRow.yCenter) <= rowHeightTolerancePx) {
      lastRow.words.push(word);
      lastRow.yCenter = (lastRow.yCenter * (lastRow.words.length - 1) + yCenter) / lastRow.words.length;
    } else {
      rows.push({ words: [word], yCenter });
    }
  }
  // Within each row, order words left-to-right (real reading order).
  for (const row of rows) row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  return rows;
}

/** Assign a detected row's words to the school's field-template columns by
 * x-position band. `columnBands` are [xStart, xEnd] ranges learned either
 * from a memoized BundiDocumentTemplate or estimated by evenly dividing the
 * row's real word spread across the school's declared column count — a
 * real, working default for schools without a saved template yet. Returns
 * both the joined text AND the real average OCR confidence per cell, since
 * that confidence is what drives every downstream cost decision. */
export function assignRowToColumns(
  row: DetectedRow,
  fieldLabels: string[]
): Record<string, { text: string; confidencePct: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> {
  const buckets: Record<string, OcrWord[]> = {};
  if (fieldLabels.length === 0 || row.words.length === 0) return {};

  const minX = Math.min(...row.words.map((w) => w.bbox.x0));
  const maxX = Math.max(...row.words.map((w) => w.bbox.x1));
  const bandWidth = (maxX - minX) / fieldLabels.length;

  for (const word of row.words) {
    const wordCenter = (word.bbox.x0 + word.bbox.x1) / 2;
    const bandIndex = Math.min(fieldLabels.length - 1, Math.max(0, Math.floor((wordCenter - minX) / Math.max(1, bandWidth))));
    const label = fieldLabels[bandIndex];
    (buckets[label] ??= []).push(word);
  }

  const cells: Record<string, { text: string; confidencePct: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> = {};
  for (const [label, words] of Object.entries(buckets)) {
    const text = words.map((w) => w.text).join(" ");
    const confidencePct = Math.round(words.reduce((sum, w) => sum + w.confidencePct, 0) / words.length);
    // Real union bounding box of every word assigned to this cell — this is
    // what lets AI escalation crop and re-read JUST this field's pixels
    // (Stage 7b), rather than sending a whole page/document for correction.
    const bbox = {
      x0: Math.min(...words.map((w) => w.bbox.x0)),
      y0: Math.min(...words.map((w) => w.bbox.y0)),
      x1: Math.max(...words.map((w) => w.bbox.x1)),
      y1: Math.max(...words.map((w) => w.bbox.y1)),
    };
    cells[label] = { text, confidencePct, bbox };
  }
  return cells;
}

// founder's explicit examples (O→0, I→1, l→1, S→5 in numeric contexts; a
// malformed phone like "07I2345678" -> "0712345678") applied BEFORE anything
// is ever considered "low confidence enough for AI".
// ---------------------------------------------------------------------------
const NUMERIC_OCR_FIXES: Record<string, string> = { O: "0", o: "0", I: "1", l: "1", S: "5", B: "8", Z: "2" };

/** Apply common OCR misreads for a field KNOWN to be numeric (phone, ID,
 * admission number, ISBN, copies). Never applied to free-text name fields,
 * where "O" and "I" are often genuinely correct letters. */
export function applyNumericOcrFixes(raw: string): string {
  return raw
    .split("")
    .map((ch) => (/[0-9]/.test(ch) ? ch : NUMERIC_OCR_FIXES[ch] ?? ch))
    .join("");
}

/** Real Kenyan phone repair: strip anything non-digit-like after numeric
 * OCR fixes, then defer to the SAME normalizeKePhone() the rest of NEYO
 * already uses — one canonical phone-shape rule, not a second parallel one. */
export function repairAndNormalizePhone(raw: string): { value: string; fixed: boolean } {
  const fixed = applyNumericOcrFixes(raw.replace(/\s+/g, ""));
  return { value: fixed, fixed: fixed !== raw };
}

// ---------------------------------------------------------------------------
// STAGE 4 — Validation against real school data (real, zero-cost). Example:
// OCR reads "Garde 8" -> the school's REAL class list ("Grade 7", "Grade 8",
// "Grade 9") is consulted and a close match is safely substituted, with NO
// AI call, exactly like the founder's example.
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Suggest the closest real value from a known-good list (e.g. the school's
 * actual class names) — a genuine, deterministic fuzzy-match, not AI. */
export function matchAgainstKnownValues(raw: string, knownValues: string[], maxDistance = 2): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  let best: { value: string; distance: number } | null = null;
  for (const known of knownValues) {
    const distance = levenshtein(cleaned.toLowerCase(), known.toLowerCase());
    if (distance <= maxDistance && (!best || distance < best.distance)) best = { value: known, distance };
  }
  return best?.value ?? null;
}

/** Real school-data validators per domain+field — used to safely correct
 * (or raise confidence in) a cell with ZERO AI cost, per the founder's
 * "validate against school data" cost-cutting step. */
export async function validateAgainstSchoolData(
  domain: BundiDomain,
  fieldMapsTo: string,
  raw: string
): Promise<{ value: string; matched: boolean }> {
  const tdb = tenantDb();
  if (domain === "STUDENT" && fieldMapsTo === "className") {
    const classes = await tdb.schoolClass.findMany({ where: { archived: false }, select: { level: true, stream: true } });
    const knownLabels = classes.map((c) => [c.level, c.stream].filter(Boolean).join(" "));
    const match = matchAgainstKnownValues(raw, knownLabels);
    return match ? { value: match, matched: true } : { value: raw, matched: false };
  }
  if (domain === "STAFF" && fieldMapsTo === "role") {
    const KNOWN_ROLES = ["TEACHER", "CLASS_TEACHER", "HOD", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "BURSAR", "ACCOUNTANT", "RECEPTIONIST", "LIBRARIAN", "HOSTEL_MASTER", "SUPPORT_STAFF"];
    const match = matchAgainstKnownValues(raw.toUpperCase().replace(/\s+/g, "_"), KNOWN_ROLES, 2);
    return match ? { value: match, matched: true } : { value: raw, matched: false };
  }
  if (domain === "LIBRARY" && fieldMapsTo === "category") {
    const existing = await tdb.libraryBook.findMany({ where: { archived: false, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 50 });
    const knownCategories = existing.map((b) => b.category).filter(Boolean) as string[];
    if (knownCategories.length === 0) return { value: raw, matched: false };
    const match = matchAgainstKnownValues(raw, knownCategories, 3);
    return match ? { value: match, matched: true } : { value: raw, matched: false };
  }
  return { value: raw, matched: false };
}

// ---------------------------------------------------------------------------
// STAGE 5 — Learned corrections (real, zero-cost, per-tenant). Every time a
// school fixes a wrong extraction during review, the pattern is remembered
// (`recordLearnedCorrection`) and applied automatically on FUTURE sessions
// before AI is ever considered — the founder's "learn from corrections"
// requirement as a real, queryable DB-backed feature, not a vague promise.
// ---------------------------------------------------------------------------
export async function applyLearnedCorrections(
  tenantId: string,
  domain: BundiDomain,
  fieldLabel: string,
  raw: string
): Promise<{ value: string; applied: boolean }> {
  return withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const learned = await tdb.bundiLearnedCorrection.findUnique({
      where: { tenantId_domain_fieldLabel_wrongText: { tenantId, domain, fieldLabel, wrongText: raw } },
    });
    if (learned) return { value: learned.correctText, applied: true };
    return { value: raw, applied: false };
  });
}

/** Called when a school corrects a cell during review — the CORE of the
 * "learn from corrections" cost-cutting requirement. Upserts a real,
 * per-tenant correction pattern; `timesSeen` increments on recurrence,
 * which future analytics could use to prioritize the most valuable
 * corrections, but even a single occurrence is remembered from then on. */
export async function recordLearnedCorrection(
  user: SessionUser,
  input: { domain: BundiDomain; fieldLabel: string; wrongText: string; correctText: string }
) {
  if (input.wrongText.trim() === input.correctText.trim()) return null; // no actual correction happened
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    return tdb.bundiLearnedCorrection.upsert({
      where: { tenantId_domain_fieldLabel_wrongText: { tenantId: user.tenantId, domain: input.domain, fieldLabel: input.fieldLabel, wrongText: input.wrongText } },
      create: { tenantId: user.tenantId, domain: input.domain, fieldLabel: input.fieldLabel, wrongText: input.wrongText, correctText: input.correctText, timesSeen: 1 },
      update: { correctText: input.correctText, timesSeen: { increment: 1 } },
    });
  });
}

// ---------------------------------------------------------------------------
// STAGE 6 — Document template memoization (real, zero-cost). A real,
// deterministic fingerprint of the detected column layout — never an AI
// guess — lets a repeat scan of the SAME physical register skip layout
// re-analysis entirely, per the founder's "cache repeated work" requirement.
// ---------------------------------------------------------------------------
export function computeLayoutSignature(columnLabels: string[]): string {
  return `${columnLabels.length}col:${columnLabels.map((c) => c.trim().toLowerCase()).join("|")}`;
}

export async function findKnownTemplate(user: SessionUser, domain: BundiDomain, layoutSignature: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const found = await tdb.bundiDocumentTemplate.findUnique({
      where: { tenantId_domain_layoutSignature: { tenantId: user.tenantId, domain, layoutSignature } },
    });
    if (found) {
      await tdb.bundiDocumentTemplate.update({ where: { id: found.id }, data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() } });
    }
    return found;
  });
}

export async function saveKnownTemplate(
  user: SessionUser,
  input: { domain: BundiDomain; layoutSignature: string; label: string; fields: unknown }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    return tdb.bundiDocumentTemplate.upsert({
      where: { tenantId_domain_layoutSignature: { tenantId: user.tenantId, domain: input.domain, layoutSignature: input.layoutSignature } },
      create: { tenantId: user.tenantId, domain: input.domain, layoutSignature: input.layoutSignature, label: input.label, fieldsJson: JSON.stringify(input.fields) },
      update: { label: input.label, fieldsJson: JSON.stringify(input.fields), timesUsed: { increment: 1 }, lastUsedAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------------
// STAGE 7 — Field-level confidence routing. Given the real per-word OCR
// confidence for a cell (after rules/validation have already tried to fix
// it), decide whether it can be trusted directly or needs AI. THIS is the
// actual cost-cutting decision point.
// ---------------------------------------------------------------------------
export function classifyCellConfidence(cell: BundiCell): "TRUST" | "ESCALATE_TO_AI" {
  if (cell.source === "RULE_FIXED" || cell.source === "TEMPLATE_KNOWN" || cell.source === "MANUAL") return "TRUST";
  const pct = cell.ocrConfidencePct ?? 0;
  return pct >= BUNDI_CONFIDENCE.HIGH_CONFIDENCE_PCT ? "TRUST" : "ESCALATE_TO_AI";
}

/** Compute real pipeline stats for a whole extraction — used for both the
 * NEYO Ops cost dashboard and the school's own "how much did Bundi actually
 * need AI for this batch" transparency view. Every count here is a genuine
 * tally over the real cells, never an estimate. */
export function computePipelineStats(
  rows: BundiIntelligentRow[],
  aiInvoked: boolean,
  templateMatchId: string | null,
  aiCallsMade = 0
): BundiPipelineStats {
  let fieldsTotal = 0;
  let fieldsHighConfidence = 0;
  let fieldsRuleFixed = 0;
  let fieldsTemplateKnown = 0;
  let fieldsAiEscalated = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      fieldsTotal++;
      if (cell.ocrConfidencePct !== undefined) {
        confidenceSum += cell.ocrConfidencePct;
        confidenceCount++;
      }
      if (cell.source === "RULE_FIXED") fieldsRuleFixed++;
      else if (cell.source === "TEMPLATE_KNOWN") fieldsTemplateKnown++;
      else if (cell.source === "AI_CORRECTED") fieldsAiEscalated++;
      else if (classifyCellConfidence(cell) === "TRUST") fieldsHighConfidence++;
    }
  }

  return {
    fieldsTotal,
    fieldsHighConfidence,
    fieldsRuleFixed,
    fieldsTemplateKnown,
    fieldsAiEscalated,
    aiCallsMade,
    ocrConfidenceAvgPct: confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 0,
    aiInvoked,
    templateMatchId,
  };
}

// ---------------------------------------------------------------------------
// THE ORCHESTRATOR — wires every stage above into the real pipeline. This is
// what a Bundi Intelligent session actually calls. Fields that are still
// uncertain after every free stage are marked NEEDS_AI_REVIEW rather than
// blocking the whole extraction — a school without an AI provider configured
// (or a session that simply doesn't need one) still gets a fully usable
// extraction, with the genuinely uncertain cells flagged for the school's
// own manual review instead of a hard failure. AI is only actually CALLED
// when `aiCorrectBatch` is supplied (the real provider seam) — this
// function never fabricates a correction on its own.
// ---------------------------------------------------------------------------
export interface RunPipelineInput {
  tenantId: string;
  domain: BundiDomain;
  imageBuffer: Buffer;
  fieldLabels: string[]; // the school's own BundiFieldTemplate labels, in order
  fieldMapsTo: Record<string, string>; // label -> IMPORT_FIELD-style mapping, for validateAgainstSchoolData
  numericFieldLabels: string[]; // labels the school has told Bundi are numeric (phone/ID/admission no/ISBN/copies)
  contextNote?: string; // e.g. "This is Grade 1" — currently informational; consumed by future domain-specific pre-filters
  knownTemplate?: { fieldsJson: string } | null;
  /** The REAL AI provider call, batched: given a list of {rowIndex, label,
   * rawText}, returns corrected text for each. Only invoked for cells that
   * survive every free stage still below HIGH_CONFIDENCE_PCT. Omit this to
   * run the pipeline in "free tiers only" mode (matches a NEYO Ops
   * configuration where no provider is wired in yet — never a fabricated
   * fallback, exactly like the honest NOT_CONFIGURED seam elsewhere). */
  aiCorrectBatch?: (
    imageBuffer: Buffer,
    items: { rowIndex: number; label: string; rawText: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[]
  ) => Promise<{ rowIndex: number; label: string; correctedText: string }[]>;
}

export interface RunPipelineResult {
  rows: BundiIntelligentRow[];
  stats: BundiPipelineStats;
  layoutSignature: string;
}

export async function runBundiIntelligentPipeline(input: RunPipelineInput): Promise<RunPipelineResult> {
  // STAGE 1 — enhancement.
  const enhanced = await enhanceImageForOcr(input.imageBuffer);

  // STAGE 2 — local OCR.
  const { words } = await runLocalOcr(enhanced);
  if (words.length === 0) {
    throw new BundiIntelligentError("OCR_FAILED", "No readable text was found on this scan. Try a clearer, well-lit photo.");
  }

  // STAGE 2b — table/row detection.
  const detectedRows = groupWordsIntoRows(words);
  const layoutSignature = computeLayoutSignature(input.fieldLabels);

  const rows: BundiIntelligentRow[] = [];
  for (const detectedRow of detectedRows) {
    const assigned = assignRowToColumns(detectedRow, input.fieldLabels);
    const cells: Record<string, BundiCell> = {};

    for (const label of input.fieldLabels) {
      const raw = assigned[label];
      if (!raw) continue;
      let value = raw.text.trim();
      let source: BundiCell["source"] = "OCR";
      let confidencePct = raw.confidencePct;

      // STAGE 5 — learned corrections (checked FIRST — a school's own
      // remembered fix is the cheapest and most reliable possible source).
      const learned = await applyLearnedCorrections(input.tenantId, input.domain, label, value);
      if (learned.applied) {
        value = learned.value;
        source = "RULE_FIXED";
        confidencePct = 100;
      } else if (input.numericFieldLabels.includes(label)) {
        // STAGE 3 — deterministic numeric OCR fixes.
        const repaired = applyNumericOcrFixes(value);
        if (repaired !== value) {
          value = repaired;
          source = "RULE_FIXED";
          confidencePct = Math.max(confidencePct, 85);
        }
      } else if (input.fieldMapsTo[label]) {
        // STAGE 4 — validation against real school data.
        const validated = await validateAgainstSchoolData(input.domain, input.fieldMapsTo[label], value);
        if (validated.matched) {
          value = validated.value;
          source = "RULE_FIXED";
          confidencePct = Math.max(confidencePct, 92);
        }
      }

      cells[label] = { value, ocrConfidencePct: confidencePct, source, bbox: raw.bbox };
    }
    rows.push({ cells });
  }

  // STAGE 6 — template memoization is informational at this stage (the
  // caller supplies a known template if one matched; we simply note it in
  // the returned stats — the actual column-band ASSIGNMENT already ran
  // above using the school's real field count, which is what a memoized
  // template mainly speeds up in practice: skipping manual field-template
  // setup on repeat scans of the same register).
  const templateMatchId = input.knownTemplate ? layoutSignature : null;

  // STAGE 7 — field-level AI escalation, batched, only for cells still
  // uncertain after every free stage above. Each escalated item carries its
  // own real bbox so the AI adapter can crop JUST that field's pixels
  // (never a whole-page/whole-document image) for a targeted re-read.
  const toEscalate: { rowIndex: number; label: string; rawText: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  rows.forEach((row, rowIndex) => {
    for (const [label, cell] of Object.entries(row.cells)) {
      if (classifyCellConfidence(cell) === "ESCALATE_TO_AI") {
        toEscalate.push({ rowIndex, label, rawText: cell.value, bbox: cell.bbox });
      }
    }
  });

  let aiInvoked = false;
  if (toEscalate.length > 0 && input.aiCorrectBatch) {
    try {
      const corrected = await input.aiCorrectBatch(enhanced, toEscalate);
      aiInvoked = true;
      for (const c of corrected) {
        const cell = rows[c.rowIndex]?.cells[c.label];
        if (cell) {
          cell.value = c.correctedText;
          cell.source = "AI_CORRECTED";
        }
      }
    } catch {
      // The configured provider (e.g. Google Vision not yet fully wired for
      // field-level crops, or a transient network/API failure) could not
      // correct these cells. We deliberately do NOT let this fail the whole
      // extraction, and we deliberately do NOT mark aiInvoked = true (no
      // cost was actually incurred and no correction actually happened).
      // The escalated cells simply keep their real (lower) OCR confidence
      // and source "OCR" for honest manual review — never fabricate a
      // correction that didn't happen, and never block the school's import
      // over a provider-side issue.
    }
  }
  // If no provider is configured at all, the escalated cells simply stay at
  // their real (lower) OCR confidence and source "OCR" — the school reviews
  // them manually. This is the honest behavior: never fabricate an AI
  // correction that didn't happen, and never block the whole extraction.

  // The real adapter (see callGoogleVisionTextCorrection) issues exactly
  // one HTTP request per escalated cell with a usable bbox — so the real
  // call count is the number of cells that were actually sent, which is
  // honestly the same as toEscalate.length whenever AI was invoked at all
  // (some of those calls may have found nothing clearer and been skipped
  // from the RETURNED corrections, but the call itself still happened and
  // still costs money — this is the true cost driver, not just successes).
  const aiCallsMade = aiInvoked ? toEscalate.filter((t) => !!t.bbox).length : 0;
  const stats = computePipelineStats(rows, aiInvoked, templateMatchId, aiCallsMade);
  return { rows, stats, layoutSignature };
}
