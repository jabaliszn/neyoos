/**
 * B.1 Transfer letter PDF download (QR-verified, co-branded — G.10).
 * GET -> application/pdf attachment. Permission: student.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { canViewStudent } from "@/lib/services/student.service";
import { buildTransferLetterPdf } from "@/lib/services/document.service";
import { StudentError } from "@/lib/services/student.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    // Row-scoping: a PARENT can download their own child's letter, not others'.
    if (!(await canViewStudent(user, params.id)))
      throw new StudentError("NOT_FOUND", "Student not found.");
    const { pdf, fileName } = await buildTransferLetterPdf(user.tenantId, params.id, user.fullName);
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
