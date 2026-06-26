import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { STUDENT_STATUSES } from "@/lib/validations/student";
import { updateStudent } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(STUDENT_STATUSES) });

/** PUT /api/students/:id/status — change status (kanban drag / quick action). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const { status } = schema.parse(await req.json().catch(() => ({})));
    const result = await updateStudent(user, params.id, { status });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
