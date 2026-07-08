import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ popupStyle: z.enum(["glass", "solid"]) });

/**
 * POST /api/me/popup-style — O.2: save the current user's PERSONAL preference
 * for how popups/modals render (Liquid Glass or Solid). This is deliberately
 * separate from:
 *  - the COMPANY-only liquid_level / neyo_liquid_system_active (G.33, PlatformSetting,
 *    SUPER_ADMIN-only) which controls the platform-wide glass depth, and
 *  - the per-DEVICE blur/sheen intensity slider (I.81, localStorage only).
 * This setting is per-USER, persisted server-side (User.popupStyle) so it
 * follows the signed-in person across devices, mirroring the exact pattern
 * already used for A.15 language preference (/api/me/language).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { popupStyle } = schema.parse(await req.json().catch(() => ({})));
    await db.user.update({ where: { id: user.id }, data: { popupStyle } });
    return ok({ popupStyle });
  } catch (err) {
    return handleError(err);
  }
}
