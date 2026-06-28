const fs = require('fs');
let code = fs.readFileSync('src/lib/services/academics.service.ts', 'utf8');

// 1. getTimetable replace
const oldGet = `    const [slots, config] = await Promise.all([
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
        venue: s.venue,
        slotType: s.slotType,
        weekRotation: s.weekRotation,
        isCombined: s.isCombined,
        combinedDetails: s.combinedDetails,
      })),
      config,
    };`;

const newGet = `    const [slots, config] = await Promise.all([
      tenantDb().timetableSlot.findMany({
        where: { classId },
        include: { subject: true, activityCategory: true },
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
        subjectId: s.subjectId, subjectName: s.subject?.name ?? null, subjectCode: s.subject?.code ?? null,
        activityCategoryId: s.activityCategoryId, activityCategoryName: s.activityCategory?.name ?? null, activityCategoryColor: s.activityCategory?.color ?? null,
        teacherId: s.teacherId, teacherName: s.teacherId ? tMap.get(s.teacherId) ?? null : null,
        venue: s.venue,
        slotType: s.slotType,
        weekRotation: s.weekRotation,
        isCombined: s.isCombined,
        combinedDetails: s.combinedDetails,
      })),
      config,
    };`;

code = code.replace(oldGet, newGet);

// 2. teacherTimetable replace
const oldTeacherGet = `export async function teacherTimetable(user: SessionUser, teacherId: string) {
  return withTenant(user.tenantId, async () => {
    const slots = await tenantDb().timetableSlot.findMany({
      where: { teacherId },
      include: { subject: true, tenant: { include: { schoolClasses: true } } },
    });
    return slots.map((s) => {
      const cls = s.tenant.schoolClasses.find((c) => c.id === s.classId);
      return {
        id: s.id, dayOfWeek: s.dayOfWeek, period: s.period,
        subjectId: s.subjectId, subjectName: s.subject.name, subjectCode: s.subject.code,
        teacherId: s.teacherId, teacherName: user.fullName,
        className: cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "Unknown",
        venue: s.venue,
        slotType: s.slotType,
        weekRotation: s.weekRotation,
      };
    });
  });
}`;

const newTeacherGet = `export async function teacherTimetable(user: SessionUser, teacherId: string) {
  return withTenant(user.tenantId, async () => {
    const slots = await tenantDb().timetableSlot.findMany({
      where: { teacherId },
      include: { subject: true, activityCategory: true, tenant: { include: { schoolClasses: true } } },
    });
    return slots.map((s) => {
      const cls = s.tenant.schoolClasses.find((c) => c.id === s.classId);
      return {
        id: s.id, dayOfWeek: s.dayOfWeek, period: s.period,
        subjectId: s.subjectId, subjectName: s.subject?.name ?? null, subjectCode: s.subject?.code ?? null,
        activityCategoryId: s.activityCategoryId, activityCategoryName: s.activityCategory?.name ?? null, activityCategoryColor: s.activityCategory?.color ?? null,
        teacherId: s.teacherId, teacherName: user.fullName,
        className: cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "Unknown",
        venue: s.venue,
        slotType: s.slotType,
        weekRotation: s.weekRotation,
        isCombined: s.isCombined,
        combinedDetails: s.combinedDetails,
      };
    });
  });
}`;

code = code.replace(oldTeacherGet, newTeacherGet);

fs.writeFileSync('src/lib/services/academics.service.ts', code);
