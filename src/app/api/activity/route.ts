import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { entityActivity, tenantActivity } from "@/lib/services/activity.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity?entityType=&entityId=  -> activity for one entity.
 * GET /api/activity                         -> recent tenant-wide activity.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const entityType = req.nextUrl.searchParams.get("entityType");
    const entityId = req.nextUrl.searchParams.get("entityId");

    const items =
      entityType && entityId
        ? await entityActivity(user.tenantId, entityType, entityId)
        : await tenantActivity(user.tenantId);

    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
