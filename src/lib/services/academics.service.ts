/**
 * B.4 Academics — service.
 * Subjects, departments, the 3-term Kenyan academic calendar, the timetable
 * (manual slots with REAL conflict detection + a greedy auto-fill), and
 * teacher lesson plans (own-only for teachers).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class AcademicsError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "CONFLICT" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AcademicsError";
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


const PRINCIPAL_OWNER_ROLES: Role[] = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
const BROAD_ACADEMICS_ROLES: Role[] = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES"];

function hasAnyRole(user: SessionUser, roles: Role[]) {
  return roles.includes(user.role as Role) || (user.secondaryRole ? roles.includes(user.secondaryRole as Role) : false);
}

function isScopedHod(user: SessionUser) {
  return !hasAnyRole(user, BROAD_ACADEMICS_ROLES) && (user.role === "HOD" || user.secondaryRole === "HOD");
}

function assertPrincipalOwner(user: SessionUser, action: string) {
  if (!hasAnyRole(user, PRINCIPAL_OWNER_ROLES)) {
    throw new AcademicsError("FORBIDDEN", `${action} is reserved for the Principal or School Owner.`);
  }
}

async function hodDepartmentIds(user: SessionUser) {
  if (!isScopedHod(user)) return null;
  const rows = await tenantDb().department.findMany({ where: { hodId: user.id }, select: { id: true } });
  return rows.map((d) => d.id);
}

async function assertHodDepartmentAccess(user: SessionUser, departmentId: string) {
  const ids = await hodDepartmentIds(user);
  if (!ids) return;
  if (!ids.includes(departmentId)) {
    throw new AcademicsError("FORBIDDEN", "As HOD, you can only manage your own department.");
  }
}

async function assertHodSubjectAccess(user: SessionUser, subjectId: string, targetDepartmentId?: string | null) {
  const ids = await hodDepartmentIds(user);
  if (!ids) return;
  const subject = await tenantDb().subject.findUnique({ where: { id: subjectId }, select: { id: true, departmentId: true, name: true } });
  if (!subject) throw new AcademicsError("NOT_FOUND", "Subject not found.");
  const currentOk = !subject.departmentId || ids.includes(subject.departmentId);
  const targetOk = targetDepartmentId === undefined || !targetDepartmentId || ids.includes(targetDepartmentId);
  if (!currentOk || !targetOk) {
    throw new AcademicsError("FORBIDDEN", "As HOD, you can only manage subjects inside your own department.");
  }
}

async function assertHodCanMapSubjects(user: SessionUser, departmentId: string, subjectIds?: string[]) {
  const ids = await hodDepartmentIds(user);
  if (!ids) return;
  await assertHodDepartmentAccess(user, departmentId);
  if (!subjectIds?.length) return;
  const subjects = await tenantDb().subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, departmentId: true } });
  const blocked = subjects.find((s) => s.departmentId && s.departmentId !== departmentId);
  if (blocked) {
    throw new AcademicsError("FORBIDDEN", `${blocked.name} belongs to another department. HODs cannot move subjects across departments.`);
  }
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartments(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const hodIds = await hodDepartmentIds(user);
    const rows = await tenantDb().department.findMany({ where: hodIds ? { id: { in: hodIds.length ? hodIds : ["__none__"] } } : {}, orderBy: { name: "asc" }, include: { subjects: { where: { archived: false } } } });
    const departmentHeadIds = rows.map((d) => d.hodId).filter((x): x is string => Boolean(x));
    const hods = departmentHeadIds.length ? await tenantDb().user.findMany({ where: { id: { in: departmentHeadIds } }, select: { id: true, fullName: true } }) : [];
    const hodMap = new Map(hods.map((h) => [h.id, h.fullName]));
    return rows.map((d) => ({ id: d.id, name: d.name, hodId: d.hodId, hodName: d.hodId ? hodMap.get(d.hodId) ?? null : null, subjectCount: d.subjects.length }));
  });
}

export async function createDepartment(user: SessionUser, input: { name: string; hodId?: string; subjectIds?: string[] }) {
  return withTenant(user.tenantId, async () => {
    if (isScopedHod(user)) throw new AcademicsError("FORBIDDEN", "HODs manage their assigned department only; they cannot create new departments.");
    if (input.hodId) assertPrincipalOwner(user, "Appointing a Department Head");
    const dup = await tenantDb().department.findFirst({ where: { name: input.name } });
    if (dup) throw new AcademicsError("DUPLICATE", `Department "${input.name}" already exists.`);
    const d = await tenantDb().department.create({ data: { name: input.name, hodId: input.hodId || null } as never });
    if (input.subjectIds && input.subjectIds.length > 0) {
      await tenantDb().subject.updateMany({
        where: { id: { in: input.subjectIds } },
        data: { departmentId: d.id }
      });
    }
    await audit(user, "academics.department_created", "department", d.id, { name: input.name });
    return d;
  });
}

export async function updateDepartment(user: SessionUser, id: string, input: { name?: string; hodId?: string; subjectIds?: string[] }) {
  return withTenant(user.tenantId, async () => {
    const d = await tenantDb().department.findUnique({ where: { id } });
    if (!d) throw new AcademicsError("NOT_FOUND", "Department not found.");
    await assertHodDepartmentAccess(user, id);
    await assertHodCanMapSubjects(user, id, input.subjectIds);
    if (input.hodId !== undefined && input.hodId !== (d.hodId ?? "")) assertPrincipalOwner(user, "Appointing or changing a Department Head");
    const updated = await tenantDb().department.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.hodId !== undefined ? { hodId: input.hodId || null } : {}),
      },
    });
    if (input.subjectIds !== undefined) {
      await tenantDb().subject.updateMany({
        where: { departmentId: id },
        data: { departmentId: null }
      });
      await tenantDb().subject.updateMany({
        where: { id: { in: input.subjectIds } },
        data: { departmentId: id }
      });
    }
    await audit(user, "academics.department_updated", "department", id);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export async function listSubjects(user: SessionUser, includeArchived = false) {
  return withTenant(user.tenantId, async () => {
    const hodIds = await hodDepartmentIds(user);
    const baseWhere = includeArchived ? {} : { archived: false };
    const rows = await tenantDb().subject.findMany({
      where: hodIds ? { AND: [baseWhere, { departmentId: { in: hodIds.length ? hodIds : ["__none__"] } }] } : baseWhere,
      orderBy: { name: "asc" },
      include: { department: true },
    });
    return rows.map((s) => ({
      id: s.id, name: s.name, code: s.code, curriculum: s.curriculum,
      departmentId: s.departmentId, departmentName: s.department?.name ?? null,
      archived: s.archived,
    }));
  });
}

export async function createSubject(user: SessionUser, input: { name: string; code: string; curriculum: string; departmentId?: string }) {
  return withTenant(user.tenantId, async () => {
    if (isScopedHod(user)) {
      if (!input.departmentId) throw new AcademicsError("FORBIDDEN", "As HOD, choose your own department before adding a subject.");
      await assertHodDepartmentAccess(user, input.departmentId);
    }
    const dup = await tenantDb().subject.findFirst({ where: { code: input.code } });
    if (dup) throw new AcademicsError("DUPLICATE", `Subject code "${input.code}" is already used by ${dup.name}.`);
    const s = await tenantDb().subject.create({
      data: { name: input.name, code: input.code, curriculum: input.curriculum, departmentId: input.departmentId || null } as never,
    });
    await audit(user, "academics.subject_created", "subject", s.id, { name: input.name, code: input.code });
    return s;
  });
}

export async function updateSubject(user: SessionUser, id: string, input: Partial<{ name: string; code: string; curriculum: string; departmentId: string; archived: boolean }>) {
  return withTenant(user.tenantId, async () => {
    const s = await tenantDb().subject.findUnique({ where: { id } });
    if (!s) throw new AcademicsError("NOT_FOUND", "Subject not found.");
    await assertHodSubjectAccess(user, id, input.departmentId);
    if (input.code && input.code !== s.code) {
      const dup = await tenantDb().subject.findFirst({ where: { code: input.code } });
      if (dup) throw new AcademicsError("DUPLICATE", `Subject code "${input.code}" is already used.`);
    }
    const updated = await tenantDb().subject.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.curriculum !== undefined ? { curriculum: input.curriculum } : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      },
    });
    await audit(user, "academics.subject_updated", "subject", id);
    return updated;
  });
}

/** Quick-add the real KE subject set for a curriculum (skips existing codes). */
export async function addSubjectPreset(user: SessionUser, curriculum: "CBC" | "8-4-4", preset: { name: string; code: string }[]) {
  return withTenant(user.tenantId, async () => {
    if (isScopedHod(user)) throw new AcademicsError("FORBIDDEN", "HODs add or edit subjects inside their own department; school-wide presets are reserved for academics leadership.");
    const existing = new Set((await tenantDb().subject.findMany({ select: { code: true } })).map((s) => s.code));
    let added = 0;
    for (const p of preset) {
      if (existing.has(p.code)) continue;
      await tenantDb().subject.create({ data: { name: p.name, code: p.code, curriculum } as never });
      added++;
    }
    await audit(user, "academics.preset_added", "subject", curriculum, { added });
    return { added, skipped: preset.length - added };
  });
}

// ---------------------------------------------------------------------------
// Academic terms (Kenyan 3-term year)
// ---------------------------------------------------------------------------

export async function listTerms(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().academicTerm.findMany({ orderBy: [{ year: "desc" }, { term: "asc" }] });
  });
}

export async function upsertTerm(user: SessionUser, input: { year: number; term: number; startDate: string; endDate: string; current: boolean }) {
  return withTenant(user.tenantId, async () => {
    const allowed = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
    const hasPrimary = allowed.includes(user.role);
    const hasSecondary = user.secondaryRole ? allowed.includes(user.secondaryRole) : false;
    if (!hasPrimary && !hasSecondary) {
      throw new AcademicsError("FORBIDDEN", "Only the Principal or School Owner can edit or change academic term dates.");
    }

    if (input.current) {
      await tenantDb().academicTerm.updateMany({ where: {}, data: { current: false } });
    }
    const row = await db.academicTerm.upsert({
      where: { tenantId_year_term: { tenantId: user.tenantId, year: input.year, term: input.term } },
      create: { tenantId: user.tenantId, year: input.year, term: input.term, startDate: input.startDate, endDate: input.endDate, current: input.current },
      update: { startDate: input.startDate, endDate: input.endDate, current: input.current },
    });
    await audit(user, "academics.term_saved", "academicTerm", row.id, { year: input.year, term: input.term, current: input.current });
    return row;
  });
}

export async function currentTerm(tenantId: string) {
  return db.academicTerm.findFirst({ where: { tenantId, current: true } });
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export const DAYS = [1, 2, 3, 4, 5] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export async function getTimetable(user: SessionUser, classId: string) {
  return withTenant(user.tenantId, async () => {
    const [slots, config] = await Promise.all([
      tenantDb().timetableSlot.findMany({
        where: { classId },
        include: { subject: true },
      }),
      tenantDb().timetableConfig.findFirst({
        where: { classId },
      }),
    ]);
    const teacherIds = [...new Set(slots.map((s) => s.teacherId).filter((x): x is string => Boolean(x)))];
    const teachers = teacherIds.length
      ? await tenantDb().user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } })
      : [];
    const tMap = new Map(teachers.map((t) => [t.id, t.fullName]));
    return {
      slots: slots.map((s) => ({
        id: s.id, dayOfWeek: s.dayOfWeek, period: s.period,
        subjectId: s.subjectId, subjectName: s.subject.name, subjectCode: s.subject.code,
        teacherId: s.teacherId, teacherName: s.teacherId ? tMap.get(s.teacherId) ?? null : null,
        venue: (s as any).venue ?? null,
        slotType: s.slotType,
        weekRotation: s.weekRotation,
      })),
      config: config || null,
    };
  });
}

/** Teacher's own weekly timetable (B.12 reuse later). */
export async function teacherTimetable(user: SessionUser, teacherId: string) {
  return withTenant(user.tenantId, async () => {
    const slots = await tenantDb().timetableSlot.findMany({ where: { teacherId }, include: { subject: true } });
    const classIds = [...new Set(slots.map((s) => s.classId))];
    const classes = classIds.length ? await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    return slots.map((s) => ({
      id: s.id, dayOfWeek: s.dayOfWeek, period: s.period,
      subjectName: s.subject.name, subjectCode: s.subject.code,
      className: cMap.get(s.classId) ?? "—",
      venue: (s as any).venue ?? null,
      slotType: s.slotType,
      weekRotation: s.weekRotation,
    }));
  });
}

export async function timetablePrintBundle(user: SessionUser, mode: "classes" | "teachers" | "venues") {
  return withTenant(user.tenantId, async () => {
    const [slots, classes, teachers, configRows] = await Promise.all([
      tenantDb().timetableSlot.findMany({ include: { subject: true }, orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] }),
      tenantDb().schoolClass.findMany({ orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      tenantDb().user.findMany({
        where: { role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"] } },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      tenantDb().timetableConfig.findMany(),
    ]);
    const classMap = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ") || c.level]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t.fullName]));
    const configMap = new Map(configRows.map((c) => [c.classId, c]));
    const normalized = slots.map((s) => ({
      id: s.id,
      classId: s.classId,
      className: classMap.get(s.classId) ?? "Class",
      dayOfWeek: s.dayOfWeek,
      period: s.period,
      subjectId: s.subjectId,
      subjectName: s.subject.name,
      subjectCode: s.subject.code,
      teacherId: s.teacherId,
      teacherName: s.teacherId ? teacherMap.get(s.teacherId) ?? null : null,
      venue: (s as any).venue ?? null,
      slotType: s.slotType,
      weekRotation: s.weekRotation,
    }));

    if (mode === "classes") {
      return {
        mode,
        groups: classes.map((c) => ({
          id: c.id,
          title: classMap.get(c.id) ?? "Class",
          subtitle: "Class timetable",
          config: configMap.get(c.id) ?? null,
          slots: normalized.filter((s) => s.classId === c.id),
        })).filter((g) => g.slots.length > 0),
      };
    }
    if (mode === "teachers") {
      return {
        mode,
        groups: teachers.map((t) => ({
          id: t.id,
          title: t.fullName,
          subtitle: "Teacher timetable",
          config: null,
          slots: normalized.filter((s) => s.teacherId === t.id),
        })).filter((g) => g.slots.length > 0),
      };
    }
    const venues = Array.from(new Set(normalized.map((s) => (s.venue || "Unassigned venue").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      mode,
      groups: venues.map((venue) => ({
        id: venue,
        title: venue,
        subtitle: "Venue timetable",
        config: null,
        slots: normalized.filter((s) => (s.venue || "Unassigned venue").trim() === venue),
      })),
    };
  });
}

/** Set/replace one slot — with REAL conflict detection. */
export async function setSlot(user: SessionUser, input: { classId: string; subjectId: string; teacherId?: string; venue?: string; dayOfWeek: number; period: number }) {
  return withTenant(user.tenantId, async () => {
    await assertHodSubjectAccess(user, input.subjectId);
    // Teacher double-booking check: same teacher, same day+period, ANY class.
    if (input.teacherId) {
      const clash = await tenantDb().timetableSlot.findFirst({
        where: {
          teacherId: input.teacherId,
          dayOfWeek: input.dayOfWeek,
          period: input.period,
          NOT: { classId: input.classId },
        },
        include: { subject: true },
      });
      if (clash) {
        const cls = await tenantDb().schoolClass.findUnique({ where: { id: clash.classId } });
        const label = cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "another class";
        throw new AcademicsError("CONFLICT", `That teacher already teaches ${clash.subject.name} in ${label} at this time.`);
      }
    }
    const row = await db.timetableSlot.upsert({
      where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: user.tenantId, classId: input.classId, dayOfWeek: input.dayOfWeek, period: input.period, slotType: "ACADEMIC" } },
      create: { tenantId: user.tenantId, classId: input.classId, subjectId: input.subjectId, teacherId: input.teacherId || null, venue: input.venue || null, dayOfWeek: input.dayOfWeek, period: input.period, slotType: "ACADEMIC" },
      update: { subjectId: input.subjectId, teacherId: input.teacherId || null, venue: input.venue || null },
    });
    await audit(user, "academics.slot_set", "timetableSlot", row.id, input);
    return row;
  });
}

export async function clearSlot(user: SessionUser, classId: string, dayOfWeek: number, period: number) {
  return withTenant(user.tenantId, async () => {
    if (isScopedHod(user)) {
      const existing = await tenantDb().timetableSlot.findFirst({ where: { classId, dayOfWeek, period }, select: { subjectId: true } });
      if (existing) await assertHodSubjectAccess(user, existing.subjectId);
    }
    await db.timetableSlot.deleteMany({ where: { tenantId: user.tenantId, classId, dayOfWeek, period } });
    return { ok: true };
  });
}

/**
 * Greedy auto-fill (B.4 "timetable generator (auto)").
 * Spreads each subject's weekly load across the grid: avoids same subject
 * twice in a day when possible, respects teacher availability across classes.
 */
export async function autoFill(
  user: SessionUser,
  input: { classId: string; weeklyLoad: Record<string, number>; teachers: Record<string, string>; clearExisting: boolean }
) {
  return withTenant(user.tenantId, async () => {
    for (const subjectId of Object.keys(input.weeklyLoad)) await assertHodSubjectAccess(user, subjectId);
    if (input.clearExisting) {
      await db.timetableSlot.deleteMany({ where: { tenantId: user.tenantId, classId: input.classId } });
    }
    const existing = await tenantDb().timetableSlot.findMany({ where: { classId: input.classId } });
    const taken = new Set(existing.map((s) => `${s.dayOfWeek}|${s.period}`));

    // Teacher busy map across the whole school.
    const teacherIds = Object.values(input.teachers).filter(Boolean);
    const teacherBusy = new Set<string>();
    if (teacherIds.length) {
      const busyRows = await tenantDb().timetableSlot.findMany({ where: { teacherId: { in: teacherIds } } });
      for (const b of busyRows) teacherBusy.add(`${b.teacherId}|${b.dayOfWeek}|${b.period}`);
    }

    const placed: { subjectId: string; dayOfWeek: number; period: number }[] = [];
    const unplaced: { subjectId: string; remaining: number }[] = [];
    const subjectDayCount = new Map<string, number>(); // `${subjectId}|${day}` -> count

    for (const [subjectId, load] of Object.entries(input.weeklyLoad)) {
      let remaining = load;
      // pass 1: one per day; pass 2: allow doubles
      for (const allowDouble of [false, true]) {
        if (remaining <= 0) break;
        for (const day of DAYS) {
          if (remaining <= 0) break;
          const dayKey = `${subjectId}|${day}`;
          if (!allowDouble && (subjectDayCount.get(dayKey) ?? 0) > 0) continue;
          for (const period of PERIODS) {
            if (remaining <= 0) break;
            const cellKey = `${day}|${period}`;
            if (taken.has(cellKey)) continue;
            const teacherId = input.teachers[subjectId];
            if (teacherId && teacherBusy.has(`${teacherId}|${day}|${period}`)) continue;
            // place
            await db.timetableSlot.create({
              data: { tenantId: user.tenantId, classId: input.classId, subjectId, teacherId: teacherId || null, dayOfWeek: day, period },
            });
            taken.add(cellKey);
            if (teacherId) teacherBusy.add(`${teacherId}|${day}|${period}`);
            subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) ?? 0) + 1);
            placed.push({ subjectId, dayOfWeek: day, period });
            remaining--;
            if (!allowDouble) break; // next day
          }
        }
      }
      if (remaining > 0) unplaced.push({ subjectId, remaining });
    }

    await audit(user, "academics.timetable_autofilled", "schoolClass", input.classId, { placed: placed.length, unplaced });
    return { placed: placed.length, unplaced };
  });
}

// ---------------------------------------------------------------------------
// Lesson plans (teacher-owned)
// ---------------------------------------------------------------------------

export async function listLessonPlans(user: SessionUser, filters: { classId?: string; from?: string; to?: string }) {
  return withTenant(user.tenantId, async () => {
    const where: Record<string, unknown> = {};
    // Teachers see only their own plans; leadership sees all.
    if (user.role === "TEACHER" || user.role === "CLASS_TEACHER") where.teacherId = user.id;
    if (filters.classId) where.classId = filters.classId;
    if (filters.from || filters.to) where.date = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };
    const rows = await tenantDb().lessonPlan.findMany({
      where, orderBy: { date: "desc" }, take: 200, include: { subject: true },
    });
    const classIds = [...new Set(rows.map((r) => r.classId))];
    const classes = classIds.length ? await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    return rows.map((r) => ({
      id: r.id, date: r.date, topic: r.topic, status: r.status,
      subjectName: r.subject.name, subjectCode: r.subject.code,
      className: cMap.get(r.classId) ?? "—", classId: r.classId,
      teacherName: r.teacherName, teacherId: r.teacherId,
      objectives: r.objectives, activities: r.activities, notes: r.notes,
    }));
  });
}

export async function createLessonPlan(user: SessionUser, input: { subjectId: string; classId: string; date: string; topic: string; objectives?: string; activities?: string; notes?: string }) {
  return withTenant(user.tenantId, async () => {
    const plan = await tenantDb().lessonPlan.create({
      data: {
        teacherId: user.id, teacherName: user.fullName,
        subjectId: input.subjectId, classId: input.classId, date: input.date,
        topic: input.topic, objectives: input.objectives || null,
        activities: input.activities || null, notes: input.notes || null,
      } as never,
    });
    await audit(user, "academics.lesson_planned", "lessonPlan", plan.id, { topic: input.topic, date: input.date });
    return plan;
  });
}

export async function setLessonStatus(user: SessionUser, id: string, status: string) {
  return withTenant(user.tenantId, async () => {
    const plan = await tenantDb().lessonPlan.findUnique({ where: { id } });
    if (!plan) throw new AcademicsError("NOT_FOUND", "Lesson plan not found.");
    // Teachers may only touch their own plans.
    if ((user.role === "TEACHER" || user.role === "CLASS_TEACHER") && plan.teacherId !== user.id)
      throw new AcademicsError("FORBIDDEN", "You can only update your own lesson plans.");
    await tenantDb().lessonPlan.update({ where: { id }, data: { status } });
    return { id, status };
  });
}

/** Bulk Saturday timetable scheduler (Form 6 to 9 / all in one tap!) */
export async function bulkSaturdaySchedule(
  user: SessionUser,
  input: { classIds: string[]; periodIds: number[]; subjectId: string; teacherId?: string; weekRotation?: string }
) {
  return withTenant(user.tenantId, async () => {
    let createdCount = 0;
    const rotation = input.weekRotation || "ALL";
    for (const classId of input.classIds) {
      for (const p of input.periodIds) {
        await db.timetableSlot.upsert({
          where: {
            tenantId_classId_dayOfWeek_period_slotType: {
              tenantId: user.tenantId,
              classId,
              dayOfWeek: 6,
              period: p,
              slotType: "ACADEMIC",
            },
          },
          create: {
            tenantId: user.tenantId,
            classId,
            subjectId: input.subjectId,
            teacherId: input.teacherId || null,
            dayOfWeek: 6,
            period: p,
            slotType: "ACADEMIC",
            weekRotation: rotation,
          },
          update: {
            subjectId: input.subjectId,
            teacherId: input.teacherId || null,
            weekRotation: rotation,
          },
        });
        createdCount++;
      }
    }

    await audit(user, "academics.timetable_bulk_saturday", "timetableSlot", user.id, {
      classes: input.classIds.length,
      periods: input.periodIds.length,
      total: createdCount,
    });

    return { success: true, createdCount };
  });
}

/** I.28 — fair Saturday/remedial scheduler.
 * Distributes a limited Saturday set of periods across multiple subjects so the
 * same subject does not monopolize the short day. Alternates Week A / Week B
 * by cell position unless a fixed rotation is chosen.
 */
export async function fairSaturdaySchedule(
  user: SessionUser,
  input: { classIds: string[]; periodIds: number[]; subjectIds: string[]; teacherId?: string; mode?: "REMEDIAL" | "EXAM_PREP" | "SATURDAY"; rotationMode?: "ALTERNATE" | "ALL" | "WEEK_A" | "WEEK_B" }
) {
  return withTenant(user.tenantId, async () => {
    const classIds = Array.from(new Set(input.classIds.filter(Boolean)));
    const periodIds = Array.from(new Set(input.periodIds.map((p) => Math.trunc(p)).filter((p) => p >= 1 && p <= 8))).sort((a, b) => a - b);
    const subjectIds = Array.from(new Set(input.subjectIds.filter(Boolean)));
    if (classIds.length === 0) throw new AcademicsError("NOT_FOUND", "Select at least one class.");
    if (periodIds.length === 0) throw new AcademicsError("NOT_FOUND", "Select at least one Saturday period.");
    if (subjectIds.length < 2) throw new AcademicsError("NOT_FOUND", "Pick at least two subjects for fair Saturday rotation.");

    const configs = await tenantDb().timetableConfig.findMany({ where: { classId: { in: classIds } } });
    const noSaturday = new Set(configs.filter((c) => c.hasSaturday === false).map((c) => c.classId));
    const eligibleClassIds = classIds.filter((id) => !noSaturday.has(id));
    if (eligibleClassIds.length === 0) throw new AcademicsError("FORBIDDEN", "All selected classes are set not to attend Saturdays.");

    const subjects = await tenantDb().subject.findMany({ where: { id: { in: subjectIds }, archived: false }, select: { id: true, name: true, code: true } });
    if (subjects.length !== subjectIds.length) throw new AcademicsError("NOT_FOUND", "One of the selected subjects was not found.");
    const subjectOrder = subjects.map((s) => s.id);

    // wipe only selected Saturday cells for these classes before fair scheduling
    await db.timetableSlot.deleteMany({
      where: { tenantId: user.tenantId, classId: { in: eligibleClassIds }, dayOfWeek: 6, period: { in: periodIds }, slotType: "ACADEMIC" },
    });

    let createdCount = 0;
    const placements: { classId: string; period: number; subjectId: string; weekRotation: string }[] = [];
    for (let cIndex = 0; cIndex < eligibleClassIds.length; cIndex++) {
      const classId = eligibleClassIds[cIndex];
      for (let pIndex = 0; pIndex < periodIds.length; pIndex++) {
        const seq = cIndex * periodIds.length + pIndex;
        const subjectId = subjectOrder[seq % subjectOrder.length];
        const weekRotation = input.rotationMode === "ALTERNATE"
          ? (seq % 2 === 0 ? "WEEK_A" : "WEEK_B")
          : (input.rotationMode || "ALTERNATE") === "ALL" ? "ALL" : (input.rotationMode || "WEEK_A");
        await db.timetableSlot.create({
          data: {
            tenantId: user.tenantId,
            classId,
            subjectId,
            teacherId: input.teacherId || null,
            dayOfWeek: 6,
            period: periodIds[pIndex],
            slotType: input.mode === "REMEDIAL" ? "REMEDIAL" : input.mode === "EXAM_PREP" ? "PREP" : "ACADEMIC",
            weekRotation,
          },
        });
        placements.push({ classId, period: periodIds[pIndex], subjectId, weekRotation });
        createdCount++;
      }
    }
    await audit(user, "academics.timetable_fair_saturday", "timetableSlot", user.id, {
      classes: eligibleClassIds.length,
      periods: periodIds.length,
      subjects: subjectIds.length,
      mode: input.mode ?? "SATURDAY",
      rotationMode: input.rotationMode ?? "ALTERNATE",
      createdCount,
    });
    return { success: true, createdCount, skippedClasses: classIds.length - eligibleClassIds.length, placements };
  });
}
