/**
 * G.28/I.99 — Fee Promise-to-Pay directory + installment plans.
 * GET -> promises calendar. POST -> create per-parent installment plan.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { handleError, ok } from "@/lib/api/respond";
import { createInstallmentPlan, listPromises } from "@/lib/services/promise-to-pay.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const user = await requirePermission("finance.view");
    const result = await listPromises(user);
    return ok({ promises: result });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.view", "finance.record_payment");
    const input = z.object({
      invoiceId: z.string().min(1),
      installments: z.array(z.object({ promiseDate: z.string().min(8), amountKes: z.coerce.number().int().min(1) })).min(1).max(12),
    }).parse(await req.json().catch(() => ({})));
    return ok(await createInstallmentPlan(user, input));
  } catch (e) {
    return handleError(e);
  }
}
