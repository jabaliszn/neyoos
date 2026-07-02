import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { extractSession } from "@/lib/services/bundi-import.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/bundi-import/sessions/:id/extract — run (or re-run) AI extraction.
 * Returns a clear NOT_CONFIGURED error if NEYO Ops hasn't wired a real
 * provider yet — never fabricates rows.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const session = await extractSession(user, params.id);
    return ok({ session });
  } catch (err) {
    return handleError(err);
  }
}
