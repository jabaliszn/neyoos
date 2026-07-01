import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type GlobalCurriculumTemplateInput } from "@/lib/validations/global-curriculum";

export class GlobalTemplateError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "GlobalTemplateError";
  }
}

function assertOps(user: SessionUser) {
  if (user.role !== "SUPER_ADMIN") {
    throw new GlobalTemplateError("FORBIDDEN", "Only NEYO Ops (Super Admin) can manage company curriculum templates.");
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
        entityType: "GlobalCurriculumTemplate",
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // Audit logging must never block the workflow.
  }
}

// =============================================================================
// 1. NEYO Ops (Super Admin) — manage company-level templates
// =============================================================================

export async function getGlobalTemplates(user: SessionUser, onlyPublished = false) {
  if (!onlyPublished) assertOps(user);
  return db.globalCurriculumTemplate.findMany({
    where: onlyPublished ? { status: "PUBLISHED" } : undefined,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function upsertGlobalTemplate(user: SessionUser, input: GlobalCurriculumTemplateInput, id?: string) {
  assertOps(user);

  const base = {
    name: input.name,
    country: input.country,
    context: input.context ?? null,
    version: input.version,
    description: input.description ?? null,
    status: input.status,
    changeNote: input.changeNote ?? null,
    learningAreasJson: JSON.stringify(input.learningAreas),
  };

  if (id) {
    const existing = await db.globalCurriculumTemplate.findUnique({ where: { id } });
    if (!existing) throw new GlobalTemplateError("NOT_FOUND", "Template not found.");

    // Stamp publishedAt the first time a template transitions to PUBLISHED.
    const becomingPublished = input.status === "PUBLISHED" && existing.status !== "PUBLISHED";
    const updated = await db.globalCurriculumTemplate.update({
      where: { id },
      data: { ...base, ...(becomingPublished ? { publishedAt: new Date() } : {}) },
    });

    await writeAudit(user, becomingPublished ? "curriculum.template_published" : "curriculum.template_updated", updated.id, {
      name: updated.name,
      version: updated.version,
      status: updated.status,
    });
    return updated;
  }

  const created = await db.globalCurriculumTemplate.create({
    data: { ...base, ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });

  await writeAudit(user, input.status === "PUBLISHED" ? "curriculum.template_published" : "curriculum.template_created", created.id, {
    name: created.name,
    version: created.version,
    status: created.status,
  });
  return created;
}

export async function deleteGlobalTemplate(user: SessionUser, id: string) {
  assertOps(user);
  const existing = await db.globalCurriculumTemplate.findUnique({ where: { id } });
  if (!existing) throw new GlobalTemplateError("NOT_FOUND", "Template not found.");
  await db.globalCurriculumTemplate.delete({ where: { id } });
  await writeAudit(user, "curriculum.template_deleted", id, { name: existing.name, version: existing.version });
  return { ok: true };
}

/**
 * Announce a new/updated version of a PUBLISHED template. This stamps the
 * template's `announcedAt` + `changeNote` so schools that adopted an older
 * version can be shown an "update available" signal and adopt it intentionally.
 */
export async function announceTemplateUpdate(user: SessionUser, id: string, changeNote: string) {
  assertOps(user);
  const existing = await db.globalCurriculumTemplate.findUnique({ where: { id } });
  if (!existing) throw new GlobalTemplateError("NOT_FOUND", "Template not found.");
  if (existing.status !== "PUBLISHED") throw new GlobalTemplateError("INVALID", "Only a published template can be announced.");

  const note = (changeNote || "").trim();
  if (note.length < 3) throw new GlobalTemplateError("INVALID", "Add a short note describing what changed.");

  const updated = await db.globalCurriculumTemplate.update({
    where: { id },
    data: { announcedAt: new Date(), changeNote: note },
  });
  await writeAudit(user, "curriculum.template_announced", updated.id, { name: updated.name, version: updated.version, changeNote: note });
  return updated;
}

// =============================================================================
// 2. School tenant — adopt template + detect updates
// =============================================================================

export async function adoptCurriculumTemplate(user: SessionUser, templateId: string) {
  const template = await db.globalCurriculumTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.status !== "PUBLISHED") {
    throw new GlobalTemplateError("NOT_FOUND", "Template not found or not published.");
  }

  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    // Create a DRAFT curriculum inside the school so adoption is intentional —
    // the school reviews + publishes it via the J.20 versioning workflow.
    const draft = await tDb.curriculum.create({
      data: {
        tenantId: user.tenantId,
        name: template.name,
        country: template.country,
        context: template.context,
        activeVersion: `${template.version} (Imported)`,
        status: "DRAFT",
        isActive: false,
        adoptedTemplateId: template.id,
        adoptedTemplateVersion: template.version,
        learningAreas: {
          create: JSON.parse(template.learningAreasJson).map((la: any) => ({
            tenantId: user.tenantId,
            name: la.name,
            code: la.code,
            description: la.description ?? null,
          })),
        },
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "curriculum.template_adopted",
        entityType: "Curriculum",
        entityId: draft.id,
        metadata: JSON.stringify({ templateId: template.id, templateName: template.name, templateVersion: template.version }),
      },
    });

    return draft;
  });
}

/**
 * For a school: which adopted templates have a newer published version available?
 * Compares the version a school adopted against the current published template
 * version, so the school can choose to adopt the update intentionally.
 */
export async function getTemplateUpdatesForSchool(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const adopted = await tenantDb().curriculum.findMany({
      where: { adoptedTemplateId: { not: null } },
    });
    if (adopted.length === 0) return [];

    const templateIds = Array.from(new Set(adopted.map((c) => c.adoptedTemplateId!).filter(Boolean)));
    const templates = await db.globalCurriculumTemplate.findMany({
      where: { id: { in: templateIds }, status: "PUBLISHED" },
    });
    const byId = new Map(templates.map((t) => [t.id, t]));

    return adopted
      .map((c) => {
        const template = byId.get(c.adoptedTemplateId!);
        if (!template) return null;
        const updateAvailable = template.version !== c.adoptedTemplateVersion;
        return {
          curriculumId: c.id,
          curriculumName: c.name,
          adoptedVersion: c.adoptedTemplateVersion,
          latestVersion: template.version,
          updateAvailable,
          changeNote: template.changeNote,
          announcedAt: template.announcedAt,
          templateId: template.id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.updateAvailable);
  });
}
