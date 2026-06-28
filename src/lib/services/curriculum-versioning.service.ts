import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";

export class VersioningError extends Error {
  constructor(public code: "NOT_FOUND" | "CONFLICT" | "INVALID", message: string) {
    super(message);
    this.name = "VersioningError";
  }
}

// 1. Clone active curriculum into a DRAFT
export async function createDraftVersion(user: SessionUser, originalCurriculumId: string, newVersionName: string) {
  const tDb = tenantDb();
  
  const original = await tDb.curriculum.findUnique({
    where: { id: originalCurriculumId },
    include: { learningAreas: true }
  });

  if (!original) throw new VersioningError("NOT_FOUND", "Original curriculum not found");
  if (original.status === "DRAFT") throw new VersioningError("CONFLICT", "Cannot draft from a draft");

  // Create the new shell
  const draft = await tDb.curriculum.create({
    data: {
      tenantId: user.tenantId,
      name: original.name,
      country: original.country,
      context: original.context,
      activeVersion: newVersionName, // e.g. "v2" or "2027 Update"
      status: "DRAFT",
      isActive: false,
      previousVersionId: original.id,
      learningAreas: {
        create: original.learningAreas.map(la => ({
          tenantId: user.tenantId,
          name: la.name,
          code: la.code,
          description: la.description
        }))
      }
    }
  });

  return draft;
}

// 2. Diff Preview
export async function previewCurriculumDiff(user: SessionUser, draftId: string) {
  const tDb = tenantDb();
  
  const draft = await tDb.curriculum.findUnique({
    where: { id: draftId },
    include: { learningAreas: true }
  });

  if (!draft || !draft.previousVersionId) throw new VersioningError("NOT_FOUND", "Draft or previous version not found");

  const original = await tDb.curriculum.findUnique({
    where: { id: draft.previousVersionId },
    include: { learningAreas: true }
  });

  if (!original) throw new VersioningError("NOT_FOUND", "Original not found");

  const originalAreas = new Set(original.learningAreas.map(la => la.code));
  const draftAreas = new Set(draft.learningAreas.map(la => la.code));

  const added = draft.learningAreas.filter(la => !originalAreas.has(la.code));
  const removed = original.learningAreas.filter(la => !draftAreas.has(la.code));
  const unchanged = draft.learningAreas.filter(la => originalAreas.has(la.code));

  return {
    baseVersion: original.activeVersion,
    draftVersion: draft.activeVersion,
    added: added.map(a => a.name),
    removed: removed.map(a => a.name),
    unchangedCount: unchanged.length,
  };
}

// 3. Publish
export async function publishDraftVersion(user: SessionUser, draftId: string) {
  const tDb = tenantDb();
  
  const draft = await tDb.curriculum.findUnique({ where: { id: draftId } });
  if (!draft || draft.status !== "DRAFT") throw new VersioningError("INVALID", "Invalid draft");

  if (draft.previousVersionId) {
    // Retire old one
    await tDb.curriculum.update({
      where: { id: draft.previousVersionId },
      data: {
        status: "ARCHIVED",
        isActive: false,
        effectiveTo: new Date().toISOString().split("T")[0]
      }
    });
  }

  // Activate new one
  const active = await tDb.curriculum.update({
    where: { id: draftId },
    data: {
      status: "ACTIVE",
      isActive: true,
      effectiveFrom: new Date().toISOString().split("T")[0]
    }
  });

  return active;
}

export async function getCurriculumVersions(user: SessionUser) {
  return tenantDb().curriculum.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { learningAreas: true } } }
  });
}
