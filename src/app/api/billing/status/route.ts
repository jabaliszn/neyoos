import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/billing/status?tenantId=... — Poll subscription status during lockout */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const tenantId = sp.get("tenantId");
    if (!tenantId) return fail("MISSING", "tenantId required.", 400);

    const sub = await db.subscription.findUnique({
      where: { tenantId },
    });

    const active = sub ? sub.status === "ACTIVE" : true; // Default true if no subscription row exists

    return ok({ active });
  } catch (err) {
    return handleError(err);
  }
}
