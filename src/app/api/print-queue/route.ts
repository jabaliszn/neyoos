/**
 * G.31 Print queue API (reception print station).
 * GET  /api/print-queue                     — queued jobs grouped by class + printed-today count
 * POST /api/print-queue {action:"printed", jobId}     — station confirms a print
 * POST /api/print-queue {action:"classBatch", structureId, classId} — queue a class's invoices
 * Permission: reception.operate OR finance.view (bursar can run the station too).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { effectivePermissionsForUser, requireUser } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { queuedJobs, markPrinted, queueClassBatch, setPrintStationMode } from "@/lib/services/print-queue.service";

export const dynamic = "force-dynamic";

async function allowed(user: Awaited<ReturnType<typeof requireUser>>): Promise<boolean> {
  const permissions = await effectivePermissionsForUser(user);
  return permissions.includes("reception.operate") || permissions.includes("finance.view");
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!(await allowed(user))) return fail("FORBIDDEN", "No access to the print station.", 403);
    return ok(await queuedJobs(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["printed", "classBatch", "externalPrint", "stationMode"]) }).parse(body).action;
    if (action === "stationMode") {
      const { mode } = z.object({ mode: z.enum(["AUTO", "HOLD"]) }).parse(body);
      return ok(await setPrintStationMode(user, mode));
    }
    if (!(await allowed(user))) return fail("FORBIDDEN", "No access to the print station.", 403);
    if (action === "printed") {
      const { jobId } = z.object({ jobId: z.string().min(1) }).parse(body);
      return ok(await markPrinted(user, jobId));
    }
    if (action === "externalPrint") {
      const { jobId, providerName } = z.object({ jobId: z.string().min(1), providerName: z.string().min(1) }).parse(body);
      const { sendToExternalPrintShop } = await import("@/lib/services/print-queue.service");
      return ok(await sendToExternalPrintShop(user, jobId, providerName));
    }
    const { structureId, classId } = z.object({ structureId: z.string().min(1), classId: z.string().min(1) }).parse(body);
    return ok(await queueClassBatch(user, structureId, classId), 201);
  } catch (e) {
    return handleError(e);
  }
}
