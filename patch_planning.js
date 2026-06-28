const fs = require('fs');
let code = fs.readFileSync('src/lib/services/academics.service.ts', 'utf8');

const oldList = `export async function listLessonPlans(user: SessionUser, filters: { classId?: string; from?: string; to?: string }) {
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
}`;

const newList = `export async function listLessonPlans(user: SessionUser, filters: { classId?: string; from?: string; to?: string }) {
  return withTenant(user.tenantId, async () => {
    const where: Record<string, unknown> = {};
    // Teachers see only their own plans; leadership sees all.
    if (user.role === "TEACHER" || user.role === "CLASS_TEACHER") where.teacherId = user.id;
    if (filters.classId) where.classId = filters.classId;
    if (filters.from || filters.to) where.date = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };
    const rows = await tenantDb().lessonPlan.findMany({
      where, orderBy: { date: "desc" }, take: 200, 
      include: { 
        subject: true,
        strand: { select: { id: true, name: true } },
        competency: { select: { id: true, name: true } },
        assessmentPlan: { select: { id: true, title: true } },
        resources: true,
      },
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
      strand: r.strand,
      competency: r.competency,
      assessmentPlan: r.assessmentPlan,
      resources: r.resources,
    }));
  });
}`;

code = code.replace(oldList, newList);

const oldCreate = `export async function createLessonPlan(user: SessionUser, input: { subjectId: string; classId: string; date: string; topic: string; objectives?: string; activities?: string; notes?: string }) {
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
}`;

const newCreate = `export async function createLessonPlan(user: SessionUser, input: { 
  subjectId: string; classId: string; date: string; topic: string; 
  objectives?: string | null; activities?: string | null; notes?: string | null;
  strandId?: string | null; competencyId?: string | null; assessmentPlanId?: string | null;
  resources?: { fileUrl: string; fileName?: string }[];
}) {
  return withTenant(user.tenantId, async () => {
    const plan = await tenantDb().lessonPlan.create({
      data: {
        teacherId: user.id, teacherName: user.fullName,
        subjectId: input.subjectId, classId: input.classId, date: input.date,
        topic: input.topic, objectives: input.objectives || null,
        activities: input.activities || null, notes: input.notes || null,
        strandId: input.strandId || null,
        competencyId: input.competencyId || null,
        assessmentPlanId: input.assessmentPlanId || null,
        resources: input.resources && input.resources.length > 0 ? {
          create: input.resources.map(r => ({ tenantId: user.tenantId, fileUrl: r.fileUrl, fileName: r.fileName || null }))
        } : undefined,
      } as never,
    });
    await audit(user, "academics.lesson_planned", "lessonPlan", plan.id, { topic: input.topic, date: input.date });
    return plan;
  });
}`;

code = code.replace(oldCreate, newCreate);

const newAnalytics = `
export async function getLessonPlanningAnalytics(user: SessionUser, classId: string, subjectId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    // 1. How many lesson plans exist
    const totalPlans = await tDb.lessonPlan.count({ where: { classId, subjectId } });
    
    // 2. How many are TAUGHT
    const taughtPlans = await tDb.lessonPlan.count({ where: { classId, subjectId, status: "TAUGHT" } });
    
    // 3. How many unique strands mapped
    const strandPlans = await tDb.lessonPlan.findMany({
      where: { classId, subjectId, strandId: { not: null } },
      select: { strandId: true }
    });
    const uniqueStrandsCovered = new Set(strandPlans.map(p => p.strandId)).size;
    
    const totalStrands = await tDb.cbcStrand.count({ where: { subjectId } });

    // 4. How many unique competencies mapped
    const compPlans = await tDb.lessonPlan.findMany({
      where: { classId, subjectId, competencyId: { not: null } },
      select: { competencyId: true }
    });
    const uniqueCompetenciesTaught = new Set(compPlans.map(p => p.competencyId)).size;

    return {
      totalPlans,
      taughtPlans,
      uniqueStrandsCovered,
      totalStrands,
      uniqueCompetenciesTaught,
    };
  });
}
`;

if (!code.includes('export async function getLessonPlanningAnalytics')) {
  code += newAnalytics;
}

fs.writeFileSync('src/lib/services/academics.service.ts', code);
