import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { getDocumentDesign } from "@/lib/services/document-design.service";
import { issueVerification } from "@/lib/services/document.service";
import { qrDataUrl, verifyUrl } from "@/lib/documents/qr";
import { renderModularReportPdf, type ModularReportSection } from "@/lib/documents/modular-report-pdf";
import { type SessionUser } from "@/lib/core/session";
import { type ReportTemplateInput } from "@/lib/validations/report-builder";
import { studentCompetencies } from "@/lib/services/cbc.service";
import { getStudentPathwayReadiness } from "@/lib/services/pathway.service";

export class ReportTemplateError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ReportTemplateError";
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
        entityType: "ReportTemplate",
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {}
}

function safeParseSections(raw: string): any[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getReportTemplates(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().reportTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  });
}

export async function getReportTemplate(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const template = await tenantDb().reportTemplate.findUnique({ where: { id } });
    if (!template) throw new ReportTemplateError("NOT_FOUND", "Template not found.");
    return template;
  });
}

export async function createReportTemplate(user: SessionUser, input: ReportTemplateInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.reportTemplate.findUnique({ where: { tenantId_name: { tenantId: user.tenantId, name: input.name } } });
    if (existing) throw new ReportTemplateError("CONFLICT", "A template with this name already exists.");

    if (input.isDefault) {
      await tDb.reportTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const created = await tDb.reportTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: input.name,
        description: input.description || null,
        isDefault: input.isDefault,
        version: input.version || "v1",
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        curriculumVersion: input.curriculumVersion || null,
        sectionsJson: JSON.stringify(input.sections),
      },
    });
    await writeAudit(user, "report_template.created", created.id, {
      name: created.name,
      isDefault: created.isDefault,
      version: created.version,
      effectiveFrom: created.effectiveFrom,
      effectiveTo: created.effectiveTo,
      curriculumVersion: created.curriculumVersion,
      sectionCount: input.sections.length,
    });
    return created;
  });
}

export async function updateReportTemplate(user: SessionUser, id: string, input: ReportTemplateInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new ReportTemplateError("NOT_FOUND", "Template not found.");

    const nameConflict = await tDb.reportTemplate.findUnique({ where: { tenantId_name: { tenantId: user.tenantId, name: input.name } } });
    if (nameConflict && nameConflict.id !== id) throw new ReportTemplateError("CONFLICT", "Name taken.");

    if (input.isDefault) {
      await tDb.reportTemplate.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }

    const updated = await tDb.reportTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        isDefault: input.isDefault,
        version: input.version || "v1",
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        curriculumVersion: input.curriculumVersion || null,
        sectionsJson: JSON.stringify(input.sections),
      },
    });
    await writeAudit(user, "report_template.updated", updated.id, {
      name: updated.name,
      isDefault: updated.isDefault,
      version: updated.version,
      effectiveFrom: updated.effectiveFrom,
      effectiveTo: updated.effectiveTo,
      curriculumVersion: updated.curriculumVersion,
      sectionCount: input.sections.length,
    });
    return updated;
  });
}

export async function deleteReportTemplate(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new ReportTemplateError("NOT_FOUND", "Template not found.");
    if (existing.isDefault) throw new ReportTemplateError("CONFLICT", "Cannot delete the default template. Assign another template as default first.");
    await tenantDb().reportTemplate.delete({ where: { id } });
    await writeAudit(user, "report_template.deleted", id, { name: existing.name });
    return { ok: true };
  });
}

export async function buildTemplateDrivenReportPdf(user: SessionUser, studentId: string, templateId?: string | null) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const template = templateId
      ? await tDb.reportTemplate.findUnique({ where: { id: templateId } })
      : await tDb.reportTemplate.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "desc" } });
    if (!template) throw new ReportTemplateError("NOT_FOUND", "No report template found. Create one first.");

    const [tenant, design, student] = await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } }),
      getDocumentDesign(user.tenantId),
      tDb.student.findUnique({ where: { id: studentId }, include: { schoolClass: true, guardians: { include: { guardian: true } } } }),
    ]);
    if (!student) throw new ReportTemplateError("NOT_FOUND", "Student not found.");

    const latestExamResult = await tDb.examResult.findFirst({ where: { studentId }, orderBy: { updatedAt: "desc" } });
    const latestExam = latestExamResult ? await db.exam.findUnique({ where: { id: latestExamResult.examId } }) : null;
    const examResults = latestExam
      ? await tDb.examResult.findMany({ where: { studentId, examId: latestExam.id }, orderBy: { subjectId: "asc" } })
      : [];
    const subjectIds = Array.from(new Set(examResults.map((r) => r.subjectId)));
    const subjects = subjectIds.length ? await db.subject.findMany({ where: { id: { in: subjectIds } } }) : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const competencies = await studentCompetencies(user, studentId);
    const attendance = await tDb.attendanceRecord.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 30 });
    const discipline = await tDb.disciplineIncident.findMany({ where: { studentId, status: "APPROVED" }, orderBy: { date: "desc" }, take: 10 });
    const talents = await tDb.talentRecord.findMany({ where: { studentId }, include: { talentArea: true }, orderBy: { dateRecorded: "desc" }, take: 10 });
    const portfolio = await tDb.portfolioItem.findMany({ where: { studentId, status: "APPROVED", visibleToParents: true }, orderBy: { approvedAt: "desc" }, take: 8 });
    const pathway = await getStudentPathwayReadiness(user, studentId).catch(() => null);

    const sections = safeParseSections(template.sectionsJson);
    const firstName = student.firstName;
    const rows = examResults.map((r) => {
      const pct = latestExam?.maxMarks ? Math.round((r.marks / latestExam.maxMarks) * 100) : 0;
      return {
        subject: subjectMap.get(r.subjectId)?.name || "Subject",
        code: subjectMap.get(r.subjectId)?.code || "—",
        marks: r.marks,
        pct,
        grade: tenant.curriculum === "CBC" ? (pct >= 80 ? "EE" : pct >= 65 ? "ME" : pct >= 50 ? "AE" : "BE") : (pct >= 80 ? "A" : pct >= 75 ? "A-" : pct >= 70 ? "B+" : pct >= 65 ? "B" : pct >= 60 ? "B-" : pct >= 55 ? "C+" : pct >= 50 ? "C" : pct >= 45 ? "C-" : pct >= 40 ? "D+" : pct >= 35 ? "D" : pct >= 30 ? "D-" : "E"),
      };
    });
    const total = rows.reduce((sum, r) => sum + r.marks, 0);
    const avgPct = rows.length && latestExam?.maxMarks ? Math.round(total / (rows.length * latestExam.maxMarks) * 100) : 0;

    const modularSections: ModularReportSection[] = sections.map((section: any) => {
      switch (section.type) {
        case "HEADER":
          return { type: "HEADER", title: section.title || template.name, items: [
            `Learner: ${[student.firstName, student.lastName].filter(Boolean).join(" ")}`,
            `Admission no.: ${student.admissionNo}`,
            `Class: ${student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : "Unassigned"}`,
          ] };
        case "ACADEMIC_MARKS":
          return { type: "ACADEMIC_MARKS", title: section.title || "Academic marks", rows: rows.map((r) => `${r.subject} (${r.code}) · ${r.marks}${latestExam?.maxMarks ? `/${latestExam.maxMarks}` : ""} · ${r.pct}% · ${r.grade}`) };
        case "COMPETENCIES":
          return { type: "COMPETENCIES", title: section.title || "Competencies", rows: competencies.subjects.flatMap((sub) => sub.strands.slice(0, 3).map((st) => `${sub.subject} · ${st.strand} · ${st.code} ${st.label}`)) };
        case "ATTENDANCE": {
          const present = attendance.filter((a) => a.status === "P").length;
          return { type: "ATTENDANCE", title: section.title || "Attendance", items: [`Recent records: ${attendance.length}`, `Present: ${present}`, `Absent/Late/Excused: ${attendance.length - present}`] };
        }
        case "DISCIPLINE":
          return { type: "DISCIPLINE", title: section.title || "Behavior", rows: discipline.map((d) => `${d.date} · ${d.category} · ${d.severity} · ${d.points} pts`) };
        case "TALENTS":
          return { type: "TALENTS", title: section.title || "Talent profile", rows: talents.map((t) => `${t.talentArea.name}${t.score != null ? ` · score ${t.score}` : ""}`) };
        case "PORTFOLIO":
          return { type: "PORTFOLIO", title: section.title || "Portfolio highlights", rows: portfolio.map((p) => `${p.title} · ${p.category || "Portfolio"}`) };
        case "TEACHER_REMARKS":
          return { type: "TEACHER_REMARKS", title: section.title || "Teacher comment", items: [avgPct >= 75 ? `${firstName} is doing very well. Keep the momentum.` : avgPct >= 50 ? `${firstName} is progressing steadily and needs consistency.` : `${firstName} needs structured support and closer follow-up.`] };
        case "PRINCIPAL_REMARKS":
          return { type: "PRINCIPAL_REMARKS", title: section.title || "Principal comment", items: [pathway ? `Readiness tracked across ${pathway.pathways.length} pathways.` : `Keep building both academic and co-curricular growth.`] };
        case "QR_VERIFICATION":
          return { type: "QR_VERIFICATION", title: section.title || "QR verification", items: ["This report is QR verifiable."] };
        default:
          return { type: section.type || "CUSTOM", title: section.title || section.type || "Custom section", items: ["Custom section configured by school."] };
      }
    });

    const letterNo = `MDR-${template.id.slice(-4).toUpperCase()}${student.id.slice(-4).toUpperCase()}`;
    const verifyCode = await issueVerification(
      user.tenantId,
      "modular_report",
      `${template.name} — ${student.admissionNo}`,
      { templateId: template.id, studentId: student.id, sectionCount: modularSections.length }
    );

    const pdf = await renderModularReportPdf({
      schoolName: tenant.name,
      motto: tenant.motto,
      county: tenant.county,
      addressLine: tenant.addressLine,
      brandPrimary: tenant.brandPrimary || "#1c2740",
      documentTemplate: design.documentTemplate,
      poweredByNeyo: design.poweredByNeyo,
      reportTitle: template.name,
      description: template.description,
      studentName: [student.firstName, student.lastName].filter(Boolean).join(" "),
      admissionNo: student.admissionNo,
      className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      verifyCode,
      qrDataUrl: await qrDataUrl(verifyUrl(verifyCode)),
      issuedDate: new Date().toISOString().slice(0, 10),
      sections: modularSections,
    });

    await writeAudit(user, "report_template.pdf_generated", template.id, { studentId, templateName: template.name, sectionCount: modularSections.length });
    return { pdf, template, verifyCode, fileName: `${letterNo}-${student.admissionNo}.pdf`, design, sections: modularSections };
  });
}


/**
 * J.20 — resolve the report template that was effective on a given historical
 * date, so a reprinted report keeps the curriculum version used at the time.
 *
 * Ranking (best first):
 *   1. Exact curriculum-version match AND the date falls in its effective window.
 *   2. Any template whose effective window covers the date.
 *   3. The default / newest template as a safe fallback.
 */
export async function findHistoricalReportTemplate(user: SessionUser, onDate: string, curriculumVersion?: string | null) {
  return withTenant(user.tenantId, async () => {
    const templates = await tenantDb().reportTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });

    const dateInWindow = (template: (typeof templates)[number]) => {
      const fromOk = !template.effectiveFrom || template.effectiveFrom <= onDate;
      const toOk = !template.effectiveTo || template.effectiveTo >= onDate;
      return fromOk && toOk;
    };

    // 1) Exact curriculum-version match within the effective window.
    if (curriculumVersion) {
      const exact = templates.find((t) => t.curriculumVersion === curriculumVersion && dateInWindow(t));
      if (exact) return exact;
    }

    // 2) Any template whose effective window explicitly covers the date.
    const windowed = templates.find((t) => (t.effectiveFrom || t.effectiveTo) && dateInWindow(t));
    if (windowed) return windowed;

    // 3) Safe fallback: default / newest template.
    return templates[0] || null;
  });
}
