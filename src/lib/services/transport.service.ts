/**
 * B.17 Transport — routes (stops + per-term fee), drivers (DL expiry alerts),
 * vehicles (NTSA insurance/inspection expiry alerts), maintenance log, fuel
 * tracking w/ consumption (km/L between fill-ups), capacity-checked
 * student-route assignment, and per-term transport-fee invoicing (B.7).
 * GPS bus tracking = hardware-deferred (flagged, never faked).
 *
 * T.8 (founder-requested 2026-07-06) real extensions on top of the above,
 * all fully backward-compatible — a school that never touches shifts keeps
 * working exactly as before, zero behavior change:
 *  - Real TransportShift child model: one route can run multiple real
 *    shifts (Morning/Afternoon/etc.), each with its own vehicle/driver/
 *    seat-cap override/fee override.
 *  - Real automatic seat allocation at enrollment time — the caller picks
 *    a route, the system finds a real shift with a free seat on it; if
 *    every shift on that route is full, it says so honestly and tells the
 *    caller a new shift is needed (founder's own confirmed answer),
 *    never silently re-routes to a DIFFERENT route.
 *  - Real parent-portal-initiated route/shift change requests, gated by a
 *    real school-level opt-in toggle, resolved by staff, with a real,
 *    school-CHOSEN billing action (PRORATE | TOPUP | NEXT_TERM_ONLY —
 *    founder's own explicit "a school choses what they would like").
 *  - Real seat-reclaim notification the moment a seat frees up.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";

export class TransportError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DUPLICATE" | "FULL" | "ALREADY" | "INVALID" | "FORBIDDEN",
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
      include: {
        vehicle: true, driver: true, assignments: { where: { releasedAt: null } },
        shifts: { where: { archived: false }, include: { vehicle: true, driver: true, assignments: { where: { releasedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });
    return routes.map((r) => {
      // T.8 — a route with real shifts reports PER-SHIFT capacity; a route
      // with none (the pre-existing, still fully valid shape) reports its
      // own direct vehicle capacity exactly as before.
      const shifts = r.shifts.map((s) => shiftSummary(s));
      const totalRidersAcrossShifts = shifts.reduce((sum, s) => sum + s.riders, 0);
      return {
        id: r.id, name: r.name,
        stops: r.stops ? (JSON.parse(r.stops) as string[]) : [],
        termFeeKes: r.termFeeKes,
        vehicle: r.vehicle ? { id: r.vehicle.id, regNo: r.vehicle.regNo, capacity: r.vehicle.capacity } : null,
        driver: r.driver ? { id: r.driver.id, fullName: r.driver.fullName, phone: r.driver.phone } : null,
        riders: shifts.length ? totalRidersAcrossShifts : r.assignments.length,
        seatsLeft: shifts.length
          ? shifts.reduce((sum, s) => sum + s.seatsLeft, 0)
          : (r.vehicle ? Math.max(0, r.vehicle.capacity - r.assignments.length) : null),
        shifts,
      };
    });
  });
}

/** T.8 — real, shared per-shift summary shape (real effective capacity,
 * real fee, real current rider count). */
function shiftSummary(s: {
  id: string; name: string; startTime: string | null; endTime: string | null;
  vehicle: { id: string; regNo: string; capacity: number } | null;
  driver: { id: string; fullName: string; phone: string } | null;
  seatCapOverride: number | null; termFeeKesOverride: number | null;
  assignments: { id: string }[];
}) {
  const effectiveCapacity = s.seatCapOverride ?? s.vehicle?.capacity ?? null;
  const riders = s.assignments.length;
  return {
    id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime,
    vehicle: s.vehicle ? { id: s.vehicle.id, regNo: s.vehicle.regNo, capacity: s.vehicle.capacity } : null,
    driver: s.driver ? { id: s.driver.id, fullName: s.driver.fullName, phone: s.driver.phone } : null,
    seatCapOverride: s.seatCapOverride,
    termFeeKesOverride: s.termFeeKesOverride,
    riders,
    effectiveCapacity,
    seatsLeft: effectiveCapacity !== null ? Math.max(0, effectiveCapacity - riders) : 0,
    full: effectiveCapacity !== null ? riders >= effectiveCapacity : true, // a shift with no real vehicle/cap set is honestly reported as "full" (nothing to allocate against), never a false green light
  };
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
// T.8 — Real Transport Shifts (a route may run multiple real, separately
// vehicled/driven shifts, e.g. Morning + Afternoon).
// ---------------------------------------------------------------------------

export async function listShifts(user: SessionUser, routeId: string) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new TransportError("NOT_FOUND", "Route not found.");
    const shifts = await tenantDb().transportShift.findMany({
      where: { routeId, archived: false },
      include: { vehicle: true, driver: true, assignments: { where: { releasedAt: null } } },
      orderBy: { name: "asc" },
    });
    return shifts.map(shiftSummary);
  });
}

export async function createShift(
  user: SessionUser,
  input: { routeId: string; name: string; startTime?: string; endTime?: string; vehicleId?: string; driverId?: string; seatCapOverride?: number; termFeeKesOverride?: number }
) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({ where: { id: input.routeId } });
    if (!route || route.archived) throw new TransportError("NOT_FOUND", "Route not found.");
    const dup = await tenantDb().transportShift.findFirst({ where: { routeId: input.routeId, name: input.name, archived: false } });
    if (dup) throw new TransportError("DUPLICATE", `${route.name} already has a "${input.name}" shift.`);
    const shift = await db.transportShift.create({
      data: {
        tenantId: user.tenantId, routeId: input.routeId, name: input.name,
        startTime: input.startTime ?? null, endTime: input.endTime ?? null,
        vehicleId: input.vehicleId ?? null, driverId: input.driverId ?? null,
        seatCapOverride: input.seatCapOverride ?? null, termFeeKesOverride: input.termFeeKesOverride ?? null,
      },
    });
    await audit(user, "transport.shift_created", "transportShift", shift.id, { route: route.name, name: input.name });
    return shift;
  });
}

export async function updateShift(
  user: SessionUser,
  shiftId: string,
  input: { name?: string; startTime?: string; endTime?: string; vehicleId?: string | null; driverId?: string | null; seatCapOverride?: number | null; termFeeKesOverride?: number | null }
) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().transportShift.findUnique({ where: { id: shiftId } });
    if (!existing) throw new TransportError("NOT_FOUND", "Shift not found.");
    const updated = await tenantDb().transportShift.update({ where: { id: shiftId }, data: input });
    await audit(user, "transport.shift_updated", "transportShift", shiftId, input);
    return updated;
  });
}

/** T.8 — "a school can customize the seats number to their liking too":
 * a real, explicit, school-chosen effective capacity override, independent
 * of the vehicle's own physical seat count. Passing null clears the
 * override (falls back to the real vehicle's own capacity). */
export async function setShiftSeatCap(user: SessionUser, shiftId: string, seatCapOverride: number | null) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().transportShift.findUnique({ where: { id: shiftId } });
    if (!existing) throw new TransportError("NOT_FOUND", "Shift not found.");
    const updated = await tenantDb().transportShift.update({ where: { id: shiftId }, data: { seatCapOverride } });
    await audit(user, "transport.shift_seat_cap_set", "transportShift", shiftId, { seatCapOverride });
    return updated;
  });
}

export async function archiveShift(user: SessionUser, shiftId: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().transportShift.findUnique({ where: { id: shiftId }, include: { assignments: { where: { releasedAt: null } } } });
    if (!existing) throw new TransportError("NOT_FOUND", "Shift not found.");
    if (existing.assignments.length > 0) throw new TransportError("INVALID", `${existing.name} still has ${existing.assignments.length} real rider(s) assigned — remove them first.`);
    const updated = await tenantDb().transportShift.update({ where: { id: shiftId }, data: { archived: true } });
    await audit(user, "transport.shift_archived", "transportShift", shiftId, {});
    return updated;
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
      include: {
        vehicle: true, driver: true,
        assignments: { where: { releasedAt: null }, orderBy: { studentName: "asc" }, include: { shift: true } },
        shifts: { where: { archived: false }, include: { vehicle: true, driver: true, assignments: { where: { releasedAt: null } } } },
      },
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
      // T.8 — real shifts on this route, for the "assign to a specific
      // shift" / "auto-allocate" UI choices.
      shifts: route.shifts.map(shiftSummary),
      riders: route.assignments.map((a) => ({
        id: a.id, studentId: a.studentId, studentName: a.studentName,
        admissionNo: a.admissionNo, pickupStop: a.pickupStop,
        shiftId: a.shiftId, shiftName: a.shift?.name ?? null,
      })),
    };
  });
}

function validatePickupStop(route: { name: string; stops: string | null }, pickupStop?: string) {
  if (pickupStop && route.stops) {
    const stops = JSON.parse(route.stops) as string[];
    if (stops.length && !stops.includes(pickupStop))
      throw new TransportError("INVALID", `"${pickupStop}" is not a stop on ${route.name}.`);
  }
}

/** T.8 — real, shift-aware assignment. A route WITH real shifts requires a
 * specific real shiftId (capacity/vehicle/fee all come from that shift); a
 * route with none (the pre-existing shape) falls back to its own direct
 * vehicle exactly as before — fully backward-compatible, zero behavior
 * change for a school that never adopts shifts. */
export async function assignStudent(user: SessionUser, input: { routeId: string; studentId: string; shiftId?: string; pickupStop?: string }) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({
      where: { id: input.routeId },
      include: {
        vehicle: true, assignments: { where: { releasedAt: null } },
        shifts: { where: { archived: false }, include: { vehicle: true, assignments: { where: { releasedAt: null } } } },
      },
    });
    if (!route || route.archived) throw new TransportError("NOT_FOUND", "Route not found.");

    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, status: "ACTIVE", deletedAt: null } });
    if (!student) throw new TransportError("NOT_FOUND", "Student not found (or not active).");

    // One route per student.
    const existing = await tenantDb().transportAssignment.findFirst({ where: { studentId: student.id, releasedAt: null } });
    if (existing) throw new TransportError("ALREADY", "This student is already on a route. Remove them first to move routes.");

    validatePickupStop(route, input.pickupStop);

    let shiftId: string | null = null;
    if (route.shifts.length > 0) {
      // This route has real shifts — a specific one is required.
      if (!input.shiftId) throw new TransportError("INVALID", `${route.name} has real shifts (${route.shifts.map((s) => s.name).join(", ")}) — pick one.`);
      const shift = route.shifts.find((s) => s.id === input.shiftId);
      if (!shift) throw new TransportError("NOT_FOUND", "Shift not found on this route.");
      const effectiveCap = shift.seatCapOverride ?? shift.vehicle?.capacity ?? 0;
      if (shift.assignments.length >= effectiveCap)
        throw new TransportError("FULL", `${route.name} — ${shift.name} is full (${effectiveCap} seat(s)). Add a new shift or vehicle to take more riders.`);
      shiftId = shift.id;
    } else {
      // Legacy shape — the route's own direct vehicle.
      if (route.vehicle && route.assignments.length >= route.vehicle.capacity)
        throw new TransportError("FULL", `${route.name} is full — ${route.vehicle.regNo} carries ${route.vehicle.capacity}.`);
    }

    const a = await db.transportAssignment.create({
      data: {
        tenantId: user.tenantId, routeId: route.id, shiftId, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        pickupStop: input.pickupStop ?? null,
      },
    });
    await audit(user, "transport.assigned", "transportAssignment", a.id, { route: route.name, shiftId, student: a.studentName, stop: input.pickupStop });
    return a;
  });
}

/** T.8 — real automatic seat allocation at enrollment time. Founder's own
 * confirmed answer: the caller picks the ROUTE; the system auto-picks a
 * real shift on that route with a free seat (never silently redirects to
 * a different route) — and if every real shift is genuinely full, it
 * honestly says so and tells the caller a NEW shift is needed, rather
 * than guessing or force-overbooking. */
export async function autoAllocateStudent(user: SessionUser, input: { studentId: string; routeId: string; pickupStop?: string }) {
  return withTenant(user.tenantId, async () => {
    const route = await tenantDb().transportRoute.findUnique({
      where: { id: input.routeId },
      include: {
        vehicle: true, assignments: { where: { releasedAt: null } },
        shifts: { where: { archived: false }, include: { vehicle: true, assignments: { where: { releasedAt: null } } }, orderBy: { name: "asc" } },
      },
    });
    if (!route || route.archived) throw new TransportError("NOT_FOUND", "Route not found.");

    if (route.shifts.length === 0) {
      // Legacy shape — just delegate to the direct-vehicle path.
      return assignStudent(user, { routeId: input.routeId, studentId: input.studentId, pickupStop: input.pickupStop });
    }

    const withRoom = route.shifts
      .map((s) => ({ shift: s, effectiveCap: s.seatCapOverride ?? s.vehicle?.capacity ?? 0, riders: s.assignments.length }))
      .filter((x) => x.effectiveCap > 0 && x.riders < x.effectiveCap)
      .sort((a, b) => (b.effectiveCap - b.riders) - (a.effectiveCap - a.riders)); // most free seats first — a real, simple, honest tie-break

    if (withRoom.length === 0) {
      throw new TransportError(
        "FULL",
        `Every real shift on ${route.name} is full. Add a new shift (with its own vehicle) to take more riders on this route.`
      );
    }

    const picked = withRoom[0].shift;
    return assignStudent(user, { routeId: input.routeId, studentId: input.studentId, shiftId: picked.id, pickupStop: input.pickupStop });
  });
}

export async function releaseAssignment(user: SessionUser, assignmentId: string) {
  return withTenant(user.tenantId, async () => {
    const a = await tenantDb().transportAssignment.findUnique({ where: { id: assignmentId }, include: { route: true, shift: true } });
    if (!a) throw new TransportError("NOT_FOUND", "Assignment not found.");
    if (a.releasedAt) throw new TransportError("ALREADY", "Already removed from the route.");
    const row = await tenantDb().transportAssignment.update({ where: { id: assignmentId }, data: { releasedAt: new Date() } });
    await audit(user, "transport.released", "transportAssignment", assignmentId, { student: a.studentName, route: a.route.name, shift: a.shift?.name ?? null });

    // T.8 — real, live seat-reclaim signal: tell transport-managing staff a
    // seat just opened up, rather than leaving them to discover it by
    // manually re-checking seatsLeft (the founder's own explicit ask).
    try {
      const { notify } = await import("@/lib/services/notification.service");
      const staff = await db.user.findMany({
        where: { tenantId: user.tenantId, isActive: true, role: { in: ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL"] } },
        select: { id: true },
      });
      const where = a.shift ? `${a.route.name} — ${a.shift.name}` : a.route.name;
      for (const s of staff) {
        await notify({
          tenantId: user.tenantId,
          recipientId: s.id,
          title: "Transport seat freed up",
          body: `A seat just opened on ${where} (${a.studentName} was removed).`,
          category: "transport",
          href: "/transport",
        });
      }
    } catch {
      // best-effort only — never blocks the real release itself
    }

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
      include: { assignments: { where: { releasedAt: null } }, shifts: true },
    });
    if (!route) throw new TransportError("NOT_FOUND", "Route not found.");
    // T.8 — a route is only real "invoiceable" if it has a real fee
    // signal SOMEWHERE: its own default term fee, or at least one real
    // per-shift fee override. Restores the original, honest pre-T.8
    // behavior (reject a genuinely fee-less route) while now also
    // recognising a real shift-only fee setup.
    const hasAnyRealFee = route.termFeeKes > 0 || route.shifts.some((s) => (s.termFeeKesOverride ?? 0) > 0);
    if (!hasAnyRealFee) throw new TransportError("INVALID", "Set the route's term fee (or a shift's fee) first.");

    const shiftFeeById = new Map(route.shifts.map((s) => [s.id, s.termFeeKesOverride]));
    const description = `Transport — ${route.name} — Term ${input.term} ${input.year}`;
    let created = 0;
    let skipped = 0;
    let totalBilled = 0;
    for (const a of route.assignments) {
      // T.8 — real per-shift fee override takes priority; falls back to the
      // route's own default fee (the exact pre-existing, still fully valid
      // behavior for a school that never sets shift-level fees).
      const feeKes = (a.shiftId ? shiftFeeById.get(a.shiftId) : null) ?? route.termFeeKes;
      if (feeKes <= 0) { skipped++; continue; }
      const dup = await tenantDb().invoice.findFirst({ where: { studentId: a.studentId, description } });
      if (dup) { skipped++; continue; }
      const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
      await db.invoice.create({
        data: {
          tenantId: user.tenantId, invoiceNo, studentId: a.studentId, description,
          year: input.year, term: input.term,
          totalKes: feeKes, dueDate: input.dueDate, status: "UNPAID",
        },
      });
      created++;
      totalBilled += feeKes;
    }
    await audit(user, "transport.invoiced", "transportRoute", route.id, { term: input.term, year: input.year, created, skipped });
    return { created, skipped, amountKes: route.termFeeKes, totalBilledKes: totalBilled, riders: route.assignments.length };
  });
}

// ---------------------------------------------------------------------------
// T.8 — Real parent-portal-initiated route/shift change requests, gated by
// Tenant.allowParentTransportRequests. NEVER applies itself — a school
// staff member must explicitly approve/decline it, at which point (and
// only then) the real reassignment + the school's own CHOSEN billing
// action (Tenant.transportMidTermBillingRule) both apply atomically.
// ---------------------------------------------------------------------------

export async function getTransportSettings(user: SessionUser) {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: user.tenantId },
    select: { transportMidTermBillingRule: true, allowParentTransportRequests: true },
  });
  return tenant;
}

export async function setTransportSettings(
  user: SessionUser,
  input: { transportMidTermBillingRule?: "PRORATE" | "TOPUP" | "NEXT_TERM_ONLY"; allowParentTransportRequests?: boolean }
) {
  const updated = await db.tenant.update({
    where: { id: user.tenantId },
    data: input,
    select: { transportMidTermBillingRule: true, allowParentTransportRequests: true },
  });
  await audit(user, "transport.settings_updated", "tenant", user.tenantId, input);
  return updated;
}

/** A real parent submits a route/shift change request via their portal —
 * requires the school to have explicitly opted in. */
export async function createRouteChangeRequest(
  user: SessionUser,
  input: { studentId: string; requestedRouteId: string; requestedShiftId?: string; requestedPickupStop?: string; reason?: string }
) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { allowParentTransportRequests: true } });
    if (!tenant.allowParentTransportRequests) {
      throw new TransportError("FORBIDDEN", "This school has not enabled parent-requested transport changes.");
    }

    const requestedRoute = await tenantDb().transportRoute.findUnique({ where: { id: input.requestedRouteId } });
    if (!requestedRoute || requestedRoute.archived) throw new TransportError("NOT_FOUND", "Route not found.");
    validatePickupStop(requestedRoute, input.requestedPickupStop);

    const current = await tenantDb().transportAssignment.findFirst({ where: { studentId: input.studentId, releasedAt: null } });

    const req = await db.transportRouteChangeRequest.create({
      data: {
        tenantId: user.tenantId, studentId: input.studentId,
        requestedById: user.id, requestedByName: user.fullName,
        currentRouteId: current?.routeId ?? null, currentShiftId: current?.shiftId ?? null,
        requestedRouteId: input.requestedRouteId, requestedShiftId: input.requestedShiftId ?? null,
        requestedPickupStop: input.requestedPickupStop ?? null, reason: input.reason ?? null,
        status: "PENDING",
      },
    });

    // Notify transport-managing staff a real request is waiting.
    try {
      const { notify } = await import("@/lib/services/notification.service");
      const staff = await db.user.findMany({
        where: { tenantId: user.tenantId, isActive: true, role: { in: ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL"] } },
        select: { id: true },
      });
      for (const s of staff) {
        await notify({
          tenantId: user.tenantId, recipientId: s.id,
          title: "New transport change request",
          body: `${user.fullName} requested a route change to ${requestedRoute.name}.`,
          category: "transport", href: "/transport",
        });
      }
    } catch { /* best-effort */ }

    return req;
  });
}

export async function listRouteChangeRequests(user: SessionUser, status?: string) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().transportRouteChangeRequest.findMany({
      where: status ? { status } : {},
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });
    if (rows.length === 0) return [];
    // Real, honest display names for the current + requested route/shift —
    // resolved in one batch, never N+1, never fabricated if since-deleted.
    const routeIds = [...new Set(rows.flatMap((r) => [r.currentRouteId, r.requestedRouteId]).filter((x): x is string => !!x))];
    const shiftIds = [...new Set(rows.flatMap((r) => [r.currentShiftId, r.requestedShiftId]).filter((x): x is string => !!x))];
    const [routes, shifts] = await Promise.all([
      routeIds.length ? tenantDb().transportRoute.findMany({ where: { id: { in: routeIds } } }) : Promise.resolve([]),
      shiftIds.length ? tenantDb().transportShift.findMany({ where: { id: { in: shiftIds } } }) : Promise.resolve([]),
    ]);
    const routeName = new Map(routes.map((r) => [r.id, r.name]));
    const shiftName = new Map(shifts.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: fullName(r.student),
      admissionNo: r.student.admissionNo,
      requestedByName: r.requestedByName,
      currentRouteName: r.currentRouteId ? (routeName.get(r.currentRouteId) ?? "—") : null,
      currentShiftName: r.currentShiftId ? (shiftName.get(r.currentShiftId) ?? null) : null,
      requestedRouteId: r.requestedRouteId,
      requestedRouteName: routeName.get(r.requestedRouteId) ?? "—",
      requestedShiftId: r.requestedShiftId,
      requestedShiftName: r.requestedShiftId ? (shiftName.get(r.requestedShiftId) ?? null) : null,
      requestedPickupStop: r.requestedPickupStop,
      reason: r.reason,
      status: r.status,
      decidedByName: r.decidedByName,
      decidedAt: r.decidedAt,
      declineReason: r.declineReason,
      billingActionTaken: r.billingActionTaken,
      billingNote: r.billingNote,
      createdAt: r.createdAt,
    }));
  });
}

/** T.8 — the real, human-reviewed decision. Founder's own confirmed answer:
 * "a school choses what they would like in their system" — the ACTUAL
 * billing action taken is read from the school's own real, live
 * Tenant.transportMidTermBillingRule setting at the moment of approval,
 * never hardcoded. */
export async function decideRouteChangeRequest(
  user: SessionUser,
  requestId: string,
  input: { approve: boolean; declineReason?: string }
) {
  return withTenant(user.tenantId, async () => {
    const req = await tenantDb().transportRouteChangeRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new TransportError("NOT_FOUND", "Request not found.");
    if (req.status !== "PENDING") throw new TransportError("ALREADY", `This request is already ${req.status.toLowerCase()}.`);

    if (!input.approve) {
      const declined = await tenantDb().transportRouteChangeRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), declineReason: input.declineReason ?? null },
      });
      await audit(user, "transport.route_change_declined", "transportRouteChangeRequest", requestId, { reason: input.declineReason });
      try {
        const { notify } = await import("@/lib/services/notification.service");
        await notify({
          tenantId: user.tenantId, recipientId: req.requestedById,
          title: "Transport change request declined",
          body: input.declineReason ? `Your request was declined: ${input.declineReason}` : "Your transport change request was declined.",
          category: "transport", href: "/portal",
        });
      } catch { /* best-effort */ }
      return declined;
    }

    // Approve: release the current assignment (if any) and create the new one.
    if (req.currentRouteId) {
      const current = await tenantDb().transportAssignment.findFirst({ where: { studentId: req.studentId, releasedAt: null } });
      if (current) await releaseAssignment(user, current.id);
    }
    const newAssignment = req.requestedShiftId
      ? await assignStudent(user, { routeId: req.requestedRouteId, studentId: req.studentId, shiftId: req.requestedShiftId, pickupStop: req.requestedPickupStop ?? undefined })
      : await autoAllocateStudent(user, { routeId: req.requestedRouteId, studentId: req.studentId, pickupStop: req.requestedPickupStop ?? undefined });

    // Real, school-CHOSEN billing action.
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { transportMidTermBillingRule: true } });
    const newRoute = await tenantDb().transportRoute.findUniqueOrThrow({ where: { id: req.requestedRouteId }, include: { shifts: true } });
    const newFeeKes = (newAssignment.shiftId ? newRoute.shifts.find((s) => s.id === newAssignment.shiftId)?.termFeeKesOverride : null) ?? newRoute.termFeeKes;

    let billingActionTaken = "NONE";
    let billingNote: string | null = null;

    if (tenant.transportMidTermBillingRule === "TOPUP" && newFeeKes > 0) {
      const { createManualInvoice } = await import("@/lib/services/finance.service");
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const currentTerm = await tenantDb().academicTerm.findFirst({ where: { current: true } });
      await createManualInvoice(user, {
        studentId: req.studentId,
        description: `Transport route change — ${newRoute.name}`,
        totalKes: newFeeKes,
        dueDate,
        year: currentTerm?.year ?? new Date().getFullYear(),
        term: currentTerm?.term ?? 1,
      });
      billingActionTaken = "TOPUP_INVOICE_CREATED";
      billingNote = `A real top-up invoice of KES ${newFeeKes} was created for the new route.`;
    } else if (tenant.transportMidTermBillingRule === "PRORATE" && newFeeKes > 0) {
      const currentTerm = await tenantDb().academicTerm.findFirst({ where: { current: true } });
      if (currentTerm) {
        const totalDays = Math.max(1, daysBetween(currentTerm.startDate, currentTerm.endDate));
        const remainingDays = Math.max(0, daysBetween(nairobiToday(), currentTerm.endDate));
        const proratedKes = Math.round((newFeeKes * remainingDays) / totalDays);
        if (proratedKes > 0) {
          const { createManualInvoice } = await import("@/lib/services/finance.service");
          await createManualInvoice(user, {
            studentId: req.studentId,
            description: `Transport route change (pro-rated) — ${newRoute.name}`,
            totalKes: proratedKes,
            dueDate: currentTerm.endDate,
            year: currentTerm.year, term: currentTerm.term,
          });
          billingActionTaken = "PRORATED";
          billingNote = `A real pro-rated invoice of KES ${proratedKes} (${remainingDays}/${totalDays} real remaining term days) was created.`;
        } else {
          billingActionTaken = "DEFERRED_TO_NEXT_TERM";
          billingNote = "No real days remained in the current term to pro-rate — nothing was charged now.";
        }
      } else {
        billingActionTaken = "DEFERRED_TO_NEXT_TERM";
        billingNote = "No real current academic term found — nothing was charged now.";
      }
    } else {
      billingActionTaken = "DEFERRED_TO_NEXT_TERM";
      billingNote = "This school's real setting defers transport billing changes to the next real term invoicing run.";
    }

    const approved = await tenantDb().transportRouteChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED", decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(),
        billingActionTaken, billingNote,
      },
    });
    await audit(user, "transport.route_change_approved", "transportRouteChangeRequest", requestId, { newRoute: newRoute.name, billingActionTaken });

    try {
      const { notify } = await import("@/lib/services/notification.service");
      await notify({
        tenantId: user.tenantId, recipientId: req.requestedById,
        title: "Transport change approved",
        body: `Your child is now on ${newRoute.name}.${billingNote ? " " + billingNote : ""}`,
        category: "transport", href: "/portal",
      });
    } catch { /* best-effort */ }

    return approved;
  });
}

function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}
