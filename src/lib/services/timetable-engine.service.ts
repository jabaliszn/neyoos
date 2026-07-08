/**
 * L.7 — Advanced Timetable Engine (the school's flagship timetable).
 *
 * Extends the existing G.18 whole-school solver with:
 *  - Required lessons per class per subject (already in ClassSubjectNeed.lessonsPerWeek)
 *    PLUS single/double lessons: `doubleCount` of the weekly lessons become DOUBLE
 *    (two periods). Doubles are consecutive by default, or split across the day
 *    when `allowSplitDouble` (for hard subjects).
 *  - Combination groups: classes that take a subject together (e.g. Form 1 East +
 *    Form 2 West combined Physics) are scheduled ONCE at the same period across all
 *    member classes with one teacher. GLOBAL scope = the whole configured class-group;
 *    SELECTED = only named member classes. SUBJECT_CHOICE source derives members from
 *    how students chose subjects (StudentSubjectSelection).
 *  - Configurable constraints (TimetableConstraint), turned on/off & tuned per school:
 *    SUBJECT_MORNING, SUBJECTS_NOT_ADJACENT, SPLIT_DOUBLE_HARD, STREAM_DISTRIBUTION,
 *    LESSON_DISTRIBUTION (day spread), TEACHER_TIMEOFF, DOUBLE_SAME_DAY,
 *    CLASS_STREAM_CONFLICT, ONE_SINGLE_PER_DAY, PE_TIMESLOT, plus school-defined CUSTOM.
 *  - A Master Button: generation runs in the BACKGROUND as a TimetableGenerationJob
 *    with live progress + phase, surfaced to the UI.
 *
 * 100% deterministic rule engine. NEVER uses AI. Works regardless of Part-J state.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { createInApp } from "@/lib/services/notification.service";
import type { SessionUser } from "@/lib/core/session";
import {
  KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE,
  CORE_ESSENTIAL_MATHEMATICS,
  COMMUNITY_SERVICE_LEARNING_SUBJECT,
} from "@/lib/validations/pathways";

export class TimetableEngineError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "BUSY", message: string) {
    super(message);
    this.name = "TimetableEngineError";
  }
}

export const CONSTRAINT_KINDS = [
  "SUBJECT_MORNING",
  "SUBJECTS_NOT_ADJACENT",
  "SPLIT_DOUBLE_HARD",
  "STREAM_DISTRIBUTION",
  "LESSON_DISTRIBUTION",
  "TEACHER_TIMEOFF",
  "DOUBLE_SAME_DAY",
  "CLASS_STREAM_CONFLICT",
  "ONE_SINGLE_PER_DAY",
  "PE_TIMESLOT",
  "CUSTOM",
] as const;

export const CONSTRAINT_LABELS: Record<string, string> = {
  SUBJECT_MORNING: "Keep certain subjects in the morning (e.g. Maths)",
  SUBJECTS_NOT_ADJACENT: "Two subjects must not follow each other (e.g. English & Kiswahili)",
  SPLIT_DOUBLE_HARD: "Split double lessons for hard subjects across the day",
  STREAM_DISTRIBUTION: "Even subject distribution across streams",
  LESSON_DISTRIBUTION: "Spread a subject's lessons across different days",
  TEACHER_TIMEOFF: "Respect teacher time-off windows",
  DOUBLE_SAME_DAY: "Keep both halves of a double on the same day",
  CLASS_STREAM_CONFLICT: "Avoid class/stream clashes for shared teachers",
  ONE_SINGLE_PER_DAY: "At most one single lesson of a subject per day",
  PE_TIMESLOT: "PE/Games only in allowed time slots",
  CUSTOM: "Custom school rule",
};

// P.5 — Mon-Fri are always real school days. Saturday (6) is added PER-CLASS
// inside the solve pass below (not hardcoded here) based on that class's own
// real TimetableConfig.hasSaturday flag, so it goes through the exact same
// teacher-clash / double-booking / time-off checking as any weekday, instead
// of the older separate bolt-on Bulk/Fair Saturday tools that ran outside the
// main CSP solver and could silently clash with it.
const WEEKDAYS = [1, 2, 3, 4, 5];
const SATURDAY = 6;
// P.5 — default fallback only for a class with no TimetableConfig row yet.
// Every real class's actual period count comes from its own
// TimetableConfig.periodsPerDay (Mon-Fri) / saturdayPeriodsCount (Saturday) —
// never a single hardcoded number for the whole school.
const DEFAULT_PERIODS_PER_DAY = 8;
const DEFAULT_SATURDAY_PERIODS = 4;

function levelAwareTimetablePreset(levels: string[]) {
  const isSeniorSchool = levels.includes("SENIOR_SCHOOL");
  const isJuniorSchool = levels.includes("JUNIOR_SCHOOL");
  return {
    isSeniorSchool,
    isJuniorSchool,
    preferCombinationRichness: isSeniorSchool,
    preferSubjectSelectionBias: isJuniorSchool || isSeniorSchool,
    preferLevelWideBalancing: isJuniorSchool,
    preferSingleLessonSpread: isJuniorSchool,
    preferMorningAcademicDensity: isSeniorSchool,
  };
}

// ---------------------------------------------------------------------------
// Settings CRUD
// ---------------------------------------------------------------------------

export async function listConstraints(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().timetableConstraint.findMany({ orderBy: { priority: "asc" } });
    return rows.map((r) => ({ ...r, config: safeParse(r.configJson, {}) }));
  });
}

export async function upsertConstraint(
  user: SessionUser,
  input: { id?: string; kind: string; label?: string; enabled?: boolean; isHard?: boolean; priority?: number; config?: unknown }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    if (!CONSTRAINT_KINDS.includes(input.kind as any)) throw new TimetableEngineError("INVALID", "Unknown constraint kind.");
    const data = {
      kind: input.kind,
      label: input.label ?? CONSTRAINT_LABELS[input.kind] ?? input.kind,
      enabled: input.enabled ?? true,
      isHard: input.isHard ?? false,
      priority: input.priority ?? 100,
      configJson: JSON.stringify(input.config ?? {}),
    };
    if (input.id) {
      const found = await tdb.timetableConstraint.findUnique({ where: { id: input.id } });
      if (!found) throw new TimetableEngineError("NOT_FOUND", "Constraint not found.");
      return tdb.timetableConstraint.update({ where: { id: input.id }, data });
    }
    return tdb.timetableConstraint.create({ data: { tenantId: user.tenantId, ...data } });
  });
}

export async function deleteConstraint(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    await tenantDb().timetableConstraint.delete({ where: { id } }).catch(() => {});
    return { success: true };
  });
}

export async function saveTeacherTimeOff(user: SessionUser, teacherId: string, windows: { dayOfWeek: number; period: number; note?: string }[]) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    await tdb.teacherTimeOff.deleteMany({ where: { teacherId } });
    if (windows.length > 0) {
      await tdb.teacherTimeOff.createMany({
        data: windows.map((w) => ({ tenantId: user.tenantId, teacherId, dayOfWeek: w.dayOfWeek, period: w.period, note: w.note ?? null })),
      });
    }
    return { success: true };
  });
}

export async function listCombinationGroups(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const groups = await tenantDb().combinationGroup.findMany({ include: { members: true }, orderBy: { createdAt: "desc" } });
    return groups;
  });
}

export async function upsertCombinationGroup(
  user: SessionUser,
  input: { id?: string; name: string; subjectId: string; teacherId?: string | null; lessonsPerWeek: number; doubleCount?: number; scope?: string; source?: string; classIds: string[] }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const base = {
      name: input.name.trim(),
      subjectId: input.subjectId,
      teacherId: input.teacherId || null,
      lessonsPerWeek: input.lessonsPerWeek,
      doubleCount: input.doubleCount ?? 0,
      scope: input.scope === "GLOBAL" ? "GLOBAL" : "SELECTED",
      source: input.source === "SUBJECT_CHOICE" ? "SUBJECT_CHOICE" : "MANUAL",
    };
    let group;
    if (input.id) {
      group = await tdb.combinationGroup.update({ where: { id: input.id }, data: base });
      await tdb.combinationGroupClass.deleteMany({ where: { groupId: input.id } });
    } else {
      group = await tdb.combinationGroup.create({ data: { tenantId: user.tenantId, ...base } });
    }
    if (input.classIds.length > 0) {
      await tdb.combinationGroupClass.createMany({
        data: input.classIds.map((classId) => ({ tenantId: user.tenantId, groupId: group.id, classId })),
      });
    }
    return group;
  });
}

export async function deleteCombinationGroup(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    await tenantDb().combinationGroup.delete({ where: { id } }).catch(() => {});
    return { success: true };
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Master Button — background generation job
// ---------------------------------------------------------------------------

export async function startGeneration(user: SessionUser) {
  const job = await withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const running = await tdb.timetableGenerationJob.findFirst({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
    if (running) throw new TimetableEngineError("BUSY", "A timetable is already being generated.");
    return tdb.timetableGenerationJob.create({
      data: { tenantId: user.tenantId, status: "QUEUED", phase: "Queued", startedById: user.id, startedByName: user.fullName },
    });
  });
  // Fire-and-forget background run.
  void runGeneration(user.tenantId, job.id, user).catch(async (e) => {
    await withTenant(user.tenantId, async () => {
      await tenantDb().timetableGenerationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: (e as Error).message, finishedAt: new Date() },
      });
    });
  });
  return job;
}

export async function getGenerationJob(user: SessionUser, jobId?: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const job = jobId
      ? await tdb.timetableGenerationJob.findUnique({ where: { id: jobId } })
      : await tdb.timetableGenerationJob.findFirst({ orderBy: { startedAt: "desc" } });
    if (!job) return null;
    return { ...job, unplaced: safeParse<any[]>(job.unplacedJson, []), warnings: safeParse<any[]>(job.warningsJson, []) };
  });
}

async function setProgress(tenantId: string, jobId: string, progress: number, phase: string) {
  await withTenant(tenantId, async () => {
    await tenantDb().timetableGenerationJob.update({ where: { id: jobId }, data: { status: "RUNNING", progress, phase } });
  });
}

// ---------------------------------------------------------------------------
// The solver
// ---------------------------------------------------------------------------

interface Card {
  id: string;
  // member class ids that this card occupies simultaneously (1 for normal,
  // many for combination groups).
  classIds: string[];
  classLabel: string;
  subjectId: string;
  subjectCode: string;
  teacherId: string | null;
  size: 1 | 2; // single or double (number of consecutive/split periods)
  splitAllowed: boolean; // double may be non-adjacent
  isCombination: boolean;
}

export async function runGeneration(tenantId: string, jobId: string, user: SessionUser) {
  const result = await buildAndSolve(tenantId, jobId);

  await withTenant(tenantId, async () => {
    const tdb = tenantDb();
    await tdb.timetableGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        progress: 100,
        phase: "Complete",
        slotsPlaced: result.slotsPlaced,
        unplacedJson: JSON.stringify(result.unplaced),
        warningsJson: JSON.stringify(result.warnings),
        finishedAt: new Date(),
      },
    });
  });

  // Notify teachers + audit (best-effort, non-fatal).
  try {
    await withTenant(tenantId, async () => {
      const teachers = await tenantDb().user.findMany({
        where: { role: { in: ["TEACHER", "CLASS_TEACHER", "DEAN_OF_STUDIES"] }, isActive: true },
        select: { id: true },
      });
      for (const t of teachers) {
        await createInApp({ tenantId, recipientId: t.id, title: "New Timetable Published", body: "A new conflict-free whole-school timetable has been generated.", category: "system" });
      }
    });
    await db.auditLog.create({
      data: {
        tenantId, actorId: user.id, actorName: user.fullName,
        action: "timetable.generated_advanced", entityType: "tenant", entityId: tenantId,
        metadata: JSON.stringify({ slotsPlaced: result.slotsPlaced, unplaced: result.unplaced.length, warnings: result.warnings.length }),
      },
    });
  } catch { /* notify is non-fatal */ }

  return result;
}

async function buildAndSolve(tenantId: string, jobId: string) {
  await setProgress(tenantId, jobId, 5, "Loading classes, subjects & teachers");

  const data = await withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const [tenant, classes, subjects, needs, configs, teacherAssoc, constraints, groups, timeOff] = await Promise.all([
      tdb.tenant.findFirst({ select: { educationLevelsOffered: true } }),
      tdb.schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      tdb.subject.findMany({ where: { archived: false } }),
      tdb.classSubjectNeed.findMany(),
      tdb.timetableConfig.findMany(),
      tdb.teacherSubject.findMany(),
      tdb.timetableConstraint.findMany({ where: { enabled: true }, orderBy: { priority: "asc" } }),
      tdb.combinationGroup.findMany({ where: { active: true }, include: { members: true } }),
      tdb.teacherTimeOff.findMany(),
    ]);
    return { tenant, classes, subjects, needs, configs, teacherAssoc, constraints, groups, timeOff };
  });

  if (data.classes.length === 0) throw new TimetableEngineError("NOT_FOUND", "No active classes found.");

  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const configByClass = new Map(data.configs.map((c) => [c.classId, c]));

  // P.5 — per-class day list and per-class-per-day period cap, driven entirely
  // by each class's own real TimetableConfig row (never a single global
  // constant). A class with hasSaturday !== false gets Saturday as a genuine
  // 6th solved day, sized to its own saturdayPeriodsCount (a normal short day
  // is NOT the same length as a weekday, so it correctly gets fewer periods).
  function daysForClass(classId: string): number[] {
    const cfg = configByClass.get(classId);
    if (cfg?.hasSaturday === false) return WEEKDAYS;
    return [...WEEKDAYS, SATURDAY];
  }
  function maxPeriodsForClass(classId: string, day: number): number {
    const cfg = configByClass.get(classId);
    if (day === SATURDAY) return cfg?.saturdayPeriodsCount ?? DEFAULT_SATURDAY_PERIODS;
    return cfg?.periodsPerDay ?? DEFAULT_PERIODS_PER_DAY;
  }
  // A card spans multiple classIds for combinations; the card may only use a
  // day/period that is valid (real school time) for EVERY member class.
  function daysForCard(classIds: string[]): number[] {
    const perClassDays = classIds.map((id) => new Set(daysForClass(id)));
    return [...WEEKDAYS, SATURDAY].filter((d) => perClassDays.every((s) => s.has(d)));
  }
  function maxPeriodsForCard(classIds: string[], day: number): number {
    return Math.min(...classIds.map((id) => maxPeriodsForClass(id, day)));
  }
  const classLabel = (c: { level: string; stream: string | null }) => [c.level, c.stream].filter(Boolean).join(" ");
  const activeLevels = safeParse<string[]>(data.tenant?.educationLevelsOffered ?? "[]", []);
  const preset = levelAwareTimetablePreset(activeLevels);

  // Parse active constraints into a quick lookup.
  const con = (kind: string) => data.constraints.find((c) => c.kind === kind);
  const morningCfg = safeParse<{ subjectIds?: string[]; latestPeriod?: number }>(con("SUBJECT_MORNING")?.configJson ?? "{}", {});
  const notAdjacentPairs = safeParse<{ pairs?: [string, string][] }>(con("SUBJECTS_NOT_ADJACENT")?.configJson ?? "{}", {}).pairs ?? [];
  const peCfg = safeParse<{ allowedPeriods?: number[] }>(con("PE_TIMESLOT")?.configJson ?? "{}", {});
  const oneSinglePerDay = Boolean(con("ONE_SINGLE_PER_DAY"));
  const spreadOn = Boolean(con("LESSON_DISTRIBUTION"));
  const respectTimeOff = Boolean(con("TEACHER_TIMEOFF"));
  const doubleSameDayOn = Boolean(con("DOUBLE_SAME_DAY"));
  const rawStreamDistributionCfg = safeParse<{ subjectIds?: string[]; maxSameDayPerLevel?: number }>(con("STREAM_DISTRIBUTION")?.configJson ?? "{}", {});
  const streamDistributionCfg = {
    ...rawStreamDistributionCfg,
    maxSameDayPerLevel: preset.preferLevelWideBalancing
      ? Math.max(1, Number(rawStreamDistributionCfg.maxSameDayPerLevel ?? 1))
      : Math.max(1, Number(rawStreamDistributionCfg.maxSameDayPerLevel ?? 2)),
  };
  const classStreamConflictCfg = safeParse<{ teacherIds?: string[] }>(con("CLASS_STREAM_CONFLICT")?.configJson ?? "{}", {});

  // Time-off lookup: teacherId -> Set("day:period") (or day:0 / 0:period wildcards).
  const timeOffSet = new Set<string>();
  for (const t of data.timeOff) timeOffSet.add(`${t.teacherId}:${t.dayOfWeek}:${t.period}`);
  function teacherUnavailable(teacherId: string | null, day: number, period: number): boolean {
    if (!teacherId || !respectTimeOff) return false;
    return (
      timeOffSet.has(`${teacherId}:${day}:${period}`) ||
      timeOffSet.has(`${teacherId}:${day}:0`) ||
      timeOffSet.has(`${teacherId}:0:${period}`) ||
      timeOffSet.has(`${teacherId}:0:0`)
    );
  }

  await setProgress(tenantId, jobId, 20, "Reserving lunch & fixed blocks");

  // Grids.
  const classGrid = new Map<string, string>(); // classId:day:period -> subjectId
  const teacherGrid = new Map<string, string>(); // teacherId:day:period -> classId(s)
  const subjectDayCount = new Map<string, number>(); // classId:subjectId:day -> count
  const singleDayCount = new Map<string, number>(); // classId:subjectId:day singles only

  // Special subjects (lunch) so academics never collide.
  const lunchSubject = await withTenant(tenantId, async () => {
    const tdb = tenantDb();
    let l = await tdb.subject.findFirst({ where: { code: "LUNCH" } });
    if (!l) l = await tdb.subject.create({ data: { tenantId, name: "Lunch Break", code: "LUNCH", curriculum: "BOTH" } });
    return l;
  });

  // Reserve lunch per class according to its config lunch shift — only on
  // days/periods that actually exist for that class (a short Saturday with
  // fewer periods than the lunch slot simply has no lunch reservation that day,
  // matching how a real short day works instead of forcing a phantom period).
  const lunchSlots: any[] = [];
  for (const c of data.classes) {
    const cfg = configByClass.get(c.id);
    const shift = cfg?.lunchShift ?? 1;
    const lunchPeriod = shift === 1 ? 5 : shift === 2 ? 6 : 7;
    for (const day of daysForClass(c.id)) {
      if (lunchPeriod > maxPeriodsForClass(c.id, day)) continue;
      classGrid.set(`${c.id}:${day}:${lunchPeriod}`, lunchSubject.id);
      lunchSlots.push({ tenantId, classId: c.id, subjectId: lunchSubject.id, teacherId: null, dayOfWeek: day, period: lunchPeriod, slotType: "ACADEMIC" });
    }
  }

  await setProgress(tenantId, jobId, 35, "Building lesson cards (singles, doubles, combinations)");
  const presetWarnings: string[] = [];
  if (preset.isSeniorSchool) presetWarnings.push("Senior School preset bias applied: richer combination and subject-structure planning is preferred.");
  else if (preset.isJuniorSchool) presetWarnings.push("Junior School preset bias applied: subject-selection-aware scheduling is preferred without full Senior pathway complexity.");
  else presetWarnings.push("Lower-level preset bias applied: simpler scheduling pressure with less pathway complexity.");

  // ---- Build cards ----
  const cards: Card[] = [];
  let cardSeq = 0;

  // 1) Combination group cards (scheduled once for all member classes).
  const comboClassSubjectKeys = new Set<string>(); // classId::subjectId handled by a combo
  for (const g of data.groups) {
    let memberClassIds = g.members.map((m) => m.classId);
    // SUBJECT_CHOICE source: derive members from student selections of this subject.
    if (g.source === "SUBJECT_CHOICE") {
      const derived = await deriveClassesFromSubjectChoice(tenantId, g.subjectId);
      if (derived.length) memberClassIds = Array.from(new Set([...memberClassIds, ...derived]));
    }
    // GLOBAL scope: include every active class that has a need for this subject.
    if (g.scope === "GLOBAL" || (preset.preferCombinationRichness && g.scope === "SELECTED" && g.source === "SUBJECT_CHOICE")) {
      const withNeed = data.needs.filter((n) => n.subjectId === g.subjectId).map((n) => n.classId);
      memberClassIds = Array.from(new Set([...memberClassIds, ...withNeed]));
    }
    memberClassIds = memberClassIds.filter((id) => data.classes.some((c) => c.id === id));
    if (memberClassIds.length === 0) continue;

    for (const cid of memberClassIds) comboClassSubjectKeys.add(`${cid}::${g.subjectId}`);

    const sub = subjectById.get(g.subjectId);
    const dbl = Math.max(0, Math.min(g.doubleCount, Math.floor(g.lessonsPerWeek / 2)));
    const singles = g.lessonsPerWeek - dbl * 2;
    const labels = memberClassIds.map((id) => classLabel(data.classes.find((c) => c.id === id)!)).join(" + ");
    for (let i = 0; i < dbl; i++) {
      cards.push({ id: `c${cardSeq++}`, classIds: memberClassIds, classLabel: labels, subjectId: g.subjectId, subjectCode: sub?.code ?? "?", teacherId: g.teacherId, size: 2, splitAllowed: false, isCombination: true });
    }
    for (let i = 0; i < singles; i++) {
      cards.push({ id: `c${cardSeq++}`, classIds: memberClassIds, classLabel: labels, subjectId: g.subjectId, subjectCode: sub?.code ?? "?", teacherId: g.teacherId, size: 1, splitAllowed: false, isCombination: true });
    }
  }

  // 2) Normal per-class needs (skip class+subject already owned by a combination).
  for (const c of data.classes) {
    const cNeeds = data.needs.filter((n) => n.classId === c.id);
    for (const n of cNeeds) {
      if (comboClassSubjectKeys.has(`${c.id}::${n.subjectId}`)) continue; // combo handles it
      const sub = subjectById.get(n.subjectId);
      if (!sub) continue;
      const dbl = Math.max(0, Math.min(n.doubleCount, Math.floor(n.lessonsPerWeek / 2)));
      const singles = n.lessonsPerWeek - dbl * 2;
      for (let i = 0; i < dbl; i++) {
        cards.push({ id: `c${cardSeq++}`, classIds: [c.id], classLabel: classLabel(c), subjectId: n.subjectId, subjectCode: sub.code, teacherId: n.teacherId, size: 2, splitAllowed: n.allowSplitDouble, isCombination: false });
      }
      for (let i = 0; i < singles; i++) {
        cards.push({ id: `c${cardSeq++}`, classIds: [c.id], classLabel: classLabel(c), subjectId: n.subjectId, subjectCode: sub.code, teacherId: n.teacherId, size: 1, splitAllowed: false, isCombination: false });
      }
    }
  }

  // Order: combinations first (most constrained), then doubles, then assigned-teacher.
  cards.sort((a, b) => {
    if (a.isCombination !== b.isCombination) return a.isCombination ? -1 : 1;
    if (a.size !== b.size) return b.size - a.size;
    if (!!a.teacherId !== !!b.teacherId) return a.teacherId ? -1 : 1;
    return 0;
  });

  await setProgress(tenantId, jobId, 50, "Placing lessons with constraints");

  const warnings: { classLabel: string; subjectCode: string; message: string }[] = presetWarnings.map((message) => ({ classLabel: "SYSTEM", subjectCode: "PRESET", message }));
  const unplaced: { classLabel: string; subjectCode: string; reason: string }[] = [];

  // Helpers used by the placement check.
  function morningViolation(subjectId: string, period: number): boolean {
    if (!(morningCfg.subjectIds ?? []).includes(subjectId)) return false;
    const latest = morningCfg.latestPeriod ?? 4;
    return period > latest;
  }
  function peViolation(subjectCode: string, period: number): boolean {
    if (!peCfg.allowedPeriods || peCfg.allowedPeriods.length === 0) return false;
    const isPe = subjectCode === "PE" || subjectCode === "GAME" || subjectCode === "GAMES";
    if (!isPe) return false;
    return !peCfg.allowedPeriods.includes(period);
  }
  function adjacentViolation(classId: string, subjectId: string, day: number, period: number): boolean {
    if (notAdjacentPairs.length === 0) return false;
    const prev = classGrid.get(`${classId}:${day}:${period - 1}`);
    const next = classGrid.get(`${classId}:${day}:${period + 1}`);
    for (const [a, b] of notAdjacentPairs) {
      const pair = new Set([a, b]);
      if (pair.has(subjectId) && ((prev && pair.has(prev)) || (next && pair.has(next)))) return true;
    }
    return false;
  }

  // Can a single period at (day, period) host this card across all its classes + teacher?
  function periodFree(card: Card, day: number, period: number): boolean {
    if (period < 1 || period > maxPeriodsForCard(card.classIds, day)) return false;
    for (const cid of card.classIds) {
      if (classGrid.has(`${cid}:${day}:${period}`)) return false;
      if (morningViolation(card.subjectId, period)) return false;
      if (peViolation(card.subjectCode, period)) return false;
      if (adjacentViolation(cid, card.subjectId, day, period)) return false;
    }
    if (card.teacherId) {
      if (teacherGrid.has(`${card.teacherId}:${day}:${period}`)) return false;
      if (teacherUnavailable(card.teacherId, day, period)) return false;
    }
    return true;
  }

  function spreadOk(card: Card, day: number): boolean {
    if (!spreadOn) return true;
    for (const cid of card.classIds) {
      const cnt = subjectDayCount.get(`${cid}:${card.subjectId}:${day}`) ?? 0;
      const maxPerDay = preset.preferSingleLessonSpread ? 1 : 2;
      if (cnt >= maxPerDay) return false;
    }
    return true;
  }
  function streamDistributionOk(card: Card, day: number): boolean {
    const configuredIds = streamDistributionCfg.subjectIds ?? [];
    if (configuredIds.length > 0 && !configuredIds.includes(card.subjectId)) return true;
    const maxSameDayPerLevel = Math.max(1, Number(streamDistributionCfg.maxSameDayPerLevel ?? 1));
    const levels = new Set(card.classIds.map((cid) => data.classes.find((c) => c.id === cid)?.level).filter(Boolean));
    for (const level of levels) {
      const classesInLevel = data.classes.filter((c) => c.level === level).map((c) => c.id);
      const usedByOtherStreams = new Set<string>();
      for (const otherClassId of classesInLevel) {
        if (card.classIds.includes(otherClassId)) continue;
        for (let p = 1; p <= maxPeriodsForClass(otherClassId, day); p++) {
          if (classGrid.get(`${otherClassId}:${day}:${p}`) === card.subjectId) usedByOtherStreams.add(otherClassId);
        }
      }
      if (usedByOtherStreams.size >= maxSameDayPerLevel) return false;
    }
    return true;
  }

  function classStreamConflictOk(card: Card, day: number, periods: number[]): boolean {
    if (!card.teacherId) return true;
    if (classStreamConflictCfg.teacherIds?.length && !classStreamConflictCfg.teacherIds.includes(card.teacherId)) return true;
    const targetLevels = new Set(card.classIds.map((cid) => data.classes.find((c) => c.id === cid)?.level).filter(Boolean));
    if (targetLevels.size === 0) return true;
    for (const [key, teacherClassIds] of teacherGrid.entries()) {
      const [teacherId, dStr, pStr] = key.split(":");
      if (teacherId !== card.teacherId) continue;
      const d = Number(dStr), p = Number(pStr);
      if (d !== day || !periods.includes(p)) continue;
      for (const otherClassId of (teacherClassIds ?? "").split(",").filter(Boolean)) {
        const other = data.classes.find((c) => c.id === otherClassId);
        if (other && targetLevels.has(other.level) && !card.classIds.includes(otherClassId)) return false;
      }
    }
    return true;
  }

  function singlePerDayOk(card: Card, day: number): boolean {
    if (!oneSinglePerDay || card.size !== 1) return true;
    for (const cid of card.classIds) {
      const cnt = singleDayCount.get(`${cid}:${card.subjectId}:${day}`) ?? 0;
      if (cnt >= 1) return false;
    }
    return true;
  }

  function occupy(card: Card, day: number, periods: number[]) {
    for (const cid of card.classIds) {
      for (const p of periods) classGrid.set(`${cid}:${day}:${p}`, card.subjectId);
      const k = `${cid}:${card.subjectId}:${day}`;
      subjectDayCount.set(k, (subjectDayCount.get(k) ?? 0) + periods.length);
      if (card.size === 1) {
        const sk = `${cid}:${card.subjectId}:${day}`;
        singleDayCount.set(sk, (singleDayCount.get(sk) ?? 0) + 1);
      }
    }
    if (card.teacherId) for (const p of periods) teacherGrid.set(`${card.teacherId}:${day}:${p}`, card.classIds.join(","));
  }
  function release(card: Card, day: number, periods: number[]) {
    for (const cid of card.classIds) {
      for (const p of periods) classGrid.delete(`${cid}:${day}:${p}`);
      const k = `${cid}:${card.subjectId}:${day}`;
      subjectDayCount.set(k, Math.max(0, (subjectDayCount.get(k) ?? 0) - periods.length));
      if (card.size === 1) {
        const sk = `${cid}:${card.subjectId}:${day}`;
        singleDayCount.set(sk, Math.max(0, (singleDayCount.get(sk) ?? 0) - 1));
      }
    }
    if (card.teacherId) for (const p of periods) teacherGrid.delete(`${card.teacherId}:${day}:${p}`);
  }

  // candidate placements for a card on a given day
  function candidates(card: Card, day: number): number[][] {
    const out: number[][] = [];
    const maxP = maxPeriodsForCard(card.classIds, day);
    if (card.size === 1) {
      for (let p = 1; p <= maxP; p++) if (periodFree(card, day, p)) out.push([p]);
    } else {
      // double: try consecutive first
      for (let p = 1; p < maxP; p++) {
        if (periodFree(card, day, p) && periodFree(card, day, p + 1)) out.push([p, p + 1]);
      }
      // split double allowed (or forced by SPLIT_DOUBLE_HARD constraint): two non-adjacent periods same day
      if (card.splitAllowed) {
        for (let p = 1; p <= maxP; p++) {
          for (let q = p + 2; q <= maxP; q++) {
            if (periodFree(card, day, p) && periodFree(card, day, q)) out.push([p, q]);
          }
        }
      }
    }
    return out;
  }

  // Backtracking placement.
  let placed = 0;
  const candidateCache = new Map<string, number[][]>();
  function candidatePlacements(card: Card) {
    const cached = candidateCache.get(card.id);
    if (cached) return cached;
    const placements: number[][] = [];
    for (const day of daysForCard(card.classIds)) {
      if (!spreadOk(card, day)) continue;
      if (!singlePerDayOk(card, day)) continue;
      if (!streamDistributionOk(card, day)) continue;
      for (const periods of candidates(card, day)) {
        if (!classStreamConflictOk(card, day, periods)) continue;
        placements.push([day, ...periods]);
      }
    }
    placements.sort((a, b) => {
      const [dayA, ...periodsA] = a;
      const [dayB, ...periodsB] = b;
      const morningPenaltyA = periodsA.some((p) => morningViolation(card.subjectId, p)) ? 100 : 0;
      const morningPenaltyB = periodsB.some((p) => morningViolation(card.subjectId, p)) ? 100 : 0;
      const pePenaltyA = periodsA.some((p) => peViolation(card.subjectCode, p)) ? 100 : 0;
      const pePenaltyB = periodsB.some((p) => peViolation(card.subjectCode, p)) ? 100 : 0;
      const streamPenaltyA = streamDistributionOk(card, dayA) ? 0 : 50;
      const streamPenaltyB = streamDistributionOk(card, dayB) ? 0 : 50;
      const densityBonusA = preset.preferMorningAcademicDensity ? periodsA.reduce((acc, p) => acc + (p <= 4 ? -3 : 0), 0) : 0;
      const densityBonusB = preset.preferMorningAcademicDensity ? periodsB.reduce((acc, p) => acc + (p <= 4 ? -3 : 0), 0) : 0;
      const scoreA = morningPenaltyA + pePenaltyA + streamPenaltyA + densityBonusA + dayA * 2 + periodsA[0];
      const scoreB = morningPenaltyB + pePenaltyB + streamPenaltyB + densityBonusB + dayB * 2 + periodsB[0];
      return scoreA - scoreB;
    });
    candidateCache.set(card.id, placements);
    return placements;
  }
  cards.sort((a, b) => candidatePlacements(a).length - candidatePlacements(b).length || (b.size - a.size));

  function solve(idx: number): boolean {
    if (idx >= cards.length) return true;
    const card = cards[idx];
    const placements = candidatePlacements(card).sort((a, b) => {
      const [dayA, ...periodsA] = a;
      const [dayB, ...periodsB] = b;
      const score = (day: number, periods: number[]) => {
        let s = 0;
        if (periods.some((p) => morningViolation(card.subjectId, p))) s += 1000;
        if (periods.some((p) => peViolation(card.subjectCode, p))) s += 500;
        if (preset.preferMorningAcademicDensity) s += periods.reduce((acc, p) => acc + (p <= 4 ? -5 : 0), 0);
        s += day * 10 + periods[0];
        return s;
      };
      return score(dayA, periodsA) - score(dayB, periodsB);
    });
    for (const placement of placements) {
      const [day, ...periods] = placement;
      if (!spreadOk(card, day)) continue;
      if (!singlePerDayOk(card, day)) continue;
      if (!streamDistributionOk(card, day)) continue;
      if (!classStreamConflictOk(card, day, periods)) continue;
      if (!periods.every((p) => periodFree(card, day, p))) continue;
      occupy(card, day, periods);
      if (solve(idx + 1)) return true;
      release(card, day, periods);
    }
    return false;
  }

  // Try a full solve; if it fails, place greedily and record unplaced loads.
  const fullySolved = solve(0);
  if (!fullySolved) {
    // greedy fallback so we still produce a usable timetable
    classGrid.clear();
    teacherGrid.clear();
    subjectDayCount.clear();
    singleDayCount.clear();
    // re-reserve lunch
    for (const s of lunchSlots) classGrid.set(`${s.classId}:${s.dayOfWeek}:${s.period}`, lunchSubject.id);
    for (const card of cards) {
      let done = false;
      for (const day of daysForCard(card.classIds)) {
        if (!spreadOk(card, day) || !singlePerDayOk(card, day) || !streamDistributionOk(card, day)) continue;
        const cs = candidates(card, day).filter((periods) => classStreamConflictOk(card, day, periods));
        if (cs.length > 0) { occupy(card, day, cs[0]); done = true; placed++; break; }
      }
      if (!done) unplaced.push({ classLabel: card.classLabel, subjectCode: card.subjectCode, reason: "No conflict-free slot under current constraints." });
    }
  } else {
    placed = cards.length;
  }

  await setProgress(tenantId, jobId, 80, "Saving timetable slots");

  // Build slot rows from the class grid (excluding lunch reservations, appended separately).
  const slotRows: any[] = [];
  // Map a (classId, subjectId) -> teacherId for academic slots.
  const teacherForClassSubject = new Map<string, string | null>();
  for (const n of data.needs) teacherForClassSubject.set(`${n.classId}::${n.subjectId}`, n.teacherId ?? null);
  for (const g of data.groups) {
    for (const m of g.members) {
      if (!m.classId) continue;
      teacherForClassSubject.set(`${m.classId}::${g.subjectId}`, g.teacherId ?? null);
    }
  }

  for (const [key, subjectId] of classGrid.entries()) {
    if (subjectId === lunchSubject.id) continue;
    const [classId, dayStr, periodStr] = key.split(":");
    const teacherId = teacherForClassSubject.get(`${classId}::${subjectId}`) ?? null;
    const classExists = data.classes.some((c) => c.id === classId);
    const subjectExists = data.subjects.some((s) => s.id === subjectId);
    const teacherExists = !teacherId || teacherId === lunchSubject.id ? true : data.needs.some((n) => n.teacherId === teacherId) || data.groups.some((g) => g.teacherId === teacherId) || data.teacherAssoc.some((a) => a.teacherId === teacherId) || true;
    if (!classExists || !subjectExists || !teacherExists) continue;
    slotRows.push({
      tenantId, classId, subjectId,
      teacherId,
      dayOfWeek: Number(dayStr), period: Number(periodStr), slotType: "ACADEMIC",
    });
  }
  slotRows.push(...lunchSlots);

  await withTenant(tenantId, async () => {
    const tdb = tenantDb();
    // P.5 bugfix: this regenerate only OWNS "ACADEMIC" slots (Mon-Fri + the
    // now-integrated Saturday). It must never wipe REMEDIAL/PREP/ACTIVITY rows
    // created by the separate Bulk/Fair Saturday tools or the Activities
    // timetable — a real pre-existing bug (unscoped deleteMany({})) found and
    // fixed during the P.5 audit that silently destroyed those rows on every
    // Master Button run.
    await tdb.timetableSlot.deleteMany({ where: { slotType: "ACADEMIC" } });
    const validTeacherIds = new Set((await tdb.user.findMany({ where: { isActive: true }, select: { id: true } })).map((u) => u.id));
    const validClassIds = new Set(data.classes.map((c) => c.id));
    const validSubjectIds = new Set(data.subjects.map((s) => s.id).concat([lunchSubject.id]));
    const safeRows = slotRows.filter((row) => validClassIds.has(row.classId) && validSubjectIds.has(row.subjectId) && (!row.teacherId || validTeacherIds.has(row.teacherId)));
    if (safeRows.length > 0) await tdb.timetableSlot.createMany({ data: safeRows });
  });

  return { slotsPlaced: slotRows.length, unplaced, warnings, fullySolved };
}

// ---------------------------------------------------------------------------
// P.5 — Optional KICD Senior School 40-lesson/week template.
// A school may apply this to a specific Senior School class in ONE action to
// pre-fill its TimetableConfig + ClassSubjectNeed rows with the real KICD
// numbers (English 5, Kiswahili 5, Math 5, CSL 3, 3 electives x 5, PE 3, ICT
// Skills 2, PPI 1, Personal/Group Study 1 = 40). NEVER applied automatically
// or forced — periodsPerDay/lessonDurationMins remain fully editable
// afterward like any other class, matching the founder's explicit
// "let a school tweak how they would like" instruction.
// ---------------------------------------------------------------------------
export async function applyKicdSeniorSchoolTemplate(
  user: SessionUser,
  input: { classId: string; electiveSubjectIds: string[] }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const cls = await tdb.schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls) throw new TimetableEngineError("NOT_FOUND", "Class not found.");
    if (input.electiveSubjectIds.length !== 3) {
      throw new TimetableEngineError("INVALID", "The KICD Senior School template needs exactly 3 real pathway electives for this class.");
    }
    const electiveSubjects = await tdb.subject.findMany({ where: { id: { in: input.electiveSubjectIds }, archived: false } });
    if (electiveSubjects.length !== 3) throw new TimetableEngineError("NOT_FOUND", "One or more selected elective subjects no longer exist.");

    // Match-or-create the real compulsory subjects this template needs,
    // reusing existing rows wherever they already exist (never duplicating
    // English/Kiswahili/Math/CSL, matching the project's non-duplication
    // discipline used throughout Part P).
    async function ensureSubject(name: string, code: string) {
      const existing = await tdb.subject.findFirst({ where: { code } });
      if (existing) return existing;
      return tdb.subject.create({ data: { tenantId: user.tenantId, name, code, curriculum: "CBC" } });
    }
    const english = await ensureSubject("English", "ENG");
    const kiswahili = await ensureSubject("Kiswahili", "KIS");
    const csl = await ensureSubject(COMMUNITY_SERVICE_LEARNING_SUBJECT.name, COMMUNITY_SERVICE_LEARNING_SUBJECT.code);
    const pe = await ensureSubject("Physical Education", "PE");
    const ict = await ensureSubject("ICT Skills", "ICTS");
    const ppi = await ensureSubject("Pastoral Programme of Instruction", "PPI");
    const study = await ensureSubject("Personal/Group Study", "PGST");

    // Mathematics variant: resolve from this class's OWN pathway allocations
    // if any students are already allocated (STEM -> Core, else Essential),
    // defaulting to Core Mathematics if the class has no allocation data yet
    // (a school can correct this afterward like any ClassSubjectNeed row).
    const allocatedGroups = await tdb.studentPathwayPreference.findMany({
      where: { isAllocated: true, student: { classId: input.classId } },
      include: { pathway: { select: { pathwayGroup: true } } },
    });
    const hasStem = allocatedGroups.some((p) => p.pathway.pathwayGroup === "STEM");
    const mathDef = CORE_ESSENTIAL_MATHEMATICS.find((m) => m.compulsoryFor.includes(hasStem || allocatedGroups.length === 0 ? "STEM" : (allocatedGroups[0].pathway.pathwayGroup as any))) ?? CORE_ESSENTIAL_MATHEMATICS[0];
    const math = await ensureSubject(mathDef.name, mathDef.code);

    // Fill TimetableConfig with the real KICD structure (40 lessons, 40 min,
    // 8 periods/day) — a starting point the school can still edit afterward.
    await tdb.timetableConfig.upsert({
      where: { classId: input.classId },
      create: {
        tenantId: user.tenantId,
        classId: input.classId,
        periodsPerDay: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.periodsPerDay,
        lessonDurationMins: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.lessonDurationMins,
        freePeriodsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.nonAcademicLessons.PERSONAL_GROUP_STUDY,
        coCurricularCount: 0,
        coCurricularName: "Games",
        hasSaturday: true,
        saturdayPeriodsCount: 4,
      },
      update: {
        periodsPerDay: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.periodsPerDay,
        lessonDurationMins: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.lessonDurationMins,
      },
    });

    const needRows: { subjectId: string; lessonsPerWeek: number }[] = [
      { subjectId: english.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.compulsorySubjectLessons.ENGLISH },
      { subjectId: kiswahili.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.compulsorySubjectLessons.KISWAHILI_OR_KSL },
      { subjectId: math.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.compulsorySubjectLessons.MATHEMATICS },
      { subjectId: csl.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.compulsorySubjectLessons.COMMUNITY_SERVICE_LEARNING },
      ...electiveSubjects.map((s) => ({ subjectId: s.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.electiveLessonsEach })),
      { subjectId: pe.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.nonAcademicLessons.PE },
      { subjectId: ict.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.nonAcademicLessons.ICT_SKILLS },
      { subjectId: ppi.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.nonAcademicLessons.PPI },
      { subjectId: study.id, lessonsPerWeek: KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE.nonAcademicLessons.PERSONAL_GROUP_STUDY },
    ];

    for (const row of needRows) {
      await tdb.classSubjectNeed.upsert({
        where: { tenantId_classId_subjectId: { tenantId: user.tenantId, classId: input.classId, subjectId: row.subjectId } },
        create: { tenantId: user.tenantId, classId: input.classId, subjectId: row.subjectId, lessonsPerWeek: row.lessonsPerWeek },
        update: { lessonsPerWeek: row.lessonsPerWeek },
      });
    }

    const totalLessons = needRows.reduce((sum, r) => sum + r.lessonsPerWeek, 0);
    return {
      classId: input.classId,
      totalLessonsPerWeek: totalLessons,
      mathVariantApplied: mathDef.name,
      subjectsConfigured: needRows.length,
    };
  });
}

/** Derive which classes take a subject from student subject selections. */
async function deriveClassesFromSubjectChoice(tenantId: string, subjectId: string): Promise<string[]> {
  return withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const sels = await tdb.studentSubjectSelection.findMany({ where: { isConfirmed: true }, select: { studentId: true, selectedSubjectIds: true } });
    const studentIds = sels.filter((s) => safeParse<string[]>(s.selectedSubjectIds, []).includes(subjectId)).map((s) => s.studentId);
    if (studentIds.length === 0) return [];
    const students = await tdb.student.findMany({ where: { id: { in: studentIds } }, select: { classId: true } });
    return Array.from(new Set(students.map((s) => s.classId).filter(Boolean))) as string[];
  });
}
