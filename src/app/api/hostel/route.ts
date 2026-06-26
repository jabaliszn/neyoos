/**
 * B.16 Hostel API.
 * GET  /api/hostel                          — hostels w/ occupancy
 * GET  /api/hostel?board=<hostelId>         — room/bed board
 * GET  /api/hostel?curfew=<hostelId>&date=  — curfew sheet
 * GET  /api/hostel?visitors=<studentId>     — boarder's visitor log
 * POST /api/hostel {action: addHostel|addRoom|allocate|release|curfew|invoice}
 * Permissions: hostel.view (read) / hostel.manage (write).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { hostelSchema, roomSchema, allocateSchema, curfewSchema, hostelInvoiceSchema } from "@/lib/validations/hostel";
import {
  listHostels, createHostel, addRoom, roomBoard, allocateBed, releaseBed,
  curfewSheet, markCurfew, invoiceBoarders, boarderVisitors, autoAllocateHostelBeds,
} from "@/lib/services/hostel.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("hostel.view");
    const sp = req.nextUrl.searchParams;
    const board = sp.get("board");
    if (board) return ok(await roomBoard(user, board));
    const curfew = sp.get("curfew");
    if (curfew) {
      const date = sp.get("date");
      if (!date) return fail("MISSING", "date required.", 400);
      return ok(await curfewSheet(user, curfew, date));
    }
    const visitors = sp.get("visitors");
    if (visitors) return ok({ visitors: await boarderVisitors(user, visitors) });
    return ok({ hostels: await listHostels(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("hostel.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["addHostel", "addRoom", "allocate", "release", "curfew", "invoice", "autoAllocate"]) })
      .parse(body).action;
    if (action === "addHostel") return ok(await createHostel(user, hostelSchema.parse(body)), 201);
    if (action === "addRoom") return ok(await addRoom(user, roomSchema.parse(body)), 201);
    if (action === "allocate") return ok(await allocateBed(user, allocateSchema.parse(body)), 201);
    if (action === "release") {
      const { allocationId } = z.object({ allocationId: z.string().min(1) }).parse(body);
      return ok(await releaseBed(user, allocationId));
    }
    if (action === "autoAllocate") {
      const { hostelId, strategy } = z.object({ hostelId: z.string(), strategy: z.enum(["FORM", "MIXED"]) }).parse(body);
      return ok(await autoAllocateHostelBeds(user, hostelId, strategy));
    }
    if (action === "curfew") return ok(await markCurfew(user, curfewSchema.parse(body)));
    return ok(await invoiceBoarders(user, hostelInvoiceSchema.parse(body)));
  } catch (e) {
    return handleError(e);
  }
}
