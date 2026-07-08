/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * PUBLIC — a prospective school gets a real, instant, honest price the
 * moment they enter (or ask NEYO to estimate) their student/staff/parent
 * counts. Founder's own explicit requirement: "so that they know the
 * amount of money they would pay" — zero waiting on a human for this step.
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { quotePriceInputSchema } from "@/lib/validations/pricing-engine";
import { instantQuote } from "@/lib/services/school-quote.service";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    enforceRate(`quote-instant:${clientIp(req)}`, 30, 3600); // 30/hour/IP — public, anti-abuse
    const input = quotePriceInputSchema.parse(await req.json().catch(() => ({})));
    return ok(await instantQuote(input));
  } catch (e) {
    return handleError(e);
  }
}
