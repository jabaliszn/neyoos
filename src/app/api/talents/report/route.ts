import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { buildTalentReport } from "@/lib/services/talent.service";
import { renderTalentReportPdf } from "@/lib/documents/talent-report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
    const termId = req.nextUrl.searchParams.get("termId");
    if (format !== "json" && format !== "pdf") {
      return fail("INVALID", "Supported report formats are json and pdf.", 422);
    }

    const report = await buildTalentReport(user, { termId: termId || null });

    if (format === "json") {
      return ok({ data: report });
    }

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const buffer = await renderTalentReportPdf({
      schoolName: tenant.name,
      motto: tenant.motto,
      county: tenant.county,
      addressLine: tenant.addressLine,
      brandPrimary: tenant.brandPrimary || "#1c2740",
      generatedDate: new Date(report.generatedAt).toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" }),
      termLabel: report.termLabel,
      analytics: report.analytics,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Talent-Participation-Report.pdf"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
