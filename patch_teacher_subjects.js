const fs = require('fs');
let code = fs.readFileSync('src/lib/services/timetable-solver.service.ts', 'utf8');

const oldSaveTS = `export async function saveTeacherSubjects(
  user: SessionUser,
  teacherId: string,
  subjectIds: string[]
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    
    // Delete existing associations for this teacher
    await tdb.teacherSubject.deleteMany({ where: { teacherId } });

    // Create new ones
    if (subjectIds.length > 0) {
      await tdb.teacherSubject.createMany({
        data: subjectIds.map((sid) => ({
          tenantId: user.tenantId,
          teacherId,
          subjectId: sid,
        })),
      });
    }

    return { success: true };
  });
}`;

const newSaveTS = `export async function saveTeacherSubjects(
  user: SessionUser,
  teacherId: string,
  subjects: { id: string; isStrong?: boolean }[]
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    
    await tdb.teacherSubject.deleteMany({ where: { teacherId } });

    if (subjects.length > 0) {
      await tdb.teacherSubject.createMany({
        data: subjects.map((s) => ({
          tenantId: user.tenantId,
          teacherId,
          subjectId: s.id,
          isStrong: s.isStrong || false
        })),
      });
    }

    return { success: true };
  });
}`;

code = code.replace(oldSaveTS, newSaveTS);

const matcherLogic = `
/**
 * L.3 Automatic Teacher-Class Matching
 * Distributes teachers to classes fairly based on their subjects and "strong" areas.
 */
export async function autoAssignTeachersToClasses(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    // Get all ClassSubjectNeeds that DO NOT have a teacher manually assigned
    const needs = await tDb.classSubjectNeed.findMany({
      where: { teacherId: null }
    });

    if (needs.length === 0) return { success: true, assignedCount: 0 };

    // Get all teachers and their subjects
    const teacherSubjects = await tDb.teacherSubject.findMany();
    
    // Track workload to assign fairly
    const workload = new Map<string, number>(); // teacherId -> total lessons assigned
    const existingAssignments = await tDb.classSubjectNeed.findMany({ where: { teacherId: { not: null } } });
    for (const a of existingAssignments) {
      workload.set(a.teacherId!, (workload.get(a.teacherId!) || 0) + a.lessonsPerWeek);
    }
    
    // Initialize workload for all available teachers
    for (const ts of teacherSubjects) {
      if (!workload.has(ts.teacherId)) workload.set(ts.teacherId, 0);
    }

    let assignedCount = 0;

    for (const need of needs) {
      // Find eligible teachers for this subject
      const eligible = teacherSubjects.filter(ts => ts.subjectId === need.subjectId);
      if (eligible.length === 0) continue; // No teacher teaches this subject

      // Sort by priority: 1. Strong subject? 2. Lowest current workload
      eligible.sort((a, b) => {
        if (a.isStrong && !b.isStrong) return -1;
        if (!a.isStrong && b.isStrong) return 1;
        
        const loadA = workload.get(a.teacherId) || 0;
        const loadB = workload.get(b.teacherId) || 0;
        return loadA - loadB;
      });

      const selectedTeacherId = eligible[0].teacherId;
      
      await tDb.classSubjectNeed.update({
        where: { id: need.id },
        data: { teacherId: selectedTeacherId }
      });

      workload.set(selectedTeacherId, (workload.get(selectedTeacherId) || 0) + need.lessonsPerWeek);
      assignedCount++;
    }

    return { success: true, assignedCount };
  });
}
`;

if (!code.includes('autoAssignTeachersToClasses')) {
  code += matcherLogic;
}

fs.writeFileSync('src/lib/services/timetable-solver.service.ts', code);
