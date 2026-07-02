/**
 * G.10/G.8/N.1 Bulk Student ID Cards PDF download.
 * POST { studentIds: string[], layout?: "single" | "batch-a4" } -> application/pdf
 * attachment. Permission: student.view.
 *
 * N.1 — "batch-a4" (the new default) packs a DENSE grid of cards onto real
 * A4 sheets with dashed cut-lines, auto-fitting as many cards as physically
 * fit at the chosen card size — a school prints on ordinary paper and cuts
 * the cards apart, no card-stock printer required. "single" keeps the
 * original one-card-per-page behavior for schools with a card printer.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { canViewStudent, StudentError } from "@/lib/services/student.service";
import { renderStudentIdCardsPdf, renderStudentIdCardsBatchA4Pdf, StudentIdCard } from "@/lib/documents/student-id-pdf";
import { qrDataUrl, verifyUrl } from "@/lib/documents/qr";
import { issueVerification } from "@/lib/services/document.service";
import { getDocumentDesign } from "@/lib/services/document-design.service";
import { logoAsDataUrl } from "@/lib/documents/school-stamp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const body = await req.json().catch(() => ({}));
    const studentIds = body.studentIds as string[];
    const design = await getDocumentDesign(user.tenantId);
    const width = body.width ? Number(body.width) : design.idCardWidthMm;
    const height = body.height ? Number(body.height) : design.idCardHeightMm;
    const template = body.template || design.idTemplate;
    const layout: "single" | "batch-a4" = body.layout === "single" ? "single" : "batch-a4";
    const showStamp = body.showStamp !== undefined ? Boolean(body.showStamp) : design.idStampEnabled;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return new Response("Invalid student IDs", { status: 422 });
    }

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const logoDataUrl = showStamp ? await logoAsDataUrl(tenant.logoUrl) : null;
    const issuedDateText = new Date().toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

    // Filter students where the user has permission check
    const allowedCards: StudentIdCard[] = [];
    for (const id of studentIds) {
      if (!(await canViewStudent(user, id))) continue;

      const student = await db.student.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { schoolClass: true },
      });
      if (!student) continue;

      const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
      const letterNo = `ID-${student.id.slice(-8).toUpperCase()}`;
      const payload = {
        letterNo,
        student: studentName,
        admissionNo: student.admissionNo,
      };

      const code = await issueVerification(
        user.tenantId,
        "student_id",
        `Student ID Card — ${studentName} (${student.admissionNo})`,
        payload,
        student.id
      );

      const className = student.schoolClass
        ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
        : "Unassigned";

      allowedCards.push({
        schoolName: tenant.name,
        motto: tenant.motto,
        county: tenant.county,
        addressLine: tenant.addressLine,
        brandPrimary: tenant.brandPrimary || "#1c2740",
        studentName,
        admissionNo: student.admissionNo,
        className,
        photoUrl: student.photoUrl,
        verifyCode: code,
        qrDataUrl: await qrDataUrl(verifyUrl(code)),
        logoUrl: tenant.logoUrl,
        logoDataUrl,
        issuedDateText,
      });
    }

    if (allowedCards.length === 0) {
      throw new StudentError("NOT_FOUND", "No accessible students found.");
    }

    const pdf = layout === "batch-a4"
      ? await renderStudentIdCardsBatchA4Pdf(allowedCards, { width, height, template, showStamp })
      : await renderStudentIdCardsPdf(allowedCards, { width, height, template, showStamp });
    const fileName = `Bulk-ID-Cards-${allowedCards.length}${layout === "batch-a4" ? "-A4-sheets" : ""}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
