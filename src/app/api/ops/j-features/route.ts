/**
 * Part-J feature toggles — NEYO Ops (SUPER_ADMIN) only.
 *
 * Founder requirement (2026-06-29): the whole Part-J feature set can be switched
 * ON/OFF in NEYO Ops before launch; default is ON.
 *
 * GET  /api/ops/j-features — list every Part-J feature with its ON/OFF state
 * POST /api/ops/j-features { id, enabled, note? } — switch a feature on/off
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listJFeatureFlags, setFlag } from "@/lib/services/platform-flags.service";
import { jFeatureKey, J_FEATURE_IDS } from "@/lib/core/j-features";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ features: await listJFeatureFlags() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = z
      .object({
        id: z.enum(J_FEATURE_IDS as [string, ...string[]]),
        enabled: z.boolean(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(await req.json().catch(() => ({})));

    // ON = enabled = not paused.
    const row = await setFlag(user, jFeatureKey(input.id), !input.enabled, input.note);
    return ok({ id: input.id, enabled: !row.paused, note: row.note });
  } catch (e) {
    return handleError(e);
  }
}
