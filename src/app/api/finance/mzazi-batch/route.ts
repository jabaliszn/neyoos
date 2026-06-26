/**
 * G.13 — whole-class batch of Mzazi cards (A6 PDF, one card per page).
 * GET ?classId= -> application/pdf. Permission: finance.view (bursar/reception
 * print the stack for distribution).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { classBatchSchema } from "@/lib/validations/mzazi";
import { buildClassMzaziBatchPdf } from "@/lib/services/mzazi.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("finance.view");
    const { classId } = classBatchSchema.parse({ classId: req.nextUrl.searchParams.get("classId") });
    const { pdf, fileName } = await buildClassMzaziBatchPdf(user, classId);
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
