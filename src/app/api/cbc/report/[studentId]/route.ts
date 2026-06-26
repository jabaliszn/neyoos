/**
 * B.6 competency profile (JSON) + KICD-format report PDF (?format=pdf).
 * exam.view; parents row-scoped to own child via studentCompetencies.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { studentCompetencies } from "@/lib/services/cbc.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const user = await requirePermission("exam.view");
    const data = await studentCompetencies(user, params.studentId);
    if (req.nextUrl.searchParams.get("format") === "pdf") {
      const { buildCbcReportPdf } = await import("@/lib/services/document.service");
      const { pdf, fileName } = await buildCbcReportPdf(user, data);
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"` },
      });
    }
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
