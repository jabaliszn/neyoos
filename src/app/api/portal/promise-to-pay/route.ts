/**
 * G.28 — Fee Promise-to-Pay Parent submission endpoint.
 * POST -> application/json. Permission: portal.parent.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError, ok } from "@/lib/api/respond";
import { createPromiseToPay } from "@/lib/services/promise-to-pay.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const body = await req.json().catch(() => ({}));
    const { invoiceId, promiseDate, amountKes } = body;

    if (!invoiceId || !promiseDate || !amountKes) {
      return new Response("Missing fields", { status: 422 });
    }

    const result = await createPromiseToPay(user, {
      invoiceId,
      promiseDate,
      amountKes: Number(amountKes),
    });

    return ok(result, 201);
  } catch (e) {
    return handleError(e);
  }
}
