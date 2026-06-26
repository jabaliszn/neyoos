/**
 * B.1 Transfer management.
 * POST   -> transfer the student out (status TRANSFERRED, seat freed, history).
 * DELETE -> undo the latest transfer (restore ACTIVE + previous class).
 * Permission: student.edit.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { transferStudentSchema } from "@/lib/validations/student";
import { transferStudent, undoTransfer } from "@/lib/services/student.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const input = transferStudentSchema.parse(await req.json());
    const result = await transferStudent(user, params.id, {
      destinationSchool: input.destinationSchool,
      destinationCounty: input.destinationCounty || undefined,
      transferDate: input.transferDate,
      reason: input.reason,
      reasonNote: input.reasonNote || undefined,
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    return ok(await undoTransfer(user, params.id));
  } catch (e) {
    return handleError(e);
  }
}
