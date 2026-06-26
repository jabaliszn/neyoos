import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { feeCollectionLeaderboard } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("finance.view");
    return ok({ leaderboard: await feeCollectionLeaderboard(user) });
  } catch (e) { return handleError(e); }
}
