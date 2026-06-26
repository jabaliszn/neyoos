import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { sendFinanceDigest } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.view", "comms.send");
    const { cadence } = z.object({ cadence: z.enum(["daily", "weekly"]).default("daily") }).parse(await req.json().catch(() => ({})));
    return ok(await sendFinanceDigest(user.tenantId, cadence));
  } catch (e) { return handleError(e); }
}
