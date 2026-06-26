import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { handleCentralSubscriptionCallback } from "@/lib/services/central-billing.service";

export const dynamic = "force-dynamic";

/** POST /api/billing/central-callback — central NEYO M-Pesa callback for STK and outside-paybill subscription payments. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await handleCentralSubscriptionCallback(body);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
