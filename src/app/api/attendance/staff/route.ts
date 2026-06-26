/**
 * B.3 staff attendance.
 * GET  /api/attendance/staff?date=    -> my clock state + day sheet (sheet
 *      requires staff.view; others get their own state only)
 * POST /api/attendance/staff {action:"in"|"out"} -> clock self in/out.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError } from "@/lib/api/respond";
import { clockIn, clockOut, staffDaySheet } from "@/lib/services/staff-attendance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const date = req.nextUrl.searchParams.get("date") || undefined;
    const includeSheet = can(user.role as Role, "staff.view");
    return ok(await staffDaySheet(user, date, includeSheet));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = z.object({
      action: z.enum(["in", "out"]),
      // G.17: device GPS, verified server-side against the school geofence.
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
    }).parse(await req.json());
    const gps = body.lat !== undefined && body.lng !== undefined ? { lat: body.lat, lng: body.lng } : undefined;
    return ok(body.action === "in" ? await clockIn(user, gps) : await clockOut(user));
  } catch (e) {
    return handleError(e);
  }
}
