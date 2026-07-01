import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { startGeneration } from "@/lib/services/timetable-engine.service";

export class ContinuityEngineError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ContinuityEngineError";
  }
}

function parseLevel(level: string) {
  const m = level.trim().match(/^(Form|Grade|PP)\s*(\d{1,2})$/i);
  if (!m) return null;
  return { prefix: m[1], n: Number(m[2]) };
}
function nextLevel(level: string) {
  const p = parseLevel(level);
  if (!p) return null;
  if (/^form$/i.test(p.prefix)) return p.n >= 4 ? null : `Form ${p.n + 1}`;
  if (/^grade$/i.test(p.prefix)) return p.n >= 9 ? null : `Grade ${p.n + 1}`;
  return p.n >= 2 ? 'Grade 1' : `PP ${p.n + 1}`;
}
function levelKey(level: string, stream: string | null) {
  return `${level}::${stream ?? ''}`;
}

async function getWorkloadContext(teacherIds: string[]) {
  const tdb = tenantDb();
  const [needs, rules] = await Promise.all([
    tdb.classSubjectNeed.findMany({ where: { teacherId: { in: teacherIds } } }),
    tdb.teacherWorkloadRule.findMany({ where: { OR: [{ teacherId: null }, { teacherId: { in: teacherIds } }] } }),
  ]);
  return { needs, rules };
}

async function recommendTeacherForSubject(tenantId: string, subjectId: string, blockedTeacherIds: string[] = []) {
  return withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const teacherLinks = await tdb.teacherSubject.findMany({ where: { subjectId } });
    const teacherIds = teacherLinks.map((x) => x.teacherId).filter((id) => !blockedTeacherIds.includes(id));
    if (teacherIds.length === 0) return [];
    const teachers = await tdb.user.findMany({ where: { id: { in: teacherIds }, isActive: true }, select: { id: true, fullName: true, role: true } });
    const { needs, rules } = await getWorkloadContext(teachers.map((t) => t.id));
    const globalRule = rules.find((r) => !r.teacherId) ?? null;
    return teachers.map((teacher) => {
      const own = needs.filter((n) => n.teacherId === teacher.id);
      const rule = rules.find((r) => r.teacherId === teacher.id) ?? globalRule;
      const classCount = new Set(own.map((n) => n.classId)).size;
      const lessonLoad = own.reduce((sum, n) => sum + n.lessonsPerWeek, 0);
      const fairnessScore = classCount * 10 + lessonLoad;
      const allowed = !((rule?.maxClasses && classCount >= rule.maxClasses) || (rule?.maxLessonsPerWeek && lessonLoad >= rule.maxLessonsPerWeek));
      return { teacherId: teacher.id, teacherName: teacher.fullName, role: teacher.role, classCount, lessonLoad, fairnessScore, allowed };
    }).filter((x) => x.allowed).sort((a, b) => a.fairnessScore - b.fairnessScore);
  });
}

export async function getContinuitySnapshot(user: SessionUser, level: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const classes = await tdb.schoolClass.findMany({ where: { level, archived: false }, orderBy: [{ stream: 'asc' }] });
    if (classes.length === 0) throw new ContinuityEngineError('NOT_FOUND', 'No classes found for that level.');
    const activeTeachers = await tdb.user.findMany({ where: { isActive: true }, select: { id: true } });
    const activeIds = new Set(activeTeachers.map((t) => t.id));
    const continuity = await tdb.teacherContinuityAssignment.findMany({ where: { levelKey: { in: classes.map((c) => levelKey(c.level, c.stream)) }, active: true } });
    const subjectNeeds = await tdb.classSubjectNeed.findMany({ where: { classId: { in: classes.map((c) => c.id) } } });

    const subjectAssignments = [] as any[];
    for (const need of subjectNeeds) {
      const cls = classes.find((c) => c.id === need.classId)!;
      const key = levelKey(cls.level, cls.stream);
      const chain = continuity.find((c) => c.levelKey === key && c.roleType === 'SUBJECT' && c.subjectId === need.subjectId);
      const recommended = !need.teacherId || !activeIds.has(need.teacherId)
        ? await recommendTeacherForSubject(user.tenantId, need.subjectId, need.teacherId ? [need.teacherId] : [])
        : [];
      subjectAssignments.push({
        classId: cls.id,
        classLabel: `${cls.level} ${cls.stream ?? ''}`.trim(),
        subjectId: need.subjectId,
        currentTeacherId: need.teacherId,
        continuityTeacherId: chain?.teacherId ?? null,
        needsReplacement: !need.teacherId || !activeIds.has(need.teacherId),
        impact: {
          lessonsPerWeek: need.lessonsPerWeek,
          doubleCount: need.doubleCount,
          splitAllowed: need.allowSplitDouble,
          timetableRegenerationRequired: true,
        },
        recommendations: recommended.slice(0, 3),
      });
    }

    const classTeacherAssignments = await Promise.all(classes.map(async (cls) => {
      const key = levelKey(cls.level, cls.stream);
      const chain = continuity.find((c) => c.levelKey === key && c.roleType === 'CLASS_TEACHER');
      const recommendations = !cls.classTeacherId || !activeIds.has(cls.classTeacherId)
        ? await recommendTeacherForSubject(user.tenantId, subjectNeeds.find((n) => n.classId === cls.id)?.subjectId ?? '', cls.classTeacherId ? [cls.classTeacherId] : [])
        : [];
      return {
        classId: cls.id,
        classLabel: `${cls.level} ${cls.stream ?? ''}`.trim(),
        currentTeacherId: cls.classTeacherId,
        continuityTeacherId: chain?.teacherId ?? null,
        needsReplacement: !cls.classTeacherId || !activeIds.has(cls.classTeacherId),
        impact: {
          timetableRegenerationRequired: true,
          reason: 'Class teacher continuity change affects class-level schedules and ownership.',
        },
        recommendations: recommendations.slice(0, 3),
      };
    }));

    return { level, nextLevel: nextLevel(level), subjectAssignments, classTeacherAssignments };
  });
}

export async function saveContinuityPolicy(user: SessionUser, input: { classId: string; subjectId?: string | null; teacherId: string; roleType: 'SUBJECT' | 'CLASS_TEACHER'; locked?: boolean }) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const cls = await tdb.schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls) throw new ContinuityEngineError('NOT_FOUND', 'Class not found.');
    const key = levelKey(cls.level, cls.stream);
    const existing = await tdb.teacherContinuityAssignment.findFirst({ where: { levelKey: key, roleType: input.roleType, subjectId: input.subjectId ?? null, active: true } });
    if (existing) {
      return tdb.teacherContinuityAssignment.update({ where: { id: existing.id }, data: { teacherId: input.teacherId, locked: input.locked ?? existing.locked, classId: input.classId } });
    }
    return tdb.teacherContinuityAssignment.create({ data: { tenantId: user.tenantId, levelKey: key, classId: input.classId, subjectId: input.subjectId ?? null, teacherId: input.teacherId, roleType: input.roleType, locked: input.locked ?? false, active: true } });
  });
}

export async function applyTeacherChangeWithImpact(user: SessionUser, input: { classId: string; subjectId?: string | null; teacherId: string; roleType: 'SUBJECT' | 'CLASS_TEACHER'; regenerateTimetable?: boolean }) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    if (input.roleType === 'SUBJECT' && input.subjectId) {
      const need = await tdb.classSubjectNeed.findFirst({ where: { classId: input.classId, subjectId: input.subjectId } });
      if (!need) throw new ContinuityEngineError('NOT_FOUND', 'Class subject load not found.');
      await tdb.classSubjectNeed.update({ where: { id: need.id }, data: { teacherId: input.teacherId } });
    }
    if (input.roleType === 'CLASS_TEACHER') {
      await tdb.schoolClass.update({ where: { id: input.classId }, data: { classTeacherId: input.teacherId } });
    }
    await saveContinuityPolicy(user, { classId: input.classId, subjectId: input.subjectId, teacherId: input.teacherId, roleType: input.roleType, locked: true });
    let job: any = null;
    if (input.regenerateTimetable !== false) job = await startGeneration(user);
    return { success: true, timetableJob: job };
  });
}
