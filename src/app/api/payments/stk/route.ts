import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { initiateStkPush } from "@/lib/services/payment.service";
import { normalizeKePhone } from "@/lib/validations/auth";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.coerce.number().int().positive("Enter a valid amount"),
  phone: z.string().min(1, "Phone is required"),
  accountRef: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(60),
});

/** POST /api/payments/stk — initiate an M-Pesa STK push. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.record_payment");
    const input = schema.parse(await req.json().catch(() => ({})));
    const phone = normalizeKePhone(input.phone);
    if (!phone) return fail("VALIDATION_ERROR", "Enter a valid Kenyan phone.", 422);

    const result = await initiateStkPush(user.tenantId, { ...input, phone });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
