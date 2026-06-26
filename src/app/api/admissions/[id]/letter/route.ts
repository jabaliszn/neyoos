/**
 * B.2.7 Admission/offer letter PDF download. Permission: student.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { buildAdmissionLetterPdf } from "@/lib/services/admission.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    const { pdf, fileName } = await buildAdmissionLetterPdf(user.tenantId, params.id, user.fullName);
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
