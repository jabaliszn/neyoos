/**
 * R.6 — School Activities / Trips API.
 * GET  — every real activity (list) with real collection stats.
 * POST — create a new real activity + its full real roster.
 * Permission: finance.manage_structure (leadership/bursar).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { createActivity, listActivities } from "@/lib/services/school-activity.service";
import { createActivitySchema } from "@/lib/validations/school-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("finance.view");
    return ok({ activities: await listActivities(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.manage_structure");
    const input = createActivitySchema.parse(await req.json());
    return ok(await createActivity(user, input));
  } catch (e) {
    return handleError(e);
  }
}
