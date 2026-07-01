import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";

export class ComputationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComputationError";
  }
}

/**
 * 1. Normalize Paper Marks -> Final Subject Exam Score
 * Math: (MarksScored / OutOfMarks) * (WeightPct / 100) -> Summed.
 */
async function computeSubjectExamScores(tenantId: string, examId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    // Fetch all paper results for this exam
    const results = await tDb.examResult.findMany({
      where: { examId },
      include: { PaperResult: { include: { paperConfig: true } } }
    });

    for (const res of results) {
      if (res.PaperResult.length === 0) continue; // It was a 'default' 100% paper, marks are already in res.marks

      let finalScore = 0;
      let configuredTotalWeight = 0;

      for (const pr of res.PaperResult) {
        if (pr.marksScored === null) continue;
        const cfg = pr.paperConfig;
        configuredTotalWeight += cfg.weightPct;
        const normalized = (pr.marksScored / cfg.outOfMarks) * cfg.weightPct;
        finalScore += normalized;
      }

      // If papers were entered but the total weight doesn't hit 100 (e.g. absent for one),
      // we scale the final score based on the school's policy. 
      // Assuming strict literal scale here: if you miss a 20% paper, max is 80.
      
      await tDb.examResult.update({
        where: { id: res.id },
        data: { marks: Math.round(finalScore) }
      });
    }
  });
}

/**
 * 2. K.5 Asynchronous Background Job — Master Term Report Aggregation
 * This loops through all students in a Term, looks up the TermAggregationRule (Macro-Weights),
 * calculates the final aggregate score across CATs, Projects, and Exams, and maps it to CBC Rubrics.
 */
/**
 * K.5 — Read the Master Term Report for a class in a term (subject grid + overall),
 * ordered by overall position. Used by the Academics computation dashboard.
 */
export async function getMasterReportCards(tenantId: string, termId: string, classId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    const rows = await tDb.masterReportCard.findMany({
      where: { termId, classId },
      orderBy: [{ subjectId: "asc" }],
    });
    const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
    const students = studentIds.length
      ? await tDb.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true } })
      : [];
    const subjectIds = Array.from(new Set(rows.map((r) => r.subjectId).filter(Boolean))) as string[];
    const subjects = subjectIds.length
      ? await tDb.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, code: true } })
      : [];
    const nameById = new Map(students.map((s) => [s.id, [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ")]));
    const admById = new Map(students.map((s) => [s.id, s.admissionNo]));
    const subjById = new Map(subjects.map((s) => [s.id, s]));

    const byStudent = new Map<string, { name: string; admissionNo: string; overall: any | null; subjects: any[] }>();
    for (const r of rows) {
      const entry = byStudent.get(r.studentId) ?? { name: nameById.get(r.studentId) ?? "", admissionNo: admById.get(r.studentId) ?? "", overall: null, subjects: [] };
      if (r.subjectId === null) {
        entry.overall = { finalMark: r.finalMark, cbcLevel: r.cbcLevel, letterGrade: r.letterGrade, rank: r.rank, outOf: r.outOf };
      } else {
        const sub = subjById.get(r.subjectId);
        entry.subjects.push({ subjectId: r.subjectId, subjectName: sub?.name ?? "", subjectCode: sub?.code ?? "", finalMark: r.finalMark, cbcLevel: r.cbcLevel, letterGrade: r.letterGrade, rank: r.rank, outOf: r.outOf, isTraditional: r.isTraditional });
      }
      byStudent.set(r.studentId, entry);
    }
    const list = Array.from(byStudent.values()).sort((a, b) => (a.overall?.rank ?? 9999) - (b.overall?.rank ?? 9999));
    return { students: list, subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })) };
  });
}

interface AggComponent {
  sourceType: "EXAM" | "ASSESSMENT";
  sourceId: string;
  label: string;
  mark: number; // 0..100 normalised
  weightPct: number; // 0..100 (effective weight used)
}

/** CBC band from a 0..100 mark. */
function cbcLevelFromMark(mark: number): number {
  if (mark >= 80) return 4;
  if (mark >= 65) return 3;
  if (mark >= 50) return 2;
  return 1;
}

/** Standard KNEC 8-4-4 letter grade from a 0..100 mark. */
function letterGradeFromMark(mark: number): string {
  if (mark >= 80) return "A";
  if (mark >= 75) return "A-";
  if (mark >= 70) return "B+";
  if (mark >= 65) return "B";
  if (mark >= 60) return "B-";
  if (mark >= 55) return "C+";
  if (mark >= 50) return "C";
  if (mark >= 45) return "C-";
  if (mark >= 40) return "D+";
  if (mark >= 35) return "D";
  if (mark >= 30) return "D-";
  return "E";
}

/**
 * K.5 — Master Term Report aggregation.
 *
 * For every (student, subject) with results in the term, produce ONE final
 * aggregated mark, persisted as a MasterReportCard row, plus an overall summary
 * row per student (subjectId = null) with the term mean and class position.
 *
 * Aggregation policy (founder choice 2026-06-30):
 *  - If a TermAggregationRule applies (most specific: class+subject -> class ->
 *    subject -> global) and is NOT traditional, use its weightings over the
 *    term's exams (and assessment types). Weights are normalised over the
 *    components that actually have a mark, so a missing component doesn't zero
 *    the subject.
 *  - Otherwise (no rule, or isTraditional) use a SIMPLE AVERAGE of the term's
 *    exam results for that subject.
 *
 * Deterministic, no AI. Idempotent via the MasterReportCard unique key.
 * Returns the number of subject rows written.
 */
export async function computeMasterReportCards(tenantId: string, termId: string): Promise<number> {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();

    const term = await tDb.academicTerm.findUnique({ where: { id: termId } });
    if (!term) throw new ComputationError("Term not found for master report computation.");

    // All exams in this term (matched by year + term number) and their results.
    const exams = await tDb.exam.findMany({ where: { year: term.year, term: term.term }, select: { id: true, name: true } });
    const examIds = exams.map((e) => e.id);
    if (examIds.length === 0) return 0;

    const results = await tDb.examResult.findMany({
      where: { examId: { in: examIds } },
      select: { examId: true, studentId: true, subjectId: true, marks: true },
    });
    if (results.length === 0) return 0;

    // Map student -> class (only students currently placed in a class are ranked).
    const studentIds = Array.from(new Set(results.map((r) => r.studentId)));
    const students = await tDb.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, classId: true },
    });
    const classByStudent = new Map(students.map((s) => [s.id, s.classId]));

    // Aggregation rules for the tenant.
    const rules = await tDb.termAggregationRule.findMany({});
    function ruleFor(classId: string | null, subjectId: string) {
      return (
        rules.find((r) => r.classId === classId && r.subjectId === subjectId) ||
        rules.find((r) => r.classId === classId && r.subjectId === null) ||
        rules.find((r) => r.classId === null && r.subjectId === subjectId) ||
        rules.find((r) => r.classId === null && r.subjectId === null) ||
        null
      );
    }

    // Index exam results by student+subject.
    type RKey = string;
    const byStudentSubject = new Map<RKey, { examId: string; mark: number }[]>();
    for (const r of results) {
      const key = `${r.studentId}::${r.subjectId}`;
      const list = byStudentSubject.get(key) ?? [];
      list.push({ examId: r.examId, mark: r.marks });
      byStudentSubject.set(key, list);
    }

    const curriculumOn = await isCurriculumEngineEnabled();

    // Compute each subject final mark.
    interface SubjectRow {
      studentId: string;
      classId: string | null;
      subjectId: string;
      finalMark: number;
      isTraditional: boolean;
      components: AggComponent[];
    }
    const subjectRows: SubjectRow[] = [];

    for (const [key, list] of byStudentSubject.entries()) {
      const [studentId, subjectId] = key.split("::");
      const classId = classByStudent.get(studentId) ?? null;
      const rule = ruleFor(classId, subjectId);

      let finalMark: number;
      let isTraditional = true;
      const components: AggComponent[] = [];

      const examMarkById = new Map(list.map((x) => [x.examId, x.mark]));

      if (rule && !rule.isTraditional) {
        let weightings: { sourceType: string; sourceId: string; weightPct: number }[] = [];
        try { weightings = JSON.parse(rule.weightingsJson); } catch { weightings = []; }
        // Only EXAM weightings can be resolved from exam results here.
        const usable = weightings
          .filter((w) => w.sourceType === "EXAM" && examMarkById.has(w.sourceId))
          .map((w) => ({ ...w, mark: examMarkById.get(w.sourceId)! }));
        const totalWeight = usable.reduce((a, w) => a + w.weightPct, 0);
        if (usable.length > 0 && totalWeight > 0) {
          isTraditional = false;
          let acc = 0;
          for (const w of usable) {
            const effective = (w.weightPct / totalWeight) * 100;
            acc += w.mark * (w.weightPct / totalWeight);
            const exam = exams.find((e) => e.id === w.sourceId);
            components.push({ sourceType: "EXAM", sourceId: w.sourceId, label: exam?.name ?? "Exam", mark: w.mark, weightPct: Math.round(effective) });
          }
          finalMark = acc;
        } else {
          // Rule present but unusable for these exams -> fall back to average.
          finalMark = list.reduce((a, x) => a + x.mark, 0) / list.length;
          for (const x of list) {
            const exam = exams.find((e) => e.id === x.examId);
            components.push({ sourceType: "EXAM", sourceId: x.examId, label: exam?.name ?? "Exam", mark: x.mark, weightPct: Math.round(100 / list.length) });
          }
        }
      } else {
        // Simple average of the term's exam results for this subject.
        finalMark = list.reduce((a, x) => a + x.mark, 0) / list.length;
        for (const x of list) {
          const exam = exams.find((e) => e.id === x.examId);
          components.push({ sourceType: "EXAM", sourceId: x.examId, label: exam?.name ?? "Exam", mark: x.mark, weightPct: Math.round(100 / list.length) });
        }
      }

      subjectRows.push({ studentId, classId, subjectId, finalMark: Math.round(finalMark * 100) / 100, isTraditional, components });
    }

    // Rank per (class, subject).
    const subjRankGroups = new Map<string, SubjectRow[]>();
    for (const row of subjectRows) {
      const g = `${row.classId ?? "none"}::${row.subjectId}`;
      const list = subjRankGroups.get(g) ?? [];
      list.push(row);
      subjRankGroups.set(g, list);
    }
    const subjRank = new Map<SubjectRow, { rank: number; outOf: number }>();
    for (const [, list] of subjRankGroups) {
      const sorted = [...list].sort((a, b) => b.finalMark - a.finalMark);
      sorted.forEach((row, i) => subjRank.set(row, { rank: i + 1, outOf: sorted.length }));
    }

    // Overall mean per student (across their subjects), then class rank.
    const overallByStudent = new Map<string, { classId: string | null; mean: number; count: number }>();
    for (const row of subjectRows) {
      const cur = overallByStudent.get(row.studentId) ?? { classId: row.classId, mean: 0, count: 0 };
      cur.mean += row.finalMark;
      cur.count += 1;
      overallByStudent.set(row.studentId, cur);
    }
    const overallRows = Array.from(overallByStudent.entries()).map(([studentId, v]) => ({
      studentId,
      classId: v.classId,
      mean: v.count ? Math.round((v.mean / v.count) * 100) / 100 : 0,
    }));
    const overallRankGroups = new Map<string, typeof overallRows>();
    for (const row of overallRows) {
      const g = row.classId ?? "none";
      const list = overallRankGroups.get(g) ?? [];
      list.push(row);
      overallRankGroups.set(g, list);
    }
    const overallRank = new Map<string, { rank: number; outOf: number }>();
    for (const [, list] of overallRankGroups) {
      const sorted = [...list].sort((a, b) => b.mean - a.mean);
      sorted.forEach((row, i) => overallRank.set(row.studentId, { rank: i + 1, outOf: sorted.length }));
    }

    // Persist (idempotent upsert) subject rows + overall summary rows.
    let written = 0;
    for (const row of subjectRows) {
      const rk = subjRank.get(row) ?? { rank: 0, outOf: 0 };
      await tDb.masterReportCard.upsert({
        where: { tenantId_termId_studentId_subjectId: { tenantId, termId, studentId: row.studentId, subjectId: row.subjectId } },
        create: {
          tenantId, termId, classId: row.classId ?? "", studentId: row.studentId, subjectId: row.subjectId,
          finalMark: row.finalMark,
          cbcLevel: curriculumOn ? cbcLevelFromMark(row.finalMark) : null,
          letterGrade: letterGradeFromMark(row.finalMark),
          rank: rk.rank || null, outOf: rk.outOf || null,
          isTraditional: row.isTraditional,
          componentsJson: JSON.stringify(row.components),
        },
        update: {
          classId: row.classId ?? "", finalMark: row.finalMark,
          cbcLevel: curriculumOn ? cbcLevelFromMark(row.finalMark) : null,
          letterGrade: letterGradeFromMark(row.finalMark),
          rank: rk.rank || null, outOf: rk.outOf || null,
          isTraditional: row.isTraditional,
          componentsJson: JSON.stringify(row.components),
          computedAt: new Date(),
        },
      });
      written++;
    }
    for (const row of overallRows) {
      const rk = overallRank.get(row.studentId) ?? { rank: 0, outOf: 0 };
      // Summary row has subjectId = null; Prisma compound uniques cannot select
      // on null, so upsert manually (find existing summary row, then update/create).
      const existing = await tDb.masterReportCard.findFirst({
        where: { tenantId, termId, studentId: row.studentId, subjectId: null },
        select: { id: true },
      });
      const summaryData = {
        classId: row.classId ?? "",
        finalMark: row.mean,
        cbcLevel: curriculumOn ? cbcLevelFromMark(row.mean) : null,
        letterGrade: letterGradeFromMark(row.mean),
        rank: rk.rank || null,
        outOf: rk.outOf || null,
        isTraditional: true,
        componentsJson: "[]",
        computedAt: new Date(),
      };
      if (existing) {
        await tDb.masterReportCard.update({ where: { id: existing.id }, data: summaryData });
      } else {
        await tDb.masterReportCard.create({
          data: { tenantId, termId, studentId: row.studentId, subjectId: null, ...summaryData },
        });
      }
    }

    return written;
  });
}

/**
 * K.6 — Map exam results to CBC competency evidence (J.4) for a term.
 *
 * Mapping rule (deterministic, no AI): an exam subject belongs to a CBC
 * LearningArea; every active Competency under that learning area receives an
 * evidence row derived from the student's final subject mark:
 *   >=80 -> Level 4 (EE), >=65 -> Level 3 (ME), >=50 -> Level 2 (AE), else 1 (BE).
 *
 * Idempotent: keyed on (sourceModule="EXAM", sourceId=examResultId,
 * competencyId) so re-computation updates rather than duplicates.
 *
 * Gated by the curriculum engine flag — when Part-J / CBC is OFF this is a no-op
 * and normal computation/release is unaffected.
 *
 * Returns the number of evidence rows written/updated.
 */
export async function syncResultsToCompetencyEvidence(tenantId: string, term: number): Promise<number> {
  if (!(await isCurriculumEngineEnabled())) return 0;

  return withTenant(tenantId, async () => {
    const tDb = tenantDb();

    const results = await tDb.examResult.findMany({
      where: { exam: { term } },
      select: { id: true, studentId: true, subjectId: true, marks: true, updatedAt: true },
    });
    if (results.length === 0) return 0;

    // subjectId -> learningAreaId
    const subjectIds = Array.from(new Set(results.map((r) => r.subjectId)));
    const subjects = await tDb.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, learningAreaId: true },
    });
    const areaBySubject = new Map(subjects.map((s) => [s.id, s.learningAreaId]));

    // learningAreaId -> active competencies in that area
    const areaIds = Array.from(new Set(subjects.map((s) => s.learningAreaId).filter(Boolean))) as string[];
    if (areaIds.length === 0) return 0;
    const competencies = await tDb.competency.findMany({
      where: { learningAreaId: { in: areaIds }, active: true },
      select: { id: true, learningAreaId: true },
    });
    const compsByArea = new Map<string, string[]>();
    for (const c of competencies) {
      if (!c.learningAreaId) continue;
      const list = compsByArea.get(c.learningAreaId) ?? [];
      list.push(c.id);
      compsByArea.set(c.learningAreaId, list);
    }

    function levelFor(marks: number): number {
      if (marks >= 80) return 4;
      if (marks >= 65) return 3;
      if (marks >= 50) return 2;
      return 1;
    }

    let written = 0;
    for (const r of results) {
      const areaId = areaBySubject.get(r.subjectId);
      if (!areaId) continue;
      const comps = compsByArea.get(areaId) ?? [];
      const level = levelFor(r.marks);
      const evidenceDate = (r.updatedAt ?? new Date()).toISOString().slice(0, 10);

      for (const competencyId of comps) {
        const existing = await tDb.competencyEvidence.findFirst({
          where: { sourceModule: "EXAM", sourceId: r.id, competencyId },
          select: { id: true },
        });
        const data = {
          level,
          scorePct: r.marks,
          narrative: `Derived from term exam result (mark ${r.marks}%).`,
          evidenceDate,
        };
        if (existing) {
          await tDb.competencyEvidence.update({ where: { id: existing.id }, data });
        } else {
          await tDb.competencyEvidence.create({
            data: {
              tenantId,
              competencyId,
              studentId: r.studentId,
              sourceModule: "EXAM",
              sourceId: r.id,
              recordedById: "system",
              recordedByName: "NEYO Computation Engine",
              approved: true,
              visibleToParents: false,
              ...data,
            },
          });
        }
        written++;
      }
    }
    return written;
  });
}

export async function triggerTermComputation(tenantId: string, portalId: string) {
  // We don't await this inside the API route. We fire and forget.
  _runBackgroundComputation(tenantId, portalId).catch(console.error);
  return { status: "COMPUTING", message: "Computation started in the background." };
}

async function _runBackgroundComputation(tenantId: string, portalId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { status: "COMPUTING", computationStartedAt: new Date(), computationProgress: 5 }
    });

    const portal = await tDb.marksPortal.findUnique({ where: { id: portalId }, include: { term: true } });
    if (!portal || !portal.termId) throw new ComputationError("Invalid portal configuration");

    // Get all exams belonging to this term to compute their micro-weights first
    const exams = await tDb.exam.findMany({ where: { term: portal.term!.term } });
    for (const ex of exams) {
      await computeSubjectExamScores(tenantId, ex.id);
    }
    
    await tDb.marksPortal.update({ where: { id: portalId }, data: { computationProgress: 30 } });

    // K.5 — Term-level macro aggregation. The per-subject weighted computation
    // already ran above (computeSubjectExamScores). Now build the MasterReportCard:
    // one final aggregated mark per (student, subject) using TermAggregationRule
    // when present, else a simple average of the term's exams, plus an overall
    // summary row per student with the term mean + class position. Real work, no
    // artificial delay.
    let masterRowsWritten = 0;
    try {
      masterRowsWritten = await computeMasterReportCards(tenantId, portal.termId!);
    } catch (err) {
      console.error("K.5 master report aggregation failed (non-fatal):", err);
    }
    await tDb.marksPortal.update({ where: { id: portalId }, data: { computationProgress: 80 } });
    
    // K.6 — Auto-sync computed final results into CBC (J.4 CompetencyEvidence),
    // which also surfaces them in the J.8 Learner Journey (the journey timeline
    // reads CompetencyEvidence). This is a BEST-EFFORT enrichment: it only runs
    // when the curriculum engine (Part-J) is ON, and any failure here must NEVER
    // break the core computation/release. Normal results work with J OFF.
    const results = await tDb.examResult.findMany({ where: { exam: { term: portal.term!.term } } });
    try {
      await syncResultsToCompetencyEvidence(tenantId, portal.term!.term);
    } catch (err) {
      console.error("K.6 CBC sync skipped (non-fatal):", err);
    }

    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { 
        status: "PENDING_RELEASE", 
        computationEndedAt: new Date(), 
        computationProgress: 100,
        computationTotalRows: results.length + masterRowsWritten
      }
    });

    // Notify Principals that results are ready for release
    const { createInApp } = await import("./notification.service");
    const leadership = await tDb.user.findMany({
      where: { role: { in: ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER"] }, isActive: true }
    });
    
    for (const leader of leadership) {
      await createInApp({
        tenantId,
        recipientId: leader.id,
        title: "Term Computation Complete",
        body: "The computation for " + portal.name + " has finished. Results are pending your approval to release.",
        category: "system",
        href: "/academics" // We will build a Release UI
      });
    }
  });
}

// 3. K.7 & K.8 Joint Release Workflow
export async function releaseTermResults(tenantId: string, portalId: string, releaserId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    const portal = await tDb.marksPortal.findUnique({ where: { id: portalId }, include: { term: true } });
    if (!portal || portal.status !== "PENDING_RELEASE") throw new ComputationError("Portal not ready for release");

    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { status: "RELEASED" }
    });

    // Make all underlying exams visible to parents
    await tDb.exam.updateMany({
      where: { term: portal.term!.term },
      data: { published: true }
    });

    // Notify all Teachers
    const { createInApp } = await import("./notification.service");
    const teachers = await tDb.user.findMany({ where: { role: { in: ["TEACHER", "CLASS_TEACHER"] } } });
    for (const t of teachers) {
      await createInApp({
        tenantId,
        recipientId: t.id,
        title: "Results Released",
        body: "The Principal has officially released results for " + portal.name,
        category: "system",
        href: "/academics"
      });
    }

    // K.8 — Notify parents by SMS that results are released. Real, but
    // best-effort: SMS failures must NEVER roll back the release. We message the
    // guardians of students who actually have a result in this term, deduped by
    // phone, using the shared sender (which records the SMS margin ledger, M.2).
    let smsSent = 0;
    try {
      const termResults = await tDb.examResult.findMany({
        where: { exam: { term: portal.term!.term } },
        select: { studentId: true },
      });
      const studentIds = Array.from(new Set(termResults.map((r) => r.studentId)));
      const links = studentIds.length
        ? await tDb.studentGuardian.findMany({
            where: { studentId: { in: studentIds } },
            include: { guardian: { select: { phone: true } } },
            orderBy: { isPrimary: "desc" },
          })
        : [];
      const phones = new Set<string>();
      for (const l of links) {
        if (l.guardian.phone) phones.add(l.guardian.phone);
      }
      const { sendSms } = await import("@/lib/notifications/sms");
      for (const phone of phones) {
        try {
          await sendSms(
            phone,
            `Results for ${portal.name} have been released. Log into the Parent Portal to view.`,
            { tenantId }
          );
          smsSent++;
        } catch (e) {
          console.error("K.8 parent SMS failed (non-fatal):", e);
        }
      }
    } catch (e) {
      console.error("K.8 parent SMS step skipped (non-fatal):", e);
    }

    return { success: true, smsSent };
  });
}
