import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { communityServiceSchema } from "@/lib/validations/community-service";
import { getStudentServiceActivities, logServiceActivity, deleteServiceActivity, CommunityServiceError } from "@/lib/services/community-service.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("students.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    const data = await getStudentServiceActivities(user, studentId);
    return ok({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("students.manage");
    const body = await req.json();
    const data = communityServiceSchema.parse(body);
    const activity = await logServiceActivity(user, data);
    return ok({ data: activity }, 201);
  } catch (error) {
    if (error instanceof CommunityServiceError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("students.manage");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "id required", 400);
    await deleteServiceActivity(user, id);
    return ok({ message: "Deleted" });
  } catch (error) {
    if (error instanceof CommunityServiceError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    return handleError(error);
  }
}
