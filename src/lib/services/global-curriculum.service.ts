import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type GlobalCurriculumTemplateInput } from "@/lib/validations/global-curriculum";

// 1. NEYO Ops (Super Admin) - Manage Templates
export async function getGlobalTemplates(user: SessionUser, onlyPublished = false) {
  if (!onlyPublished && user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to view unpublished global templates.");
  }
  return db.globalCurriculumTemplate.findMany({
    where: onlyPublished ? { status: "PUBLISHED" } : undefined,
    orderBy: { name: "asc" }
  });
}

export async function upsertGlobalTemplate(user: SessionUser, input: GlobalCurriculumTemplateInput, id?: string) {
  if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");

  const data = {
    name: input.name,
    country: input.country,
    context: input.context,
    version: input.version,
    description: input.description,
    status: input.status,
    learningAreasJson: JSON.stringify(input.learningAreas)
  };

  if (id) {
    return db.globalCurriculumTemplate.update({ where: { id }, data });
  }
  return db.globalCurriculumTemplate.create({ data });
}

export async function deleteGlobalTemplate(user: SessionUser, id: string) {
  if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
  return db.globalCurriculumTemplate.delete({ where: { id } });
}

// 2. School Tenant - Adopt Template
export async function adoptCurriculumTemplate(user: SessionUser, templateId: string) {
  const template = await db.globalCurriculumTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.status !== "PUBLISHED") {
    throw new Error("Template not found or not published.");
  }

  const tDb = tenantDb();
  
  // Create a DRAFT curriculum inside the school
  const draft = await tDb.curriculum.create({
    data: {
      tenantId: user.tenantId,
      name: template.name,
      country: template.country,
      context: template.context,
      activeVersion: \`\${template.version} (Imported)\`,
      status: "DRAFT",
      isActive: false,
      learningAreas: {
        create: JSON.parse(template.learningAreasJson).map((la: any) => ({
          tenantId: user.tenantId,
          name: la.name,
          code: la.code,
          description: la.description
        }))
      }
    }
  });

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "curriculum.template_adopted",
      entityType: "Curriculum",
      entityId: draft.id,
      metadata: JSON.stringify({ templateId: template.id, templateName: template.name })
    }
  });

  return draft;
}
