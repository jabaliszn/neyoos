/**
 * G.16 Undo a promotion/reshuffle run.
 * POST /api/promotion/undo {runId}. Permission: class.manage.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { undoRun } from "@/lib/services/promotion.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const { runId } = z.object({ runId: z.string().min(1) }).parse(await req.json());
    return ok(await undoRun(user, runId));
  } catch (e) {
    return handleError(e);
  }
}
