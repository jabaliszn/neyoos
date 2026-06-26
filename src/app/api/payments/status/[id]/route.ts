import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { queryPaymentStatus } from "@/lib/services/payment.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/payments/status/:id — poll a payment's status (Daraja query). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("finance.view");
    const result = await queryPaymentStatus(user.tenantId, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
