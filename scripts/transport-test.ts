/** B.17 Transport — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  listRoutes, createRoute, listDrivers, addDriver, listVehicles, addVehicle,
  addMaintenance, addFuel, vehicleFile, routeRiders, assignStudent,
  releaseAssignment, invoiceRiders,
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
  console.log("seat math:", routeA.riders === 2 && routeA.seatsLeft === 31 ? "✓ 2 riders, 31/33 seats left" : "✗ " + JSON.stringify({ r: routeA.riders, s: routeA.seatsLeft }));
  console.log("stops parsed:", routeA.stops.length === 4 && routeA.stops[0] === "Mwiki" ? "✓ 4 stops" : "✗");

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
  // invalid pickup stop
  const kamau = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Kamau" } });
  try { await assignStudent(principal, { routeId: routeA.id, studentId: kamau.id, pickupStop: "Nakuru" }); console.log("bad stop: ALLOWED ✗"); }
  catch { console.log("invalid pickup stop blocked: ✓"); }
  // valid assign + release + double release
  const a = await assignStudent(principal, { routeId: routeA.id, studentId: kamau.id, pickupStop: "Seasons" });
  console.log("assign w/ stop: ✓", a.pickupStop);
  await releaseAssignment(principal, a.id);
  try { await releaseAssignment(principal, a.id); console.log("double release: ALLOWED ✗"); }
  catch { console.log("double release blocked: ✓"); }

  // 7) capacity: tiny bus (2 seats) fills up
  const tinyBus = await addVehicle(principal, { regNo: "KZZ 001T", capacity: 2 });
  const tinyRoute = await createRoute(principal, { name: "Test Tiny Route", termFeeKes: 0, vehicleId: tinyBus.id });
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const atieno = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Atieno" } });
  await assignStudent(principal, { routeId: tinyRoute.id, studentId: achieng.id });
  await assignStudent(principal, { routeId: tinyRoute.id, studentId: atieno.id });
  try { await assignStudent(principal, { routeId: tinyRoute.id, studentId: kamau.id }); console.log("over capacity: ALLOWED ✗"); }
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
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
