import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getImportSession, cancelSession } from "@/lib/services/bundi-import.service";

export const dynamic = "force-dynamic";

/** GET /api/bundi-import/sessions/:id — poll session status/extraction result. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const session = await getImportSession(user, params.id);
    return ok({ session });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/bundi-import/sessions/:id — cancel a not-yet-committed session. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const result = await cancelSession(user, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
