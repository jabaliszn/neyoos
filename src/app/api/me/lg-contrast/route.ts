import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ lgContrast: z.enum(["company", "1", "2", "3"]) });

/**
 * POST /api/me/lg-contrast — O.3: save the current user's PERSONAL override
 * for Liquid Glass colour/contrast intensity. Deliberately separate from:
 *  - the COMPANY-only liquid_color_level (PlatformSetting, SUPER_ADMIN-only,
 *    set via POST /api/platform/appearance) which is the school-wide default, and
 *  - the existing blur-depth liquid_level / per-device blur-sheen slider (I.81),
 *    which this control does NOT touch at all — only background opacity/contrast.
 * "company" (the default) means "follow whatever NEYO Ops has set"; "1"/"2"/"3"
 * lets an individual user opt into a different contrast level than their
 * school's default, persisted server-side so it follows them across devices —
 * mirrors the exact same pattern as O.2's /api/me/popup-style.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { lgContrast } = schema.parse(await req.json().catch(() => ({})));
    await db.user.update({ where: { id: user.id }, data: { lgContrast } });
    return ok({ lgContrast });
  } catch (err) {
    return handleError(err);
  }
}
