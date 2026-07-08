import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { nationalAssessmentSchema } from "@/lib/validations/pathways";
import { recordNationalAssessment, getStudentNationalAssessments, PathwayError } from "@/lib/services/pathway.service";

/**
 * P.4 — real EXTERNAL KNEC national assessment milestones (KPSEA/KJSEA/
 * Senior Secondary Assessment/legacy KCPE/KCSE) per student. Distinct from
 * the internal Exam/ExamResult routes and from ExamMaterialRecord (which
 * only tracks application/registration logistics, not a received result).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const rows = await getStudentNationalAssessments(user, studentId);
    return ok(rows);
  } catch (error) {
    if (error instanceof PathwayError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    const data = nationalAssessmentSchema.parse(body);
    const record = await recordNationalAssessment(user, data);
    return ok(record, 201);
  } catch (error) {
    if (error instanceof PathwayError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
