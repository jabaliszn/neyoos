import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { getStudentPathwayReadiness } from "@/lib/services/pathway.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const readiness = await getStudentPathwayReadiness(user, studentId);
    return ok({ data: readiness });
  } catch (error) {
    return handleError(error);
  }
}
