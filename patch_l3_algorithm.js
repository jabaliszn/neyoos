const fs = require('fs');
let code = fs.readFileSync('src/lib/services/timetable-solver.service.ts', 'utf8');

const oldAutoAssign = `export async function autoAssignTeachersToClasses(user: SessionUser) {
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
}`;

const newAutoAssign = `/**
 * L.3 Strict Rule-Based Teacher-Class Matching (ZERO AI)
 * Distributes teachers fairly using pure mathematical workload balancing.
 * Also handles mid-term transfers by checking existing TimetableSlots for conflicts.
 */
export async function autoAssignTeachersToClasses(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    // 1. Get all needs missing a teacher
    const needs = await tDb.classSubjectNeed.findMany({
      where: { teacherId: null }
    });

    if (needs.length === 0) return { success: true, assignedCount: 0 };

    // 2. Get all teachers and their subjects (including new Teaching Practice enrollees)
    const teacherSubjects = await tDb.teacherSubject.findMany();
    
    // 3. Track current workload to ensure mathematically fair distribution
    const workload = new Map<string, number>(); 
    const existingAssignments = await tDb.classSubjectNeed.findMany({ where: { teacherId: { not: null } } });
    for (const a of existingAssignments) {
      workload.set(a.teacherId!, (workload.get(a.teacherId!) || 0) + a.lessonsPerWeek);
    }
    for (const ts of teacherSubjects) {
      if (!workload.has(ts.teacherId)) workload.set(ts.teacherId, 0);
    }

    // 4. Pre-fetch all current timetable slots to prevent mid-term transfer conflicts
    const allSlots = await tDb.timetableSlot.findMany();

    let assignedCount = 0;

    for (const need of needs) {
      // Find eligible teachers who teach this subject
      let eligible = teacherSubjects.filter(ts => ts.subjectId === need.subjectId);
      if (eligible.length === 0) continue; 

      // If this need already has timetable slots (e.g. replacing a transferred teacher)
      // we MUST filter out any teacher who is already busy during those exact periods.
      const existingNeedSlots = allSlots.filter(s => s.classId === need.classId && s.subjectId === need.subjectId);
      
      if (existingNeedSlots.length > 0) {
        eligible = eligible.filter(candidate => {
          // Check if candidate is already booked in any of these exact (day, period) slots
          for (const slot of existingNeedSlots) {
            const isBusy = allSlots.some(s => 
              s.teacherId === candidate.teacherId && 
              s.dayOfWeek === slot.dayOfWeek && 
              s.period === slot.period &&
              !(s.classId === slot.classId && s.subjectId === slot.subjectId) // ignore the slot we are trying to fill
            );
            if (isBusy) return false; // Conflict found, rule blocks this teacher
          }
          return true; // No conflict
        });
      }

      if (eligible.length === 0) continue; // No non-conflicting teacher found

      // Sort by pure rule: 1. Strong subject preference, 2. Lowest current workload
      eligible.sort((a, b) => {
        if (a.isStrong && !b.isStrong) return -1;
        if (!a.isStrong && b.isStrong) return 1;
        const loadA = workload.get(a.teacherId) || 0;
        const loadB = workload.get(b.teacherId) || 0;
        return loadA - loadB;
      });

      const selectedTeacherId = eligible[0].teacherId;
      
      // Assign the need
      await tDb.classSubjectNeed.update({
        where: { id: need.id },
        data: { teacherId: selectedTeacherId }
      });

      // Instantly patch the Timetable if slots already exist!
      if (existingNeedSlots.length > 0) {
        for (const slot of existingNeedSlots) {
          await tDb.timetableSlot.update({
            where: { id: slot.id },
            data: { teacherId: selectedTeacherId }
          });
          // Update in memory cache for next iterations
          const slotRef = allSlots.find(s => s.id === slot.id);
          if (slotRef) slotRef.teacherId = selectedTeacherId;
        }
      }

      workload.set(selectedTeacherId, (workload.get(selectedTeacherId) || 0) + need.lessonsPerWeek);
      assignedCount++;
    }

    return { success: true, assignedCount };
  });
}

/**
 * Handles a teacher leaving the school or transferring out.
 * Rips them out of the timetable and auto-reassigns available teachers to their classes fairly.
 */
export async function processTeacherTransferOut(user: SessionUser, departingTeacherId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    // 1. Unassign all their class needs
    await tDb.classSubjectNeed.updateMany({
      where: { teacherId: departingTeacherId },
      data: { teacherId: null }
    });

    // 2. Unassign all their active timetable slots
    await tDb.timetableSlot.updateMany({
      where: { teacherId: departingTeacherId },
      data: { teacherId: null }
    });

    // 3. Automatically run the strict rule-based matcher to find replacement teachers
    // who are free during those exact periods.
    const result = await autoAssignTeachersToClasses(user);

    return { success: true, reassignedClasses: result.assignedCount };
  });
}
`;

code = code.replace(oldAutoAssign, newAutoAssign);
fs.writeFileSync('src/lib/services/timetable-solver.service.ts', code);
