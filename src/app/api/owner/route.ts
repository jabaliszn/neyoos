/**
 * B.24 Owner Dashboard API.
 * GET  /api/owner — full dashboard payload (owner.dashboard).
 * POST /api/owner {targetPct} — set the term collection target.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { ownerDashboard, setCollectionTarget } from "@/lib/services/owner-dashboard.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("owner.dashboard");
    return ok(await ownerDashboard(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("owner.dashboard");
    const { targetPct } = z
      .object({ targetPct: z.coerce.number().int().min(10).max(100) })
      .parse(await req.json().catch(() => ({})));
    return ok({ collectionTargetPct: await setCollectionTarget(user, targetPct) });
  } catch (e) {
    return handleError(e);
  }
}
