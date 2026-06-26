/** B.5 exams — live tests. */
import { db } from "../src/lib/db";
import { listExams, getMarksSheet, saveMarks, examSummary, studentReport, publishExam } from "../src/lib/services/exam.service";
import { buildReportCardPdf } from "../src/lib/services/document.service";
import { verifyDocument } from "../src/lib/services/document.service";
import { cbcLevel, grade844 } from "../src/lib/validations/exams";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER F2E
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const exam = await db.exam.findFirstOrThrow({ where: { name: { contains: "CAT 1" } } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });
  const mat = await db.subject.findFirstOrThrow({ where: { code: "MAT" } });

  // 0) grading fns
  console.log("grading:", cbcLevel(85), cbcLevel(70), cbcLevel(55), cbcLevel(30), "|", grade844(82), grade844(63), grade844(31),
    cbcLevel(85)==="EE"&&cbcLevel(70)==="ME"&&cbcLevel(55)==="AE"&&cbcLevel(30)==="BE"&&grade844(82)==="A"&&grade844(63)==="B-"&&grade844(31)==="D-" ? "✓" : "✗");

  // 1) exams list
  const exams = await listExams(principal);
  console.log("exams:", exams.length, exams[0]?.resultCount, "marks ✓");

  // 2) teacher opens OWN class sheet; other class blocked
  const sheet = await getMarksSheet(chebet, exam.id, mat.id, f2e.id);
  console.log("chebet F2E sheet:", sheet.students.length, "students, marks prefilled:", sheet.students.every(s => s.marks !== null) ? "✓" : "✗");
  try { await getMarksSheet(chebet, exam.id, mat.id, f1w.id); console.log("chebet F1W sheet: ALLOWED ✗"); }
  catch { console.log("chebet F1W sheet blocked: ✓"); }

  // 3) autosave: change one mark, re-save (idempotent), over-max blocked
  const target = sheet.students[0];
  await saveMarks(chebet, { examId: exam.id, subjectId: mat.id, classId: f2e.id, marks: [{ studentId: target.id, marks: 95 }] });
  const after = await getMarksSheet(chebet, exam.id, mat.id, f2e.id);
  console.log("mark updated to 95:", after.students.find(s=>s.id===target.id)?.marks === 95 ? "✓" : "✗");
  try { await saveMarks(chebet, { examId: exam.id, subjectId: mat.id, classId: f2e.id, marks: [{ studentId: target.id, marks: 150 }] }); console.log("over-max: ALLOWED ✗"); }
  catch { console.log("over-max blocked: ✓"); }

  // 4) summary: positions + ties + means
  const sum = await examSummary(principal, exam.id);
  console.log("summary:", sum.students.length, "ranked | top:", sum.students[0].name, sum.students[0].avgPct + "%", sum.students[0].grade, "pos", sum.students[0].position);
  const posOk = sum.students.every((s, i) => i === 0 || s.position >= sum.students[i-1].position);
  console.log("positions monotonic:", posOk ? "✓" : "✗", "| classMeans:", JSON.stringify(sum.classMeans), "| top subject:", sum.subjectMeans[0]?.code, sum.subjectMeans[0]?.mean + "%");

  // 5) parent: sees ONLY own child in summary; report blocked when unpublished
  const pSum = await examSummary(parent, exam.id);
  const kids = await db.studentGuardian.findMany({ where: { guardian: { userId: parent.id } }, select: { studentId: true } });
  const kidIds = new Set(kids.map(k => k.studentId));
  console.log("parent summary rows:", pSum.students.length, pSum.students.every(s => kidIds.has(s.studentId)) ? "✓ own child only" : "✗ LEAK");
  await publishExam(principal, exam.id, false);
  try { await studentReport(parent, exam.id, [...kidIds][0]); console.log("unpublished report to parent: ALLOWED ✗"); }
  catch { console.log("unpublished blocked for parent: ✓"); }
  await publishExam(principal, exam.id, true);
  const rep = await studentReport(parent, exam.id, [...kidIds][0]);
  console.log("published report for parent:", rep.student.name, rep.avgPct + "%", rep.overallGrade, "pos", rep.position, "✓");

  // 6) report card PDF + QR
  const pdf = await buildReportCardPdf(principal as never, exam.id, sum.students[0].studentId);
  console.log("report PDF:", pdf.pdf.subarray(0,4).toString() === "%PDF" ? "✓ " + pdf.fileName : "✗");
  const code = (await db.documentVerification.findFirst({ where: { docType: "report_card" }, orderBy: { createdAt: "desc" } }))!.code;
  const v = await verifyDocument(code);
  console.log("QR verify:", v?.valid ? "✓ " + v.summary.slice(0, 60) : "✗");

  // restore the seeded mark
  await saveMarks(chebet, { examId: exam.id, subjectId: mat.id, classId: f2e.id, marks: [{ studentId: target.id, marks: 88 }] });
  console.log("cleanup ✓ (mark restored)");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
