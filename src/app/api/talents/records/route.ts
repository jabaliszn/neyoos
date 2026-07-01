import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { talentRecordSchema } from "@/lib/validations/talents";
import { getStudentTalentRecords, recordStudentTalent, TalentError } from "@/lib/services/talent.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const records = await getStudentTalentRecords(user, studentId);
    return ok({ data: records });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Teachers and coaches can record talent progression
    const user = await requirePermission("academics.view"); 
    const body = await req.json();
    const data = talentRecordSchema.parse(body);
    const record = await recordStudentTalent(user, data);
    return ok({ data: record }, 201);
  } catch (error) {
    if (error instanceof TalentError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
