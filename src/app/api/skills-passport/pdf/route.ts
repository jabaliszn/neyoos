/**
 * PART J.6 — Skills Passport PDF download API.
 *
 * GET /api/skills-passport/pdf?studentId=...
 *   Returns co-branded, QR-verified Skills Passport PDF attachment.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";
import { getSkillsPassportProfile } from "@/lib/services/skills-passport.service";
import { issueVerification } from "@/lib/services/document.service";
import { renderSkillsPassportPdf } from "@/lib/documents/skills-passport-pdf";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId parameter is required.", 422);

    const profile = await getSkillsPassportProfile(user, studentId);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

    // Generate idempotent QR verification code
    const code = await issueVerification(
      user.tenantId,
      "SKILLS_PASSPORT",
      `Skills Passport & Holistic Learner Identity for ${profile.student.name} (${profile.student.admissionNo})`,
      { studentId, admissionNo: profile.student.admissionNo, totalPoints: profile.summary.totalPoints }
    );
    const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
    const qr = await qrDataUrl(verifyUrl(code));

    const pdfBuffer = await renderSkillsPassportPdf({
      schoolName: tenant.name,
      motto: tenant.motto,
      county: tenant.addressLine ? "Nairobi" : null,
      addressLine: tenant.addressLine,
      brandPrimary: tenant.brandPrimary || "#1c2740",
      logoUrl: tenant.logoUrl,
      studentName: profile.student.name,
      admissionNo: profile.student.admissionNo,
      className: profile.student.className,
      academicGrowth: profile.academicGrowth,
      competencyGrowth: profile.competencyGrowth,
      talentAndLeadership: profile.talentAndLeadership,
      verifyCode: `PAS-${code}`,
      qrDataUrl: qr,
      issuedDate: new Date().toISOString().slice(0, 10),
    });

    const fileName = `Skills-Passport-${profile.student.admissionNo}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
