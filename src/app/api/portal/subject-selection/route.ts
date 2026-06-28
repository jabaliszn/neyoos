import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getActiveSelectionPortals, submitStudentSelections, SelectionError } from "@/lib/services/subject-selection.service";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const level = req.nextUrl.searchParams.get("level") || undefined;
    const data = await getActiveSelectionPortals(user, level);
    return ok({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const body = await req.json();
    
    const input = z.object({
      portalId: z.string().cuid(),
      studentId: z.string().cuid(),
      selectedSubjectIds: z.array(z.string())
    }).parse(body);

    const data = await submitStudentSelections(user, input.portalId, input.studentId, input.selectedSubjectIds);
    return ok({ data }, 201);
  } catch (error) {
    if (error instanceof SelectionError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CLOSED: 423 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    return handleError(error);
  }
}
