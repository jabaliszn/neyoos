import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/core/session";
import { deleteSavedView } from "@/lib/services/saved-view.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/saved-views/:id -> delete a saved view */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 419 });

    const result = await deleteSavedView(user, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
