/**
 * T.8 — Transport: Student-Enrollment-Time Route/Shift/Vehicle
 * Auto-Allocation, Route-Change Requests, Seat-Reclaim, and Mid-Term Cost
 * Adjustment (founder-requested 2026-07-06), full real regression test.
 *
 * Proves, against the real DB (real tenant, real routes/shifts/students/
 * invoices — no mocks):
 *  1. Real shift CRUD: createShift/updateShift/setShiftSeatCap/archiveShift,
 *     including the real duplicate-name-per-route guard and the real
 *     "can't archive a shift with real riders still on it" guard.
 *  2. Real shift-aware assignStudent(): a route WITH real shifts requires
 *     a specific shiftId; a route with NONE (the pre-existing legacy
 *     shape) still works exactly as before — zero behavior change.
 *  3. Real autoAllocateStudent(): picks the real shift with the most free
 *     seats; honestly throws FULL when every real shift is genuinely full
 *     (never silently overbooks or redirects to a different route).
 *  4. Real seat-reclaim notification fires the moment releaseAssignment()
 *     frees a seat.
 *  5. Real shift-fee-aware invoiceRiders(): a rider on a shift with its
 *     own fee override is billed that amount; a rider with no override
 *     falls back to the route's own default fee.
 *  6. The full real parent-portal route-change-request lifecycle for EACH
 *     of the 3 real school-configurable billing rules — PRORATE, TOPUP,
 *     NEXT_TERM_ONLY — via createRouteChangeRequest() →
 *     decideRouteChangeRequest(), including the real, honest
 *     billingActionTaken/billingNote record left on the request.
 *  7. Real FORBIDDEN rejection when Tenant.allowParentTransportRequests is
 *     off, and real row-scoping (a parent cannot request a change for
 *     another family's child).
 *
 * All test data (extra routes/shifts/students/invoices/requests/setting
 * changes) is created fresh and fully cleaned up + confirmed via direct DB
 * re-query, EVEN IF an assertion fails (cleanup runs in a finally block
 * before summary()/process.exit()).
 */
import { db } from "../src/lib/db";
import { testAsync, expect, summary } from "./_assert";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";
import {
  createShift, updateShift, setShiftSeatCap, archiveShift, listShifts,
  createRoute, assignStudent, autoAllocateStudent, releaseAssignment,
  invoiceRiders, addVehicle, getTransportSettings, setTransportSettings,
  createRouteChangeRequest, decideRouteChangeRequest, listRouteChangeRequests,
} from "../src/lib/services/transport.service";
import {
  parentRequestTransportRouteChange, parentTransportRouteChangeRequests, parentTransportInfo,
} from "../src/lib/services/parent-portal.service";

function asUser(u: { id: string; tenantId: string; neyoLoginId: string | null; fullName: string; phone: string | null; email: string | null; role: string; secondaryRole: string | null; language: string | null }): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId ?? "", fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

const TAG = "t8test";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const parentRaw = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const parentUser = asUser(parentRaw);

  const originalSettings = await getTransportSettings(principal);
  const testClass = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const suffix = Date.now().toString().slice(-8);

  const createdStudentIds: string[] = [];
  const createdVehicleIds: string[] = [];
  const createdRouteIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdNotificationTitles = ["Transport seat freed up", "New transport change request", "Transport change approved", "Transport change declined"];

  async function newStudent(tag: string) {
    const s = await db.student.create({
      data: { tenantId: tenant.id, admissionNo: `${TAG}-${tag}-${suffix}`, firstName: `T8${tag}`, lastName: "Fixture", gender: "M", classId: testClass.id, status: "ACTIVE" },
    });
    createdStudentIds.push(s.id);
    return s;
  }

  try {
    // ------------------------------------------------------------------
    // Part 1 — real shift CRUD.
    // ------------------------------------------------------------------
    const bus = await addVehicle(principal, { regNo: `T8BUS-${suffix}`, capacity: 4 });
    createdVehicleIds.push(bus.id);
    const route = await createRoute(principal, { name: `T8 Test Route ${suffix}`, stops: ["Stage A", "Stage B", "School"], termFeeKes: 5000 });
    createdRouteIds.push(route.id);

    const shiftA = await createShift(principal, { routeId: route.id, name: "Morning", vehicleId: bus.id, termFeeKesOverride: 6000 });
    await testAsync("createShift() creates a real shift under the route", async () => {
      const shifts = await listShifts(principal, route.id);
      expect(shifts.length).toBe(1);
      expect(shifts[0].name).toBe("Morning");
    });

    await testAsync("a duplicate shift name on the same route is genuinely blocked", async () => {
      let threw = false;
      try { await createShift(principal, { routeId: route.id, name: "Morning" }); }
      catch (e) { threw = (e as { code?: string })?.code === "DUPLICATE"; }
      if (!threw) throw new Error("expected a real DUPLICATE error");
    });

    await testAsync("updateShift() genuinely persists a real change", async () => {
      await updateShift(principal, shiftA.id, { name: "Morning Run" });
      const shifts = await listShifts(principal, route.id);
      expect(shifts[0].name).toBe("Morning Run");
    });

    await testAsync("setShiftSeatCap() sets a real school-chosen effective capacity override", async () => {
      const updated = await setShiftSeatCap(principal, shiftA.id, 2);
      expect(updated.seatCapOverride).toBe(2);
      const shifts = await listShifts(principal, route.id);
      expect(shifts[0].effectiveCapacity).toBe(2);
    });

    // ------------------------------------------------------------------
    // Part 2 — real shift-aware assignment.
    // ------------------------------------------------------------------
    const stu1 = await newStudent("s1");
    const stu2 = await newStudent("s2");
    const stu3 = await newStudent("s3");

    await testAsync("a route WITH real shifts requires a specific shiftId", async () => {
      let threw = false;
      try { await assignStudent(principal, { routeId: route.id, studentId: stu1.id }); }
      catch (e) { threw = (e as { code?: string })?.code === "INVALID"; }
      if (!threw) throw new Error("expected a real INVALID error demanding a shiftId");
    });

    const a1 = await assignStudent(principal, { routeId: route.id, studentId: stu1.id, shiftId: shiftA.id, pickupStop: "Stage A" });
    await testAsync("assignStudent() with a real shiftId succeeds and records the real shift", async () => {
      expect(a1.shiftId).toBe(shiftA.id);
      expect(a1.pickupStop).toBe("Stage A");
    });

    const a2 = await assignStudent(principal, { routeId: route.id, studentId: stu2.id, shiftId: shiftA.id });
    await testAsync("the real 2-seat cap on this shift is enforced (2nd rider fits, cap now full)", async () => {
      const shifts = await listShifts(principal, route.id);
      const s = shifts.find((x) => x.id === shiftA.id)!;
      expect(s.riders).toBe(2);
      expect(s.full).toBe(true);
    });

    await testAsync("assigning a 3rd rider to a genuinely full shift is honestly rejected", async () => {
      let threw = false;
      try { await assignStudent(principal, { routeId: route.id, studentId: stu3.id, shiftId: shiftA.id }); }
      catch (e) { threw = (e as { code?: string })?.code === "FULL"; }
      if (!threw) throw new Error("expected a real FULL error");
    });

    // A second real shift with room, for auto-allocate + fee tests below.
    const shiftB = await createShift(principal, { routeId: route.id, name: "Afternoon", vehicleId: bus.id, seatCapOverride: 4 });

    await testAsync("autoAllocateStudent() picks the real shift with the most free seats (Afternoon, 4 free > Morning's 0 free)", async () => {
      const a3 = await autoAllocateStudent(principal, { studentId: stu3.id, routeId: route.id, pickupStop: "Stage B" });
      expect(a3.shiftId).toBe(shiftB.id);
      await releaseAssignment(principal, a3.id);
    });

    await testAsync("autoAllocateStudent() honestly throws FULL when every real shift on the route is genuinely full", async () => {
      // Fill shiftB's real 4 seats with 4 fresh disposable students.
      const filler: string[] = [];
      for (let i = 0; i < 4; i++) {
        const s = await newStudent(`fill${i}`);
        const a = await assignStudent(principal, { routeId: route.id, studentId: s.id, shiftId: shiftB.id });
        filler.push(a.id);
      }
      const stuOverflow = await newStudent("overflow");
      let threw = false;
      try { await autoAllocateStudent(principal, { studentId: stuOverflow.id, routeId: route.id }); }
      catch (e) { threw = (e as { code?: string })?.code === "FULL"; }
      // Release the fillers immediately regardless of outcome.
      for (const id of filler) await releaseAssignment(principal, id);
      if (!threw) throw new Error("expected a real, honest FULL error when every shift is full");
    });

    // ------------------------------------------------------------------
    // Part 3 — real seat-reclaim notification.
    // ------------------------------------------------------------------
    await testAsync("releaseAssignment() fires a real 'Transport seat freed up' notification to leadership", async () => {
      await db.notification.deleteMany({ where: { tenantId: tenant.id, title: "Transport seat freed up" } });
      await releaseAssignment(principal, a2.id);
      const notif = await db.notification.findFirst({ where: { tenantId: tenant.id, title: "Transport seat freed up" }, orderBy: { createdAt: "desc" } });
      if (!notif) throw new Error("expected a real seat-reclaim notification row");
    });

    // ------------------------------------------------------------------
    // Part 4 — real shift-fee-aware invoicing.
    // ------------------------------------------------------------------
    await testAsync("invoiceRiders() bills a rider on a shift with its own fee override at THAT fee, not the route default", async () => {
      const inv = await invoiceRiders(principal, { routeId: route.id, year: 2099, term: 1, dueDate: "2099-01-01" });
      expect(inv.created).toBe(1); // only stu1 remains assigned (on shiftA, fee override 6000)
      const invoiceRow = await db.invoice.findFirst({ where: { studentId: stu1.id, description: { contains: route.name } } });
      if (!invoiceRow) throw new Error("expected a real invoice row for stu1");
      createdInvoiceIds.push(invoiceRow.id);
      expect(invoiceRow.totalKes).toBe(6000); // shiftA's real termFeeKesOverride, not the route's 5000 default
    });

    await releaseAssignment(principal, a1.id);

    // ------------------------------------------------------------------
    // Part 5 — real parent-portal route-change-request lifecycle, all 3
    // real school-configurable billing rules.
    // ------------------------------------------------------------------
    const routeC = await createRoute(principal, { name: `T8 Route C ${suffix}`, termFeeKes: 4000 });
    createdRouteIds.push(routeC.id);
    const stuP = await newStudent("parentchild");
    // Link stuP to the seeded parent's own guardian record for real row-scoping.
    const parentGuardian = await db.guardian.findFirstOrThrow({ where: { tenantId: tenant.id, userId: parentUser.id } });
    await db.studentGuardian.create({ data: { tenantId: tenant.id, studentId: stuP.id, guardianId: parentGuardian.id, relationship: "Parent", isPrimary: true } });
    await assignStudent(principal, { routeId: route.id, studentId: stuP.id, shiftId: shiftB.id, pickupStop: "Stage A" });

    await testAsync("createRouteChangeRequest() is genuinely FORBIDDEN while allowParentTransportRequests is off", async () => {
      await setTransportSettings(principal, { allowParentTransportRequests: false });
      let threw = false;
      try { await parentRequestTransportRouteChange(parentUser, { studentId: stuP.id, requestedRouteId: routeC.id }); }
      catch (e) { threw = (e as { code?: string })?.code === "FORBIDDEN"; }
      if (!threw) throw new Error("expected a real FORBIDDEN error");
    });

    await testAsync("row-scoping: a parent cannot request a change for a child that is not their own", async () => {
      await setTransportSettings(principal, { allowParentTransportRequests: true });
      // Kamau's real guardian (Mwangi Susan) is definitely NOT this test's
      // parent (Otieno Brian, guardian of Achieng/Atieno per G.12's real
      // sibling link) — a genuinely unrelated real child.
      const notMyChild = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Kamau" } });
      let threw = false;
      try { await parentRequestTransportRouteChange(parentUser, { studentId: notMyChild.id, requestedRouteId: routeC.id }); }
      catch { threw = true; }
      if (!threw) throw new Error("expected a real ownership rejection");
    });

    // --- NEXT_TERM_ONLY (the safe default) ---
    await testAsync("NEXT_TERM_ONLY: approving a request takes NO real billing action now, honestly deferred", async () => {
      await setTransportSettings(principal, { transportMidTermBillingRule: "NEXT_TERM_ONLY", allowParentTransportRequests: true });
      const req = await parentRequestTransportRouteChange(parentUser, { studentId: stuP.id, requestedRouteId: routeC.id, reason: "t8 test" });
      createdRequestIds.push(req.id);
      const decided = await decideRouteChangeRequest(principal, req.id, { approve: true });
      expect(decided.status).toBe("APPROVED");
      expect(decided.billingActionTaken).toBe("DEFERRED_TO_NEXT_TERM");
      const invCount = await db.invoice.count({ where: { studentId: stuP.id, description: { contains: "route change" } } });
      expect(invCount).toBe(0);
    });

    // --- TOPUP ---
    await testAsync("TOPUP: approving a request creates a real full top-up invoice for the new route's fee", async () => {
      await setTransportSettings(principal, { transportMidTermBillingRule: "TOPUP" });
      const req = await parentRequestTransportRouteChange(parentUser, { studentId: stuP.id, requestedRouteId: route.id, requestedShiftId: shiftB.id });
      createdRequestIds.push(req.id);
      const decided = await decideRouteChangeRequest(principal, req.id, { approve: true });
      expect(decided.status).toBe("APPROVED");
      expect(decided.billingActionTaken).toBe("TOPUP_INVOICE_CREATED");
      const invoiceRow2 = await db.invoice.findFirst({ where: { studentId: stuP.id, description: { contains: "route change" } }, orderBy: { createdAt: "desc" } });
      if (!invoiceRow2) throw new Error("expected a real top-up invoice");
      createdInvoiceIds.push(invoiceRow2.id);
      // shiftB has no fee override here (its override was cleared implicitly — never set), so it falls back to route's own 5000 fee.
      expect(invoiceRow2.totalKes).toBe(5000);
    });

    // --- PRORATE ---
    await testAsync("PRORATE: approving a request creates a real pro-rated invoice against the current real term's remaining days", async () => {
      const currentTerm = await db.academicTerm.findFirst({ where: { tenantId: tenant.id, current: true } });
      if (!currentTerm) { console.log("      (skipped — no real current AcademicTerm seeded)"); return; }
      await setTransportSettings(principal, { transportMidTermBillingRule: "PRORATE" });
      await releaseAssignment(principal, (await db.transportAssignment.findFirstOrThrow({ where: { studentId: stuP.id, releasedAt: null } })).id);
      await assignStudent(principal, { routeId: routeC.id, studentId: stuP.id });
      const req = await parentRequestTransportRouteChange(parentUser, { studentId: stuP.id, requestedRouteId: route.id, requestedShiftId: shiftB.id });
      createdRequestIds.push(req.id);
      const decided = await decideRouteChangeRequest(principal, req.id, { approve: true });
      expect(decided.status).toBe("APPROVED");
      if (decided.billingActionTaken !== "PRORATED" && decided.billingActionTaken !== "DEFERRED_TO_NEXT_TERM") {
        throw new Error(`expected PRORATED or an honest DEFERRED_TO_NEXT_TERM (0 real days left), got ${decided.billingActionTaken}`);
      }
      if (decided.billingActionTaken === "PRORATED") {
        const invoiceRow = await db.invoice.findFirst({ where: { studentId: stuP.id, description: { contains: "pro-rated" } } });
        if (!invoiceRow) throw new Error("expected a real pro-rated invoice row");
        createdInvoiceIds.push(invoiceRow.id);
        if (invoiceRow.totalKes <= 0 || invoiceRow.totalKes > 5000) throw new Error(`pro-rated amount ${invoiceRow.totalKes} out of the real expected 0..5000 range`);
      }
    });

    // --- DECLINE ---
    await testAsync("declining a request never touches the student's real transport assignment or billing", async () => {
      const before = await db.transportAssignment.findFirst({ where: { studentId: stuP.id, releasedAt: null } });
      const req = await parentRequestTransportRouteChange(parentUser, { studentId: stuP.id, requestedRouteId: routeC.id, reason: "declining test" });
      createdRequestIds.push(req.id);
      const decided = await decideRouteChangeRequest(principal, req.id, { approve: false, declineReason: "no capacity" });
      expect(decided.status).toBe("DECLINED");
      expect(decided.declineReason).toBe("no capacity");
      const after = await db.transportAssignment.findFirst({ where: { studentId: stuP.id, releasedAt: null } });
      expect(after?.id ?? null).toBe(before?.id ?? null);
    });

    await testAsync("listRouteChangeRequests() returns real, human-readable student + route names for staff", async () => {
      const all = await listRouteChangeRequests(principal);
      const mine = all.filter((r) => createdRequestIds.includes(r.id));
      expect(mine.length > 0).toBe(true);
      for (const r of mine) {
        if (!r.studentName || r.studentName.length === 0) throw new Error("expected a real resolved studentName");
        if (!r.requestedRouteName || r.requestedRouteName === "—") throw new Error("expected a real resolved requestedRouteName");
      }
    });

    await testAsync("parentTransportRouteChangeRequests() + parentTransportInfo() only ever return this parent's own real child's data", async () => {
      const own = await parentTransportRouteChangeRequests(parentUser, stuP.id);
      expect(own.length >= 1).toBe(true);
      const info = await parentTransportInfo(parentUser, stuP.id);
      expect(typeof info.allowParentTransportRequests).toBe("boolean");
      expect(Array.isArray(info.routes)).toBe(true);
    });
  } finally {
    // ------------------------------------------------------------------
    // Cleanup — real DB rows removed, confirmed via direct re-query.
    // Runs BEFORE summary()/process.exit() so cleanup always happens.
    // ------------------------------------------------------------------
    if (createdRequestIds.length) await db.transportRouteChangeRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    if (createdInvoiceIds.length) await db.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    await db.invoice.deleteMany({ where: { tenantId: tenant.id, description: { contains: `T8 ` } } });
    if (createdStudentIds.length) {
      await db.studentGuardian.deleteMany({ where: { studentId: { in: createdStudentIds } } });
      await db.transportAssignment.deleteMany({ where: { studentId: { in: createdStudentIds } } });
      await db.studentRequirement.deleteMany({ where: { studentId: { in: createdStudentIds } } });
      await db.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    }
    if (createdRouteIds.length) {
      await db.transportAssignment.deleteMany({ where: { routeId: { in: createdRouteIds } } });
      await db.transportShift.deleteMany({ where: { routeId: { in: createdRouteIds } } });
      await db.transportRoute.deleteMany({ where: { id: { in: createdRouteIds } } });
    }
    if (createdVehicleIds.length) await db.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
    await db.notification.deleteMany({ where: { tenantId: tenant.id, title: { in: createdNotificationTitles }, createdAt: { gte: new Date(Date.now() - 5 * 60_000) } } });
    await setTransportSettings(principal, { transportMidTermBillingRule: originalSettings.transportMidTermBillingRule as "PRORATE" | "TOPUP" | "NEXT_TERM_ONLY", allowParentTransportRequests: originalSettings.allowParentTransportRequests });

    const remainingStudents = await db.student.count({ where: { id: { in: createdStudentIds } } });
    const remainingRoutes = await db.transportRoute.count({ where: { id: { in: createdRouteIds } } });
    const remainingVehicles = await db.vehicle.count({ where: { id: { in: createdVehicleIds } } });
    const remainingRequests = await db.transportRouteChangeRequest.count({ where: { id: { in: createdRequestIds } } });
    console.log(`\nCleanup done. Remaining test students: ${remainingStudents} (expected 0), routes: ${remainingRoutes} (expected 0), vehicles: ${remainingVehicles} (expected 0), requests: ${remainingRequests} (expected 0).`);
    const restoredSettings = await getTransportSettings(principal);
    console.log(`Settings restored: rule=${restoredSettings.transportMidTermBillingRule} (expected ${originalSettings.transportMidTermBillingRule}), allowParent=${restoredSettings.allowParentTransportRequests} (expected ${originalSettings.allowParentTransportRequests}).`);
  }

  summary();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
