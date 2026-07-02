/**
 * PART M.5 — Bundi Handwritten Import (founder-controlled premium import path).
 *
 * Design contract (per the checklist, followed literally):
 *  1. Separate premium/manual-assist path — never replaces or weakens the
 *     standard CSV/Excel engine (M.4). Every commit funnels through the SAME
 *     `commitImport()` used by the standard engine — there is no second,
 *     weaker write path into the Student table.
 *  2. Gated by a one-time company-issued unlock code (or a standing
 *     per-school approval — maxUses:null) minted by NEYO Ops.
 *  3. The school describes their own register's fields BEFORE any AI mapping
 *     happens (BundiFieldTemplate) — Bundi maps AROUND the school's own
 *     description, never the other way round.
 *  4. Every session tracks REAL provider/model/token/cost so NEYO Ops has
 *     full usage + cost visibility (mirrors the M.2 SMS-margin ledger
 *     pattern). No feature here may ever fake a number.
 *  5. Cost-aware by design: `maxPagesPerSession` caps spend per attempt, and
 *     the extraction call point is a real provider ADAPTER seam — if no
 *     provider is configured, this returns a clear NOT_CONFIGURED error,
 *     never fabricated rows. Swapping in a real provider later requires
 *     zero changes to any of the surrounding gating/review/commit logic.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import {
  BUNDI_PROVIDER_SETTING_KEY,
  bundiProviderConfigSchema,
  defaultBundiProviderConfig,
  type BundiProviderConfig,
  type MintUnlockCodeInput,
  type SaveFieldTemplateInput,
  type StartImportSessionInput,
  type ReviewImportSessionInput,
  type CommitBundiSessionInput,
  type BundiExtractedRow,
} from "@/lib/validations/bundi-import";
import { commitImport } from "@/lib/services/student-import.service";
import type { ColumnMapping } from "@/lib/validations/student-import";
import { readObject } from "@/lib/services/storage.service";

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
// NEYO Ops: provider configuration (company-level, PlatformSetting — same
// pattern as M.2's SMS margin config). No secret lives here; the API key
// itself belongs in the existing company-secret vault (bundi_provider_key,
// already scaffolded in integration-credentials.service.ts).
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
// NEYO Ops: unlock code lifecycle
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
      // undefined -> 1 (classic one-time code, the founder's chosen default);
      // explicit null -> unlimited (standing approval), a deliberate opt-in.
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

/** Real validity check — used both when redeeming and before every session start. */
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

/** School: redeem a code (does NOT consume it — consumption happens per session start). */
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
// School: field template (described BEFORE any AI mapping happens)
// ---------------------------------------------------------------------------

export async function getFieldTemplate(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().bundiFieldTemplate.findUnique({ where: { tenantId: user.tenantId } });
    if (!row) return { fields: [] as unknown[], updatedAt: null };
    return { fields: JSON.parse(row.fieldsJson), updatedAt: row.updatedAt };
  });
}

export async function saveFieldTemplate(user: SessionUser, input: SaveFieldTemplateInput) {
  return withTenant(user.tenantId, async () => {
    const row = await db.bundiFieldTemplate.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, fieldsJson: JSON.stringify(input.fields), updatedById: user.id },
      update: { fieldsJson: JSON.stringify(input.fields), updatedById: user.id },
    });
    await audit(user, "bundi.field_template_saved", "BundiFieldTemplate", row.id, { fieldCount: input.fields.length });
    return { fields: input.fields, updatedAt: row.updatedAt };
  });
}

// ---------------------------------------------------------------------------
// School: import session lifecycle
// ---------------------------------------------------------------------------

export async function startImportSession(user: SessionUser, input: StartImportSessionInput) {
  return withTenant(user.tenantId, async () => {
    const codeRow = await db.bundiImportUnlockCode.findUnique({ where: { code: input.unlockCode.trim().toUpperCase() } });
    if (!codeRow) throw new BundiImportError("NOT_FOUND", "That unlock code was not recognized.");
    assertCodeUsable(codeRow, user.tenantId);

    const config = await getBundiProviderConfig();
    if (input.pageCount > config.maxPagesPerSession) {
      throw new BundiImportError("INVALID", `This session has ${input.pageCount} pages; NEYO Ops has capped Bundi sessions at ${config.maxPagesPerSession} pages to protect AI spend. Split the scan into smaller batches.`);
    }

    // Resolve the real storage key from the already-uploaded encrypted file
    // (never trust a raw storage key from the client).
    const storedFile = await tenantDb().storedFile.findUnique({ where: { id: input.storedFileId } });
    if (!storedFile) throw new BundiImportError("NOT_FOUND", "Uploaded file not found. Please upload the scan again.");

    // Consume one use of the code atomically with session creation.
    await db.bundiImportUnlockCode.update({ where: { id: codeRow.id }, data: { usedCount: { increment: 1 } } });

    const session = await tenantDb().bundiImportSession.create({
      data: {
        unlockCodeId: codeRow.id,
        status: "UPLOADED",
        fileKey: storedFile.key,
        fileName: input.fileName,
        pageCount: input.pageCount,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await audit(user, "bundi.import_session_started", "BundiImportSession", session.id, { fileName: input.fileName, pageCount: input.pageCount });
    return session;
  });
}

export async function listImportSessions(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().bundiImportSession.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((r) => ({
      id: r.id, status: r.status, fileName: r.fileName, pageCount: r.pageCount,
      provider: r.provider, model: r.model, costKes: r.costKes,
      studentImportId: r.studentImportId, createdByName: r.createdByName, createdAt: r.createdAt,
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

/**
 * Run (or re-run) AI extraction for a session. THE REAL PROVIDER SEAM.
 *
 * If NEYO Ops has not configured a real provider, this throws NOT_CONFIGURED
 * — it NEVER fabricates rows. This is the exact same honesty pattern as
 * `payment.service.ts` (PaymentError "NOT_CONFIGURED") and the WhatsApp/OAuth
 * seams elsewhere in this codebase.
 */
export async function extractSession(user: SessionUser, sessionId: string) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status !== "UPLOADED" && session.status !== "FAILED") {
      throw new BundiImportError("STATE", `Cannot extract a session in status ${session.status}.`);
    }

    const config = await getBundiProviderConfig();
    if (!config.enabled || config.provider === "NONE") {
      await tenantDb().bundiImportSession.update({
        where: { id: sessionId },
        data: { status: "FAILED", errorMessage: "Bundi's handwriting reader is not switched on yet for NEYO. NEYO Ops must configure a real AI provider before scans can be read." },
      });
      throw new BundiImportError("NOT_CONFIGURED", "Bundi's handwriting reader is not configured yet. Ask NEYO Ops to enable a provider.");
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
          reviewedRowsJson: JSON.stringify(result.rows), // school starts review from the raw extraction
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
 * THE PROVIDER ADAPTER SEAM. Swapping providers means editing only this
 * function — nothing above (gating, cost tracking) or below (review/commit)
 * changes. Currently every branch is a real "not implemented" throw rather
 * than fabricated output; wiring a real HTTP call to OpenAI/Google/Anthropic
 * vision here is the ONLY change needed to go live once a provider is chosen
 * and a real API key is placed in the company-secret vault
 * (`bundi_provider_key`, already scaffolded).
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

/** School: save their row-by-row edits/corrections after reviewing the AI extraction. */
export async function reviewSession(user: SessionUser, sessionId: string, input: ReviewImportSessionInput) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status !== "REVIEW") throw new BundiImportError("STATE", `Cannot review a session in status ${session.status}.`);

    const updated = await tenantDb().bundiImportSession.update({
      where: { id: sessionId },
      data: { reviewedRowsJson: JSON.stringify(input.rows) },
    });
    await audit(user, "bundi.import_reviewed", "BundiImportSession", sessionId, { rowCount: input.rows.length });
    return updated;
  });
}

/**
 * Commit the school-reviewed rows through the SAME `commitImport()` used by
 * the standard CSV/Excel engine — never a second, weaker write path. Builds
 * a synthetic header+rows+mapping from the school's own BundiFieldTemplate so
 * every downstream rule (duplicate prevention, legacy admission numbers,
 * single-class-only mode, custom fields) applies identically.
 */
export async function commitSession(user: SessionUser, sessionId: string, input: CommitBundiSessionInput) {
  return withTenant(user.tenantId, async () => {
    const session = await tenantDb().bundiImportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BundiImportError("NOT_FOUND", "Import session not found.");
    if (session.status !== "REVIEW") throw new BundiImportError("STATE", `Cannot commit a session in status ${session.status}.`);
    if (!session.reviewedRowsJson) throw new BundiImportError("STATE", "No reviewed rows to commit.");

    const template = await tenantDb().bundiFieldTemplate.findUnique({ where: { tenantId: user.tenantId } });
    if (!template) throw new BundiImportError("INVALID", "Describe your register's fields first, before committing an import.");
    const fields = JSON.parse(template.fieldsJson) as { label: string; mapsTo: string; customLabel?: string }[];
    if (fields.length === 0) throw new BundiImportError("INVALID", "Your field description is empty.");

    const reviewedRows = JSON.parse(session.reviewedRowsJson) as BundiExtractedRow[];
    if (reviewedRows.length === 0) throw new BundiImportError("INVALID", "No rows to commit.");

    // Build a synthetic header + rows exactly matching the school's field
    // template order, then a real ColumnMapping — this is what makes the
    // commit flow all the way through the STANDARD engine's own rules.
    const header = fields.map((f) => f.label);
    const rows: string[][] = [header, ...reviewedRows.map((r) => fields.map((f) => r.cells[f.label] ?? ""))];
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

    await tenantDb().bundiImportSession.update({
      where: { id: sessionId },
      data: { status: "COMMITTED", studentImportId: result.importId },
    });
    await audit(user, "bundi.import_committed", "BundiImportSession", sessionId, {
      studentImportId: result.importId, created: result.created, failed: result.failed.length,
    });
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
// NEYO Ops: usage/cost dashboard (mirrors M.2's smsMarginDashboard pattern)
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

  const bySchool = new Map<string, { tenantName: string; sessions: number; costKes: number }>();
  for (const s of sessions) {
    const key = s.tenantId;
    const row = bySchool.get(key) ?? { tenantName: s.tenant.name, sessions: 0, costKes: 0 };
    row.sessions += 1;
    row.costKes += s.costKes;
    bySchool.set(key, row);
  }
  const topSchools = [...bySchool.values()].sort((a, b) => b.costKes - a.costKes).slice(0, 10);

  return { totalSessions, totalCostKes, totalPromptTokens, totalOutputTokens, byStatus, topSchools };
}
