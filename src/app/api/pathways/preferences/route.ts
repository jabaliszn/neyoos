import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { setStudentPreferencesSchema } from "@/lib/validations/pathways";
import { getStudentPreferences, setStudentPreferences } from "@/lib/services/pathway.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const preferences = await getStudentPreferences(user, studentId);
    return ok({ data: preferences });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const body = await req.json();
    const { preferences } = setStudentPreferencesSchema.parse(body);
    const updated = await setStudentPreferences(user, studentId, preferences);
    return ok({ data: updated });
  } catch (error) {
    return handleError(error);
  }
}
