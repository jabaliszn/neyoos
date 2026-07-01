import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";

export class AutoGroupingError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "AutoGroupingError";
  }
}

type GroupRuleConfig = {
  retainSubjectTeachers?: boolean;
  retainClassTeachers?: boolean;
  maxClassesPerTeacher?: number;
  preferredClassTeacherRoles?: string[];
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function classLabel(c: { level: string; stream: string | null }) {
  return [c.level, c.stream].filter(Boolean).join(" ");
}

export async function listAutoGroupingSetup(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const [rules, workloadRules, classes, teachers, selections] = await Promise.all([
      tdb.classGroupingRule.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
      tdb.teacherWorkloadRule.findMany({ orderBy: { createdAt: "desc" } }),
      tdb.schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      tdb.user.findMany({ where: { isActive: true, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL", "DEAN_OF_STUDIES"] } }, select: { id: true, fullName: true, role: true } }),
      tdb.studentSubjectSelection.findMany({ where: { isConfirmed: true }, select: { studentId: true, selectedSubjectIds: true } }),
    ]);
    return {
      rules: rules.map((r) => ({ ...r, config: parseJson<GroupRuleConfig>(r.configJson, {}) })),
      workloadRules,
      classes,
      teachers,
      confirmedSelections: selections.length,
    };
  });
}

export async function saveAutoGroupingRule(user: SessionUser, input: { id?: string; name: string; targetLevel?: string | null; ruleType?: string; priority?: number; active?: boolean; config?: GroupRuleConfig }) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const data = {
      name: input.name.trim(),
      targetLevel: input.targetLevel || null,
      ruleType: input.ruleType || "SCHOOL_DEFINED",
      priority: input.priority ?? 100,
      active: input.active ?? true,
      configJson: JSON.stringify(input.config ?? {}),
    };
    if (input.id) {
      return tdb.classGroupingRule.update({ where: { id: input.id }, data });
    }
    return tdb.classGroupingRule.create({ data: { tenantId: user.tenantId, ...data } });
  });
}

export async function saveTeacherWorkloadRule(user: SessionUser, input: { id?: string; teacherId?: string | null; maxClasses?: number | null; maxLessonsPerWeek?: number | null; retainSubjectLoads?: boolean; retainClassTeacher?: boolean }) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const data = {
      teacherId: input.teacherId || null,
      maxClasses: input.maxClasses ?? null,
      maxLessonsPerWeek: input.maxLessonsPerWeek ?? null,
      retainSubjectLoads: input.retainSubjectLoads ?? true,
      retainClassTeacher: input.retainClassTeacher ?? true,
    };
    if (input.id) return tdb.teacherWorkloadRule.update({ where: { id: input.id }, data });
    return tdb.teacherWorkloadRule.create({ data: { tenantId: user.tenantId, ...data } });
  });
}

export async function runAutoGroupingPreview(user: SessionUser, level: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const classes = await tdb.schoolClass.findMany({ where: { level, archived: false }, orderBy: [{ stream: "asc" }] });
    if (classes.length === 0) throw new AutoGroupingError("NOT_FOUND", "No active classes found for that level.");
    const students = await tdb.student.findMany({ where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, classId: true } });
    const selections = await tdb.studentSubjectSelection.findMany({ where: { isConfirmed: true, studentId: { in: students.map((s) => s.id) } }, select: { studentId: true, selectedSubjectIds: true } });
    const selectionMap = new Map(selections.map((s) => [s.studentId, parseJson<string[]>(s.selectedSubjectIds, [])]));
    const rules = await tdb.classGroupingRule.findMany({ where: { active: true, OR: [{ targetLevel: null }, { targetLevel: level }] }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
    const ruleConfig = parseJson<GroupRuleConfig>(rules[0]?.configJson, {});

    const bySubjectSet = new Map<string, typeof students>();
    for (const student of students) {
      const selected = [...(selectionMap.get(student.id) ?? [])].sort();
      const key = selected.join("|") || "NO_SELECTION";
      const arr = bySubjectSet.get(key) ?? [];
      arr.push(student);
      bySubjectSet.set(key, arr);
    }

    const assignments = new Map<string, string>();
    const orderedClasses = [...classes];
    for (const [, members] of [...bySubjectSet.entries()].sort((a, b) => b[1].length - a[1].length)) {
      members.forEach((student, index) => {
        const target = orderedClasses[index % orderedClasses.length];
        assignments.set(student.id, target.id);
      });
      orderedClasses.push(orderedClasses.shift()!);
    }

    const preview = classes.map((cls) => {
      const members = students.filter((s) => assignments.get(s.id) === cls.id);
      return {
        classId: cls.id,
        label: classLabel(cls),
        count: members.length,
        students: members.map((m) => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`,
          selectedSubjectIds: selectionMap.get(m.id) ?? [],
          moved: m.classId !== cls.id,
        })),
      };
    });

    return {
      level,
      ruleApplied: rules[0]?.name ?? "Default school-defined subject-first grouping",
      retainSubjectTeachers: ruleConfig.retainSubjectTeachers !== false,
      retainClassTeachers: ruleConfig.retainClassTeachers !== false,
      totalStudents: students.length,
      movedCount: students.filter((s) => assignments.get(s.id) !== s.classId).length,
      preview,
    };
  });
}

async function chooseReplacementTeacher(tdb: ReturnType<typeof tenantDb>, tenantId: string, subjectId: string, blockedTeacherId?: string | null) {
  const teachers = await tdb.user.findMany({ where: { tenantId, isActive: true, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES"] }, NOT: blockedTeacherId ? { id: blockedTeacherId } : undefined }, select: { id: true, fullName: true, role: true } });
  const teacherIds = teachers.map((t) => t.id);
  const [subjectLinks, needs, workloadRules] = await Promise.all([
    tdb.teacherSubject.findMany({ where: { teacherId: { in: teacherIds }, subjectId } }),
    tdb.classSubjectNeed.findMany({ where: { teacherId: { in: teacherIds } } }),
    tdb.teacherWorkloadRule.findMany({ where: { OR: [{ teacherId: null }, { teacherId: { in: teacherIds } }] } }),
  ]);
  const allowed = new Set(subjectLinks.map((s) => s.teacherId));
  const candidates = teachers.filter((t) => allowed.has(t.id));
  if (candidates.length === 0) return null;
  const globalRule = workloadRules.find((r) => !r.teacherId) ?? null;
  const byTeacher = new Map(teachers.map((t) => [t.id, needs.filter((n) => n.teacherId === t.id)]));
  candidates.sort((a, b) => {
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
  return candidates[0] ?? null;
}

export async function commitAutoGrouping(user: SessionUser, level: string) {
  return withTenant(user.tenantId, async () => {
    const preview = await runAutoGroupingPreview(user, level);
    const tdb = tenantDb();
    const moves: any[] = [];
    for (const cls of preview.preview) {
      for (const student of cls.students.filter((s) => s.moved)) {
        const current = await tdb.student.findUnique({ where: { id: student.id }, select: { classId: true } });
        moves.push({ studentId: student.id, fromClassId: current?.classId ?? null, toClassId: cls.classId, selectedSubjectIds: student.selectedSubjectIds });
        await tdb.student.update({ where: { id: student.id }, data: { classId: cls.classId } });
      }
    }

    const classes = await tdb.schoolClass.findMany({ where: { level, archived: false } });
    const classIdsAtLevel = new Set(classes.map((c) => c.id));
    const activeTeacherIds = new Set((await tdb.user.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true } })).map((u) => u.id));

    for (const cls of classes) {
      const needs = await tdb.classSubjectNeed.findMany({ where: { classId: cls.id } });
      for (const need of needs) {
        if (!classIdsAtLevel.has(need.classId)) continue;
        if (need.teacherId && activeTeacherIds.has(need.teacherId)) continue;
        const replacement = await chooseReplacementTeacher(tdb, user.tenantId, need.subjectId, need.teacherId);
        if (replacement) {
          await tdb.classSubjectNeed.update({ where: { id: need.id }, data: { teacherId: replacement.id } });
        }
      }
      if (cls.classTeacherId && activeTeacherIds.has(cls.classTeacherId)) continue;
      const candidate = await chooseReplacementTeacher(tdb, user.tenantId, needs[0]?.subjectId ?? "", cls.classTeacherId);
      if (candidate) {
        await tdb.schoolClass.update({ where: { id: cls.id }, data: { classTeacherId: candidate.id } });
      }
    }

    const run = await tdb.promotionRun.create({
      data: {
        tenantId: user.tenantId,
        kind: "auto_grouping",
        summary: `Auto-grouped ${preview.totalStudents} students in ${level}; ${preview.movedCount} moved by school rules + subject choices.`,
        moves: JSON.stringify(moves),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "auto_grouping.committed",
        entityType: "promotionRun",
        entityId: run.id,
        metadata: JSON.stringify({ level, movedCount: preview.movedCount }),
      },
    });
    return { runId: run.id, movedCount: preview.movedCount, totalStudents: preview.totalStudents, summary: `Auto-grouped ${preview.totalStudents} students in ${level}.` };
  });
}
