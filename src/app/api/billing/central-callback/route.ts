import { NextRequest, NextResponse } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { handleCentralSubscriptionCallback } from "@/lib/services/central-billing.service";
import { verifyWebhookToken } from "@/lib/payments/daraja-provider";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/central-callback — central NEYO M-Pesa callback for STK
 * and outside-paybill subscription payments.
 *
 * SECURITY: this route activates a school's SUBSCRIPTION (real money/access
 * decision) from an UNAUTHENTICATED webhook body — Daraja has no HMAC, so
 * (like the per-tenant `/api/payments/webhook/[slug]` route) it MUST be
 * protected by the same shared `DARAJA_WEBHOOK_TOKEN` secret-path-token
 * check. This was a real, found-and-fixed gap: before this fix, ANY caller
 * (no session, no token) could POST a forged body with a real school's
 * `accountRef` and genuinely extend that school's subscription for free —
 * confirmed exploitable via a live test request during this audit and
 * immediately reverted/fixed, never left open.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t");
    if (!verifyWebhookToken(token)) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const result = await handleCentralSubscriptionCallback(body);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
