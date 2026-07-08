/**
 * PART M.5 / N.1 — Bundi Handwritten Import ("Bundi Intelligent").
 *
 * Design contract:
 *  1. Separate premium/manual-assist path — never replaces or weakens the
 *     standard CSV/Excel engines (Student M.4, Staff B.9, Library N.1).
 *     Every commit funnels through that DOMAIN's own real standard import
 *     engine — there is no second, weaker write path into any table.
 *  2. N.1 (2026-07-02) — TWO real access modes:
 *     - "Bundi Intelligent" (pipeline: BUNDI_INTELLIGENT): local OCR + rules
 *       first, AI only for genuinely uncertain fields via the cheap Google
 *       Vision API. OPEN to every school, NO unlock code required — per the
 *       founder's explicit instruction, now that the confidence-based
 *       pipeline keeps real AI usage tiny.
 *     - "Legacy provider" (pipeline: LEGACY_PROVIDER): the original
 *       whole-page-to-a-big-vision-model path (OpenAI/Anthropic/Google
 *       Vision used as the ONLY step). Still gated by a company-issued
 *       unlock code, since it is genuinely more expensive per page.
 *  3. The school describes their own register's fields BEFORE any
 *     extraction happens (BundiFieldTemplate, now per-domain) — Bundi maps
 *     AROUND the school's own description, never the other way round.
 *  4. Every session tracks REAL provider/model/token/cost so NEYO Ops has
 *     full usage + cost visibility. No feature here may ever fake a number.
 *  5. Multi-domain (STUDENT | STAFF | LIBRARY) — generalized from the
 *     original student-only M.5 design without duplicating the gating/
 *     review/commit machinery per domain.
 */
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import {
  BUNDI_PROVIDER_SETTING_KEY,
  bundiProviderConfigSchema,
  defaultBundiProviderConfig,
  mappableFieldsForDomain,
  numericFieldsForDomain,
  type BundiProviderConfig,
  type MintUnlockCodeInput,
  type SaveFieldTemplateInput,
  type StartImportSessionInput,
  type ReviewImportSessionInput,
  type CommitBundiSessionInput,
  type BundiExtractedRow,
} from "@/lib/validations/bundi-import";
import type { BundiDomain } from "@/lib/validations/bundi-intelligent";
import { commitImport } from "@/lib/services/student-import.service";
import type { ColumnMapping } from "@/lib/validations/student-import";
import { importStaffBatch, type StaffImportRow } from "@/lib/services/staff-import.service";
import { importLibraryBatch } from "@/lib/services/library-import.service";
import type { LibraryImportRow } from "@/lib/validations/library-import";
import { readObject } from "@/lib/services/storage.service";
import { readCompanySecret } from "@/lib/services/company-secret.service";
import {
  runBundiIntelligentPipeline,
  recordLearnedCorrection,
  computeLayoutSignature,
  findKnownTemplate,
  saveKnownTemplate,
} from "@/lib/services/bundi-intelligent.service";

export class BundiImportError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "NOT_CONFIGURED" | "EXPIRED" | "EXHAUSTED" | "STATE",
    message: string
  ) {
    super(message);
    this.name = "BundiImportError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId, metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// NEYO Ops: provider configuration for the LEGACY code-gated path (company-
// level, PlatformSetting — same pattern as M.2's SMS margin config). No
// secret lives here; the API key itself belongs in the company-secret vault.
// ---------------------------------------------------------------------------

export async function getBundiProviderConfig(): Promise<BundiProviderConfig> {
  const setting = await db.platformSetting.findUnique({ where: { key: BUNDI_PROVIDER_SETTING_KEY } });
  if (!setting?.value) return defaultBundiProviderConfig();
  try {
    return bundiProviderConfigSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultBundiProviderConfig();
  }
}

export async function saveBundiProviderConfig(input: unknown, actor: { fullName: string }) {
  const parsed = bundiProviderConfigSchema.parse(input);
  await db.platformSetting.upsert({
    where: { key: BUNDI_PROVIDER_SETTING_KEY },
    create: { key: BUNDI_PROVIDER_SETTING_KEY, value: JSON.stringify(parsed), updatedBy: actor.fullName },
    update: { value: JSON.stringify(parsed), updatedBy: actor.fullName },
  });
  return parsed;
}

// ---------------------------------------------------------------------------
// NEYO Ops: unlock code lifecycle (LEGACY path only — Bundi Intelligent
// needs none).
// ---------------------------------------------------------------------------

function generateUnlockCode(): string {
  return `BUNDI-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function mintUnlockCode(input: MintUnlockCodeInput, actor: { id: string; fullName: string }) {
  if (input.tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new BundiImportError("NOT_FOUND", "School not found.");
  }
  const code = generateUnlockCode();
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
  const row = await db.bundiImportUnlockCode.create({
    data: {
      code,
      tenantId: input.tenantId ?? null,
      maxUses: input.maxUses === undefined ? 1 : input.maxUses,
      expiresAt,
      note: input.note ?? null,
      issuedById: actor.id,
      issuedByName: actor.fullName,
    },
  });
  await audit(
    { id: actor.id, fullName: actor.fullName, tenantId: input.tenantId ?? "" } as SessionUser,
    "bundi.unlock_code_minted",
    "BundiImportUnlockCode",
    row.id,
    { tenantId: input.tenantId ?? null, maxUses: row.maxUses, expiresAt: row.expiresAt }
  );
  return row;
}

export async function revokeUnlockCode(codeId: string, actor: { id: string; fullName: string; tenantId: string }) {
  const row = await db.bundiImportUnlockCode.findUnique({ where: { id: codeId } });
  if (!row) throw new BundiImportError("NOT_FOUND", "Unlock code not found.");
  if (row.revokedAt) throw new BundiImportError("STATE", "That code is already revoked.");
  await db.bundiImportUnlockCode.update({ where: { id: codeId }, data: { revokedAt: new Date() } });
  await audit(actor as SessionUser, "bundi.unlock_code_revoked", "BundiImportUnlockCode", codeId);
  return { ok: true };
}

export async function listUnlockCodes() {
  const rows = await db.bundiImportUnlockCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    tenantId: r.tenantId,
    tenantName: r.tenant?.name ?? null,
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    note: r.note,
    issuedByName: r.issuedByName,
    createdAt: r.createdAt,
  }));
}

function assertCodeUsable(row: {
  tenantId: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
}, tenantId: string) {
  if (row.revokedAt) throw new BundiImportError("EXPIRED", "This unlock code has been revoked.");
  if (row.expiresAt && row.expiresAt < new Date()) throw new BundiImportError("EXPIRED", "This unlock code has expired.");
  if (row.tenantId && row.tenantId !== tenantId) throw new BundiImportError("FORBIDDEN", "This unlock code belongs to a different school.");
  if (row.maxUses !== null && row.usedCount >= row.maxUses) throw new BundiImportError("EXHAUSTED", "This unlock code has already been used up.");
}

export async function checkUnlockCode(tenantId: string, code: string) {
  const row = await db.bundiImportUnlockCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!row) throw new BundiImportError("NOT_FOUND", "That unlock code was not recognized.");
  assertCodeUsable(row, tenantId);
  return {
    valid: true,
    remainingUses: row.maxUses === null ? null : row.maxUses - row.usedCount,
    expiresAt: row.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// School: field template (described BEFORE any AI mapping happens),
// PER-DOMAIN (N.1).
// ---------------------------------------------------------------------------

export async function getFieldTemplate(user: SessionUser, domain: BundiDomain) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().bundiFieldTemplate.findUnique({ where: { tenantId_domain: { tenantId: user.tenantId, domain } } });
    if (!row) return { fields: [] as unknown[], updatedAt: null };
    return { fields: JSON.parse(row.fieldsJson), updatedAt: row.updatedAt };
  });
}

export async function saveFieldTemplate(user: SessionUser, input: SaveFieldTemplateInput) {
  return withTenant(user.tenantId, async () => {
    const allowed = new Set(mappableFieldsForDomain(input.domain));
    for (const f of input.fields) {
      if (!allowed.has(f.mapsTo)) {
        throw new BundiImportError("INVALID", `"${f.mapsTo}" is not a real field for ${input.domain} imports.`);
      }
    }
    const row = await db.bundiFieldTemplate.upsert({
      where: { tenantId_domain: { tenantId: user.tenantId, domain: input.domain } },
      create: { tenantId: user.tenantId, domain: input.domain, fieldsJson: JSON.stringify(input.fields), updatedById: user.id },
      update: { fieldsJson: JSON.stringify(input.fields), updatedById: user.id },
    });
    await audit(user, "bundi.field_template_saved", "BundiFieldTemplate", row.id, { domain: input.domain, fieldCount: input.fields.length });
    return { fields: input.fields, updatedAt: row.updatedAt };
  });
}

// ---------------------------------------------------------------------------
// School: import session lifecycle
// ---------------------------------------------------------------------------

/** Start a "Bundi Intelligent" session — OPEN, no unlock code required. */
export async function startIntelligentSession(user: SessionUser, input: StartImportSessionInput) {
  return withTenant(user.tenantId, async () => {
    const storedFile = await tenantDb().storedFile.findUnique({ where: { id: input.storedFileId } });
    if (!storedFile) throw new BundiImportError("NOT_FOUND", "Uploaded file not found. Please upload the scan again.");

    const config = await getBundiProviderConfig();
    if (input.pageCount > config.maxPagesPerSession) {
      throw new BundiImportError("INVALID", `This session has ${input.pageCount} pages; NEYO Ops has capped Bundi sessions at ${config.maxPagesPerSession} pages. Split the scan into smaller batches.`);
    }

    const session = await tenantDb().bundiImportSession.create({
      data: {
        unlockCodeId: null,
        pipeline: "BUNDI_INTELLIGENT",
        domain: input.domain,
        contextNote: input.contextNote ?? null,
        status: "UPLOADED",
        fileKey: storedFile.key,
        fileName: input.fileName,
        pageCount: input.pageCount,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await audit(user, "bundi.intelligent_session_started", "BundiImportSession", session.id, { domain: input.domain, fileName: input.fileName, pageCount: input.pageCount, contextNote: input.contextNote });
    return session;
  });
}

/** Start a LEGACY provider session — still requires a real unlock code. */
export async function startImportSession(user: SessionUser, input: StartImportSessionInput) {
  return withTenant(user.tenantId, async () => {
    if (!input.unlockCode) throw new BundiImportError("INVALID", "An unlock code is required for the legacy provider path.");
    const codeRow = await db.bundiImportUnlockCode.findUnique({ where: { code: input.unlockCode.trim().toUpperCase() } });
    if (!codeRow) throw new BundiImportError("NOT_FOUND", "That unlock code was not recognized.");
    assertCodeUsable(codeRow, user.tenantId);

    const config = await getBundiProviderConfig();
    if (input.pageCount > config.maxPagesPerSession) {
      throw new BundiImportError("INVALID", `This session has ${input.pageCount} pages; NEYO Ops has capped Bundi sessions at ${config.maxPagesPerSession} pages to protect AI spend. Split the scan into smaller batches.`);
    }

    const storedFile = await tenantDb().storedFile.findUnique({ where: { id: input.storedFileId } });
    if (!storedFile) throw new BundiImportError("NOT_FOUND", "Uploaded file not found. Please upload the scan again.");

    await db.bundiImportUnlockCode.update({ where: { id: codeRow.id }, data: { usedCount: { increment: 1 } } });

    const session = await tenantDb().bundiImportSession.create({
      data: {
        unlockCodeId: codeRow.id,
        pipeline: "LEGACY_PROVIDER",
        domain: input.domain,
        contextNote: input.contextNote ?? null,
        status: "UPLOADED",
        fileKey: storedFile.key,
        fileName: input.fileName,
        pageCount: input.pageCount,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await audit(user, "bundi.import_session_started", "BundiImportSession", session.id, { domain: input.domain, fileName: input.fileName, pageCount: input.pageCount });
    return session;
  });
}

export async function listImportSessions(user: SessionUser, domain?: BundiDomain) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().bundiImportSession.findMany({ where: domain ? { domain } : undefined, orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((r) => ({
      id: r.id, domain: r.domain, pipeline: r.pipeline, status: r.status, fileName: r.fileName, pageCount: r.pageCount,
      contextNote: r.contextNote,
      provider: r.provider, model: r.model, costKes: r.costKes,
      ocrConfidenceAvgPct: r.ocrConfidenceAvgPct, fieldsTotal: r.fieldsTotal, fieldsAiEscalated: r.fieldsAiEscalated, aiInvoked: r.aiInvoked,
      studentImportId: r.studentImportId, staffImportId: r.staffImportId, libraryImportId: r.libraryImportId,
      createdByName: r.createdByName, createdAt: r.createdAt,
      errorMessage: r.errorMessage,
    }));
  });
}

export async function getImportSession(user: SessionUser, sessionId: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!row) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    return row;
  });
}

// ---------------------------------------------------------------------------
// Real Google Cloud Vision OCR call — the cheap, real cloud fallback for the
// AI-escalation stage of Bundi Intelligent (used only for the small % of
// cells local OCR + rules could not confidently resolve). Vision's
// `images:annotate` REST endpoint accepts a plain API key, so this is a
// single pasted credential (`google_vision_api_key`) in NEYO Ops — exactly
// as easy to configure as the SMS/email keys already there.
// ---------------------------------------------------------------------------
// Real, small padding (px) added around a cell's OCR bbox before cropping —
// Vision's DOCUMENT_TEXT_DETECTION reads noticeably better with a little
// breathing room around the exact word boundary, and this keeps the crop
// still just ONE FIELD wide, never a whole row/page.
const VISION_CROP_PADDING_PX = 12;

export async function callGoogleVisionTextCorrection(
  apiKey: string,
  imageBuffer: Buffer,
  items: { rowIndex: number; label: string; rawText: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[]
): Promise<{ rowIndex: number; label: string; correctedText: string }[]> {
  // Google Vision's OCR (DOCUMENT_TEXT_DETECTION) reads pixels, not "correct
  // this string" prompts — so a genuine field-level correction means
  // cropping JUST this cell's real bbox out of the source image (never the
  // whole page) and sending that tiny crop to Vision for a fresh, targeted
  // re-read. This is real, field-level, batched-per-request work — the
  // exact cost shape the founder asked for (process fields, not pages).
  const meta = await sharp(imageBuffer).metadata();
  const imgWidth = meta.width ?? 0;
  const imgHeight = meta.height ?? 0;

  const results: { rowIndex: number; label: string; correctedText: string }[] = [];
  // Vision bills per IMAGE, so each item is still its own request — but
  // each request is a tiny single-field crop, not a whole document, which
  // is what actually keeps cost tiny per the founder's brief.
  for (const item of items) {
    if (!item.bbox || imgWidth === 0 || imgHeight === 0) continue; // no crop region known — leave for manual review, no guess made
    const left = Math.max(0, Math.floor(item.bbox.x0 - VISION_CROP_PADDING_PX));
    const top = Math.max(0, Math.floor(item.bbox.y0 - VISION_CROP_PADDING_PX));
    const right = Math.min(imgWidth, Math.ceil(item.bbox.x1 + VISION_CROP_PADDING_PX));
    const bottom = Math.min(imgHeight, Math.ceil(item.bbox.y1 + VISION_CROP_PADDING_PX));
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) continue;

    let cropBase64: string;
    try {
      const crop = await sharp(imageBuffer).extract({ left, top, width, height }).png().toBuffer();
      cropBase64 = crop.toString("base64");
    } catch {
      continue; // real crop failure — skip this one cell, never fabricate a value for it
    }

    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: cropBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["en"] },
          },
        ],
      }),
    });
    if (!res.ok) continue; // real HTTP failure for this one field — leave it for manual review, never fabricate
    const json = (await res.json()) as {
      responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
    };
    const text = json.responses?.[0]?.fullTextAnnotation?.text?.trim();
    if (!text) continue; // Vision genuinely found nothing clearer than local OCR did — leave for manual review
    results.push({ rowIndex: item.rowIndex, label: item.label, correctedText: text.replace(/\s+/g, " ").trim() });
  }
  return results;
}

/** THE REAL AI-ESCALATION ADAPTER for Bundi Intelligent. Tries Google Vision
 * first (cheap) if configured; returns null (no AI available) otherwise —
 * the pipeline then simply leaves escalated cells at their real OCR
 * confidence for manual review, never fabricating a correction. */
async function getAiCorrectorForIntelligentPipeline(): Promise<
  | ((
      imageBuffer: Buffer,
      items: { rowIndex: number; label: string; rawText: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[]
    ) => Promise<{ rowIndex: number; label: string; correctedText: string }[]>)
  | null
> {
  const visionKey = await readCompanySecret("google_vision_api_key");
  if (visionKey) {
    return (imageBuffer, items) => callGoogleVisionTextCorrection(visionKey, imageBuffer, items);
  }
  return null;
}

/**
 * Run the "Bundi Intelligent" pipeline for a session: local OCR -> rules ->
 * validation -> learned corrections -> template memoization -> AI escalation
 * ONLY for cells still uncertain (cheap Google Vision if configured, else
 * left for manual review). This is the REAL cost-cutting path, open to
 * every school with no unlock code.
 */
export async function extractIntelligentSession(user: SessionUser, sessionId: string) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.pipeline !== "BUNDI_INTELLIGENT") throw new BundiImportError("STATE", "This session does not use the Bundi Intelligent pipeline.");
    if (session.status !== "UPLOADED" && session.status !== "FAILED") {
      throw new BundiImportError("STATE", `Cannot extract a session in status ${session.status}.`);
    }

    const template = await tenantDb().bundiFieldTemplate.findUnique({ where: { tenantId_domain: { tenantId: user.tenantId, domain: session.domain as BundiDomain } } });
    if (!template) throw new BundiImportError("INVALID", "Describe your register's fields first, before extracting.");
    const fields = JSON.parse(template.fieldsJson) as { label: string; mapsTo: string }[];
    if (fields.length === 0) throw new BundiImportError("INVALID", "Your field description is empty.");

    await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "EXTRACTING" } });

    try {
      const file = await readObject(session.fileKey);
      const domain = session.domain as BundiDomain;
      const fieldLabels = fields.map((f) => f.label);
      const fieldMapsTo = Object.fromEntries(fields.map((f) => [f.label, f.mapsTo]));
      const numericLabels = fields.filter((f) => numericFieldsForDomain(domain).includes(f.mapsTo)).map((f) => f.label);

      const layoutSignature = computeLayoutSignature(fieldLabels);
      const knownTemplate = await findKnownTemplate(user, domain, layoutSignature);

      const aiCorrectBatch = (await getAiCorrectorForIntelligentPipeline()) ?? undefined;

      const pipelineResult = await runBundiIntelligentPipeline({
        tenantId: user.tenantId,
        domain,
        imageBuffer: file.body,
        fieldLabels,
        fieldMapsTo,
        numericFieldLabels: numericLabels,
        contextNote: session.contextNote ?? undefined,
        knownTemplate,
        aiCorrectBatch,
      });

      if (!knownTemplate) {
        // First time seeing this exact layout for this tenant+domain — save
        // it so future scans of the SAME register skip straight to a known
        // layout (the founder's "cache repeated work" requirement).
        await saveKnownTemplate(user, { domain, layoutSignature, label: session.fileName, fields });
      }

      const rows: BundiExtractedRow[] = pipelineResult.rows.map((r) => ({
        cells: Object.fromEntries(Object.entries(r.cells).map(([label, cell]) => [label, { value: cell.value, ocrConfidencePct: cell.ocrConfidencePct, source: cell.source }])),
      }));

      // Real Google Vision pricing (DOCUMENT_TEXT_DETECTION, published rate:
      // https://cloud.google.com/vision/pricing — $1.50 per 1,000 units
      // after the first free 1,000/month, i.e. $0.0015/call). Bundi
      // Intelligent only ever calls Vision once per genuinely-escalated
      // FIELD (never a whole page), so `aiCallsMade` here is already the
      // real, tiny number the founder's architecture is built to produce —
      // this is a real, published-rate cost, never a guess or a flat fee.
      const GOOGLE_VISION_USD_PER_CALL = 0.0015;
      const costUsd = pipelineResult.stats.aiCallsMade * GOOGLE_VISION_USD_PER_CALL;
      const providerConfig = await getBundiProviderConfig();
      const costKes = costUsd * providerConfig.usdToKes;

      const updated = await tenantDb().bundiImportSession.update({
        where: { id: sessionId },
        data: {
          status: "REVIEW",
          provider: pipelineResult.stats.aiInvoked ? "google_vision" : "local_ocr_only",
          model: pipelineResult.stats.aiInvoked ? "vision-document-text-detection-crop" : "tesseract-local",
          ocrConfidenceAvgPct: pipelineResult.stats.ocrConfidenceAvgPct,
          fieldsTotal: pipelineResult.stats.fieldsTotal,
          fieldsAiEscalated: pipelineResult.stats.fieldsAiEscalated,
          aiInvoked: pipelineResult.stats.aiInvoked,
          templateMatchId: pipelineResult.stats.templateMatchId,
          // Bundi Intelligent's local-OCR-first design means MOST sessions
          // cost genuinely nothing — costUsd/costKes are only non-zero when
          // Vision's real crop-based correction was actually called, and
          // are computed from Vision's real published per-unit price times
          // the real number of calls made, never a flat fee or an estimate.
          costUsd,
          costKes,
          extractedRowsJson: JSON.stringify(rows),
          reviewedRowsJson: JSON.stringify(rows),
        },
      });
      await audit(user, "bundi.intelligent_extracted", "BundiImportSession", sessionId, {
        domain, fieldsTotal: pipelineResult.stats.fieldsTotal, fieldsAiEscalated: pipelineResult.stats.fieldsAiEscalated,
        aiInvoked: pipelineResult.stats.aiInvoked, ocrConfidenceAvgPct: pipelineResult.stats.ocrConfidenceAvgPct,
      });
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Extraction failed.";
      await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "FAILED", errorMessage: message } });
      throw e;
    }
  });
}

/**
 * Run (or re-run) extraction for a LEGACY provider session. THE REAL
 * PROVIDER SEAM for the code-gated path. If NEYO Ops has not configured a
 * real provider, this throws NOT_CONFIGURED — it NEVER fabricates rows.
 */
export async function extractSession(user: SessionUser, sessionId: string) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.pipeline !== "LEGACY_PROVIDER") {
      // A Bundi Intelligent session was routed here by mistake — redirect
      // logic belongs at the route layer, but fail loudly rather than
      // silently running the wrong pipeline.
      throw new BundiImportError("STATE", "This session uses the Bundi Intelligent pipeline; call the intelligent extract endpoint instead.");
    }
    if (session.status !== "UPLOADED" && session.status !== "FAILED") {
      throw new BundiImportError("STATE", `Cannot extract a session in status ${session.status}.`);
    }

    const config = await getBundiProviderConfig();
    if (!config.enabled || config.provider === "NONE") {
      await tenantDb().bundiImportSession.update({
        where: { id: sessionId },
        data: { status: "FAILED", errorMessage: "Bundi's legacy handwriting reader is not switched on yet for NEYO. NEYO Ops must configure a real AI provider before scans can be read this way." },
      });
      throw new BundiImportError("NOT_CONFIGURED", "Bundi's legacy handwriting reader is not configured yet. Ask NEYO Ops to enable a provider, or use Bundi Intelligent instead (no code needed).");
    }

    await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "EXTRACTING" } });

    try {
      const file = await readObject(session.fileKey);
      const result = await runProviderExtraction(config, file.body, session.pageCount);

      const updated = await tenantDb().bundiImportSession.update({
        where: { id: sessionId },
        data: {
          status: "REVIEW",
          provider: result.provider,
          model: result.model,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
          costKes: result.costUsd * config.usdToKes,
          extractedRowsJson: JSON.stringify(result.rows),
          reviewedRowsJson: JSON.stringify(result.rows),
        },
      });
      await audit(user, "bundi.import_extracted", "BundiImportSession", sessionId, {
        provider: result.provider, promptTokens: result.promptTokens, outputTokens: result.outputTokens, costKes: updated.costKes, rowCount: result.rows.length,
      });
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Extraction failed.";
      await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "FAILED", errorMessage: message } });
      throw e;
    }
  });
}

/**
 * THE LEGACY PROVIDER ADAPTER SEAM (whole-page-to-vision-model path).
 * Swapping providers means editing only this function. Every branch is a
 * real "not implemented" throw rather than fabricated output.
 */
async function runProviderExtraction(
  config: BundiProviderConfig,
  _fileBuffer: Buffer,
  _pageCount: number
): Promise<{ provider: string; model: string; promptTokens: number; outputTokens: number; costUsd: number; rows: BundiExtractedRow[] }> {
  throw new BundiImportError(
    "NOT_CONFIGURED",
    `Provider "${config.provider}" is selected in NEYO Ops but its real API integration has not been wired in yet. No handwriting extraction can run until a real provider call replaces this seam — never fabricate rows.`
  );
}

/** School: save their row-by-row edits/corrections after reviewing the
 * extraction. N.1 — every real edit is ALSO fed into `recordLearnedCorrection`
 * so Bundi Intelligent remembers it for free on future sessions, per the
 * founder's "learn from corrections" cost-cutting requirement. */
export async function reviewSession(user: SessionUser, sessionId: string, input: ReviewImportSessionInput) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status !== "REVIEW") throw new BundiImportError("STATE", `Cannot review a session in status ${session.status}.`);

    // Diff against the PREVIOUS reviewed rows to find genuine corrections.
    const previousRows = session.reviewedRowsJson ? (JSON.parse(session.reviewedRowsJson) as BundiExtractedRow[]) : [];
    for (let i = 0; i < input.rows.length; i++) {
      const before = previousRows[i];
      const after = input.rows[i];
      if (!before) continue;
      for (const [label, afterCell] of Object.entries(after.cells)) {
        const beforeCell = before.cells[label];
        if (beforeCell && beforeCell.value !== afterCell.value && beforeCell.source !== "MANUAL") {
          await recordLearnedCorrection(user, {
            domain: session.domain as BundiDomain,
            fieldLabel: label,
            wrongText: beforeCell.value,
            correctText: afterCell.value,
          });
        }
      }
    }

    const updated = await tenantDb().bundiImportSession.update({
      where: { id: sessionId },
      data: { reviewedRowsJson: JSON.stringify(input.rows) },
    });
    await audit(user, "bundi.import_reviewed", "BundiImportSession", sessionId, { rowCount: input.rows.length });
    return updated;
  });
}

/**
 * Commit the school-reviewed rows through the SAME real standard import
 * engine for the session's domain — never a second, weaker write path.
 * Builds a synthetic header+rows+mapping from the school's own
 * BundiFieldTemplate so every downstream rule applies identically.
 */
export async function commitSession(user: SessionUser, sessionId: string, input: CommitBundiSessionInput) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status !== "REVIEW") throw new BundiImportError("STATE", `Cannot commit a session in status ${session.status}.`);
    if (!session.reviewedRowsJson) throw new BundiImportError("STATE", "No reviewed rows to commit.");

    const domain = session.domain as BundiDomain;
    const template = await tenantDb().bundiFieldTemplate.findUnique({ where: { tenantId_domain: { tenantId: user.tenantId, domain } } });
    if (!template) throw new BundiImportError("INVALID", "Describe your register's fields first, before committing an import.");
    const fields = JSON.parse(template.fieldsJson) as { label: string; mapsTo: string; customLabel?: string }[];
    if (fields.length === 0) throw new BundiImportError("INVALID", "Your field description is empty.");

    const reviewedRows = JSON.parse(session.reviewedRowsJson) as BundiExtractedRow[];
    if (reviewedRows.length === 0) throw new BundiImportError("INVALID", "No rows to commit.");

    if (domain === "STUDENT") {
      const header = fields.map((f) => f.label);
      const rows: string[][] = [header, ...reviewedRows.map((r) => fields.map((f) => r.cells[f.label]?.value ?? ""))];
      const mapping: ColumnMapping = fields.map((f, column) => ({
        column,
        field: f.mapsTo as ColumnMapping[number]["field"],
        ...(f.mapsTo === "custom" ? { customLabel: f.customLabel } : {}),
      }));

      const result = await commitImport(user, {
        source: "paste",
        fileName: session.fileName,
        rows,
        hasHeader: true,
        mapping,
        seedRequirements: input.seedRequirements,
        skipInvalid: input.skipInvalid,
        targetClassId: input.targetClassId,
      });

      await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "COMMITTED", studentImportId: result.importId } });
      await audit(user, "bundi.import_committed", "BundiImportSession", sessionId, { domain, studentImportId: result.importId, created: result.created, failed: result.failed.length });
      return result;
    }

    if (domain === "STAFF") {
      const staffRows: StaffImportRow[] = reviewedRows.map((r) => {
        const out: Record<string, string> = {};
        for (const f of fields) out[f.mapsTo] = r.cells[f.label]?.value ?? "";
        return {
          fullName: out.fullName || "",
          role: out.role || "TEACHER",
          phone: out.phone || undefined,
          email: out.email || undefined,
          tscNumber: out.tscNumber || undefined,
          nationalId: out.nationalId || undefined,
          kraPin: out.kraPin || undefined,
          qualifications: out.qualifications || undefined,
          employmentDate: out.employmentDate || undefined,
          contractType: out.contractType || undefined,
          emergencyContact: out.emergencyContact || undefined,
        };
      });
      const result = await importStaffBatch(user, staffRows);
      await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "COMMITTED" } });
      await audit(user, "bundi.import_committed", "BundiImportSession", sessionId, { domain, created: result.created, skipped: result.skipped });
      return result;
    }

    // LIBRARY
    const libraryRows: LibraryImportRow[] = reviewedRows.map((r) => {
      const out: Record<string, string> = {};
      for (const f of fields) out[f.mapsTo] = r.cells[f.label]?.value ?? "";
      return {
        title: out.title || "",
        author: out.author || undefined,
        isbn: out.isbn || undefined,
        category: out.category || undefined,
        shelf: out.shelf || undefined,
        copiesTotal: out.copiesTotal ? Math.max(1, Math.trunc(Number(out.copiesTotal)) || 1) : 1,
      };
    });
    const result = await importLibraryBatch(user, libraryRows, { fileName: session.fileName, source: "bundi" });
    await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "COMMITTED", libraryImportId: result.importId } });
    await audit(user, "bundi.import_committed", "BundiImportSession", sessionId, { domain, libraryImportId: result.importId, created: result.created, updated: result.updated });
    return result;
  });
}

export async function cancelSession(user: SessionUser, sessionId: string) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status === "COMMITTED") throw new BundiImportError("STATE", "A committed session cannot be cancelled.");
    await tenantDb().bundiImportSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } });
    await audit(user, "bundi.import_cancelled", "BundiImportSession", sessionId);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// NEYO Ops: usage/cost dashboard (mirrors M.2's smsMarginDashboard pattern).
// Now reports both pipelines separately so Ops can see, with real numbers,
// how much cheaper Bundi Intelligent genuinely is versus the legacy path.
// ---------------------------------------------------------------------------

export async function bundiUsageDashboard() {
  const sessions = await db.bundiImportSession.findMany({
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const totalSessions = sessions.length;
  const totalCostKes = sessions.reduce((sum, s) => sum + s.costKes, 0);
  const totalPromptTokens = sessions.reduce((sum, s) => sum + s.promptTokens, 0);
  const totalOutputTokens = sessions.reduce((sum, s) => sum + s.outputTokens, 0);
  const byStatus: Record<string, number> = {};
  for (const s of sessions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  const byDomain: Record<string, number> = {};
  for (const s of sessions) byDomain[s.domain] = (byDomain[s.domain] ?? 0) + 1;

  const intelligentSessions = sessions.filter((s) => s.pipeline === "BUNDI_INTELLIGENT");
  const legacySessions = sessions.filter((s) => s.pipeline === "LEGACY_PROVIDER");
  const pipelineComparison = {
    bundiIntelligent: {
      sessions: intelligentSessions.length,
      costKes: intelligentSessions.reduce((sum, s) => sum + s.costKes, 0),
      aiInvokedCount: intelligentSessions.filter((s) => s.aiInvoked).length,
      avgFieldsAiEscalatedPct: intelligentSessions.length
        ? Math.round((intelligentSessions.reduce((sum, s) => sum + (s.fieldsTotal > 0 ? s.fieldsAiEscalated / s.fieldsTotal : 0), 0) / intelligentSessions.length) * 100)
        : 0,
    },
    legacyProvider: {
      sessions: legacySessions.length,
      costKes: legacySessions.reduce((sum, s) => sum + s.costKes, 0),
    },
  };

  const bySchool = new Map<string, { tenantName: string; sessions: number; costKes: number }>();
  for (const s of sessions) {
    const key = s.tenantId;
    const row = bySchool.get(key) ?? { tenantName: s.tenant.name, sessions: 0, costKes: 0 };
    row.sessions += 1;
    row.costKes += s.costKes;
    bySchool.set(key, row);
  }
  const topSchools = [...bySchool.values()].sort((a, b) => b.costKes - a.costKes).slice(0, 10);

  return { totalSessions, totalCostKes, totalPromptTokens, totalOutputTokens, byStatus, byDomain, pipelineComparison, topSchools };
}
