import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getStudentPreferences } from "@/lib/services/pathway.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("students.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) throw new Error("studentId required");
    const preferences = await getStudentPreferences(user, studentId);
    return ok({ data: preferences });
  } catch (error) {
    return handleError(error);
  }
}
