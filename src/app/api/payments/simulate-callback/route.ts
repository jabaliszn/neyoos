import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { handleCallback } from "@/lib/services/payment.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  checkoutRequestId: z.string().min(1),
  success: z.boolean().default(true),
});

/**
 * POST /api/payments/simulate-callback — DEV ONLY.
 * Simulates an M-Pesa callback so the pending->paid flow is testable without
 * real Daraja credentials. Disabled in production.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return fail("FORBIDDEN", "Not available in production.", 403);
    }
    await requirePermission("finance.record_payment");
    const { checkoutRequestId, success } = schema.parse(
      await req.json().catch(() => ({}))
    );
    const result = await handleCallback("mock", {
      checkoutRequestId,
      success,
      mpesaRef: `MOCK${Date.now()}`,
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
