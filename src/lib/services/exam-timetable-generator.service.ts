import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { generateExamInvigilators } from "@/lib/services/exam-timetable-invigilator.service";

export class ExamTimetableGeneratorError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ExamTimetableGeneratorError";
  }
}

type PeriodInput = { label: string; startTime: string; endTime: string };
type GeneratorInput = {
  examName?: string;
  classIds?: string[];
  startDate?: string;
  endDate?: string;
  periods?: PeriodInput[];
  notes?: string | null;
  autoGenerateInvigilators?: boolean;
  // P.5 — Sunday is never a real exam day for a Kenyan school and is now
  // always excluded (was previously a real gap: every calendar day in the
  // range, including Sundays, was treated as usable exam capacity).
  // Saturday is a normal school day for many schools but a short/no-lesson
  // day for others — excludeSaturday lets a school opt out of using it for
  // exams without having to manually avoid picking those dates.
  excludeSaturday?: boolean;
};

type PaperTemplate = {
  subjectId: string;
  classId: string | null;
  paperConfigId: string | null;
  paperName: string;
  weightPct: number;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

// P.5 bugfix: this previously included every calendar day in the range —
// including Sunday, which is never a real Kenyan school exam day — as usable
// exam capacity, silently over-counting how many slots were actually
// available. Sunday is now always excluded; Saturday is excluded only when
// the school explicitly opts out via excludeSaturday (many schools do sit
// exams on Saturday, so it is not force-excluded by default).
function enumerateDates(startDate: string, endDate: string, excludeSaturday = false) {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow === 0) continue;
    if (dow === 6 && excludeSaturday) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function normalizePaperName(name?: string | null) {
  const cleaned = (name || '').trim();
  return cleaned.length > 0 ? cleaned : 'Theory';
}

function levelAwarePaperFallbacks(classLevel?: string | null) {
  const raw = (classLevel || '').toLowerCase();
  if (raw.includes('form') || raw.includes('grade 10') || raw.includes('grade 11') || raw.includes('grade 12')) {
    return ['Paper 1', 'Paper 2'];
  }
  if (raw.includes('grade 7') || raw.includes('grade 8') || raw.includes('grade 9') || raw.includes('junior')) {
    return ['Theory'];
  }
  return ['Theory'];
}

export async function getExamTimetableGeneratorSetup(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const [classes, subjects, paperConfigs, runs] = await Promise.all([
      tdb.schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: 'asc' }, { stream: 'asc' }] }),
      tdb.subject.findMany({ where: { archived: false }, orderBy: { name: 'asc' } }),
      tdb.subjectPaperConfig.findMany({ orderBy: [{ subjectId: 'asc' }, { classId: 'asc' }, { name: 'asc' }] }),
      tdb.examTimetableGeneratorRun.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      classes,
      subjects,
      paperConfigs,
      runs: runs.map((run) => ({ ...run, classIds: parseJson<string[]>(run.classIdsJson, []), periods: parseJson<PeriodInput[]>(run.periodJson, []) })),
    };
  });
}

async function buildGenerationPlan(user: SessionUser, input: GeneratorInput) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const examName = (input.examName || '').trim();
    const classIds = Array.from(new Set((input.classIds || []).filter(Boolean)));
    const periods = (input.periods || []).filter((p) => p.label?.trim() && p.startTime && p.endTime);

    if (!examName) throw new ExamTimetableGeneratorError('INVALID', 'Exam name is required.');
    if (classIds.length === 0) throw new ExamTimetableGeneratorError('INVALID', 'Select at least one class.');
    if (!input.startDate || !input.endDate) throw new ExamTimetableGeneratorError('INVALID', 'Start and end dates are required.');
    if (input.startDate > input.endDate) throw new ExamTimetableGeneratorError('INVALID', 'End date must be after or equal to start date.');
    if (periods.length === 0) throw new ExamTimetableGeneratorError('INVALID', 'Add at least one exam period.');
    if (periods.some((p) => p.startTime >= p.endTime)) throw new ExamTimetableGeneratorError('INVALID', 'Every exam period must end after it starts.');

    const [classes, subjectNeeds, subjects, paperConfigs, existingExamSlots, blockingSlots, combinationGroups] = await Promise.all([
      tdb.schoolClass.findMany({ where: { id: { in: classIds } } }),
      tdb.classSubjectNeed.findMany({ where: { classId: { in: classIds } }, orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }] }),
      tdb.subject.findMany({ where: { archived: false } }),
      tdb.subjectPaperConfig.findMany({ where: { OR: [{ classId: { in: classIds } }, { classId: null }] }, orderBy: [{ subjectId: 'asc' }, { classId: 'asc' }, { name: 'asc' }] }),
      tdb.examTimetableSlot.findMany({ where: { examName } }),
      tdb.examTimetableSlot.findMany({
        where: { classId: { in: classIds }, examDate: { gte: input.startDate, lte: input.endDate } },
        select: { classId: true, subjectId: true, examDate: true, startTime: true, paperName: true },
      }),
      // P.5 — real CombinationGroup awareness: classes that are taught a
      // subject TOGETHER (e.g. a Senior School elective combining Form 4
      // East + Form 4 West) must sit that subject's exam at the SAME
      // date/period, not independently scheduled slots that could clash with
      // each other or simply make no sense (two "sittings" of one combined
      // class for the same paper). This mirrors the same CombinationGroup
      // model the whole-school Timetable Engine already uses (L.7), instead
      // of inventing a parallel concept for exams.
      tdb.combinationGroup.findMany({ where: { active: true }, include: { members: true } }),
    ]);

    if (classes.length !== classIds.length) throw new ExamTimetableGeneratorError('INVALID', 'One or more selected classes no longer exist.');
    if (existingExamSlots.length > 0) throw new ExamTimetableGeneratorError('CONFLICT', 'This exam name already has saved timetable slots. Use a different exam name or delete the existing slots first.');

    const dates = enumerateDates(input.startDate, input.endDate, Boolean(input.excludeSaturday));
    if (dates.length === 0) throw new ExamTimetableGeneratorError('INVALID', 'Could not build a valid date range.');

    const classMap = new Map(classes.map((c) => [c.id, c]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    // Which (classId, subjectId) pairs are owned by a real combination group
    // scoped to the classes actually selected for this exam run.
    const comboByClassSubject = new Map<string, string[]>(); // "classId::subjectId" -> all member classIds in that combo (within this run)
    for (const g of combinationGroups) {
      const memberIds = g.members.map((m) => m.classId).filter((id) => classIds.includes(id));
      if (memberIds.length < 2) continue; // not a real multi-class combination for THIS exam run
      for (const cid of memberIds) comboByClassSubject.set(`${cid}::${g.subjectId}`, memberIds);
    }

    const papersToPlace: Array<{ classId: string; subjectId: string; paperConfigId: string | null; paperName: string; comboClassIds?: string[] }> = [];
    const comboHandled = new Set<string>(); // "subjectId::paperName::sortedComboKey" already queued once
    for (const need of subjectNeeds) {
      const specificConfigs = paperConfigs.filter((cfg) => cfg.subjectId === need.subjectId && cfg.classId === need.classId);
      const fallbackConfigs = paperConfigs.filter((cfg) => cfg.subjectId === need.subjectId && cfg.classId === null);
      const pickedConfigs = specificConfigs.length > 0 ? specificConfigs : fallbackConfigs;
      const comboMembers = comboByClassSubject.get(`${need.classId}::${need.subjectId}`);

      const paperNames = pickedConfigs.length > 0
        ? pickedConfigs.map((cfg) => ({ paperConfigId: cfg.id, paperName: normalizePaperName(cfg.name) }))
        : levelAwarePaperFallbacks(classMap.get(need.classId)?.level).map((paperName) => ({ paperConfigId: null, paperName }));

      for (const p of paperNames) {
        if (comboMembers) {
          const comboKey = `${need.subjectId}::${p.paperName}::${[...comboMembers].sort().join(',')}`;
          if (comboHandled.has(comboKey)) continue; // this combination's paper is already queued once for all its members
          comboHandled.add(comboKey);
          papersToPlace.push({ classId: need.classId, subjectId: need.subjectId, paperConfigId: p.paperConfigId, paperName: p.paperName, comboClassIds: comboMembers });
        } else {
          papersToPlace.push({ classId: need.classId, subjectId: need.subjectId, paperConfigId: p.paperConfigId, paperName: p.paperName });
        }
      }
    }


    const capacity = dates.length * periods.length;
    if (papersToPlace.length === 0) throw new ExamTimetableGeneratorError('NOT_FOUND', 'No class subject needs were found for the selected classes.');
    if (papersToPlace.length > capacity) throw new ExamTimetableGeneratorError('CONFLICT', 'Not enough exam periods for the selected classes and subject papers. Increase the date range or add more periods.');

    const occupied = new Set<string>();
    const blocked = new Set(blockingSlots.map((slot) => `${slot.classId}:${slot.subjectId}:${normalizePaperName(slot.paperName)}:${slot.examDate}:${slot.startTime}`));
    const created: any[] = [];
    let cursor = 0;

    for (const paper of papersToPlace) {
      const sittingClassIds = paper.comboClassIds ?? [paper.classId];
      let placed = false;
      for (; cursor < capacity * 6 && !placed; cursor++) {
        const slotIndex = cursor % capacity;
        const date = dates[Math.floor(slotIndex / periods.length)];
        const period = periods[slotIndex % periods.length];
        // A combined sitting needs the SAME date/period free for every
        // member class simultaneously (they are literally in one room/exam
        // together), not just the class this paper was enumerated from.
        const anyOccupied = sittingClassIds.some((cid) => occupied.has(`${cid}:${date}:${period.startTime}`));
        const anyBlocked = sittingClassIds.some((cid) => blocked.has(`${cid}:${paper.subjectId}:${paper.paperName}:${date}:${period.startTime}`));
        if (anyOccupied || anyBlocked) continue;
        for (const cid of sittingClassIds) occupied.add(`${cid}:${date}:${period.startTime}`);
        const venueLabel = paper.comboClassIds
          ? `${sittingClassIds.map((cid) => classMap.get(cid)?.stream ? `${classMap.get(cid)?.level} ${classMap.get(cid)?.stream}` : classMap.get(cid)?.level).join(' + ')} (combined)`
          : classMap.get(paper.classId)?.stream ? `${classMap.get(paper.classId)?.level} ${classMap.get(paper.classId)?.stream} Room` : `${classMap.get(paper.classId)?.level} Room`;
        for (const cid of sittingClassIds) {
          created.push({
            tenantId: user.tenantId,
            classId: cid,
            subjectId: paper.subjectId,
            paperConfigId: paper.paperConfigId,
            examName,
            paperName: paper.paperName,
            examDate: date,
            startTime: period.startTime,
            endTime: period.endTime,
            venue: venueLabel,
            targetScope: paper.comboClassIds ? 'COMBINATION' : 'CLASS',
            targetJson: JSON.stringify(sittingClassIds),
            notes: input.notes || `Auto-generated from exam setup period ${period.label}`,
            createdById: user.id,
            createdByName: user.fullName,
          });
        }
        placed = true;
      }
      if (!placed) throw new ExamTimetableGeneratorError('CONFLICT', `Could not place ${subjectMap.get(paper.subjectId)?.name || 'a subject'} ${paper.paperName}.`);
    }

    return {
      examName,
      classIds,
      periods,
      created,
      generatedCount: created.length,
      notes: input.notes || null,
      startDate: input.startDate!,
      endDate: input.endDate!,
    };
  });
}

export async function previewExamTimetableGeneration(user: SessionUser, input: GeneratorInput) {
  const plan = await buildGenerationPlan(user, input);
  return {
    examName: plan.examName,
    generatedCount: plan.generatedCount,
    startDate: plan.startDate,
    endDate: plan.endDate,
    classIds: plan.classIds,
    periods: plan.periods,
    slots: plan.created.map((slot) => ({ ...slot, targetIds: parseJson<string[]>(slot.targetJson, []), previewOnly: true })),
  };
}

export async function generateExamTimetableFromRules(user: SessionUser, input: GeneratorInput) {
  const plan = await buildGenerationPlan(user, input);
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const persisted: any[] = [];
    for (const slot of plan.created) persisted.push(await tdb.examTimetableSlot.create({ data: slot }));
    const run = await tdb.examTimetableGeneratorRun.create({
      data: {
        tenantId: user.tenantId,
        examName: plan.examName,
        classIdsJson: JSON.stringify(plan.classIds),
        periodJson: JSON.stringify(plan.periods),
        startDate: plan.startDate,
        endDate: plan.endDate,
        paperMode: 'ALL_SUBJECTS_SELECTED_CLASSES',
        distributionMode: 'ONE_PAPER_PER_CLASS_PER_PERIOD',
        generatedCount: persisted.length,
        notes: plan.notes,
        createdById: user.id,
        createdByName: user.fullName,
      },
    });
    const generatedSlots = persisted.map((slot) => ({ ...slot, targetIds: parseJson<string[]>(slot.targetJson, []) }));
    const invigilatorResult = input.autoGenerateInvigilators ? await generateExamInvigilators(user, plan.examName) : null;
    return {
      run: { ...run, classIds: plan.classIds, periods: plan.periods },
      generatedCount: persisted.length,
      slots: generatedSlots,
      invigilatorsGenerated: !!invigilatorResult,
      invigilatorSummary: invigilatorResult ? { generated: invigilatorResult.generated } : null,
    };
  });
}
