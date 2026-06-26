/**
 * G.15 Term Trends Pulse API.
 * GET  /api/term-pulse — latest stored weekly pulse (owner.dashboard).
 * POST /api/term-pulse — recompute + notify this school now (run-now, leadership).
 */
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { latestPulse, runPulseNow } from "@/lib/services/term-pulse.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("owner.dashboard");
    return ok({ pulse: await latestPulse(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST() {
  try {
    const user = await requirePermission("owner.dashboard");
    return ok(await runPulseNow(user));
  } catch (e) {
    return handleError(e);
  }
}
