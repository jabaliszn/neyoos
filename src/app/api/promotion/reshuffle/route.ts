/**
 * G.16 Stream reshuffle.
 * POST /api/promotion/reshuffle {level, strategy, commit:boolean}
 *   commit=false -> preview; commit=true -> apply.
 * Permission: class.manage.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { reshufflePlan, commitReshuffle } from "@/lib/services/promotion.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  level: z.string().trim().min(2).max(40),
  strategy: z.enum(["size", "gender", "alpha"]),
  commit: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const body = schema.parse(await req.json());
    if (body.commit) return ok(await commitReshuffle(user, body.level, body.strategy));
    return ok(await reshufflePlan(user, body.level, body.strategy));
  } catch (e) {
    return handleError(e);
  }
}
