/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. Marks a real, optional onboarding-assistance
 * follow-up (data import help, staff training, a guide into NEYO) done.
 */
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { markOnboardingAssistanceDone } from "@/lib/services/school-quote.service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    return ok(await markOnboardingAssistanceDone(user, params.id));
  } catch (e) {
    return handleError(e);
  }
}
