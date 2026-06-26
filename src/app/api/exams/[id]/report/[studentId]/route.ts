/**
 * B.5.7 report card PDF download. exam.view + row-scoping (parents own child,
 * published exams only — enforced in studentReport).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { buildReportCardPdf } from "@/lib/services/document.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  try {
    const user = await requirePermission("exam.view");
    const { pdf, fileName } = await buildReportCardPdf(user, params.id, params.studentId);
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
