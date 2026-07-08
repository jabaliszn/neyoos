import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { deleteNationalAssessment, PathwayError } from "@/lib/services/pathway.service";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("academics.manage");
    await deleteNationalAssessment(user, params.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof PathwayError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    return handleError(error);
  }
}
