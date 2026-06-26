import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { updateStudentSchema } from "@/lib/validations/student";
import { getStudent, updateStudent, deleteStudent } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/students/:id — full profile (row-scoped). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    const student = await getStudent(user, params.id);
    return ok({ student });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/students/:id — edit with audit trail (B.1.9). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const input = updateStudentSchema.parse(await req.json().catch(() => ({})));
    const result = await updateStudent(user, params.id, input);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/students/:id — soft-delete to Recycle Bin (G.6). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.delete");
    const result = await deleteStudent(user, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
