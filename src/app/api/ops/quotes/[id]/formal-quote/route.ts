/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. Reviews and sends a real, human-confirmed
 * formal quotation (may adjust the instant price for a real, justified
 * reason — always audit-logged).
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { sendFormalQuoteSchema } from "@/lib/validations/pricing-engine";
import { sendFormalQuote } from "@/lib/services/school-quote.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));
    const input = sendFormalQuoteSchema.parse({ ...body, requestId: params.id });
    return ok(await sendFormalQuote(user, input));
  } catch (e) {
    return handleError(e);
  }
}
