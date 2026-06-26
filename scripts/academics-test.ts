/** B.4 academics — live tests. */
import { db } from "../src/lib/db";
import { listSubjects, createSubject, listTerms, currentTerm, setSlot, autoFill, getTimetable, teacherTimetable, createLessonPlan, listLessonPlans, setLessonStatus } from "../src/lib/services/academics.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const chebet = (await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });

  // 1) subjects seeded + dup code blocked
  const subs = await listSubjects(principal);
  console.log("subjects:", subs.length, subs.length >= 9 ? "✓" : "✗");
  try { await createSubject(principal, { name: "Maths 2", code: "MAT", curriculum: "BOTH" }); console.log("dup code: ALLOWED ✗"); }
  catch { console.log("dup subject code blocked: ✓"); }

  // 2) terms + current
  const terms = await listTerms(principal);
  const cur = await currentTerm(principal.tenantId);
  console.log("terms:", terms.length, "| current:", cur ? `T${cur.term} ${cur.year} ✓` : "✗ none");

  // 3) timetable seeded + teacher view
  const res = await getTimetable(principal, f2e.id);
  const tt = res.slots;
  console.log("F2E slots:", tt.length, tt.length === 8 ? "✓" : "✗");
  const chebetTT = await teacherTimetable(principal, chebet.id);
  console.log("Chebet teaches:", chebetTT.length, "periods", chebetTT.every(s => s.subjectCode === "MAT") ? "✓ MAT only" : "✗");

  // 4) CONFLICT: same teacher same time in another class
  const mat = subs.find(s => s.code === "MAT")!;
  try {
    await setSlot(principal, { classId: f1w.id, subjectId: mat.id, teacherId: chebet.id, dayOfWeek: 1, period: 1 });
    console.log("teacher double-booking: ALLOWED ✗ FAIL");
  } catch (e) { console.log("teacher double-booking blocked: ✓", (e as Error).message.slice(0, 70)); }

  // 5) autofill F1W: 5 MAT + 4 ENG + 3 BIO, MAT taught by Chebet (must avoid her busy P1 Mon + P2 Tue)
  const eng = subs.find(s => s.code === "ENG")!; const bio = subs.find(s => s.code === "BIO")!;
  const result = await autoFill(principal, { classId: f1w.id, weeklyLoad: { [mat.id]: 5, [eng.id]: 4, [bio.id]: 3 }, teachers: { [mat.id]: chebet.id }, clearExisting: true });
  console.log("autofill placed:", result.placed, "/12, unplaced:", result.unplaced.length, result.placed === 12 ? "✓" : "✗");
  const resF1 = await getTimetable(principal, f1w.id);
  const f1tt = resF1.slots;
  const matSlots = f1tt.filter(s => s.subjectCode === "MAT");
  const clash = matSlots.some(s => (s.dayOfWeek === 1 && s.period === 1) || (s.dayOfWeek === 2 && s.period === 2));
  console.log("autofill avoided Chebet's busy periods:", clash ? "✗ CLASH" : "✓");
  const matDays = new Set(matSlots.map(s => s.dayOfWeek));
  console.log("MAT spread over days:", matDays.size, matDays.size === 5 ? "✓ one per day" : "(doubles allowed)");

  // 6) lesson plans: teacher own-scoping
  const plan = await createLessonPlan(chebet, { subjectId: mat.id, classId: f2e.id, date: "2026-06-15", topic: "Indices test review" });
  const chebetPlans = await listLessonPlans(chebet, {});
  console.log("chebet sees own plans only:", chebetPlans.every(p => p.teacherId === chebet.id) ? "✓ " + chebetPlans.length : "✗");
  const allPlans = await listLessonPlans(principal, {});
  console.log("principal sees all:", allPlans.length >= chebetPlans.length ? "✓" : "✗");
  await setLessonStatus(chebet, plan.id, "TAUGHT");
  // principal-owned plan: chebet cannot touch
  const pPlan = await createLessonPlan(principal, { subjectId: eng.id, classId: f2e.id, date: "2026-06-16", topic: "Essay writing" });
  try { await setLessonStatus(chebet, pPlan.id, "SKIPPED"); console.log("chebet edits others' plan: ALLOWED ✗"); }
  catch { console.log("chebet edits others' plan blocked: ✓"); }

  // cleanup: remove autofill slots + test plans (keep seed)
  await db.timetableSlot.deleteMany({ where: { classId: f1w.id } });
  await db.lessonPlan.deleteMany({ where: { id: { in: [plan.id, pPlan.id] } } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
