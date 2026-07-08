/**
 * B.7 Part 2 — invoice actions.
 * POST {action:"stk", phone, amountKes?}      -> M-Pesa STK push (finance.record_payment)
 * POST {action:"discount", amountKes, reason} -> scholarship/bursary waiver (finance.manage_structure)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { kePhone } from "@/lib/validations/reception";
import { stkForInvoice, applyDiscount } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const action = z.enum(["stk", "discount"]).parse(body?.action);
    if (action === "stk") {
      const user = await requirePermission("finance.record_payment");
      const input = z.object({ phone: kePhone, amountKes: z.coerce.number().int().min(1).optional() }).parse(body);
      return ok(await stkForInvoice(user, params.id, input.phone, input.amountKes));
    }
    const user = await requirePermission("finance.manage_structure");
    const input = z.object({
      amountKes: z.coerce.number().int().min(1).max(10_000_000),
      reason: z.string().trim().min(3).max(120),
      // R.3 — real single-use server ticket, required only if the school
      // has turned on requireBiometricForFinance (see applyDiscount()).
      biometricTicket: z.string().trim().max(80).optional(),
    }).parse(body);
    return ok(await applyDiscount(user, params.id, input.amountKes, input.reason, input.biometricTicket));
  } catch (e) {
    return handleError(e);
  }
}
