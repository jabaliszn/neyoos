import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";

export class VersioningError extends Error {
  constructor(public code: "NOT_FOUND" | "CONFLICT" | "INVALID", message: string) {
    super(message);
    this.name = "VersioningError";
  }
}

async function writeAudit(user: SessionUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action,
        entityType: "Curriculum",
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // Audit logging must never block the versioning workflow.
  }
}

const todayYmd = () => new Date().toISOString().split("T")[0];

// 1. Clone the active curriculum into a DRAFT sandbox.
// The draft copies the learning-area structure so a school can edit it safely
// without touching the live curriculum used by historical reports.
export async function createDraftVersion(user: SessionUser, originalCurriculumId: string, newVersionName: string) {
  const trimmedName = (newVersionName || "").trim();
  if (trimmedName.length < 1) throw new VersioningError("INVALID", "A version name is required, e.g. 'CBC 2027 Update'.");

  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const original = await tDb.curriculum.findUnique({
      where: { id: originalCurriculumId },
      include: { learningAreas: true },
    });

    if (!original) throw new VersioningError("NOT_FOUND", "Original curriculum not found.");
    if (original.status === "DRAFT") throw new VersioningError("CONFLICT", "You cannot draft a new version from an existing draft. Publish or discard it first.");

    // Prevent two drafts hanging off the same parent at once.
    const existingDraft = await tDb.curriculum.findFirst({
      where: { previousVersionId: original.id, status: "DRAFT" },
    });
    if (existingDraft) throw new VersioningError("CONFLICT", "A draft for this curriculum already exists. Publish or discard it before drafting again.");

    const draft = await tDb.curriculum.create({
      data: {
        tenantId: user.tenantId,
        name: original.name,
        country: original.country,
        context: original.context,
        activeVersion: trimmedName, // e.g. "v2" or "CBC 2027 Update"
        status: "DRAFT",
        isActive: false,
        previousVersionId: original.id,
        learningAreas: {
          create: original.learningAreas.map((la) => ({
            tenantId: user.tenantId,
            name: la.name,
            code: la.code,
            description: la.description,
          })),
        },
      },
      include: { _count: { select: { learningAreas: true } } },
    });

    await writeAudit(user, "curriculum.version_drafted", draft.id, {
      fromCurriculumId: original.id,
      fromVersion: original.activeVersion,
      newVersion: trimmedName,
      clonedLearningAreas: original.learningAreas.length,
    });

    return draft;
  });
}

// 2. Migration-impact preview — shows what changes BEFORE publishing.
// Compares the draft against the version it was cloned from so a school can see
// exactly which learning areas were added, removed, renamed, or kept.
export async function previewCurriculumDiff(user: SessionUser, draftId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const draft = await tDb.curriculum.findUnique({
      where: { id: draftId },
      include: { learningAreas: true },
    });

    if (!draft) throw new VersioningError("NOT_FOUND", "Draft version not found.");
    if (!draft.previousVersionId) throw new VersioningError("NOT_FOUND", "This version has no previous version to compare against.");

    const original = await tDb.curriculum.findUnique({
      where: { id: draft.previousVersionId },
      include: { learningAreas: true },
    });

    if (!original) throw new VersioningError("NOT_FOUND", "Original curriculum not found.");

    const originalByCode = new Map(original.learningAreas.map((la) => [la.code, la]));
    const draftByCode = new Map(draft.learningAreas.map((la) => [la.code, la]));

    const added = draft.learningAreas.filter((la) => !originalByCode.has(la.code));
    const removed = original.learningAreas.filter((la) => !draftByCode.has(la.code));

    // "Renamed" = same code kept, but the display name changed.
    const renamed = draft.learningAreas
      .filter((la) => originalByCode.has(la.code))
      .filter((la) => originalByCode.get(la.code)!.name !== la.name)
      .map((la) => ({ code: la.code, from: originalByCode.get(la.code)!.name, to: la.name }));

    const unchanged = draft.learningAreas.filter(
      (la) => originalByCode.has(la.code) && originalByCode.get(la.code)!.name === la.name
    );

    const hasStructuralChanges = added.length > 0 || removed.length > 0 || renamed.length > 0;

    // Count how many historical reports are pinned to the base version. These are
    // the records that will keep using the OLD curriculum after publishing — they
    // are never rewritten, which is the whole point of versioning.
    const pinnedHistoricalReports = await tDb.reportTemplate.count({
      where: { curriculumVersion: original.activeVersion },
    });

    return {
      baseVersion: original.activeVersion,
      draftVersion: draft.activeVersion,
      added: added.map((a) => ({ code: a.code, name: a.name })),
      removed: removed.map((a) => ({ code: a.code, name: a.name })),
      renamed,
      unchangedCount: unchanged.length,
      hasStructuralChanges,
      impact: {
        learningAreasAfter: draft.learningAreas.length,
        learningAreasBefore: original.learningAreas.length,
        pinnedHistoricalReports,
        warning: hasStructuralChanges
          ? "Existing reports keep the curriculum version they were issued under. Only future reports will use this new version."
          : "No structural changes detected. Publishing is safe.",
      },
    };
  });
}

// 3. Publish — archives the old active version (keeping it for historical
// reports) and activates the draft with an effective-from date.
export async function publishDraftVersion(user: SessionUser, draftId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const draft = await tDb.curriculum.findUnique({ where: { id: draftId } });
    if (!draft) throw new VersioningError("NOT_FOUND", "Draft version not found.");
    if (draft.status !== "DRAFT") throw new VersioningError("INVALID", "Only a DRAFT version can be published.");

    const effectiveDate = todayYmd();

    if (draft.previousVersionId) {
      // Retire the old one but KEEP it (status ARCHIVED) so historical reports
      // pinned to it still resolve. We never delete archived versions.
      await tDb.curriculum.update({
        where: { id: draft.previousVersionId },
        data: {
          status: "ARCHIVED",
          isActive: false,
          effectiveTo: effectiveDate,
        },
      });
    }

    const active = await tDb.curriculum.update({
      where: { id: draftId },
      data: {
        status: "ACTIVE",
        isActive: true,
        effectiveFrom: effectiveDate,
        effectiveTo: null,
      },
    });

    await writeAudit(user, "curriculum.version_published", active.id, {
      version: active.activeVersion,
      archivedPreviousId: draft.previousVersionId,
      effectiveFrom: effectiveDate,
    });

    return active;
  });
}

export async function getCurriculumVersions(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().curriculum.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { learningAreas: true } } },
    });
  });
}
