import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { sendAllOpenFeeReminders } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requirePermission("finance.view", "comms.send");
    return ok(await sendAllOpenFeeReminders(user));
  } catch (e) { return handleError(e); }
}
