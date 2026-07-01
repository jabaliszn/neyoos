import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class ExamTimetableEngineError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ExamTimetableEngineError";
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

type Invigilator = { teacherId: string; teacherName: string; warning?: string };
type EligibleInvigilator = { teacherId: string; teacherName: string };

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function listExamTimetableSetup(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const [slots, papers, classes, subjects, combinationGroupsRaw] = await Promise.all([
      tdb.examTimetableSlot.findMany({ orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] }),
      tdb.subjectPaperConfig.findMany({ orderBy: [{ subjectId: 'asc' }, { name: 'asc' }] }),
      tdb.schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: 'asc' }, { stream: 'asc' }] }),
      tdb.subject.findMany({ where: { archived: false }, orderBy: { name: 'asc' } }),
      tdb.combinationGroup.findMany({ where: { active: true }, include: { members: true }, orderBy: { name: 'asc' } }),
    ]);
    const streamGroups = Array.from(new Map(
      classes
        .filter((c) => c.level !== null && c.level !== undefined)
        .map((c) => [String(c.level), { id: String(c.level), label: String(c.level), classIds: classes.filter((x) => x.level === c.level).map((x) => x.id) }])
    ).values());
    const combinationGroups = combinationGroupsRaw.map((group) => ({
      id: group.id,
      label: group.name,
      subjectId: group.subjectId,
      classIds: group.members.map((member) => member.classId),
      source: group.source,
      scope: group.scope,
    }));
    return { slots: slots.map((s) => ({ ...s, targetIds: parseJson<string[]>(s.targetJson, []), invigilators: parseJson<any[]>(s.invigilatorJson, []), eligibleInvigilators: parseJson<any[]>(s.eligibleInvigilatorJson, []), warnings: parseJson<string[]>(s.warningJson, []) })), papers, classes, subjects, streamGroups, combinationGroups };
  });
}

export async function saveExamTimetableSlot(user: SessionUser, input: any) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const data = {
      classId: input.classId,
      subjectId: input.subjectId,
      paperConfigId: input.paperConfigId || null,
      examName: input.examName,
      paperName: input.paperName || null,
      examDate: input.examDate,
      startTime: input.startTime,
      endTime: input.endTime,
      venue: input.venue || null,
      targetScope: input.targetScope || 'CLASS',
      targetJson: JSON.stringify(input.targetIds ?? []),
      invigilatorScope: input.invigilatorScope || 'AUTO',
      eligibleInvigilatorJson: JSON.stringify(input.eligibleInvigilatorIds ?? []),
      notes: input.notes || null,
      createdById: user.id,
      createdByName: user.fullName,
    };
    if (input.id) return tdb.examTimetableSlot.update({ where: { id: input.id }, data });
    return tdb.examTimetableSlot.create({ data: { tenantId: user.tenantId, ...data } });
  });
}


export async function saveExamInvigilatorPool(user: SessionUser, input: { examName: string; slotId?: string; invigilatorScope?: string; eligibleInvigilatorIds?: string[] }) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const teacherIds = Array.from(new Set((input.eligibleInvigilatorIds ?? []).filter(Boolean)));
    const teachers = teacherIds.length > 0 ? await tdb.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } }) : [];
    const payload = teachers.map((teacher) => ({ teacherId: teacher.id, teacherName: teacher.fullName }));
    const where = input.slotId ? { id: input.slotId } : { examName: input.examName };
    await tdb.examTimetableSlot.updateMany({
      where,
      data: {
        invigilatorScope: input.invigilatorScope || 'AUTO',
        eligibleInvigilatorJson: JSON.stringify(payload),
      },
    });
    return { updated: input.slotId ? 1 : await tdb.examTimetableSlot.count({ where: { examName: input.examName } }), invigilatorScope: input.invigilatorScope || 'AUTO', eligibleInvigilators: payload };
  });
}


export async function deleteExamTimetableSlot(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    if (!id) throw new ExamTimetableEngineError('INVALID', 'Exam slot id is required.');
    const tdb = tenantDb();
    const existing = await tdb.examTimetableSlot.findUnique({ where: { id } });
    if (!existing) throw new ExamTimetableEngineError('NOT_FOUND', 'Exam timetable slot not found.');
    await tdb.examTimetableSlot.delete({ where: { id } });
    return { deleted: true, id };
  });
}

export async function generateExamInvigilators(user: SessionUser, examName: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const [slots, teachers, classNeeds, timetableSlots] = await Promise.all([
      tdb.examTimetableSlot.findMany({ where: { examName }, orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] }),
      tdb.user.findMany({
        where: { isActive: true, role: { in: ['TEACHER', 'CLASS_TEACHER', 'HOD', 'DEPUTY_PRINCIPAL', 'DEAN_OF_STUDIES'] } },
        select: { id: true, fullName: true, role: true },
      }),
      tdb.classSubjectNeed.findMany(),
      tdb.timetableSlot.findMany({ where: { slotType: 'ACADEMIC' } }),
    ]);
    if (slots.length === 0) throw new ExamTimetableEngineError('NOT_FOUND', 'No exam timetable slots found for that exam.');

    const assigned = new Map<string, string>();
    const updated: any[] = [];

    for (const slot of slots) {
      const warnings: string[] = [];
      const invigilators: Invigilator[] = [];
      const targetIds = parseJson<string[]>(slot.targetJson, []);
      const involvedClassIds = targetIds.length > 0 ? targetIds : [slot.classId];
      const day = new Date(`${slot.examDate}T00:00:00`).getDay();
      const normalizedDay = day === 0 ? 7 : day;
      const periodGuess = slot.startTime <= '08:00' ? 1 : slot.startTime <= '09:00' ? 2 : slot.startTime <= '10:00' ? 3 : slot.startTime <= '11:00' ? 4 : slot.startTime <= '12:00' ? 5 : slot.startTime <= '14:00' ? 6 : 7;

      const eligibleInvigilators = parseJson<EligibleInvigilator[] | string[]>(slot.eligibleInvigilatorJson, []);
      const explicitEligibleIds = new Set(
        eligibleInvigilators
          .map((item: any) => typeof item === 'string' ? item : item?.teacherId)
          .filter(Boolean)
      );
      const candidateTeachers = slot.invigilatorScope === 'ELIGIBLE_ONLY' && explicitEligibleIds.size > 0
        ? teachers.filter((teacher) => explicitEligibleIds.has(teacher.id))
        : teachers;
      const currentSlotTeacherIds = new Set(
        timetableSlots
          .filter((tt) => tt.dayOfWeek === normalizedDay && tt.period === periodGuess)
          .map((tt) => tt.teacherId)
          .filter(Boolean)
      );
      const allCandidateTeachersBusy = candidateTeachers.length > 0 && candidateTeachers.every((teacher) => currentSlotTeacherIds.has(teacher.id));

      const candidateScores = candidateTeachers.map((teacher) => {
        const reasons: string[] = [];
        let hardBlocked = false;
        let teachingConflict = false;
        let ownSubjectConflict = false;

        const sameTimeExam = slots.some((s) =>
          s.id !== slot.id &&
          parseJson<any[]>(s.invigilatorJson, []).some((i: any) => i.teacherId === teacher.id) &&
          s.examDate === slot.examDate &&
          overlap(s.startTime, s.endTime, slot.startTime, slot.endTime)
        );
        if (sameTimeExam) {
          hardBlocked = true;
          reasons.push('Already invigilating another exam at this exact time');
        }

        const alreadyAssigned = assigned.has(`${teacher.id}:${slot.examDate}:${slot.startTime}`);
        if (alreadyAssigned) {
          hardBlocked = true;
          reasons.push('Already assigned to another invigilation slot at this time');
        }

        teachingConflict = timetableSlots.some((tt) =>
          tt.teacherId === teacher.id &&
          tt.dayOfWeek === normalizedDay &&
          tt.period === periodGuess &&
          tt.classId &&
          !involvedClassIds.includes(tt.classId)
        );
        if (teachingConflict) reasons.push('Has a normal lesson for another class at this time');
        if (!teachingConflict && allCandidateTeachersBusy) reasons.push('No fully free eligible invigilator was found at this time, so a fallback assignment was needed');

        ownSubjectConflict = classNeeds.some((n) =>
          n.teacherId === teacher.id &&
          involvedClassIds.includes(n.classId) &&
          n.subjectId === slot.subjectId
        );
        if (ownSubjectConflict) reasons.push('Teaches this subject/class so should be avoided if possible');

        const classCount = new Set(classNeeds.filter((n) => n.teacherId === teacher.id).map((n) => n.classId)).size;
        const lessonLoad = classNeeds.filter((n) => n.teacherId === teacher.id).reduce((sum, n) => sum + n.lessonsPerWeek, 0);
        const hasExamLinkedLoad = classNeeds.some((n) => n.teacherId === teacher.id && involvedClassIds.includes(n.classId));
        const hasAnyMappedLoad = classNeeds.some((n) => n.teacherId === teacher.id);
        const hasCurrentTeachingLoad = timetableSlots.some((tt) => tt.teacherId === teacher.id && tt.dayOfWeek === normalizedDay && tt.period === periodGuess);

        const fallbackPressure = !teachingConflict && allCandidateTeachersBusy;
        const lane = hardBlocked ? 99 : teachingConflict || fallbackPressure ? 3 : ownSubjectConflict ? 2 : 1;
        const eligibilityRank = hasExamLinkedLoad ? 1 : hasCurrentTeachingLoad ? 2 : hasAnyMappedLoad ? 3 : 4;
        const tieBreaker = classCount * 10 + lessonLoad;

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          role: teacher.role,
          hardBlocked,
          teachingConflict,
          ownSubjectConflict,
          reasons,
          classCount,
          lessonLoad,
          lane,
          eligibilityRank,
          tieBreaker,
        };
      }).filter((c) => !c.hardBlocked).sort((a, b) => {
        if (a.lane !== b.lane) return a.lane - b.lane;
        if (a.eligibilityRank !== b.eligibilityRank) return a.eligibilityRank - b.eligibilityRank;
        if (a.tieBreaker !== b.tieBreaker) return a.tieBreaker - b.tieBreaker;
        return a.teacherName.localeCompare(b.teacherName);
      });

      const picked = candidateScores[0];
      if (!picked) {
        warnings.push('No invigilator available.');
      } else {
        if (picked.lane > 1) warnings.push(`Fallback used: ${picked.reasons.join(' · ')}`);
        invigilators.push({
          teacherId: picked.teacherId,
          teacherName: picked.teacherName,
          warning: picked.lane > 1 ? picked.reasons.join(' · ') : undefined,
        });
        assigned.set(`${picked.teacherId}:${slot.examDate}:${slot.startTime}`, slot.id);
      }

      updated.push(await tdb.examTimetableSlot.update({
        where: { id: slot.id },
        data: { invigilatorJson: JSON.stringify(invigilators), warningJson: JSON.stringify(warnings) },
      }));
    }

    return {
      generated: updated.length,
      slots: updated.map((s) => ({ ...s, invigilators: parseJson<any[]>(s.invigilatorJson, []), eligibleInvigilators: parseJson<any[]>(s.eligibleInvigilatorJson, []), warnings: parseJson<string[]>(s.warningJson, []) })),
    };
  });
}