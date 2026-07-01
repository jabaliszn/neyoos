/**
 * J.13 — Parent Growth Dashboard service.
 *
 * Aggregates a parent-safe "growth not just grades" picture for ONE of the
 * signed-in parent's own children: attendance summary, behavior summary,
 * approved competency growth, talents/co-curricular, approved portfolio
 * highlights, a teacher feedback digest, upcoming assessments, and
 * teacher-set goals (with parent acknowledgement where the school enables it).
 *
 * Security: PARENT callers are verified as a guardian of the child; staff
 * callers (with portal access) may read for support. Everything runs inside
 * withTenant() so cross-tenant leakage is impossible.
 */
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class GrowthError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "DISABLED", message: string) {
    super(message);
    this.name = "GrowthError";
  }
}

/** Default-on feature gate: a school may turn off parent goal acknowledgement. */
export async function isGoalAckEnabled(): Promise<boolean> {
  const row = await tenantDb().tenantModule.findFirst({ where: { moduleKey: "parent_goal_ack" } });
  return row ? row.enabled : true; // default ON when no explicit row
}

/** Verify the caller may see this child (guardian for parents). */
async function assertGuardian(user: SessionUser, studentId: string) {
  const student = await tenantDb().student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true, classId: true, firstName: true, lastName: true } });
  if (!student) throw new GrowthError("NOT_FOUND", "Student not found.");
  if (user.role === "PARENT") {
    const link = await tenantDb().studentGuardian.findFirst({ where: { studentId, guardian: { userId: user.id } }, select: { id: true } });
    if (!link) throw new GrowthError("FORBIDDEN", "You are not a guardian of this learner.");
  }
  return student;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function ymdDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

export async function getParentGrowthDashboard(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await assertGuardian(user, studentId);
    const today = todayYmd();
    const since60 = ymdDaysAgo(60);

    // 1. Teacher-set goals (with acknowledgement state).
    const goals = await tDb.studentGoal.findMany({
      where: { studentId },
      include: { teacher: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const goalAckEnabled = await isGoalAckEnabled();

    // 2. Recent talents / co-curricular.
    const talents = await tDb.talentRecord.findMany({
      where: { studentId },
      include: { talentArea: true, coach: { select: { fullName: true } } },
      orderBy: { dateRecorded: "desc" },
      take: 4,
    });

    // 3. Competency growth — APPROVED + visible to parents only (safe view).
    const competencies = await tDb.competencyEvidence.findMany({
      where: { studentId, approved: true, visibleToParents: true },
      include: { competency: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    // 4. Upcoming assessments per child — REAL status + future/recent dueDate.
    //    (AssessmentPlan statuses are DRAFT|ACTIVE|MODERATION|RELEASED|ARCHIVED.)
    const upcomingAssessments = student.classId ? await tDb.assessmentPlan.findMany({
      where: {
        classId: student.classId,
        visibleToParents: true,
        status: { in: ["ACTIVE", "MODERATION"] },
        dueDate: { gte: today },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: { id: true, title: true, dueDate: true, maxMarks: true, term: true, year: true },
    }) : [];

    // 5. Approved portfolio highlights (safe).
    const portfolio = await tDb.portfolioItem.findMany({
      where: { studentId, status: "APPROVED", visibleToParents: true },
      orderBy: { approvedAt: "desc" },
      take: 6,
      select: { id: true, title: true, category: true, description: true, fileUrl: true, externalLink: true, approvedAt: true },
    });

    // 6. Attendance summary (last 60 days): present rate.
    const attRows = await tDb.attendanceRecord.findMany({
      where: { studentId, date: { gte: since60, lte: today } },
      select: { status: true },
    });
    const attTotal = attRows.length;
    const attPresent = attRows.filter((r) => r.status === "P").length;
    const attLate = attRows.filter((r) => r.status === "L").length;
    const attAbsent = attRows.filter((r) => r.status === "A").length;
    const attExcused = attRows.filter((r) => r.status === "E").length;
    const attendance = {
      windowDays: 60, totalMarked: attTotal, present: attPresent, late: attLate, absent: attAbsent, excused: attExcused,
      presentPct: attTotal ? Math.round((attPresent / attTotal) * 100) : null,
    };

    // 7. Behavior summary (APPROVED incidents only) — counts + demerit points.
    const incidents = await tDb.disciplineIncident.findMany({
      where: { studentId, status: "APPROVED", date: { gte: since60, lte: today } },
      orderBy: { date: "desc" },
      select: { id: true, date: true, category: true, severity: true, points: true },
    });
    const behavior = {
      windowDays: 60,
      incidents: incidents.length,
      demeritPoints: incidents.reduce((s, i) => s + (i.points ?? 0), 0),
      minor: incidents.filter((i) => i.severity === "MINOR").length,
      major: incidents.filter((i) => i.severity === "MAJOR").length,
      severe: incidents.filter((i) => i.severity === "SEVERE").length,
      recent: incidents.slice(0, 3).map((i) => ({ date: i.date, category: i.category, severity: i.severity })),
    };

    // 8. Teacher feedback digest — parent-safe qualitative notes from several
    //    sources, newest first. (competency narratives [approved], coach/teacher
    //    talent notes, and goal descriptions set by teachers.)
    const feedback: { date: string; source: string; from: string; text: string }[] = [];
    for (const c of competencies) {
      if (c.narrative) feedback.push({ date: c.evidenceDate || c.createdAt.toISOString().slice(0, 10), source: "Competency", from: c.recordedByName, text: `${c.competency.name}: ${c.narrative}` });
    }
    for (const t of talents) {
      if (t.notes) feedback.push({ date: t.dateRecorded.toISOString().slice(0, 10), source: "Co-curricular", from: t.coach?.fullName ?? "Coach", text: `${t.talentArea.name}: ${t.notes}` });
    }
    for (const g of goals) {
      if (g.description) feedback.push({ date: (g.targetDate || g.createdAt.toISOString().slice(0, 10)), source: "Goal", from: g.teacher.fullName, text: `${g.title}: ${g.description}` });
    }
    feedback.sort((a, b) => (a.date < b.date ? 1 : -1));
    const feedbackDigest = feedback.slice(0, 8);

    // 9. "Growth not just grades" summary roll-up cards.
    const summary = {
      attendancePct: attendance.presentPct,
      goalsActive: goals.filter((g) => g.status === "ACTIVE").length,
      goalsAchieved: goals.filter((g) => g.status === "ACHIEVED").length,
      goalsToAcknowledge: goalAckEnabled ? goals.filter((g) => !g.acknowledgedByParent).length : 0,
      competenciesShown: competencies.length,
      talentsLogged: talents.length,
      portfolioHighlights: portfolio.length,
      behaviorIncidents: behavior.incidents,
    };

    return {
      child: { id: student.id, name: [student.firstName, student.lastName].filter(Boolean).join(" ") },
      goalAckEnabled,
      summary,
      goals: goals.map((g) => ({
        id: g.id, category: g.category, title: g.title, description: g.description,
        status: g.status, targetDate: g.targetDate,
        acknowledgedByParent: g.acknowledgedByParent, teacher: { fullName: g.teacher.fullName },
      })),
      talents: talents.map((t) => ({ id: t.id, score: t.score, notes: t.notes, date: t.dateRecorded.toISOString().slice(0, 10), talentArea: { name: t.talentArea.name }, coach: { fullName: t.coach?.fullName ?? "Coach" } })),
      competencies: competencies.map((c) => ({ id: c.id, level: c.level, scorePct: c.scorePct, narrative: c.narrative, createdAt: c.createdAt, competency: { name: c.competency.name } })),
      upcomingAssessments,
      portfolio,
      attendance,
      behavior,
      feedbackDigest,
    };
  });
}

export async function acknowledgeStudentGoal(user: SessionUser, goalId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    if (!(await isGoalAckEnabled())) throw new GrowthError("DISABLED", "Goal acknowledgement is turned off for this school.");
    const goal = await tDb.studentGoal.findUnique({ where: { id: goalId }, select: { id: true, studentId: true } });
    if (!goal) throw new GrowthError("NOT_FOUND", "Goal not found.");
    await assertGuardian(user, goal.studentId);
    return tDb.studentGoal.update({
      where: { id: goalId },
      data: { acknowledgedByParent: true, acknowledgedAt: new Date() },
    });
  });
}
