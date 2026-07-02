import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { createReportTemplate, updateReportTemplate, deleteReportTemplate, buildTemplateDrivenReportPdf, getReportTemplates } from "@/lib/services/report-template.service";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });

  await db.tenant.update({ where: { id: tenant.id }, data: { documentDesignJson: JSON.stringify({ documentTemplate: "classic", poweredByNeyo: true, idCardWidthMm: 74, idCardHeightMm: 105, idTemplate: "navy", smallTimetableLogo: true }) } });

  const user = {
    id: principal.id,
    tenantId: tenant.id,
    neyoLoginId: principal.neyoLoginId,
    fullName: principal.fullName,
    phone: principal.phone,
    email: principal.email,
    role: principal.role,
    secondaryRole: principal.secondaryRole,
    language: principal.language,
  } as any;

  const name = `J15 Fullstack ${Date.now()}`;
  const created = await createReportTemplate(user, {
    name,
    description: "Template-driven modular report",
    isDefault: true,
    version: "v1",
    effectiveFrom: null,
    effectiveTo: null,
    sections: [
      { id: "1", type: "HEADER", config: {} },
      { id: "2", type: "ACADEMIC_MARKS", config: {} },
      { id: "3", type: "COMPETENCIES", config: {} },
      { id: "4", type: "ATTENDANCE", config: {} },
      { id: "5", type: "DISCIPLINE", config: {} },
      { id: "6", type: "TALENTS", config: {} },
      { id: "7", type: "PORTFOLIO", config: {} },
      { id: "8", type: "TEACHER_REMARKS", config: {} },
      { id: "9", type: "PRINCIPAL_REMARKS", config: {} },
      { id: "10", type: "QR_VERIFICATION", config: {} },
    ],
  });
  assert.equal(created.name, name);

  const updated = await updateReportTemplate(user, created.id, {
    name,
    description: "Updated template-driven modular report",
    isDefault: true,
    version: "v1",
    effectiveFrom: null,
    effectiveTo: null,
    sections: [
      { id: "a", type: "HEADER", config: {} },
      { id: "b", type: "PORTFOLIO", config: {} },
      { id: "c", type: "ACADEMIC_MARKS", config: {} },
      { id: "d", type: "QR_VERIFICATION", config: {} },
    ],
  });
  const sections = JSON.parse(updated.sectionsJson);
  assert.deepEqual(sections.map((s: any) => s.type), ["HEADER", "PORTFOLIO", "ACADEMIC_MARKS", "QR_VERIFICATION"]);

  const built = await buildTemplateDrivenReportPdf(user, student.id, created.id);
  assert.ok(Buffer.isBuffer(built.pdf));
  assert.ok(built.pdf.length > 1000, "pdf should be real");
  assert.equal(built.design.documentTemplate, "classic");
  assert.equal(built.design.poweredByNeyo, true);
  assert.deepEqual(built.sections.map((s: any) => s.type), ["HEADER", "PORTFOLIO", "ACADEMIC_MARKS", "QR_VERIFICATION"]);
  assert.ok(String(built.fileName).endsWith(".pdf"));
  assert.ok(built.verifyCode);

  const templates = await getReportTemplates(user);
  assert.ok(templates.some((t: any) => t.id === created.id));

  const audits = await db.auditLog.findMany({ where: { tenantId: tenant.id, entityType: "ReportTemplate", entityId: created.id }, orderBy: { createdAt: "asc" } });
  const actions = audits.map((a) => a.action);
  assert.ok(actions.includes("report_template.created"));
  assert.ok(actions.includes("report_template.updated"));
  assert.ok(actions.includes("report_template.pdf_generated"));

  await deleteReportTemplate(user, created.id).catch(() => null);
  const deleteReady = await createReportTemplate(user, {
    name: `${name} delete`,
    description: "Delete check",
    isDefault: false,
    version: "v1",
    effectiveFrom: null,
    effectiveTo: null,
    sections: [{ id: "1", type: "HEADER", config: {} }],
  });
  await deleteReportTemplate(user, deleteReady.id);
  const deleteAudit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, entityType: "ReportTemplate", entityId: deleteReady.id, action: "report_template.deleted" } });
  assert.ok(deleteAudit, "delete audit missing");

  const uiText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/academics/report-builder.tsx", "utf8"));
  assert.ok(uiText.includes("Download modular PDF"));
  assert.ok(!uiText.includes('variant="outline"'));
  assert.ok(!uiText.includes('<Badge variant='));

  const routeText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/api/academics/report-templates/route.ts", "utf8"));
  assert.ok(routeText.includes('format === "pdf"'));

  console.log("✅ J.15 modular report builder full-stack test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
