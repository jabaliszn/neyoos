/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * The real, rare, human-reviewed discretionary price DECREASE (V.0/V.8):
 * "a decrease is never considered... but if it drastic it can be heard."
 * Gated at the SERVICE layer (SUPER_ADMIN or a specifically-delegated
 * staff member) — this route only requires a genuine signed-in user,
 * since `applyDiscretionaryDecrease()` itself enforces the real
 * authorization check and throws a real 403 otherwise.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { discretionaryDecreaseSchema } from "@/lib/validations/pricing-engine";
import { applyDiscretionaryDecrease } from "@/lib/services/pricing-engine.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = discretionaryDecreaseSchema.parse(await req.json().catch(() => ({})));
    return ok(await applyDiscretionaryDecrease(user, input.tenantId, input.newMonthlyPriceKes, input.note));
  } catch (e) {
    return handleError(e);
  }
}
