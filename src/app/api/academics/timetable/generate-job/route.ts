/**
 * L.7 — Master Button: start a background whole-school generation, poll progress.
 * POST  -> start a new generation job (runs in background).
 * GET   -> current/most-recent job (or ?jobId=) with progress + phase + results.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { startGeneration, getGenerationJob, TimetableEngineError } from "@/lib/services/timetable-engine.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const jobId = req.nextUrl.searchParams.get("jobId") ?? undefined;
    const job = await getGenerationJob(user, jobId);
    return ok({ job });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST() {
  try {
    const user = await requirePermission("academics.manage");
    const job = await startGeneration(user);
    return ok({ job }, 202);
  } catch (e) {
    if (e instanceof TimetableEngineError) {
      const m = { NOT_FOUND: 404, INVALID: 400, BUSY: 409 } as const;
      return fail(e.code, e.message, m[e.code]);
    }
    return handleError(e);
  }
}
