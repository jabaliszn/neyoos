/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06, V.8).
 * SUPER_ADMIN ONLY — delegates (or revokes) the real, narrow discretionary-
 * decrease capability to a specific named staff member, without promoting
 * them to SUPER_ADMIN. Founder's own words: "when the ceo allows a staff
 * to do so no issue eg the ceo of neyo."
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { setDiscretionaryDecreaseDelegateSchema } from "@/lib/validations/pricing-engine";
import { setDiscretionaryDecreaseDelegate } from "@/lib/services/pricing-engine.service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET — real, active NEYO staff (SUPER_ADMIN) with their current
 * delegation flag, so the Ops UI can list who has the capability today. */
export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    const staff = await db.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { id: true, fullName: true, email: true, canApplyDiscretionaryDecrease: true },
      orderBy: { fullName: "asc" },
    });
    return ok({ staff });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = setDiscretionaryDecreaseDelegateSchema.parse(await req.json().catch(() => ({})));
    return ok(await setDiscretionaryDecreaseDelegate(user, input.userId, input.canApplyDiscretionaryDecrease));
  } catch (e) {
    return handleError(e);
  }
}
