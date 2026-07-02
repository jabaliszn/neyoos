import { NextRequest } from "next/server";
import { z } from "zod";
import { normalizeKePhone } from "@/lib/validations/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { initiateCentralSubscriptionStk } from "@/lib/services/central-billing.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  tenantId: z.string().min(1),
  phone: z.string().min(1, "Phone is required"),
});

/** POST /api/billing/public-stk — instant centralized NEYO subscription payment for expired SaaS accounts. */
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json().catch(() => ({})));
    const phone = normalizeKePhone(input.phone);
    if (!phone) return fail("VALIDATION_ERROR", "Enter a valid Kenyan phone.", 422);

    const result = await initiateCentralSubscriptionStk({ tenantId: input.tenantId, phone });

    return ok({
      success: true,
      message: "M-Pesa STK push initiated through NEYO central billing.",
      checkoutRequestId: result.checkoutRequestId,
      amount: result.amount,
      fullAmount: result.fullAmount,
      referralDiscountKes: result.referralDiscountKes,
      accountRef: result.accountRef,
      centralized: true,
    });
  } catch (err) {
    return handleError(err);
  }
}
