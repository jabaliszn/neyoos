import { requireRole } from "@/lib/core/session";
import { recentRuns } from "@/lib/jobs/jobs.service";
import { CRON_SCHEDULES } from "@/lib/jobs/registry";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/jobs — recent runs + cron schedule (SUPER_ADMIN). */
export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    const runs = await recentRuns();
    return ok({
      schedules: CRON_SCHEDULES,
      runs: runs.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        progress: r.progress,
        attempts: r.attempts,
        result: r.result,
        error: r.error,
        createdAt: r.createdAt,
        finishedAt: r.finishedAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
