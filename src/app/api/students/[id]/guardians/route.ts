import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { addGuardianSchema } from "@/lib/validations/student";
import { addGuardian, setPrimaryGuardian } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/students/:id/guardians — add a guardian or set primary. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const body = await req.json().catch(() => ({}));

    if (body.action === "set_primary") {
      const result = await setPrimaryGuardian(user, params.id, body.guardianId);
      return ok(result);
    }

    const input = addGuardianSchema.parse(body);
    const result = await addGuardian(user, params.id, input);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
