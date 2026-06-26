/** B.6 CBC — live tests. */
import { db } from "../src/lib/db";
import { listStrands, createStrand, getAssessSheet, saveAssessments, studentCompetencies } from "../src/lib/services/cbc.service";
import { buildCbcReportPdf, verifyDocument } from "../src/lib/services/document.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });

  // 1) strands seeded + dup blocked
  const strands = await listStrands(principal);
  console.log("strands:", strands.length, strands.length >= 3 ? "✓" : "✗");
  const eng = await db.subject.findFirstOrThrow({ where: { code: "ENGC" } });
  try { await createStrand(principal, { subjectId: eng.id, name: "Reading" }); console.log("dup strand: ALLOWED ✗"); }
  catch { console.log("dup strand blocked: ✓"); }

  // 2) teacher sheet own class; other blocked
  const reading = strands.find(s => s.name === "Reading")!;
  const sheet = await getAssessSheet(chebet, reading.id, f2e.id);
  console.log("sheet students:", sheet.students.length, "| latest levels prefilled:", sheet.students.some(s => s.latest) ? "✓" : "✗");
  try { await getAssessSheet(chebet, reading.id, f1w.id); console.log("other class: ALLOWED ✗"); }
  catch { console.log("other class blocked: ✓"); }

  // 3) record a new round (history kept, not overwritten)
  const before = await db.cbcAssessment.count({ where: { strandId: reading.id } });
  await saveAssessments(chebet, { strandId: reading.id, date: "2026-06-11", entries: sheet.students.map(s => ({ studentId: s.id, level: 3 })) }, f2e.id);
  const after = await db.cbcAssessment.count({ where: { strandId: reading.id } });
  console.log("history kept (rows grew):", after === before + sheet.students.length ? "✓ " + before + "->" + after : "✗");

  // 4) competency profile aggregates LATEST per strand
  const prof = await studentCompetencies(principal, sheet.students[0].id);
  console.log("profile areas:", prof.subjects.length, "| total obs:", prof.totalAssessments);
  const readingNow = prof.subjects[0].strands.find(s => s.strand === "Reading");
  console.log("latest level used (3/ME):", readingNow?.code === "ME" ? "✓" : "✗ " + readingNow?.code);
  console.log("parent-friendly line:", readingNow?.parentFriendly?.includes("expected") ? "✓" : "✗");

  // 5) parent: own child only
  const kids = await db.studentGuardian.findMany({ where: { guardian: { userId: parent.id } }, select: { studentId: true } });
  const kidId = kids[0].studentId;
  const other = sheet.students.find(s => s.id !== kidId);
  await studentCompetencies(parent, kidId); // should work
  try { if (other) { await studentCompetencies(parent, other.id); console.log("parent other child: ALLOWED ✗"); } }
  catch { console.log("parent other child blocked: ✓"); }

  // 6) KICD PDF + QR
  const pdf = await buildCbcReportPdf(principal, prof);
  console.log("CBC PDF:", pdf.pdf.subarray(0, 4).toString() === "%PDF" ? "✓ " + pdf.fileName : "✗");
  const code = (await db.documentVerification.findFirst({ where: { docType: "cbc_report" }, orderBy: { createdAt: "desc" } }))!.code;
  const v = await verifyDocument(code);
  console.log("QR verify:", v?.valid ? "✓" : "✗");

  // cleanup the round added in (3)
  await db.cbcAssessment.deleteMany({ where: { strandId: reading.id, date: "2026-06-11", level: 3 } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
