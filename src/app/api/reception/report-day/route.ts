/**
 * G.29 — Report-Card Day Mode API.
 * GET  /api/reception/report-day          - list today's check-ins
 * POST /api/reception/report-day          - handles check-in, one-tap print queue, and queue status changes
 * Permission: reception.operate or academics.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError, ok, fail } from "@/lib/api/respond";
import { checkInParent, listCheckIns, printOneTap, updateCheckInStatus } from "@/lib/services/report-card-day.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const result = await listCheckIns(user);
    return ok({ checkIns: result });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "check_in") {
      if (!body.studentId || !body.guardianName) return fail("BAD_FIELDS", "studentId and guardianName required.", 422);
      const result = await checkInParent(user, {
        studentId: body.studentId,
        guardianName: body.guardianName,
      });
      return ok(result, 201);
    }

    if (action === "print_one_tap") {
      if (!body.checkInId) return fail("BAD_FIELDS", "checkInId required.", 422);
      const result = await printOneTap(user, body.checkInId);
      return ok(result);
    }

    if (action === "update_status") {
      if (!body.checkInId || !body.status) return fail("BAD_FIELDS", "checkInId and status required.", 422);
      const result = await updateCheckInStatus(user, body.checkInId, body.status);
      return ok(result);
    }

    return fail("BAD_REQUEST", "Invalid action specified.", 400);
  } catch (e) {
    return handleError(e);
  }
}
