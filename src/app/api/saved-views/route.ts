import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/core/session";
import { createSavedView, listSavedViews } from "@/lib/services/saved-view.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/saved-views?entityType=student -> list saved views for user */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 419 });
    
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") || "student";
    const result = await listSavedViews(user, entityType);
    return ok({ views: result });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/saved-views -> create a saved view */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 419 });

    const body = await req.json().catch(() => ({}));
    if (!body.entityType || !body.name || !body.filters) {
      return new Response("Invalid fields", { status: 422 });
    }

    const result = await createSavedView(user, {
      entityType: body.entityType,
      name: body.name,
      filters: body.filters,
    });
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
