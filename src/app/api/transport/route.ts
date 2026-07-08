/**
 * B.17 Transport API, extended by T.8 (founder-requested 2026-07-06).
 * GET  /api/transport                      — routes (incl. real shifts) + drivers + vehicles + real school settings
 * GET  /api/transport?riders=<routeId>     — route riders
 * GET  /api/transport?vehicle=<vehicleId>  — vehicle file (maintenance+fuel)
 * GET  /api/transport?shifts=<routeId>     — a route's real shifts
 * GET  /api/transport?changeRequests=1     — real pending route-change requests
 * POST /api/transport {action: addRoute|addDriver|addVehicle|maintenance|fuel|assign|autoAllocate|release|invoice|addShift|updateShift|setShiftSeatCap|archiveShift|setSettings|requestRouteChange|decideRouteChange}
 * Permissions: transport.view (read) / transport.manage (write).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  routeSchema, driverSchema, vehicleSchema, maintenanceSchema, fuelSchema,
  assignSchema, transportInvoiceSchema, shiftSchema, autoAllocateSchema,
  setSeatCapSchema, createRouteChangeRequestSchema, decideRouteChangeRequestSchema,
  setTransportSettingsSchema,
} from "@/lib/validations/transport";
import {
  listRoutes, createRoute, listDrivers, addDriver, listVehicles, addVehicle,
  addMaintenance, addFuel, vehicleFile, routeRiders, assignStudent,
  autoAllocateStudent, releaseAssignment, invoiceRiders,
  listShifts, createShift, updateShift, setShiftSeatCap, archiveShift,
  getTransportSettings, setTransportSettings,
  listRouteChangeRequests, decideRouteChangeRequest,
} from "@/lib/services/transport.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("transport.view");
    const sp = req.nextUrl.searchParams;
    const riders = sp.get("riders");
    if (riders) return ok(await routeRiders(user, riders));
    const vehicle = sp.get("vehicle");
    if (vehicle) return ok(await vehicleFile(user, vehicle));
    const shiftsFor = sp.get("shifts");
    if (shiftsFor) return ok({ shifts: await listShifts(user, shiftsFor) });
    if (sp.get("changeRequests")) return ok({ requests: await listRouteChangeRequests(user, sp.get("status") ?? undefined) });
    const [routes, drivers, vehicles, settings] = await Promise.all([
      listRoutes(user), listDrivers(user), listVehicles(user), getTransportSettings(user),
    ]);
    return ok({ routes, drivers, vehicles, settings });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("transport.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum([
        "addRoute", "addDriver", "addVehicle", "maintenance", "fuel", "assign", "autoAllocate", "release", "invoice",
        "addShift", "updateShift", "setShiftSeatCap", "archiveShift", "setSettings", "decideRouteChange",
      ]) })
      .parse(body).action;
    if (action === "addRoute") return ok(await createRoute(user, routeSchema.parse(body)), 201);
    if (action === "addDriver") return ok(await addDriver(user, driverSchema.parse(body)), 201);
    if (action === "addVehicle") return ok(await addVehicle(user, vehicleSchema.parse(body)), 201);
    if (action === "maintenance") return ok(await addMaintenance(user, maintenanceSchema.parse(body)), 201);
    if (action === "fuel") return ok(await addFuel(user, fuelSchema.parse(body)), 201);
    if (action === "assign") return ok(await assignStudent(user, assignSchema.parse(body)), 201);
    if (action === "autoAllocate") return ok(await autoAllocateStudent(user, autoAllocateSchema.parse(body)), 201);
    if (action === "release") {
      const { assignmentId } = z.object({ assignmentId: z.string().min(1) }).parse(body);
      return ok(await releaseAssignment(user, assignmentId));
    }
    if (action === "addShift") return ok(await createShift(user, shiftSchema.parse(body)), 201);
    if (action === "updateShift") {
      const { shiftId, ...rest } = z.object({ shiftId: z.string().min(1) }).passthrough().parse(body);
      return ok(await updateShift(user, shiftId as string, rest as never));
    }
    if (action === "setShiftSeatCap") {
      const input = setSeatCapSchema.parse(body);
      return ok(await setShiftSeatCap(user, input.shiftId, input.seatCapOverride));
    }
    if (action === "archiveShift") {
      const { shiftId } = z.object({ shiftId: z.string().min(1) }).parse(body);
      return ok(await archiveShift(user, shiftId));
    }
    if (action === "setSettings") return ok(await setTransportSettings(user, setTransportSettingsSchema.parse(body)));
    if (action === "decideRouteChange") {
      const { requestId, ...rest } = z.object({ requestId: z.string().min(1) }).passthrough().parse(body);
      return ok(await decideRouteChangeRequest(user, requestId as string, decideRouteChangeRequestSchema.parse(rest)));
    }
    return ok(await invoiceRiders(user, transportInvoiceSchema.parse(body)));
  } catch (e) {
    return handleError(e);
  }
}
