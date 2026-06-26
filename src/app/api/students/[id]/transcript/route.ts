/**
 * G.10 Student Academic Transcript PDF download (QR-verified, co-branded).
 * GET -> application/pdf attachment. Permission: student.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { canViewStudent, StudentError } from "@/lib/services/student.service";
import { buildStudentTranscriptPdf } from "@/lib/services/document.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    // Row-scoping: a PARENT can download their own child's transcript, not others'.
    if (!(await canViewStudent(user, params.id)))
      throw new StudentError("NOT_FOUND", "Student not found.");
      
    const { pdf, fileName } = await buildStudentTranscriptPdf(user.tenantId, params.id);
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
