import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type ReportTemplateInput } from "@/lib/validations/report-builder";

export class ReportTemplateError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ReportTemplateError";
  }
}

export async function getReportTemplates(user: SessionUser) {
  return tenantDb().reportTemplate.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function getReportTemplate(user: SessionUser, id: string) {
  const template = await tenantDb().reportTemplate.findUnique({ where: { id } });
  if (!template) throw new ReportTemplateError("NOT_FOUND", "Template not found.");
  return template;
}

export async function createReportTemplate(user: SessionUser, input: ReportTemplateInput) {
  const tDb = tenantDb();
  
  const existing = await tDb.reportTemplate.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } }
  });
  if (existing) throw new ReportTemplateError("CONFLICT", "A template with this name already exists.");

  // If this is set to default, unset other defaults
  if (input.isDefault) {
    await tDb.reportTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });
  }

  return tDb.reportTemplate.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      description: input.description || null,
      isDefault: input.isDefault,
      sectionsJson: JSON.stringify(input.sections)
    }
  });
}

export async function updateReportTemplate(user: SessionUser, id: string, input: ReportTemplateInput) {
  const tDb = tenantDb();
  
  const existing = await tDb.reportTemplate.findUnique({ where: { id } });
  if (!existing) throw new ReportTemplateError("NOT_FOUND", "Template not found.");

  const nameConflict = await tDb.reportTemplate.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } }
  });
  if (nameConflict && nameConflict.id !== id) throw new ReportTemplateError("CONFLICT", "Name taken.");

  if (input.isDefault) {
    await tDb.reportTemplate.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false }
    });
  }

  return tDb.reportTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description || null,
      isDefault: input.isDefault,
      sectionsJson: JSON.stringify(input.sections)
    }
  });
}

export async function deleteReportTemplate(user: SessionUser, id: string) {
  const existing = await tenantDb().reportTemplate.findUnique({ where: { id } });
  if (!existing) throw new ReportTemplateError("NOT_FOUND", "Template not found.");
  
  if (existing.isDefault) throw new ReportTemplateError("CONFLICT", "Cannot delete the default template. Assign another template as default first.");

  return tenantDb().reportTemplate.delete({ where: { id } });
}
