/**
 * G.33/I.74 Platform appearance API.
 * GET  /api/platform/appearance — any signed-in user reads COMPANY-set
 *      Liquid Glass enabled state + liquidity level.
 * POST /api/platform/appearance {liquidLevel?, liquidEnabled?} — SUPER_ADMIN
 *      (NEYO) ONLY. Schools cannot change the platform look.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getAppearanceSettings, setAppearanceSettings } from "@/lib/services/platform-appearance.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    return ok(await getAppearanceSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = z
      .object({
        liquidLevel: z.enum(["1", "2", "3"]).optional(),
        liquidEnabled: z.boolean().optional(),
        liquidColorLevel: z.enum(["1", "2", "3"]).optional(),
      })
      .refine(
        (v) => v.liquidLevel !== undefined || v.liquidEnabled !== undefined || v.liquidColorLevel !== undefined,
        "Provide liquidLevel, liquidEnabled or liquidColorLevel."
      )
      .parse(await req.json().catch(() => ({})));
    return ok(await setAppearanceSettings(user, input));
  } catch (e) {
    return handleError(e);
  }
}
