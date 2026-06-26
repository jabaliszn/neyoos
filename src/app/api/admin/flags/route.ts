/**
 * G.22 Platform flags API — SUPER_ADMIN (NEYO company) only.
 * GET  /api/admin/flags — module pause states
 * POST /api/admin/flags {moduleKey, paused, note?} — pause/release globally
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listFlags, setFlag } from "@/lib/services/platform-flags.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ flags: await listFlags() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = z
      .object({
        moduleKey: z.string().min(1),
        paused: z.boolean(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(await req.json().catch(() => ({})));
    return ok(await setFlag(user, input.moduleKey, input.paused, input.note));
  } catch (e) {
    return handleError(e);
  }
}
