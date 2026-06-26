/**
 * G.13 — single learner's Mzazi card (A6 PDF, QR-verified).
 * GET -> application/pdf. Permission: student.view (row-scoped in the service,
 * so a PARENT can print their own child's card but not others').
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { buildMzaziCardPdf } from "@/lib/services/mzazi.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    const { pdf, fileName } = await buildMzaziCardPdf(user, params.id);
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
