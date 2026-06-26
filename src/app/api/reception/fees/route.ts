/**
 * B.7+ receptionist desk fees (founder request).
 * GET ?studentId=  -> that student's open invoices.
 * POST {invoiceId, phone, amountKes?} -> STK push from the front desk
 *      (parent without a smartphone: STK works on ANY M-Pesa SIM via the
 *      SIM toolkit prompt — they just enter their PIN).
 * Permission: reception.operate AND finance.record_payment (receptionist has both).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { kePhone } from "@/lib/validations/reception";
import { studentOpenInvoices, stkForInvoice } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("MISSING", "studentId required.", 400);
    return ok({ invoices: await studentOpenInvoices(user, studentId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("reception.operate");
    const user = await requirePermission("finance.record_payment");
    const input = z.object({
      invoiceId: z.string().min(1),
      phone: kePhone,
      amountKes: z.coerce.number().int().min(1).optional(),
    }).parse(await req.json());
    return ok(await stkForInvoice(user, input.invoiceId, input.phone, input.amountKes));
  } catch (e) {
    return handleError(e);
  }
}
