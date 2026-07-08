/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. Lists every real quote request (the
 * "Quote Requests queue" from V.7).
 */
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listQuoteRequests } from "@/lib/services/school-quote.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ requests: await listQuoteRequests() });
  } catch (e) {
    return handleError(e);
  }
}
