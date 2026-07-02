import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";
import { learnerJourneyQuerySchema } from "@/lib/validations/learner-journey";
import { exportLearnerJourneyPack } from "@/lib/services/learner-journey.service";
import { renderLearnerJourneyExportPdf } from "@/lib/documents/learner-journey-export";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId parameter is required.", 422);

    const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
    if (!["json", "pdf"].includes(format)) {
      return fail("INVALID", "Supported export formats are json and pdf.", 422);
    }

    const query = learnerJourneyQuerySchema.parse({
      studentId,
      mode: req.nextUrl.searchParams.get("mode") ?? undefined,
      from: req.nextUrl.searchParams.get("from") ?? undefined,
      to: req.nextUrl.searchParams.get("to") ?? undefined,
      source: req.nextUrl.searchParams.get("source") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const pack = await exportLearnerJourneyPack(user, query);

    if (format === "pdf") {
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
      const pdf = await renderLearnerJourneyExportPdf({
        schoolName: tenant.name,
        motto: tenant.motto,
        county: tenant.county,
        addressLine: tenant.addressLine,
        brandPrimary: tenant.brandPrimary || "#1c2740",
        studentName: pack.learner.name,
        admissionNo: pack.learner.admissionNo,
        className: pack.learner.className,
        mode: pack.export.filters.mode,
        generatedDate: pack.manifest.generatedAt.slice(0, 10),
        verifyCode: pack.export.verifyCode,
        entries: pack.journey,
      });
      const fileName = `Learner-Journey-${pack.learner.admissionNo}.pdf`;
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return Response.json({ ok: true, data: { pack } });
  } catch (error) {
    return handleError(error);
  }
}
