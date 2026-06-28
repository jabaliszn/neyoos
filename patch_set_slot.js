const fs = require('fs');
let code = fs.readFileSync('src/lib/services/academics.service.ts', 'utf8');

const oldSetSlot = `export async function setSlot(user: SessionUser, input: { classId: string; subjectId: string; teacherId?: string; venue?: string; dayOfWeek: number; period: number }) {
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
        throw new AcademicsError("CONFLICT", \`That teacher already teaches \${clash.subject.name} in \${label} at this time.\`);
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
}`;

const newSetSlot = `export async function setSlot(user: SessionUser, input: { classId: string; subjectId?: string; activityCategoryId?: string; teacherId?: string; venue?: string; dayOfWeek: number; period: number; slotType?: string; isCombined?: boolean; combinedDetails?: string }) {
  return withTenant(user.tenantId, async () => {
    if (input.subjectId && input.slotType !== "ACTIVITY") {
      await assertHodSubjectAccess(user, input.subjectId);
    }
    const mode = input.slotType || "ACADEMIC";

    // Teacher double-booking check
    if (input.teacherId && !input.isCombined) {
      const clash = await tenantDb().timetableSlot.findFirst({
        where: {
          teacherId: input.teacherId,
          dayOfWeek: input.dayOfWeek,
          period: input.period,
          NOT: { classId: input.classId },
        },
        include: { subject: true, activityCategory: true },
      });
      if (clash) {
        const cls = await tenantDb().schoolClass.findUnique({ where: { id: clash.classId } });
        const label = cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "another class";
        const thing = clash.slotType === "ACTIVITY" ? clash.activityCategory?.name : clash.subject?.name;
        throw new AcademicsError("CONFLICT", \`That teacher already handles \${thing} in \${label} at this time.\`);
      }
    }

    const row = await db.timetableSlot.upsert({
      where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: user.tenantId, classId: input.classId, dayOfWeek: input.dayOfWeek, period: input.period, slotType: mode } },
      create: { 
        tenantId: user.tenantId, classId: input.classId, 
        subjectId: input.subjectId || null, 
        activityCategoryId: input.activityCategoryId || null,
        teacherId: input.teacherId || null, 
        venue: input.venue || null, 
        dayOfWeek: input.dayOfWeek, period: input.period, slotType: mode,
        isCombined: input.isCombined,
        combinedDetails: input.combinedDetails || null,
      },
      update: { 
        subjectId: input.subjectId || null, 
        activityCategoryId: input.activityCategoryId || null,
        teacherId: input.teacherId || null, 
        venue: input.venue || null,
        isCombined: input.isCombined,
        combinedDetails: input.combinedDetails || null,
      },
    });
    await audit(user, "academics.slot_set", "timetableSlot", row.id, input);
    return row;
  });
}`;

// There might be another signature or old code. Let's do a more robust replace using exact matched code or regex.
