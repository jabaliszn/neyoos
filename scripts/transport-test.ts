/** B.17 Transport — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  listRoutes, createRoute, listDrivers, addDriver, listVehicles, addVehicle,
  addMaintenance, addFuel, vehicleFile, routeRiders, assignStudent,
  releaseAssignment, invoiceRiders, listShifts,
} from "../src/lib/services/transport.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  // Self-heal: reset transport tables + reseed.
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.transportAssignment.deleteMany({ where: { tenantId: t.id } });
  await db.fuelLog.deleteMany({ where: { tenantId: t.id } });
  await db.vehicleMaintenance.deleteMany({ where: { tenantId: t.id } });
  await db.transportRoute.deleteMany({ where: { tenantId: t.id } });
  await db.driver.deleteMany({ where: { tenantId: t.id } });
  await db.vehicle.deleteMany({ where: { tenantId: t.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Transport" } } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });

  const principal = await asUser("principal@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");

  // 1) routes list w/ vehicle/driver/seat math
  const routes = await listRoutes(principal);
  const routeA = routes.find((r) => r.name.includes("Kasarani"))!;
  console.log("routes:", routes.length === 2 ? "✓ 2" : "✗");
  // T.8: Route A now runs 2 real shifts (Morning bus1/33 w/ 2 riders,
  // Afternoon custom-20-seat-cap w/ 0 riders) — seat math is now the real
  // SUM across shifts, not the route's own bare vehicle capacity.
  console.log("seat math (shift-aware):", routeA.riders === 2 && routeA.seatsLeft === 51 && routeA.shifts.length === 2 ? "✓ 2 riders, 51 real seats left across 2 shifts" : "✗ " + JSON.stringify({ r: routeA.riders, s: routeA.seatsLeft, shifts: routeA.shifts.length }));
  console.log("stops parsed:", routeA.stops.length === 4 && routeA.stops[0] === "Mwiki" ? "✓ 4 stops" : "✗");

  // T.8 — real shifts: Morning (bus1, no override) + Afternoon (custom 20-seat cap)
  const shifts = await listShifts(principal, routeA.id);
  const morning = shifts.find((s) => s.name === "Morning")!;
  const afternoon = shifts.find((s) => s.name === "Afternoon")!;
  console.log("shift list:", shifts.length === 2 ? "✓ 2 real shifts" : "✗");
  console.log("morning shift (legacy bus cap):", morning.effectiveCapacity === 33 && morning.riders === 2 && morning.seatsLeft === 31 && !morning.full ? "✓ 33 cap, 2 riders, 31 left" : "✗ " + JSON.stringify(morning));
  console.log("afternoon shift (custom seat-cap override):", afternoon.effectiveCapacity === 20 && afternoon.riders === 0 && afternoon.seatsLeft === 20 && !afternoon.full ? "✓ custom 20-seat cap, 0 riders" : "✗ " + JSON.stringify(afternoon));

  // 2) duplicate route/driver/vehicle blocked
  try { await createRoute(principal, { name: "Route A — Kasarani", termFeeKes: 0 }); console.log("dup route: ALLOWED ✗"); }
  catch { console.log("dup route blocked: ✓"); }
  try { await addDriver(principal, { fullName: "X", phone: "+254700000001", licenseNo: "DL-0098231" }); console.log("dup DL: ALLOWED ✗"); }
  catch { console.log("dup DL blocked: ✓"); }
  try { await addVehicle(principal, { regNo: "KCB 123A", capacity: 10 }); console.log("dup regNo: ALLOWED ✗"); }
  catch { console.log("dup regNo blocked: ✓"); }

  // 3) expiry alerts: bus1 insurance in ~20d → expiring; driver Wafula DL ~20d → expiring
  const vehicles = await listVehicles(principal);
  const bus1 = vehicles.find((v) => v.regNo === "KCB 123A")!;
  console.log("insurance alert:", bus1.insuranceExpiring && !bus1.inspectionExpiring ? "✓ insurance flagged, NTSA ok" : "✗");
  const drivers = await listDrivers(principal);
  const wafula = drivers.find((d) => d.fullName.includes("Wafula"))!;
  console.log("DL expiry alert:", wafula.licenseExpiring ? `✓ flagged (${wafula.licenseDaysLeft}d left)` : "✗");

  // 4) km/L consumption from the two seeded fill-ups: (84540-84120)/60 = 7.0
  console.log("km/L:", bus1.kmPerL === 7 ? "✓ 7 km/L computed" : "✗ " + bus1.kmPerL);

  // 5) vehicle file totals
  const file = await vehicleFile(principal, bus1.id);
  console.log("vehicle file:", file.totals.fuelKes === 21240 && file.totals.maintenanceKes === 18500 && file.totals.litres === 118
    ? "✓ fuel 21,240 + service 18,500 + 118 L" : "✗ " + JSON.stringify(file.totals));

  // 6) assignment rules
  const riders = await routeRiders(principal, routeA.id);
  console.log("riders board:", riders.riders.length === 2 && riders.riders.some((r) => r.pickupStop === "Mwiki") ? "✓ pickup stops shown" : "✗");
  const wanjiru = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Wanjiru" } });
  const routeB = routes.find((r) => r.name.includes("Githurai"))!;
  // one route per student
  try { await assignStudent(principal, { routeId: routeB.id, studentId: wanjiru.id }); console.log("second route: ALLOWED ✗"); }
  catch { console.log("one-route-per-student: ✓"); }
  // T.8 — a route WITH real shifts requires a specific shiftId now (no
  // more silent fallback to the route's own direct vehicle).
  const kamau = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Kamau" } });
  try { await assignStudent(principal, { routeId: routeA.id, studentId: kamau.id }); console.log("assign w/o shiftId on a shifted route: ALLOWED ✗"); }
  catch (e) { console.log("shiftId required on a shifted route: ✓", (e as Error).message.slice(0, 60)); }
  // invalid pickup stop
  try { await assignStudent(principal, { routeId: routeA.id, studentId: kamau.id, shiftId: afternoon.id, pickupStop: "Nakuru" }); console.log("bad stop: ALLOWED ✗"); }
  catch { console.log("invalid pickup stop blocked: ✓"); }
  // valid assign (to the real Afternoon shift) + release + double release
  const a = await assignStudent(principal, { routeId: routeA.id, studentId: kamau.id, shiftId: afternoon.id, pickupStop: "Seasons" });
  console.log("assign w/ stop + shift: ✓", a.pickupStop, a.shiftId === afternoon.id ? "(Afternoon)" : "✗ wrong shift");
  await releaseAssignment(principal, a.id);
  try { await releaseAssignment(principal, a.id); console.log("double release: ALLOWED ✗"); }
  catch { console.log("double release blocked: ✓"); }

  // T.8 — real automatic seat allocation: caller picks the ROUTE, the
  // system finds a real shift with a free seat, most-free-seats-first.
  // Morning has 31 free (33 cap - 2 riders), Afternoon has 20 free (20 cap
  // - 0 riders) — Morning has MORE free seats, so it's picked first.
  const { autoAllocateStudent } = await import("../src/lib/services/transport.service");
  const atieno0 = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Atieno" } });
  const auto = await autoAllocateStudent(principal, { routeId: routeA.id, studentId: atieno0.id, pickupStop: "Seasons" });
  console.log("auto-allocate picks the shift with the most free seats:", auto.shiftId === morning.id ? "✓ picked Morning (31 free > Afternoon's 20 free)" : `✗ picked shiftId=${auto.shiftId}`);
  await releaseAssignment(principal, auto.id);

  // T.8 — real honest FULL error when every real shift on a route is full.
  const fullBus = await addVehicle(principal, { regNo: "KFL 002T", capacity: 1 });
  const fullRoute = await createRoute(principal, { name: "Test Full Route", termFeeKes: 0 });
  const fullShift = await (await import("../src/lib/services/transport.service")).createShift(principal, { routeId: fullRoute.id, name: "Only", vehicleId: fullBus.id });
  const atieno1 = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Atieno" } });
  await assignStudent(principal, { routeId: fullRoute.id, studentId: atieno1.id, shiftId: fullShift.id });
  try {
    await autoAllocateStudent(principal, { routeId: fullRoute.id, studentId: kamau.id });
    console.log("auto-allocate on a genuinely full route: ALLOWED ✗");
  } catch (e) { console.log("auto-allocate honestly reports FULL: ✓", (e as Error).message.slice(0, 60)); }
  // cleanup the full-route test fixtures now (before further shared-fee-route steps)
  await db.transportAssignment.deleteMany({ where: { routeId: fullRoute.id } });
  await db.transportShift.delete({ where: { id: fullShift.id } });
  await db.transportRoute.delete({ where: { id: fullRoute.id } });
  await db.vehicle.delete({ where: { id: fullBus.id } });

  // 7) capacity: tiny bus (2 seats) fills up. NOTE: Achieng/Wanjiru/Kiprono
  // are now permanently seeded riders (T.8 real demo fixtures on Route
  // A/B), so this step uses 3 real, dedicated, disposable test-only
  // students instead of borrowing seeded ones that already have real
  // transport assignments.
  const testClass = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id } });
  const suffix = Date.now().toString().slice(-6);
  const capStu1 = await db.student.create({ data: { tenantId: t.id, admissionNo: `T8-CAP1-${suffix}`, firstName: "TestCap1", lastName: "Fixture", gender: "M", classId: testClass.id, status: "ACTIVE" } });
  const capStu2 = await db.student.create({ data: { tenantId: t.id, admissionNo: `T8-CAP2-${suffix}`, firstName: "TestCap2", lastName: "Fixture", gender: "F", classId: testClass.id, status: "ACTIVE" } });
  const capStu3 = await db.student.create({ data: { tenantId: t.id, admissionNo: `T8-CAP3-${suffix}`, firstName: "TestCap3", lastName: "Fixture", gender: "M", classId: testClass.id, status: "ACTIVE" } });
  const tinyBus = await addVehicle(principal, { regNo: "KZZ 001T", capacity: 2 });
  const tinyRoute = await createRoute(principal, { name: "Test Tiny Route", termFeeKes: 0, vehicleId: tinyBus.id });
  await assignStudent(principal, { routeId: tinyRoute.id, studentId: capStu1.id });
  await assignStudent(principal, { routeId: tinyRoute.id, studentId: capStu2.id });
  try { await assignStudent(principal, { routeId: tinyRoute.id, studentId: capStu3.id }); console.log("over capacity: ALLOWED ✗"); }
  catch (e) { console.log("bus capacity enforced: ✓", (e as Error).message.slice(0, 50)); }

  // 8) transport fees → real B.7 invoices, idempotent
  const inv1 = await invoiceRiders(bursar, { routeId: routeA.id, year: 2026, term: 2, dueDate: "2026-07-03" });
  console.log("transport invoices:", inv1.created === 2 && inv1.amountKes === 9000 ? "✓ 2 × KES 9,000" : "✗ " + JSON.stringify(inv1));
  const inv2 = await invoiceRiders(bursar, { routeId: routeA.id, year: 2026, term: 2, dueDate: "2026-07-03" });
  console.log("idempotent re-run:", inv2.created === 0 && inv2.skipped === 2 ? "✓ 0 created, 2 skipped" : "✗");
  // fee not set
  try { await invoiceRiders(bursar, { routeId: tinyRoute.id, year: 2026, term: 2, dueDate: "2026-07-03" }); console.log("no-fee invoice: ALLOWED ✗"); }
  catch { console.log("no-fee route blocked: ✓"); }

  // 9) fuel + maintenance log writes
  const fl = await addFuel(principal, { vehicleId: bus1.id, date: "2026-06-12", litres: 55, costKes: 9900, odometerKm: 84920 });
  const mt = await addMaintenance(principal, { vehicleId: bus1.id, date: "2026-06-12", type: "TYRES", description: "2 new front tyres", costKes: 24000 });
  console.log("fuel + maintenance logged: ✓", fl.id.slice(0, 6), mt.id.slice(0, 6));

  // cleanup test extras
  await db.transportAssignment.deleteMany({ where: { routeId: tinyRoute.id } });
  await db.transportRoute.delete({ where: { id: tinyRoute.id } });
  await db.vehicle.delete({ where: { id: tinyBus.id } });
  await db.fuelLog.delete({ where: { id: fl.id } });
  await db.vehicleMaintenance.delete({ where: { id: mt.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Transport" } } });
  await db.student.deleteMany({ where: { id: { in: [capStu1.id, capStu2.id, capStu3.id] } } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
