import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { commitSession } from "@/lib/services/bundi-import.service";
import { commitBundiSessionSchema } from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/**
 * POST /api/bundi-import/sessions/:id/commit — write the reviewed rows
 * through the SAME standard commitImport() the CSV/Excel engine uses.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const input = commitBundiSessionSchema.parse(await req.json().catch(() => ({})));
    const result = await commitSession(user, params.id, input);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
