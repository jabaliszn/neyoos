import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { reviewSession } from "@/lib/services/bundi-import.service";
import { reviewImportSessionSchema } from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/** POST /api/bundi-import/sessions/:id/review — save the school's row edits. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const input = reviewImportSessionSchema.parse(await req.json().catch(() => ({})));
    const session = await reviewSession(user, params.id, input);
    return ok({ session });
  } catch (err) {
    return handleError(err);
  }
}
