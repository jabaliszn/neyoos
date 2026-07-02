import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { ensureReferralCode, applyReferralCode, schoolReferralStatus } from "@/lib/services/revenue-ops.service";

export const dynamic = "force-dynamic";

/**
 * PART M.1 — School-side referral view (Settings → Billing).
 * A school can see its own referral code, who it referred, and its earned
 * credits. Applying a code (during onboarding, one-time) is also here.
 */
export async function GET() {
  try {
    const user = await requirePermission("owner.dashboard");
    const referralCode = await ensureReferralCode(user.tenantId);
    const status = await schoolReferralStatus(user.tenantId);
    return ok({ ...status, referralCode });
  } catch (err) {
    return handleError(err);
  }
}

const applySchema = z.object({ code: z.string().trim().min(4).max(20) });

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("owner.dashboard");
    const body = applySchema.parse(await req.json());
    const result = await applyReferralCode(user.tenantId, body.code);
    return ok({ appliedTo: result.referrerName }, 201);
  } catch (err) {
    return handleError(err);
  }
}
