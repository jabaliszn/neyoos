import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { addGuardianSchema, updateGuardianSchema } from "@/lib/validations/student";
import { addGuardian, setPrimaryGuardian, updateGuardian } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/students/:id/guardians — add a guardian, set primary, or edit an existing one. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const body = await req.json().catch(() => ({}));

    if (body.action === "set_primary") {
      const result = await setPrimaryGuardian(user, params.id, body.guardianId);
      return ok(result);
    }

    // M.3 — class teachers correcting a wrong phone number / relationship on
    // a guardian ALREADY on file (not creating a new one).
    if (body.action === "update_guardian") {
      if (!body.guardianId || typeof body.guardianId !== "string") {
        return ok({ ok: false }, 400);
      }
      const input = updateGuardianSchema.parse(body);
      const result = await updateGuardian(user, params.id, body.guardianId, input);
      return ok(result);
    }

    const input = addGuardianSchema.parse(body);
    const result = await addGuardian(user, params.id, input);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
