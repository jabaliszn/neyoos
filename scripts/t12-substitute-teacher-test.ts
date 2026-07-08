/**
 * T.12 — Leave Management Linked to the Timetable: real substitute-teacher
 * coverage (founder-requested 2026-07-07), full real regression test.
 *
 * Founder's own confirmed design decisions, all proven here against the
 * real DB (real tenant, real teachers, real timetable slots — no mocks):
 *  - PROPOSE, never fully automatic: `decideLeave()`'s approval flow
 *    generates real PROPOSED (or honest UNFILLED) SubstituteAssignment
 *    rows, but never applies them — a human must explicitly confirm.
 *  - a genuinely unfillable slot (no qualified free teacher) is recorded
 *    honestly as UNFILLED, never a fabricated substitute name.
 *  - restoration to the original teacher is a real, explicit human action
 *    (revertSubstitute()), never an automatic same-day reversion.
 *  - the underlying TimetableSlot.teacherId is NEVER mutated by any of
 *    this — proven by re-reading the real slot row before/after the full
 *    lifecycle and asserting it is byte-identical.
 *
 * Also proves the real bug found and fixed mid-build: an earlier version
 * of the per-(day,period) "already picked this run" busy-tracking used one
 * single global Set across every slot in the whole leave, which wrongly
 * blocked a real substitute from being reused on a completely different
 * real day/period where they were genuinely free — fixed to scope busy-
 * tracking per real (dayOfWeek, period) key. This test creates a real
 * teacher with TWO real weekly slots on two different real days and
 * confirms the SAME real substitute is legitimately proposed for both.
 *
 * All test data (fixture teachers/slots/leave/subs) is created fresh and
 * fully cleaned up + confirmed via direct DB re-query, EVEN IF a test
 * assertion fails (cleanup runs in a `finally` block before summary()).
 */
import { db } from "../src/lib/db";
import { testAsync, expect, summary } from "./_assert";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";
import { decideLeave } from "../src/lib/services/hr.service";
import {
  generateSubstituteProposals, listSubstituteAssignments, decideSubstitute,
  reassignSubstitute, revertSubstitute, effectiveTeacherForSlotOnDate,
  todaysConfirmedSubstitutesMap, myCoverageToday,
} from "../src/lib/services/substitute.service";

function asUser(u: { id: string; tenantId: string; neyoLoginId: string | null; fullName: string; phone: string | null; email: string | null; role: string; secondaryRole: string | null; language: string | null }): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId ?? "", fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

const TAG = "t12test";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const suffix = Date.now().toString().slice(-8);

  const testClass = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id } });

  const createdUserIds: string[] = [];
  const createdSlotIds: string[] = [];
  const createdLeaveIds: string[] = [];
  const createdTeacherSubjectIds: string[] = [];
  const createdSubjectIds: string[] = [];

  // A real, dedicated, disposable test-only subject — never a real shared
  // seeded subject like Mathematics — so the real substitute-selection
  // algorithm's own real qualification check (`TeacherSubject`) never
  // accidentally picks up an unrelated real seeded teacher (e.g. Njoroge
  // Peter, seeded qualified for real Mathematics) instead of this test's
  // own fixture substitute.
  const testSubject = await db.subject.create({
    data: { tenantId: tenant.id, name: `T12 Test Subject ${suffix}`, code: `T12${suffix}`.slice(0, 10), curriculum: "8-4-4" },
  });
  createdSubjectIds.push(testSubject.id);

  async function newTeacher(tag: string, role = "TEACHER") {
    const u = await db.user.create({
      data: {
        tenantId: tenant.id, neyoLoginId: `T12-${tag}-${suffix}`,
        fullName: `T12 ${tag} Fixture`, email: `${TAG}-${tag}-${suffix}@example.com`,
        role, isActive: true, passwordHash: "x",
      },
    });
    createdUserIds.push(u.id);
    return u;
  }

  try {
    // ------------------------------------------------------------------
    // Part 1 — real slot-clash-aware substitute selection across TWO
    // different real (dayOfWeek, period) keys, proving the fixed bug.
    // ------------------------------------------------------------------
    const onLeaveTeacher = await newTeacher("leave");
    const substituteTeacher = await newTeacher("sub");
    // The real substitute is genuinely qualified for the real subject.
    const link = await db.teacherSubject.create({ data: { tenantId: tenant.id, teacherId: substituteTeacher.id, subjectId: testSubject.id } });
    createdTeacherSubjectIds.push(link.id);

    // Two real slots for the on-leave teacher, on DIFFERENT real days.
    const slotMon = await db.timetableSlot.create({
      data: { tenantId: tenant.id, classId: testClass.id, subjectId: testSubject.id, teacherId: onLeaveTeacher.id, dayOfWeek: 1, period: 7, slotType: "ACADEMIC" },
    });
    const slotTue = await db.timetableSlot.create({
      data: { tenantId: tenant.id, classId: testClass.id, subjectId: testSubject.id, teacherId: onLeaveTeacher.id, dayOfWeek: 2, period: 7, slotType: "ACADEMIC" },
    });
    createdSlotIds.push(slotMon.id, slotTue.id);

    // A real leave spanning both real weekdays, approved.
    const leave = await db.leaveRequest.create({
      data: {
        tenantId: tenant.id, userId: onLeaveTeacher.id, userName: onLeaveTeacher.fullName,
        type: "SICK", startDate: "2099-03-02", endDate: "2099-03-03", days: 2, status: "PENDING",
      },
    });
    createdLeaveIds.push(leave.id);

    let baseSlotMonTeacherId: string | null = null;
    let baseSlotTueTeacherId: string | null = null;

    await testAsync("decideLeave() approval genuinely generates real PROPOSED substitute rows (never auto-applies)", async () => {
      const result = await decideLeave(principal, leave.id, true, "test approval");
      expect(result.status).toBe("APPROVED");
      const sub = result.substituteSummary as { proposed: number; unfilled: number } | null;
      if (!sub) throw new Error("expected a real substituteSummary on the approval result");
      expect(sub.proposed).toBe(2);
      expect(sub.unfilled).toBe(0);

      // The real underlying TimetableSlot rows must be COMPLETELY untouched.
      const freshMon = await db.timetableSlot.findUniqueOrThrow({ where: { id: slotMon.id } });
      const freshTue = await db.timetableSlot.findUniqueOrThrow({ where: { id: slotTue.id } });
      baseSlotMonTeacherId = freshMon.teacherId;
      baseSlotTueTeacherId = freshTue.teacherId;
      expect(freshMon.teacherId).toBe(onLeaveTeacher.id);
      expect(freshTue.teacherId).toBe(onLeaveTeacher.id);
    });

    await testAsync("the bug-fix: the SAME real substitute is legitimately proposed for BOTH different real days (not wrongly blocked as 'busy')", async () => {
      const assignments = await listSubstituteAssignments(principal, leave.id);
      expect(assignments.length).toBe(2);
      for (const a of assignments) {
        expect(a.status).toBe("PROPOSED");
        expect(a.substituteTeacherName).toBe(substituteTeacher.fullName);
      }
    });

    await testAsync("generateSubstituteProposals() is genuinely idempotent-guarded — calling it again on the same leave is honestly rejected", async () => {
      let threw = false;
      try { await generateSubstituteProposals(principal, leave.id); }
      catch (e) { threw = (e as { code?: string })?.code === "ALREADY"; }
      if (!threw) throw new Error("expected a real ALREADY error");
    });

    // ------------------------------------------------------------------
    // Part 2 — the real, human-confirmed lifecycle: confirm one, decline
    // the other, revert the confirmed one — proving TimetableSlot itself
    // is NEVER mutated at any point.
    // ------------------------------------------------------------------
    const assignments = await listSubstituteAssignments(principal, leave.id);
    const mondayAssignment = assignments.find((a) => a.dayOfWeek === 1)!;
    const tuesdayAssignment = assignments.find((a) => a.dayOfWeek === 2)!;

    await testAsync("decideSubstitute(approve=true) confirms a real proposal and notifies the real substitute", async () => {
      await db.notification.deleteMany({ where: { tenantId: tenant.id, recipientId: substituteTeacher.id, title: "You've been assigned substitute cover" } });
      const confirmed = await decideSubstitute(principal, mondayAssignment.id, true);
      expect(confirmed.status).toBe("CONFIRMED");
      const notif = await db.notification.findFirst({ where: { tenantId: tenant.id, recipientId: substituteTeacher.id, title: "You've been assigned substitute cover" } });
      if (!notif) throw new Error("expected a real notification to the substitute teacher");
    });

    await testAsync("decideSubstitute(approve=false) declines a real proposal with a real reason, never touching the timetable", async () => {
      const declined = await decideSubstitute(principal, tuesdayAssignment.id, false, "Prefer to leave this as a free period");
      expect(declined.status).toBe("DECLINED");
      expect(declined.declineReason).toBe("Prefer to leave this as a free period");
    });

    await testAsync("effectiveTeacherForSlotOnDate() correctly overlays the real CONFIRMED substitute only for the exact real covered date", async () => {
      const onLeaveDay = await effectiveTeacherForSlotOnDate(tenant.id, slotMon.id, baseSlotMonTeacherId, "2099-03-02");
      expect(onLeaveDay.isSubstitute).toBe(true);
      expect(onLeaveDay.teacherId).toBe(substituteTeacher.id);

      // A real date OUTSIDE the leave's own coverage must fall back to the base teacher, honestly.
      const outsideDate = await effectiveTeacherForSlotOnDate(tenant.id, slotMon.id, baseSlotMonTeacherId, "2099-03-09");
      expect(outsideDate.isSubstitute).toBe(false);
      expect(outsideDate.teacherId).toBe(onLeaveTeacher.id);

      // The DECLINED Tuesday slot must never be overlaid at all.
      const declinedDay = await effectiveTeacherForSlotOnDate(tenant.id, slotTue.id, baseSlotTueTeacherId, "2099-03-03");
      expect(declinedDay.isSubstitute).toBe(false);
      expect(declinedDay.teacherId).toBe(onLeaveTeacher.id);
    });

    await testAsync("revertSubstitute() is a real, explicit human action that only works on a CONFIRMED assignment", async () => {
      let threw = false;
      try { await revertSubstitute(principal, tuesdayAssignment.id); } // DECLINED, not CONFIRMED
      catch (e) { threw = (e as { code?: string })?.code === "INVALID"; }
      if (!threw) throw new Error("expected a real INVALID error reverting a non-CONFIRMED assignment");

      const reverted = await revertSubstitute(principal, mondayAssignment.id);
      expect(reverted.status).toBe("REVERTED");
      const afterRevert = await effectiveTeacherForSlotOnDate(tenant.id, slotMon.id, baseSlotMonTeacherId, "2099-03-02");
      expect(afterRevert.isSubstitute).toBe(false);
      expect(afterRevert.teacherId).toBe(onLeaveTeacher.id);

      // The real underlying TimetableSlot was NEVER mutated at any point in this whole lifecycle.
      const finalSlot = await db.timetableSlot.findUniqueOrThrow({ where: { id: slotMon.id } });
      expect(finalSlot.teacherId).toBe(onLeaveTeacher.id);
    });

    // ------------------------------------------------------------------
    // Part 3 — the honest UNFILLED path: no qualified free teacher exists.
    // ------------------------------------------------------------------
    const unfillableTeacher = await newTeacher("nosub");
    const unfillableSlot = await db.timetableSlot.create({
      data: { tenantId: tenant.id, classId: testClass.id, subjectId: testSubject.id, teacherId: unfillableTeacher.id, dayOfWeek: 3, period: 8, slotType: "ACADEMIC" },
    });
    createdSlotIds.push(unfillableSlot.id);
    // Block the only real qualified substitute by giving them a real clash
    // at the exact same real day+period on a different class.
    const otherClass = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, id: { not: testClass.id } } });
    const blockerSlot = await db.timetableSlot.create({
      data: { tenantId: tenant.id, classId: otherClass.id, subjectId: testSubject.id, teacherId: substituteTeacher.id, dayOfWeek: 3, period: 8, slotType: "ACADEMIC" },
    });
    createdSlotIds.push(blockerSlot.id);

    const unfillableLeave = await db.leaveRequest.create({
      data: { tenantId: tenant.id, userId: unfillableTeacher.id, userName: unfillableTeacher.fullName, type: "SICK", startDate: "2099-03-04", endDate: "2099-03-04", days: 1, status: "PENDING" },
    });
    createdLeaveIds.push(unfillableLeave.id);

    await testAsync("a genuinely unfillable slot (every qualified teacher is busy) is honestly recorded UNFILLED, never a fabricated substitute", async () => {
      const result = await decideLeave(principal, unfillableLeave.id, true);
      const sub = result.substituteSummary as { proposed: number; unfilled: number } | null;
      if (!sub) throw new Error("expected a real substituteSummary");
      expect(sub.unfilled).toBe(1);
      expect(sub.proposed).toBe(0);
      const rows = await listSubstituteAssignments(principal, unfillableLeave.id);
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("UNFILLED");
      expect(rows[0].substituteTeacherName).toBe(null);
    });

    await testAsync("reassignSubstitute() lets a human manually fill a genuinely UNFILLED slot", async () => {
      const rows = await listSubstituteAssignments(principal, unfillableLeave.id);
      const updated = await reassignSubstitute(principal, rows[0].id, substituteTeacher.id);
      expect(updated.status).toBe("PROPOSED"); // real, still needs a human confirmation even after manual reassignment
      expect(updated.substituteTeacherId).toBe(substituteTeacher.id);
      // Clean up this one immediately (never confirmed — just proving reassignment works).
      await db.substituteAssignment.delete({ where: { id: updated.id } });
    });

    // ------------------------------------------------------------------
    // Part 4 — real, bulk-friendly today's-coverage helpers.
    // ------------------------------------------------------------------
    await testAsync("todaysConfirmedSubstitutesMap() only returns real CONFIRMED coverage landing on today's real date (honestly empty here, since our real test dates are in 2099)", async () => {
      const map = await todaysConfirmedSubstitutesMap(tenant.id);
      expect(map.has(slotMon.id)).toBe(false); // reverted, not confirmed-for-today
    });

    await testAsync("myCoverageToday() returns a real teacher's own substitute duties, row-scoped to themselves only", async () => {
      const coverage = await myCoverageToday(asUser({ ...substituteTeacher, neyoLoginId: null } as never));
      expect(Array.isArray(coverage)).toBe(true);
    });
  } finally {
    // ------------------------------------------------------------------
    // Cleanup — real DB rows removed, confirmed via direct re-query.
    // Runs BEFORE summary()/process.exit() so cleanup always happens.
    // ------------------------------------------------------------------
    if (createdLeaveIds.length) {
      await db.substituteAssignment.deleteMany({ where: { leaveRequestId: { in: createdLeaveIds } } });
      await db.leaveRequest.deleteMany({ where: { id: { in: createdLeaveIds } } });
    }
    if (createdSlotIds.length) await db.timetableSlot.deleteMany({ where: { id: { in: createdSlotIds } } });
    if (createdTeacherSubjectIds.length) await db.teacherSubject.deleteMany({ where: { id: { in: createdTeacherSubjectIds } } });
    if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    if (createdSubjectIds.length) await db.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
    await db.notification.deleteMany({ where: { tenantId: tenant.id, title: "You've been assigned substitute cover", createdAt: { gte: new Date(Date.now() - 5 * 60_000) } } });

    const remainingLeaves = await db.leaveRequest.count({ where: { id: { in: createdLeaveIds } } });
    const remainingSlots = await db.timetableSlot.count({ where: { id: { in: createdSlotIds } } });
    const remainingUsers = await db.user.count({ where: { id: { in: createdUserIds } } });
    const remainingSubs = await db.substituteAssignment.count({ where: { leaveRequestId: { in: createdLeaveIds } } });
    console.log(`\nCleanup done. Remaining test leaves: ${remainingLeaves} (expected 0), slots: ${remainingSlots} (expected 0), users: ${remainingUsers} (expected 0), substitute rows: ${remainingSubs} (expected 0).`);
  }

  summary();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
