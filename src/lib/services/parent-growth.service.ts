import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";

export async function getParentGrowthDashboard(user: SessionUser, studentId: string) {
  const tDb = tenantDb();
  
  // Verify Guardian access
  if (user.role === "PARENT") {
    const isGuardian = await tDb.studentGuardian.findFirst({
      where: { studentId, guardian: { userId: user.id } }
    });
    if (!isGuardian) throw new Error("Unauthorized access to child.");
  }

  // 1. Fetch Goals
  const goals = await tDb.studentGoal.findMany({
    where: { studentId },
    include: { teacher: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  // 2. Fetch Recent Talent & Co-curricular
  const talents = await tDb.talentRecord.findMany({
    where: { studentId },
    include: { talentArea: true, coach: { select: { fullName: true } } },
    orderBy: { dateRecorded: "desc" },
    take: 3,
  });

  // 3. Fetch Recent Competency Evidence
  const competencies = await tDb.competencyEvidence.findMany({
    where: { studentId, visibleToParents: true },
    include: { competency: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // 4. Fetch Upcoming Assessments
  // (We assume any AssessmentPlan with a date in the future, if it had a date, but let's just grab the latest published plans for the student's class)
  const student = await tDb.student.findUnique({ where: { id: studentId } });
  const upcomingAssessments = student?.classId ? await tDb.assessmentPlan.findMany({
    where: { classId: student.classId, status: "PUBLISHED", visibleToParents: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  }) : [];

  return {
    goals,
    talents,
    competencies,
    upcomingAssessments
  };
}

export async function acknowledgeStudentGoal(user: SessionUser, goalId: string) {
  const tDb = tenantDb();
  
  // Must check if user is indeed parent of this child
  const goal = await tDb.studentGoal.findUnique({ where: { id: goalId }, include: { student: { include: { guardians: { include: { guardian: true } } } } } });
  if (!goal) throw new Error("Goal not found");
  
  if (user.role === "PARENT") {
    const isGuardian = goal.student.guardians.some(g => g.guardian.userId === user.id);
    if (!isGuardian) throw new Error("Unauthorized");
  }

  return tDb.studentGoal.update({
    where: { id: goalId },
    data: {
      acknowledgedByParent: true,
      acknowledgedAt: new Date(),
    }
  });
}
