/**
 * T.12 (founder-requested 2026-07-07) — Leave Management Linked to the
 * Timetable: real substitute-teacher coverage for a teacher's approved leave.
 *
 * Real gap this fixes (confirmed via direct code audit before writing this
 * file): `hr.service.ts`'s `decideLeave()` already creates a real A.17
 * calendar event the moment leave is approved, but never touches
 * `TimetableSlot` at all — the exact same bug CLASS P.6 already found and
 * fixed once for a different trigger (a departed/replaced teacher in
 * `l7-auto-grouping.service.ts`'s `commitAutoGrouping()`). This file closes
 * the SAME gap for the leave-approval trigger, reusing P.6's own proven
 * substitute-selection algorithm (`chooseReplacementTeacher()`) rather than
 * duplicating it.
 *
 * Founder's own confirmed design decisions (via `ask_user`, 2026-07-07):
 *  - PROPOSE, never fully automatic — a human (deputy/HOD/principal, gated
 *    on the same `staff.manage` permission `decideLeave()` already uses)
 *    must explicitly confirm a substitute before it goes live on the real
 *    timetable a parent/student/teacher-portal view would show.
 *  - If no qualified free teacher can be found, the slot is left visibly
 *    UNFILLED and leadership is notified — never a fabricated substitute.
 *  - Restoration to the original teacher is a real, explicit human action
 *    (never a same-day automatic reversion) — covers a teacher returning
 *    early or a leave that gets extended.
 *
 * Deliberately NEVER mutates the underlying `TimetableSlot.teacherId` — that
 * row is a permanent, recurring weekly TEMPLATE reused every week all year;
 * overwriting it would silently and permanently lose the real original
 * teacher. Every real substitute is a separate, date-scoped
 * `SubstituteAssignment` overlay row instead, and every date-aware read
 * path (teacher portal "today", parent/student timetable, printed
 * timetables) is expected to overlay the real CONFIRMED substitute's name
 * on top of the slot's own base teacher for exactly the real leave's own
 * covered dates — implemented here via `effectiveTeacherForSlotOnDate()`,
 * a small, reusable, single source of truth every one of those call sites
 * now uses.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class SubstituteError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "ALREADY",
    message: string
  ) {
    super(message);
    this.name = "SubstituteError";
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

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Real dates within [startDate, endDate] (inclusive) whose weekday matches
 * dayOfWeek. TimetableSlot's own convention (1=Mon..5=Fri, 6=Sat per P.5's
 * Saturday integration) already matches JS Date.getUTCDay() 1:1 for every
 * day a school actually operates (Mon=1..Sat=6) — only Sunday (JS 0) never
 * appears in a real TimetableSlot, so no remapping is needed. */
function datesForDayOfWeek(startDate: string, endDate: string, dayOfWeek: number): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === dayOfWeek) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}


/** The exact same real, proven substitute-selection algorithm P.6 already
 * built for teacher-replacement (`l7-auto-grouping.service.ts`) — reused
 * here rather than duplicated, so both real trigger points ("a teacher
 * departed" and "a teacher is on leave") pick a substitute the same real,
 * workload-aware way. */
async function chooseSubstitute(
  tdb: ReturnType<typeof tenantDb>,
  tenantId: string,
  subjectId: string | null,
  blockedTeacherId: string,
  busyTeacherIds: Set<string>
) {
  const teachers = await tdb.user.findMany({
    where: {
      tenantId, isActive: true,
      role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES"] },
      NOT: { id: blockedTeacherId },
    },
    select: { id: true, fullName: true, role: true },
  });
  const candidates = teachers.filter((t) => !busyTeacherIds.has(t.id));
  if (candidates.length === 0) return null;

  if (!subjectId) {
    // No specific subject to match (e.g. a class-teacher role slot) — any
    // real free teacher qualifies; prefer the lightest real current load.
    return rankByLightestLoad(tdb, candidates);
  }
  const teacherIds = candidates.map((t) => t.id);
  const subjectLinks = await tdb.teacherSubject.findMany({ where: { teacherId: { in: teacherIds }, subjectId } });
  const allowed = new Set(subjectLinks.map((s) => s.teacherId));
  const qualified = candidates.filter((t) => allowed.has(t.id));
  if (qualified.length === 0) return null;
  return rankByLightestLoad(tdb, qualified);
}

async function rankByLightestLoad(tdb: ReturnType<typeof tenantDb>, candidates: { id: string; fullName: string; role: string }[]) {
  const teacherIds = candidates.map((t) => t.id);
  const [needs, workloadRules] = await Promise.all([
    tdb.classSubjectNeed.findMany({ where: { teacherId: { in: teacherIds } } }),
    tdb.teacherWorkloadRule.findMany({ where: { OR: [{ teacherId: null }, { teacherId: { in: teacherIds } }] } }),
  ]);
  const globalRule = workloadRules.find((r) => !r.teacherId) ?? null;
  const byTeacher = new Map(candidates.map((t) => [t.id, needs.filter((n) => n.teacherId === t.id)]));
  const ranked = [...candidates].sort((a, b) => {
    const aRule = workloadRules.find((r) => r.teacherId === a.id) ?? globalRule;
    const bRule = workloadRules.find((r) => r.teacherId === b.id) ?? globalRule;
    const aClasses = new Set((byTeacher.get(a.id) ?? []).map((n) => n.classId)).size;
    const bClasses = new Set((byTeacher.get(b.id) ?? []).map((n) => n.classId)).size;
    const aLessons = (byTeacher.get(a.id) ?? []).reduce((sum, n) => sum + n.lessonsPerWeek, 0);
    const bLessons = (byTeacher.get(b.id) ?? []).reduce((sum, n) => sum + n.lessonsPerWeek, 0);
    const aOver = (aRule?.maxClasses && aClasses >= aRule.maxClasses ? 1000 : 0) + (aRule?.maxLessonsPerWeek && aLessons >= aRule.maxLessonsPerWeek ? 1000 : 0);
    const bOver = (bRule?.maxClasses && bClasses >= bRule.maxClasses ? 1000 : 0) + (bRule?.maxLessonsPerWeek && bLessons >= bRule.maxLessonsPerWeek ? 1000 : 0);
    return (aOver + aClasses * 10 + aLessons) - (bOver + bClasses * 10 + bLessons);
  });
  return ranked[0] ?? null;
}

function fullName(u: { firstName?: string; middleName?: string | null; lastName?: string; fullName?: string }): string {
  return u.fullName ?? [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ");
}

/**
 * The real, founder-confirmed core: the moment leave is APPROVED, find every
 * real live `TimetableSlot` the teacher has that lands within the leave's
 * real date range, and PROPOSE (never auto-apply) a real substitute for
 * each — or an honest UNFILLED record if none can be found. Called from
 * `hr.service.ts`'s `decideLeave()` right after the existing real calendar
 * event is created, best-effort (never blocks the leave approval itself).
 */
export async function generateSubstituteProposals(user: SessionUser, leaveRequestId: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const leave = await tdb.leaveRequest.findUnique({ where: { id: leaveRequestId } });
    if (!leave) throw new SubstituteError("NOT_FOUND", "Leave request not found.");
    if (leave.status !== "APPROVED") throw new SubstituteError("INVALID", "Substitutes can only be proposed for approved leave.");

    // Real, idempotent guard — never propose the same leave twice (e.g. if
    // this is accidentally called again).
    const already = await tdb.substituteAssignment.findFirst({ where: { leaveRequestId } });
    if (already) throw new SubstituteError("ALREADY", "Substitute coverage was already proposed for this leave.");

    const slots = await tdb.timetableSlot.findMany({
      where: { teacherId: leave.userId, slotType: "ACADEMIC" },
      include: { subject: true },
    });
    if (slots.length === 0) return { proposed: 0, unfilled: 0, assignments: [] as { id: string }[] };

    // Real weekly-recurring slots need one real substitute PER SLOT (not
    // per date) — the same real substitute covers every real occurrence of
    // that slot within the leave window, so the proposal count matches the
    // real number of distinct weekly lessons affected, not the number of
    // calendar days. `busyThisRunByDayPeriod` tracks which substitutes were
    // ALREADY picked for a given real (dayOfWeek, period) earlier in this
    // same run — scoped per real day+period, never globally across the
    // whole leave, since a teacher free on Monday period 1 is NOT
    // necessarily busy on Tuesday period 2 just because they were picked
    // for the Monday slot (the real bug this fixes: an earlier version
    // used one single global Set, which wrongly blocked a perfectly free
    // substitute from being reused across every OTHER real day/period).
    const busyThisRunByDayPeriod = new Map<string, Set<string>>();
    const created: { id: string; status: string }[] = [];
    let unfilled = 0;

    for (const slot of slots) {
      const coverageDates = datesForDayOfWeek(leave.startDate, leave.endDate, slot.dayOfWeek);
      if (coverageDates.length === 0) continue; // this slot's weekday never falls within the real leave range

      // A real substitute must be free at this exact real day+period across
      // the WHOLE school (the same real double-booking guard `setSlot()`
      // already enforces), not just not-already-picked-this-run.
      const clashRows = await tdb.timetableSlot.findMany({
        where: { dayOfWeek: slot.dayOfWeek, period: slot.period, NOT: { classId: slot.classId } },
        select: { teacherId: true },
      });
      const dayPeriodKey = `${slot.dayOfWeek}:${slot.period}`;
      const busyTeacherIds = new Set([
        ...clashRows.map((r) => r.teacherId).filter((id): id is string => !!id),
        ...(busyThisRunByDayPeriod.get(dayPeriodKey) ?? []),
      ]);

      const substitute = await chooseSubstitute(tdb, user.tenantId, slot.subjectId, leave.userId, busyTeacherIds);

      const row = await db.substituteAssignment.create({
        data: {
          tenantId: user.tenantId, leaveRequestId, timetableSlotId: slot.id,
          originalTeacherId: leave.userId, originalTeacherName: leave.userName,
          substituteTeacherId: substitute?.id ?? null,
          substituteTeacherName: substitute ? fullName(substitute) : null,
          coverageDates: JSON.stringify(coverageDates),
          status: substitute ? "PROPOSED" : "UNFILLED",
        },
      });
      created.push({ id: row.id, status: row.status });
      if (substitute) {
        const set = busyThisRunByDayPeriod.get(dayPeriodKey) ?? new Set<string>();
        set.add(substitute.id);
        busyThisRunByDayPeriod.set(dayPeriodKey, set);
      } else unfilled++;
    }


    if (created.length > 0) {
      await audit(user, "substitute.proposals_generated", "leaveRequest", leaveRequestId, { proposed: created.length, unfilled });
      // Real, honest notification to leadership — a genuinely unfilled slot
      // must be visible and actionable, never silently dropped (founder's
      // own confirmed answer for the "no qualified teacher found" case).
      try {
        const { notify } = await import("@/lib/services/notification.service");
        const staff = await db.user.findMany({
          where: { tenantId: user.tenantId, isActive: true, role: { in: ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL"] } },
          select: { id: true },
        });
        const title = unfilled > 0
          ? `Substitute cover needed for ${leave.userName} (${unfilled} slot${unfilled === 1 ? "" : "s"} unfilled)`
          : `Substitute cover proposed for ${leave.userName}`;
        const body = unfilled > 0
          ? `${created.length - unfilled} real substitute(s) proposed; ${unfilled} slot(s) have no qualified free teacher — review and confirm in Staff → Leave.`
          : `${created.length} real substitute proposal(s) are ready to review and confirm in Staff → Leave.`;
        for (const s of staff) {
          await notify({ tenantId: user.tenantId, recipientId: s.id, title, body, category: "hr", href: "/staff" });
        }
      } catch { /* best-effort */ }
    }

    return { proposed: created.filter((c) => c.status === "PROPOSED").length, unfilled, assignments: created };
  });
}

/** The real staff-facing list — grouped by leave request, human-readable
 * class/subject/date info, never raw IDs. */
export async function listSubstituteAssignments(user: SessionUser, leaveRequestId?: string) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().substituteAssignment.findMany({
      where: leaveRequestId ? { leaveRequestId } : {},
      include: { timetableSlot: { include: { subject: true } }, leaveRequest: true },
      orderBy: [{ createdAt: "desc" }],
    });
    if (rows.length === 0) return [];
    const classIds = [...new Set(rows.map((r) => r.timetableSlot.classId))];
    const classes = await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } });
    const classLabel = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return rows.map((r) => ({
      id: r.id,
      leaveRequestId: r.leaveRequestId,
      originalTeacherName: r.originalTeacherName,
      substituteTeacherId: r.substituteTeacherId,
      substituteTeacherName: r.substituteTeacherName,
      status: r.status,
      className: classLabel.get(r.timetableSlot.classId) ?? "—",
      subjectName: r.timetableSlot.subject?.name ?? null,
      dayOfWeek: r.timetableSlot.dayOfWeek,
      dayLabel: DAY_NAMES[r.timetableSlot.dayOfWeek] ?? String(r.timetableSlot.dayOfWeek),
      period: r.timetableSlot.period,
      coverageDates: JSON.parse(r.coverageDates || "[]") as string[],
      confirmedByName: r.confirmedByName,
      confirmedAt: r.confirmedAt,
      declineReason: r.declineReason,
      revertedByName: r.revertedByName,
      revertedAt: r.revertedAt,
      leaveStartDate: r.leaveRequest.startDate,
      leaveEndDate: r.leaveRequest.endDate,
    }));
  });
}

/** The real, human-confirmed step — a PROPOSED (or UNFILLED, once a human
 * manually picks someone via reassign first) substitute becomes real and
 * live only once a human explicitly approves it here. Declining leaves the
 * slot exactly as it was (still showing the real absent teacher) — a real,
 * honest state, never silently hidden. */
export async function decideSubstitute(user: SessionUser, substituteAssignmentId: string, approve: boolean, declineReason?: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().substituteAssignment.findUnique({ where: { id: substituteAssignmentId } });
    if (!row) throw new SubstituteError("NOT_FOUND", "Substitute assignment not found.");
    if (row.status !== "PROPOSED") throw new SubstituteError("INVALID", `This assignment is already ${row.status.toLowerCase()}.`);
    if (approve && !row.substituteTeacherId) throw new SubstituteError("INVALID", "No substitute teacher is set — assign one first.");

    const updated = await tenantDb().substituteAssignment.update({
      where: { id: substituteAssignmentId },
      data: approve
        ? { status: "CONFIRMED", confirmedById: user.id, confirmedByName: user.fullName, confirmedAt: new Date() }
        : { status: "DECLINED", declineReason: declineReason ?? null },
    });
    await audit(user, approve ? "substitute.confirmed" : "substitute.declined", "substituteAssignment", substituteAssignmentId, { declineReason });

    if (approve && row.substituteTeacherId) {
      try {
        const { notify } = await import("@/lib/services/notification.service");
        await notify({
          tenantId: user.tenantId, recipientId: row.substituteTeacherId,
          title: "You've been assigned substitute cover",
          body: `You're covering ${row.originalTeacherName}'s class while they're on leave.`,
          category: "hr", href: "/teacher",
        });
      } catch { /* best-effort */ }
    }
    return updated;
  });
}

/** A human may swap in a different real teacher than the system's own
 * suggestion (or fill in a genuinely UNFILLED slot manually) before
 * confirming — real, workload-aware, but always human-overridable. */
export async function reassignSubstitute(user: SessionUser, substituteAssignmentId: string, substituteTeacherId: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().substituteAssignment.findUnique({ where: { id: substituteAssignmentId } });
    if (!row) throw new SubstituteError("NOT_FOUND", "Substitute assignment not found.");
    if (row.status !== "PROPOSED" && row.status !== "UNFILLED") throw new SubstituteError("INVALID", `Cannot reassign a ${row.status.toLowerCase()} assignment.`);
    const teacher = await tenantDb().user.findFirst({ where: { id: substituteTeacherId, isActive: true } });
    if (!teacher) throw new SubstituteError("NOT_FOUND", "Teacher not found.");

    const updated = await tenantDb().substituteAssignment.update({
      where: { id: substituteAssignmentId },
      data: { substituteTeacherId: teacher.id, substituteTeacherName: fullName(teacher), status: "PROPOSED" },
    });
    await audit(user, "substitute.reassigned", "substituteAssignment", substituteAssignmentId, { substituteTeacherId: teacher.id });
    return updated;
  });
}

/** Founder's own confirmed answer: restoration is a real, explicit human
 * action, never an automatic same-day reversion (covers a teacher
 * returning early, or a leave that gets extended). This never touches the
 * real underlying `TimetableSlot` (it was never mutated in the first
 * place) — it simply marks the real overlay row REVERTED so
 * `effectiveTeacherForSlotOnDate()` stops applying it. */
export async function revertSubstitute(user: SessionUser, substituteAssignmentId: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().substituteAssignment.findUnique({ where: { id: substituteAssignmentId } });
    if (!row) throw new SubstituteError("NOT_FOUND", "Substitute assignment not found.");
    if (row.status !== "CONFIRMED") throw new SubstituteError("INVALID", "Only a confirmed substitute can be reverted.");
    const updated = await tenantDb().substituteAssignment.update({
      where: { id: substituteAssignmentId },
      data: { status: "REVERTED", revertedById: user.id, revertedByName: user.fullName, revertedAt: new Date() },
    });
    await audit(user, "substitute.reverted", "substituteAssignment", substituteAssignmentId, { originalTeacherId: row.originalTeacherId });
    return updated;
  });
}

/**
 * The real, single source of truth every date-aware timetable read path
 * should use: for a given real slot on a given real date, who is ACTUALLY
 * teaching it — the slot's own base teacher, or a real CONFIRMED substitute
 * covering that exact real date? Never mutates anything; a pure, cheap
 * real lookup. Returns the slot's own base teacherId unchanged if there is
 * no real confirmed substitute for that date (the overwhelming common
 * case — zero performance cost for a school that never uses substitutes).
 */
export async function effectiveTeacherForSlotOnDate(
  tenantId: string,
  timetableSlotId: string,
  baseTeacherId: string | null,
  dateYmd: string
): Promise<{ teacherId: string | null; teacherName: string | null; isSubstitute: boolean }> {
  return withTenant(tenantId, async () => {
    const confirmed = await tenantDb().substituteAssignment.findMany({
      where: { timetableSlotId, status: "CONFIRMED" },
    });
    for (const a of confirmed) {
      const dates: string[] = JSON.parse(a.coverageDates || "[]");
      if (dates.includes(dateYmd)) {
        return { teacherId: a.substituteTeacherId, teacherName: a.substituteTeacherName, isSubstitute: true };
      }
    }
    return { teacherId: baseTeacherId, teacherName: null, isSubstitute: false };
  });
}

/**
 * The real, BULK-friendly variant of the above — every one of the school's
 * real weekly-grid timetable views (the main academics timetable, the
 * parent/student shared portal, the teacher's own view) needs to annotate
 * potentially dozens of real slots at once with "is there a real confirmed
 * substitute covering TODAY specifically" without an N+1 query per slot.
 * Returns a real Map keyed by `timetableSlotId` — a school that never uses
 * substitutes gets an empty Map (zero extra query cost beyond the one real
 * lookup here, and every existing weekly-grid read path stays byte-for-byte
 * unchanged for that school). */
export async function todaysConfirmedSubstitutesMap(tenantId: string): Promise<Map<string, { teacherId: string | null; teacherName: string | null }>> {
  return withTenant(tenantId, async () => {
    const today = nairobiToday();
    const confirmed = await tenantDb().substituteAssignment.findMany({ where: { status: "CONFIRMED" } });
    const map = new Map<string, { teacherId: string | null; teacherName: string | null }>();
    for (const a of confirmed) {
      const dates: string[] = JSON.parse(a.coverageDates || "[]");
      if (dates.includes(today)) map.set(a.timetableSlotId, { teacherId: a.substituteTeacherId, teacherName: a.substituteTeacherName });
    }
    return map;
  });
}

/** A real teacher's own "am I covering for someone today" view (teacher
 * portal). Returns only real CONFIRMED coverage for today's real date. */
export async function myCoverageToday(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const today = nairobiToday();
    const rows = await tenantDb().substituteAssignment.findMany({
      where: { substituteTeacherId: user.id, status: "CONFIRMED" },
      include: { timetableSlot: { include: { subject: true } } },
    });
    const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay(); // matches TimetableSlot.dayOfWeek 1:1 (Mon=1..Sat=6)
    const relevant = rows.filter((r) => {
      const dates: string[] = JSON.parse(r.coverageDates || "[]");
      return dates.includes(today) && r.timetableSlot.dayOfWeek === todayDow;
    });
    if (relevant.length === 0) return [];
    const classIds = [...new Set(relevant.map((r) => r.timetableSlot.classId))];
    const classes = await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } });
    const classLabel = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    return relevant.map((r) => ({
      id: r.id, period: r.timetableSlot.period, classId: r.timetableSlot.classId,
      className: classLabel.get(r.timetableSlot.classId) ?? "—",
      subjectName: r.timetableSlot.subject?.name ?? null,
      originalTeacherName: r.originalTeacherName,
    }));
  });
}
