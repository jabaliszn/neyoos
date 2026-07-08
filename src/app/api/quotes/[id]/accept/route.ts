/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * PUBLIC — the real "accept & go live" moment. Founder's own confirmed
 * answer: self-serve, automatic — no NEYO Ops manual gate blocking
 * activation. The actual account creation still happens via the real,
 * existing /api/onboarding/signup (this route only marks the real
 * quotation genuinely accepted; the school then completes signup, which
 * links back to this request via markQuoteRequestLive()).
 */
import { ok, handleError } from "@/lib/api/respond";
import { acceptQuote } from "@/lib/services/school-quote.service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    return ok(await acceptQuote(params.id));
  } catch (e) {
    return handleError(e);
  }
}
