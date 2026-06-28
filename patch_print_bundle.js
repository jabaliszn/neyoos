const fs = require('fs');
let code = fs.readFileSync('src/lib/services/academics.service.ts', 'utf8');

const oldPrint = `    const [slots, classes, teachers, configRows] = await Promise.all([
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
      teacherName: s.teacherId ? teacherMap.get(s.teacherId) ?? "Unknown" : null,
      venue: s.venue,
      slotType: s.slotType,
      weekRotation: s.weekRotation,
      isCombined: s.isCombined,
      combinedDetails: s.combinedDetails,
    }));`;

const newPrint = `    const [slots, classes, teachers, configRows] = await Promise.all([
      tenantDb().timetableSlot.findMany({ include: { subject: true, activityCategory: true }, orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] }),
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
      subjectName: s.subject?.name ?? null,
      subjectCode: s.subject?.code ?? null,
      activityCategoryId: s.activityCategoryId,
      activityCategoryName: s.activityCategory?.name ?? null,
      activityCategoryColor: s.activityCategory?.color ?? null,
      teacherId: s.teacherId,
      teacherName: s.teacherId ? teacherMap.get(s.teacherId) ?? "Unknown" : null,
      venue: s.venue,
      slotType: s.slotType,
      weekRotation: s.weekRotation,
      isCombined: s.isCombined,
      combinedDetails: s.combinedDetails,
    }));`;

code = code.replace(oldPrint, newPrint);
fs.writeFileSync('src/lib/services/academics.service.ts', code);
