/**
 * B.17 Transport — routes (stops + per-term fee), drivers (DL expiry alerts),
 * vehicles (NTSA insurance/inspection expiry alerts), maintenance log, fuel
 * tracking w/ consumption (km/L between fill-ups), capacity-checked
 * student-route assignment, and per-term transport-fee invoicing (B.7).
 * GPS bus tracking = hardware-deferred (flagged, never faked).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";

export class TransportError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DUPLICATE" | "FULL" | "ALREADY" | "INVALID",
    message: string
  ) {
    super(message);
    this.name = "TransportError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Days until a YYYY-MM-DD date (negative = already past). */
function daysUntil(date: string): number {
  return Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${nairobiToday()}T00:00:00Z`).getTime()) / 86_400_000);
}

const EXPIRY_WARN_DAYS = 30;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function listRoutes(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const routes = await tenantDb().transportRoute.findMany({
      where: { archived: false },
      include: { vehicle: true, driver: true, assignments: { where: { releasedAt: null } } },
      orderBy: { name: "asc" },
    });
    return routes.map((r) => ({
      id: r.id, name: r.name,
      stops: r.stops ? (JSON.parse(r.stops) as string[]) : [],
      termFeeKes: r.termFeeKes,
      vehicle: r.vehicle ? { id: r.vehicle.id, regNo: r.vehicle.regNo, capacity: r.vehicle.capacity } : null,
      driver: r.driver ? { id: r.driver.id, fullName: r.driver.fullName, phone: r.driver.phone } : null,
      riders: r.assignments.length,
      seatsLeft: r.vehicle ? Math.max(0, r.vehicle.capacity - r.assignments.length) : null,
    }));
  });
}

export async function createRoute(
  user: SessionUser,
  input: { name: string; stops?: string[]; termFeeKes: number; vehicleId?: string; driverId?: string }
) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().transportRoute.findFirst({ where: { name: input.name, archived: false } });
    if (dup) throw new TransportError("DUPLICATE", "A route with that name already exists.");
    const route = await db.transportRoute.create({
      data: {
        tenantId: user.tenantId, name: input.name,
        stops: input.stops?.length ? JSON.stringify(input.stops) : null,
        termFeeKes: input.termFeeKes,
        vehicleId: input.vehicleId ?? null, driverId: input.driverId ?? null,
      },
    });
    await audit(user, "transport.route_created", "transportRoute", route.id, { name: input.name });
    return route;
  });
}

// ---------------------------------------------------------------------------
// Drivers + vehicles (with compliance alerts)
// ---------------------------------------------------------------------------

export async function listDrivers(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().driver.findMany({ where: { archived: false }, orderBy: { fullName: "asc" }, include: { routes: { where: { archived: false } } } });
    return rows.map((d) => ({
      id: d.id, fullName: d.fullName, phone: d.phone, licenseNo: d.licenseNo,
      licenseExpiry: d.licenseExpiry,
      licenseDaysLeft: d.licenseExpiry ? daysUntil(d.licenseExpiry) : null,
      licenseExpiring: d.licenseExpiry ? daysUntil(d.licenseExpiry) <= EXPIRY_WARN_DAYS : false,
      routes: d.routes.map((r) => r.name),
    }));
  });
}

export async function addDriver(user: SessionUser, input: { fullName: string; phone: string; licenseNo: string; licenseExpiry?: string; nationalId?: string }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().driver.findFirst({ where: { licenseNo: input.licenseNo, archived: false } });
    if (dup) throw new TransportError("DUPLICATE", `That DL number is already registered (${dup.fullName}).`);
    const d = await db.driver.create({
      data: {
        tenantId: user.tenantId, fullName: input.fullName, phone: input.phone,
        licenseNo: input.licenseNo, licenseExpiry: input.licenseExpiry ?? null, nationalId: input.nationalId ?? null,
      },
    });
    await audit(user, "transport.driver_added", "driver", d.id, { name: input.fullName });
    return d;
  });
}

export async function listVehicles(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().vehicle.findMany({
      where: { archived: false }, orderBy: { regNo: "asc" },
      include: {
        routes: { where: { archived: false } },
        maintenanceLogs: { orderBy: { date: "desc" }, take: 1 },
        fuelLogs: { orderBy: { date: "desc" }, take: 2 },
      },
    });
    return rows.map((v) => {
      // Consumption: km between the last two fill-ups / litres of the newest.
      let kmPerL: number | null = null;
      if (v.fuelLogs.length === 2 && v.fuelLogs[0].odometerKm && v.fuelLogs[1].odometerKm) {
        const km = v.fuelLogs[0].odometerKm - v.fuelLogs[1].odometerKm;
        if (km > 0 && v.fuelLogs[0].litres > 0) kmPerL = Math.round((km / v.fuelLogs[0].litres) * 10) / 10;
      }
      return {
        id: v.id, regNo: v.regNo, make: v.make, capacity: v.capacity,
        insuranceExpiry: v.insuranceExpiry,
        insuranceExpiring: v.insuranceExpiry ? daysUntil(v.insuranceExpiry) <= EXPIRY_WARN_DAYS : false,
        inspectionExpiry: v.inspectionExpiry,
        inspectionExpiring: v.inspectionExpiry ? daysUntil(v.inspectionExpiry) <= EXPIRY_WARN_DAYS : false,
        routes: v.routes.map((r) => r.name),
        lastService: v.maintenanceLogs[0] ? { date: v.maintenanceLogs[0].date, type: v.maintenanceLogs[0].type } : null,
        kmPerL,
      };
    });
  });
}

export async function addVehicle(user: SessionUser, input: { regNo: string; make?: string; capacity: number; insuranceExpiry?: string; inspectionExpiry?: string }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().vehicle.findFirst({ where: { regNo: input.regNo, archived: false } });
    if (dup) throw new TransportError("DUPLICATE", `${input.regNo} is already registered.`);
    const v = await db.vehicle.create({
      data: {
        tenantId: user.tenantId, regNo: input.regNo, make: input.make ?? null, capacity: input.capacity,
        insuranceExpiry: input.insuranceExpiry ?? null, inspectionExpiry: input.inspectionExpiry ?? null,
      },
    });
    await audit(user, "transport.vehicle_added", "vehicle", v.id, { regNo: input.regNo });
    return v;
  });
}

// ---------------------------------------------------------------------------
// Maintenance + fuel
// ---------------------------------------------------------------------------

export async function addMaintenance(
  user: SessionUser,
  input: { vehicleId: string; date: string; type: string; description: string; costKes: number; odometerKm?: number; garage?: string }
) {
  return withTenant(user.tenantId, async () => {
    const vehicle = await tenantDb().vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new TransportError("NOT_FOUND", "Vehicle not found.");
    const row = await db.vehicleMaintenance.create({
      data: {
        tenantId: user.tenantId, vehicleId: input.vehicleId, date: input.date, type: input.type,
        description: input.description, costKes: input.costKes,
        odometerKm: input.odometerKm ?? null, garage: input.garage ?? null, createdById: user.id,
      },
    });
    await audit(user, "transport.maintenance_logged", "vehicleMaintenance", row.id, { vehicle: vehicle.regNo, type: input.type, costKes: input.costKes });
    return row;
  });
}

export async function addFuel(
  user: SessionUser,
  input: { vehicleId: string; date: string; litres: number; costKes: number; odometerKm?: number; station?: string }
) {
  return withTenant(user.tenantId, async () => {
    const vehicle = await tenantDb().vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new TransportError("NOT_FOUND", "Vehicle not found.");
    const row = await db.fuelLog.create({
      data: {
        tenantId: user.tenantId, vehicleId: input.vehicleId, date: input.date,
        litres: input.litres, costKes: input.costKes,
        odometerKm: input.odometerKm ?? null, station: input.station ?? null, createdById: user.id,
      },
    });
    await audit(user, "transport.fuel_logged", "fuelLog", row.id, { vehicle: vehicle.regNo, litres: input.litres, costKes: input.costKes });
    return row;
  });
}

/** Vehicle file: maintenance + fuel history + totals. */
export async function vehicleFile(user: SessionUser, vehicleId: string) {
  return withTenant(user.tenantId, async () => {
    const vehicle = await tenantDb().vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new TransportError("NOT_FOUND", "Vehicle not found.");
    const [maintenance, fuel] = await Promise.all([
      tenantDb().vehicleMaintenance.findMany({ where: { vehicleId }, orderBy: { date: "desc" }, take: 50 }),
      tenantDb().fuelLog.findMany({ where: { vehicleId }, orderBy: { date: "desc" }, take: 50 }),
    ]);
    return {
      vehicle: { id: vehicle.id, regNo: vehicle.regNo, make: vehicle.make, capacity: vehicle.capacity },
      maintenance,
      fuel,
      totals: {
        maintenanceKes: maintenance.reduce((a, m) => a + m.costKes, 0),
        fuelKes: fuel.reduce((a, f) => a + f.costKes, 0),
        litres: Math.round(fuel.reduce((a, f) => a + f.litres, 0) * 10) / 10,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Student-route assignment (capacity-checked)
// ---------------------------------------------------------------------------

export async function routeRiders(user: SessionUser, routeId: string) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({
      where: { id: routeId },
      include: { vehicle: true, driver: true, assignments: { where: { releasedAt: null }, orderBy: { studentName: "asc" } } },
    });
    if (!route) throw new TransportError("NOT_FOUND", "Route not found.");
    return {
      route: {
        id: route.id, name: route.name,
        stops: route.stops ? (JSON.parse(route.stops) as string[]) : [],
        termFeeKes: route.termFeeKes,
        vehicleRegNo: route.vehicle?.regNo ?? null,
        capacity: route.vehicle?.capacity ?? null,
        driverName: route.driver?.fullName ?? null,
      },
      riders: route.assignments.map((a) => ({
        id: a.id, studentId: a.studentId, studentName: a.studentName,
        admissionNo: a.admissionNo, pickupStop: a.pickupStop,
      })),
    };
  });
}

export async function assignStudent(user: SessionUser, input: { routeId: string; studentId: string; pickupStop?: string }) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({
      where: { id: input.routeId },
      include: { vehicle: true, assignments: { where: { releasedAt: null } } },
    });
    if (!route || route.archived) throw new TransportError("NOT_FOUND", "Route not found.");

    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, status: "ACTIVE", deletedAt: null } });
    if (!student) throw new TransportError("NOT_FOUND", "Student not found (or not active).");

    // One route per student.
    const existing = await tenantDb().transportAssignment.findFirst({ where: { studentId: student.id, releasedAt: null } });
    if (existing) throw new TransportError("ALREADY", "This student is already on a route. Remove them first to move routes.");

    // Bus capacity.
    if (route.vehicle && route.assignments.length >= route.vehicle.capacity)
      throw new TransportError("FULL", `${route.name} is full — ${route.vehicle.regNo} carries ${route.vehicle.capacity}.`);

    // Pickup stop must be one of the route's stops (when both exist).
    if (input.pickupStop && route.stops) {
      const stops = JSON.parse(route.stops) as string[];
      if (stops.length && !stops.includes(input.pickupStop))
        throw new TransportError("INVALID", `"${input.pickupStop}" is not a stop on ${route.name}.`);
    }

    const a = await db.transportAssignment.create({
      data: {
        tenantId: user.tenantId, routeId: route.id, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        pickupStop: input.pickupStop ?? null,
      },
    });
    await audit(user, "transport.assigned", "transportAssignment", a.id, { route: route.name, student: a.studentName, stop: input.pickupStop });
    return a;
  });
}

export async function releaseAssignment(user: SessionUser, assignmentId: string) {
  return withTenant(user.tenantId, async () => {
    const a = await tenantDb().transportAssignment.findUnique({ where: { id: assignmentId }, include: { route: true } });
    if (!a) throw new TransportError("NOT_FOUND", "Assignment not found.");
    if (a.releasedAt) throw new TransportError("ALREADY", "Already removed from the route.");
    const row = await tenantDb().transportAssignment.update({ where: { id: assignmentId }, data: { releasedAt: new Date() } });
    await audit(user, "transport.released", "transportAssignment", assignmentId, { student: a.studentName, route: a.route.name });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Transport fees (B.7 invoices) — same idempotent pattern as B.16 boarding
// ---------------------------------------------------------------------------

export async function invoiceRiders(user: SessionUser, input: { routeId: string; year: number; term: number; dueDate: string }) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({
      where: { id: input.routeId },
      include: { assignments: { where: { releasedAt: null } } },
    });
    if (!route) throw new TransportError("NOT_FOUND", "Route not found.");
    if (route.termFeeKes <= 0) throw new TransportError("INVALID", "Set the route's term fee first.");

    const description = `Transport — ${route.name} — Term ${input.term} ${input.year}`;
    let created = 0;
    let skipped = 0;
    for (const a of route.assignments) {
      const dup = await tenantDb().invoice.findFirst({ where: { studentId: a.studentId, description } });
      if (dup) { skipped++; continue; }
      const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
      await db.invoice.create({
        data: {
          tenantId: user.tenantId, invoiceNo, studentId: a.studentId, description,
          year: input.year, term: input.term,
          totalKes: route.termFeeKes, dueDate: input.dueDate, status: "UNPAID",
        },
      });
      created++;
    }
    await audit(user, "transport.invoiced", "transportRoute", route.id, { term: input.term, year: input.year, created, skipped });
    return { created, skipped, amountKes: route.termFeeKes, riders: route.assignments.length };
  });
}
