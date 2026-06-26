import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { tick } from "@/lib/jobs/jobs.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ only: z.string().optional(), force: z.boolean().optional() });

/**
 * POST /api/jobs/tick — cron stand-in (A.12). A scheduler (or cron service)
 * hits this every minute in production; SUPER_ADMIN can also run jobs manually.
 *  - {} -> run all due cron jobs (by Nairobi time)
 *  - { only, force } -> run a specific job now
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const { only, force } = schema.parse(await req.json().catch(() => ({})));
    const result = await tick({ only, force });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/jobs/tick — invoked by a hosted scheduler (Vercel Cron, A.19).
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. We authorize on that
 * shared secret instead of a session, then run all due cron jobs (which
 * includes the A.16 webhook retry queue via EVERY_MINUTE_JOBS).
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") ?? "";
    if (!secret || auth !== `Bearer ${secret}`) {
      return fail("UNAUTHENTICATED", "Invalid cron secret.", 401);
    }
    const result = await tick({});
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
