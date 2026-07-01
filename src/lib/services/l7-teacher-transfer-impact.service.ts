import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { startGeneration } from "@/lib/services/timetable-engine.service";

export class TeacherTransferImpactError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "TeacherTransferImpactError";
  }
}

async function recommendForSubject(subjectId: string, blockedTeacherId?: string) {
  const tdb = tenantDb();
  const subjectLinks = await tdb.teacherSubject.findMany({ where: { subjectId } });
  const teacherIds = subjectLinks.map((x) => x.teacherId).filter((id) => id !== blockedTeacherId);
  if (teacherIds.length === 0) return [] as any[];
  const [teachers, needs, rules] = await Promise.all([
    tdb.user.findMany({ where: { id: { in: teacherIds }, isActive: true }, select: { id: true, fullName: true, role: true } }),
    tdb.classSubjectNeed.findMany({ where: { teacherId: { in: teacherIds } } }),
    tdb.teacherWorkloadRule.findMany({ where: { OR: [{ teacherId: null }, { teacherId: { in: teacherIds } }] } }),
  ]);
  const globalRule = rules.find((r) => !r.teacherId) ?? null;
  return teachers.map((teacher) => {
    const own = needs.filter((n) => n.teacherId === teacher.id);
    const rule = rules.find((r) => r.teacherId === teacher.id) ?? globalRule;
    const classCount = new Set(own.map((n) => n.classId)).size;
    const lessonLoad = own.reduce((sum, n) => sum + n.lessonsPerWeek, 0);
    const maxClasses = rule?.maxClasses ?? null;
    const maxLessonsPerWeek = rule?.maxLessonsPerWeek ?? null;
    const allowed = !((maxClasses && classCount >= maxClasses) || (maxLessonsPerWeek && lessonLoad >= maxLessonsPerWeek));
    const reasons = [
      `Currently handles ${classCount} classes`,
      `Currently has ${lessonLoad} lessons per week`,
      maxClasses ? `School limit for classes is ${maxClasses}` : `No class limit set`,
      maxLessonsPerWeek ? `School limit for lessons is ${maxLessonsPerWeek}` : `No lesson limit set`,
    ];
    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      role: teacher.role,
      classCount,
      lessonLoad,
      maxClasses,
      maxLessonsPerWeek,
      projectedClassCount: classCount + 1,
      projectedLessonLoad: lessonLoad,
      allowed,
      fairnessScore: classCount * 10 + lessonLoad,
      reasons,
    };
  }).filter((x) => x.allowed).sort((a, b) => a.fairnessScore - b.fairnessScore);
}

export async function analyseTeacherTransferImpact(user: SessionUser, teacherId: string, reason?: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const teacher = await tdb.user.findUnique({ where: { id: teacherId }, select: { id: true, fullName: true, role: true, isActive: true } });
    if (!teacher) throw new TeacherTransferImpactError("NOT_FOUND", "Teacher not found.");
    const [subjectNeeds, classTeacherClasses] = await Promise.all([
      tdb.classSubjectNeed.findMany({ where: { teacherId }, include: { } }),
      tdb.schoolClass.findMany({ where: { classTeacherId: teacherId, archived: false } }),
    ]);

    const affected: any[] = [];
    const recommendations: any[] = [];

    for (const need of subjectNeeds) {
      const cls = await tdb.schoolClass.findUnique({ where: { id: need.classId }, select: { id: true, level: true, stream: true } });
      if (!cls) continue;
      affected.push({ type: 'SUBJECT', classId: cls.id, classLabel: [cls.level, cls.stream].filter(Boolean).join(' '), subjectId: need.subjectId, currentTeacherId: teacherId, lessonsPerWeek: need.lessonsPerWeek });
      const recs = await recommendForSubject(need.subjectId, teacherId);
      if (recs[0]) recommendations.push({ type: 'SUBJECT', classId: cls.id, classLabel: [cls.level, cls.stream].filter(Boolean).join(' '), subjectId: need.subjectId, best: recs[0], alternatives: recs.slice(0, 3), disruptionScore: recs[0].fairnessScore, comparison: recs.slice(0, 3).map((r, index) => ({ rank: index + 1, ...r })) });
    }

    for (const cls of classTeacherClasses) {
      const supportingNeed = subjectNeeds.find((n) => n.classId === cls.id) ?? await tdb.classSubjectNeed.findFirst({ where: { classId: cls.id } });
      const recs = supportingNeed ? await recommendForSubject(supportingNeed.subjectId, teacherId) : [];
      affected.push({ type: 'CLASS_TEACHER', classId: cls.id, classLabel: [cls.level, cls.stream].filter(Boolean).join(' '), currentTeacherId: teacherId });
      if (recs[0]) recommendations.push({ type: 'CLASS_TEACHER', classId: cls.id, classLabel: [cls.level, cls.stream].filter(Boolean).join(' '), best: recs[0], alternatives: recs.slice(0, 3), disruptionScore: recs[0].fairnessScore, comparison: recs.slice(0, 3).map((r, index) => ({ rank: index + 1, ...r })) });
    }

    const record = await tdb.teacherTransferImpact.create({
      data: {
        tenantId: user.tenantId,
        teacherId,
        reason: reason ?? null,
        affectedJson: JSON.stringify(affected),
        recommendationJson: JSON.stringify(recommendations),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    return {
      impactId: record.id,
      teacher,
      affected,
      recommendations,
      summary: `${affected.length} teaching responsibilities affected.`,
      timetableImpact: {
        affectedClasses: Array.from(new Set(affected.map((a) => a.classLabel))),
        affectedSubjects: Array.from(new Set(affected.filter((a) => a.subjectId).map((a) => a.subjectId))),
        regenerationRequired: affected.length > 0,
      },
    };
  });
}

export async function applyTeacherTransferReplacement(user: SessionUser, impactId: string, replacementTeacherId?: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const impact = await tdb.teacherTransferImpact.findUnique({ where: { id: impactId } });
    if (!impact) throw new TeacherTransferImpactError("NOT_FOUND", "Transfer impact record not found.");
    const affected = JSON.parse(impact.affectedJson || '[]');
    const recommendations = JSON.parse(impact.recommendationJson || '[]');

    for (const item of affected) {
      const picked = replacementTeacherId
        ? { teacherId: replacementTeacherId }
        : recommendations.find((r: any) => r.type === item.type && r.classId === item.classId && (r.subjectId ?? null) === (item.subjectId ?? null))?.best;
      if (!picked?.teacherId) continue;
      if (item.type === 'SUBJECT') {
        const need = await tdb.classSubjectNeed.findFirst({ where: { classId: item.classId, subjectId: item.subjectId } });
        if (need) await tdb.classSubjectNeed.update({ where: { id: need.id }, data: { teacherId: picked.teacherId } });
      } else {
        await tdb.schoolClass.update({ where: { id: item.classId }, data: { classTeacherId: picked.teacherId } });
      }
    }

    await tdb.user.update({ where: { id: impact.teacherId }, data: { isActive: false } }).catch(() => {});
    const job = await startGeneration(user);
    await tdb.teacherTransferImpact.update({ where: { id: impactId }, data: { replacementTeacherId: replacementTeacherId ?? recommendations[0]?.best?.teacherId ?? null, timetableJobId: job.id, status: 'APPLIED' } });
    return { success: true, timetableJob: job };
  });
}

export async function listTeacherTransferImpacts(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().teacherTransferImpact.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...r, affected: JSON.parse(r.affectedJson || '[]'), recommendations: JSON.parse(r.recommendationJson || '[]') }));
  });
}
