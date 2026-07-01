import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";
import { exportTransferPassportPdf } from "@/lib/services/digital-identity.service";

export async function GET(req: NextRequest) {
  try {
    // J.22 — export tightened to Admin/Principal level (was student.view, which
    // TEACHER & PARENT also hold). Exporting a full transfer passport PDF is a
    // privileged compliance action.
    const user = await requirePermission("student.edit");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const buffer = await exportTransferPassportPdf(user, studentId);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="student-transfer-passport.pdf"',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
