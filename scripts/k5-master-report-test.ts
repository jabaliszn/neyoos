/**
 * K.5 full-stack test — Master Term Report aggregation (MasterReportCard).
 *
 * Proves against the live SQLite DB:
 *  1. Default (no rule) -> simple average of the term's exams per subject;
 *     writes one MasterReportCard row per (student, subject) + an overall summary
 *     row per student with the term mean.
 *  2. Ranks are computed per (class, subject) and overall per class.
 *  3. A TermAggregationRule (e.g. CAT 30% + Exam 70%) is applied as a weighted
 *     average instead of a plain average.
 *  4. Re-running is idempotent (no duplicates).
 *  5. CBC level is set when the curriculum engine is ON; letter grade always set.
 *
 * Creates a clean isolated scenario (its own students/class/exams) and removes
 * everything afterwards. Restores curriculum-engine setting.
 */
import { PrismaClient } from "@prisma/client";
import { computeMasterReportCards } from "../src/lib/services/computation-engine.service";

const db = new PrismaClient();
let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`); }
}

async function setEngine(value: boolean) {
  await db.platformSetting.upsert({
    where: { key: "enable_curriculum_engine" },
    create: { key: "enable_curriculum_engine", value: value ? "true" : "false" },
    update: { value: value ? "true" : "false" },
  });
}

async function main() {
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error("tenant not found");
  const tid = t.id;
  const TERMNO = 3; // use a term unlikely to collide with seeded term-2 data

  const original = await db.platformSetting.findUnique({ where: { key: "enable_curriculum_engine" } });
  const originalValue = original?.value ?? null;

  // --- build an isolated scenario ---
  const term = await db.academicTerm.create({ data: { tenantId: tid, year: 2099, term: TERMNO, current: false, startDate: "2099-09-01", endDate: "2099-11-30" } });
  const cls = await db.schoolClass.create({ data: { tenantId: tid, level: "TESTF9", stream: "Z", curriculum: "8-4-4" } });
  const subj = await db.subject.create({ data: { tenantId: tid, name: "TEST-Math", code: `TM${Date.now()%100000}`, curriculum: "8-4-4" } });

  const sA = await db.student.create({ data: { tenantId: tid, admissionNo: `TST-A-${Date.now()}`, firstName: "Aaa", lastName: "Test", gender: "M", classId: cls.id } });
  const sB = await db.student.create({ data: { tenantId: tid, admissionNo: `TST-B-${Date.now()}`, firstName: "Bbb", lastName: "Test", gender: "F", classId: cls.id } });

  // Two exams in the term: a CAT and an end-term EXAM.
  const cat = await db.exam.create({ data: { tenantId: tid, name: "TEST CAT", year: 2099, term: TERMNO, type: "CAT", maxMarks: 100 } });
  const endterm = await db.exam.create({ data: { tenantId: tid, name: "TEST EndTerm", year: 2099, term: TERMNO, type: "EXAM", maxMarks: 100 } });

  // Student A: CAT 60, Exam 80  -> avg 70 ; weighted (30/70) = 60*0.3+80*0.7 = 74
  // Student B: CAT 90, Exam 70  -> avg 80 ; weighted = 90*0.3+70*0.7 = 76
  const principal = await db.user.findFirst({ where: { tenantId: tid, role: "PRINCIPAL" } });
  const eid = principal!.id;
  await db.examResult.createMany({ data: [
    { tenantId: tid, examId: cat.id, studentId: sA.id, subjectId: subj.id, marks: 60, enteredById: eid },
    { tenantId: tid, examId: endterm.id, studentId: sA.id, subjectId: subj.id, marks: 80, enteredById: eid },
    { tenantId: tid, examId: cat.id, studentId: sB.id, subjectId: subj.id, marks: 90, enteredById: eid },
    { tenantId: tid, examId: endterm.id, studentId: sB.id, subjectId: subj.id, marks: 70, enteredById: eid },
  ]});

  const createdRuleIds: string[] = [];

  try {
    // === 1) Default: simple average, engine ON ===
    await setEngine(true);
    const n1 = await computeMasterReportCards(tid, term.id);
    check("Writes one subject row per (student, subject)", n1 === 2);

    const aSubj = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sA.id, subjectId: subj.id } });
    const bSubj = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sB.id, subjectId: subj.id } });
    check("Student A simple average = 70", aSubj?.finalMark === 70);
    check("Student B simple average = 80", bSubj?.finalMark === 80);
    check("Default aggregation marked traditional (no rule)", aSubj?.isTraditional === true);
    check("CBC level set when curriculum engine ON (A: 70 -> level 3)", aSubj?.cbcLevel === 3);
    check("Letter grade always set (A: 70 -> B+)", aSubj?.letterGrade === "B+");

    // subject rank: B(80) is 1st, A(70) is 2nd
    check("Per-subject rank computed (B=1, A=2 of 2)", bSubj?.rank === 1 && aSubj?.rank === 2 && aSubj?.outOf === 2);

    // overall summary rows
    const aSum = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sA.id, subjectId: null } });
    const bSum = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sB.id, subjectId: null } });
    check("Overall summary row per student (mean = single-subject mark)", aSum?.finalMark === 70 && bSum?.finalMark === 80);
    check("Overall class position computed (B=1, A=2)", bSum?.rank === 1 && aSum?.rank === 2);

    // === 2) Weighted rule: CAT 30% + Exam 70% ===
    const rule = await db.termAggregationRule.create({
      data: {
        tenantId: tid, classId: cls.id, subjectId: subj.id, isTraditional: false,
        weightingsJson: JSON.stringify([
          { sourceType: "EXAM", sourceId: cat.id, weightPct: 30 },
          { sourceType: "EXAM", sourceId: endterm.id, weightPct: 70 },
        ]),
      },
    });
    createdRuleIds.push(rule.id);

    await computeMasterReportCards(tid, term.id);
    const aW = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sA.id, subjectId: subj.id } });
    const bW = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sB.id, subjectId: subj.id } });
    check("Weighted rule applied for A (60*0.3+80*0.7 = 74)", aW?.finalMark === 74 && aW?.isTraditional === false);
    check("Weighted rule applied for B (90*0.3+70*0.7 = 76)", bW?.finalMark === 76 && bW?.isTraditional === false);

    // === 3) idempotent ===
    const before = await db.masterReportCard.count({ where: { tenantId: tid, termId: term.id } });
    await computeMasterReportCards(tid, term.id);
    const after = await db.masterReportCard.count({ where: { tenantId: tid, termId: term.id } });
    check("Re-running is idempotent (no duplicate rows)", before === after);

    // === 4) engine OFF -> no CBC level ===
    await setEngine(false);
    await computeMasterReportCards(tid, term.id);
    const aOff = await db.masterReportCard.findFirst({ where: { tenantId: tid, termId: term.id, studentId: sA.id, subjectId: subj.id } });
    check("With curriculum engine OFF, CBC level is null (letter grade stays)", aOff?.cbcLevel === null && aOff?.letterGrade != null);
  } finally {
    // cleanup
    await db.masterReportCard.deleteMany({ where: { tenantId: tid, termId: term.id } }).catch(() => {});
    for (const id of createdRuleIds) await db.termAggregationRule.delete({ where: { id } }).catch(() => {});
    await db.examResult.deleteMany({ where: { examId: { in: [cat.id, endterm.id] } } }).catch(() => {});
    await db.exam.deleteMany({ where: { id: { in: [cat.id, endterm.id] } } }).catch(() => {});
    await db.student.deleteMany({ where: { id: { in: [sA.id, sB.id] } } }).catch(() => {});
    await db.subject.delete({ where: { id: subj.id } }).catch(() => {});
    await db.schoolClass.delete({ where: { id: cls.id } }).catch(() => {});
    await db.academicTerm.delete({ where: { id: term.id } }).catch(() => {});
    if (originalValue === null) await db.platformSetting.delete({ where: { key: "enable_curriculum_engine" } }).catch(() => {});
    else await db.platformSetting.update({ where: { key: "enable_curriculum_engine" }, data: { value: originalValue } }).catch(() => {});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("  \u2705 K.5 master report all green");
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
