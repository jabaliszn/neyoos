/**
 * B.17 Transport API.
 * GET  /api/transport                      — routes + drivers + vehicles
 * GET  /api/transport?riders=<routeId>     — route riders
 * GET  /api/transport?vehicle=<vehicleId>  — vehicle file (maintenance+fuel)
 * POST /api/transport {action: addRoute|addDriver|addVehicle|maintenance|fuel|assign|release|invoice}
 * Permissions: transport.view (read) / transport.manage (write).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  routeSchema, driverSchema, vehicleSchema, maintenanceSchema, fuelSchema,
  assignSchema, transportInvoiceSchema,
} from "@/lib/validations/transport";
import {
  listRoutes, createRoute, listDrivers, addDriver, listVehicles, addVehicle,
  addMaintenance, addFuel, vehicleFile, routeRiders, assignStudent,
  releaseAssignment, invoiceRiders,
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
    const [routes, drivers, vehicles] = await Promise.all([
      listRoutes(user), listDrivers(user), listVehicles(user),
    ]);
    return ok({ routes, drivers, vehicles });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("transport.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["addRoute", "addDriver", "addVehicle", "maintenance", "fuel", "assign", "release", "invoice"]) })
      .parse(body).action;
    if (action === "addRoute") return ok(await createRoute(user, routeSchema.parse(body)), 201);
    if (action === "addDriver") return ok(await addDriver(user, driverSchema.parse(body)), 201);
    if (action === "addVehicle") return ok(await addVehicle(user, vehicleSchema.parse(body)), 201);
    if (action === "maintenance") return ok(await addMaintenance(user, maintenanceSchema.parse(body)), 201);
    if (action === "fuel") return ok(await addFuel(user, fuelSchema.parse(body)), 201);
    if (action === "assign") return ok(await assignStudent(user, assignSchema.parse(body)), 201);
    if (action === "release") {
      const { assignmentId } = z.object({ assignmentId: z.string().min(1) }).parse(body);
      return ok(await releaseAssignment(user, assignmentId));
    }
    return ok(await invoiceRiders(user, transportInvoiceSchema.parse(body)));
  } catch (e) {
    return handleError(e);
  }
}
