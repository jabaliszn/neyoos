/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * PUBLIC — a prospective school submits a real quote request (after seeing
 * the real instant price via /api/quotes/instant), optionally asking for a
 * real NEYO-Ops-reviewed formal quotation and/or real onboarding
 * assistance (data import, staff training, a guide into NEYO).
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { createQuoteRequestSchema } from "@/lib/validations/pricing-engine";
import { createQuoteRequest } from "@/lib/services/school-quote.service";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    enforceRate(`quote-request:${clientIp(req)}`, 10, 3600); // 10/hour/IP — public, anti-abuse
    const input = createQuoteRequestSchema.parse(await req.json().catch(() => ({})));
    const { request, instant } = await createQuoteRequest(input);
    return ok({ requestId: request.id, status: request.status, instant });
  } catch (e) {
    return handleError(e);
  }
}
