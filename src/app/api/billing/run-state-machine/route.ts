import { requireRole } from "@/lib/core/session";
import { runSubscriptionStateMachine } from "@/lib/services/billing.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/run-state-machine — cron stand-in (A.5).
 * In production a scheduled job (A.12) hits this; for now SUPER_ADMIN can.
 */
export async function POST() {
  try {
    await requireRole("SUPER_ADMIN");
    const changed = await runSubscriptionStateMachine();
    return ok({ changed });
  } catch (err) {
    return handleError(err);
  }
}
