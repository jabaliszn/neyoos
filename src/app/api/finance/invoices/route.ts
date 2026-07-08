/**
 * B.7 invoices. GET list ?status=&q= (finance.view; parents row-scoped)
 * · POST manual invoice (finance.create_invoice)
 * · PATCH ?id= {amountKes} apply offline payment (finance.record_payment).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { manualInvoiceSchema } from "@/lib/validations/finance";
import { listInvoices, createManualInvoice, applyPaymentToInvoice, arrearsAging } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("finance.view");
    const sp = req.nextUrl.searchParams;
    if (sp.get("aging") === "1") return ok(await arrearsAging(user));
    return ok({
      invoices: await listInvoices(user, {
        status: sp.get("status") || undefined,
        q: sp.get("q") || undefined,
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.create_invoice");
    return ok(await createManualInvoice(user, manualInvoiceSchema.parse(await req.json())));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission("finance.record_payment");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("MISSING_ID", "Invoice id required.", 400);
    const { amountKes, biometricTicket } = z.object({
      amountKes: z.coerce.number().int().min(1).max(10_000_000),
      // R.3 — real single-use server ticket, required only if the school
      // has turned on requireBiometricForFinance (see applyPaymentToInvoice()).
      biometricTicket: z.string().trim().max(80).optional(),
    }).parse(await req.json());
    return ok(await applyPaymentToInvoice(user, id, amountKes, biometricTicket));
  } catch (e) {
    return handleError(e);
  }
}
