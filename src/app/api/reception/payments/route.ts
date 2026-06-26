import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { walkInPaymentSchema } from "@/lib/validations/reception";
import { recordWalkInPayment } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/reception/payments — record a walk-in (cash/M-Pesa) payment (A.18.3). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate", "finance.record_payment");
    const input = walkInPaymentSchema.parse(await req.json().catch(() => ({})));
    const payment = await recordWalkInPayment(user.tenantId, input, {
      id: user.id,
      name: user.fullName,
    });
    return ok(
      { id: payment.id, ref: payment.mpesaRef, amount: payment.amount, status: payment.status },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
