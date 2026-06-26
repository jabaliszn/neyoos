import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { subscribeToPlan } from "@/lib/services/billing.service";
import { getPlanFromCatalog } from "@/lib/services/pricing-catalog.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ planKey: z.string().min(1) });

/** POST /api/billing/subscribe — change the school's plan. Leadership only. */
export async function POST(req: NextRequest) {
  try {
    // I.5: changing the school's NEYO subscription is owner/principal-only.
    const user = await requirePermission("owner.dashboard");
    const { planKey } = schema.parse(await req.json().catch(() => ({})));

    const result = await subscribeToPlan(
      user.tenantId,
      { id: user.id, fullName: user.fullName },
      planKey
    );
    const plan = await getPlanFromCatalog(result.subscription.planKey);

    return ok({
      planKey: result.subscription.planKey,
      status: result.subscription.status,
      paymentStatus: result.payment?.status ?? "NONE",
      planName: plan?.name ?? result.subscription.planKey,
    });
  } catch (err) {
    return handleError(err);
  }
}
