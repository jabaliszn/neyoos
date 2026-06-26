/** B.13 LMS — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  submitHomework, submissionsForHomework, gradeSubmission,
  createQuiz, publishQuiz, listQuizzesForTeacher, quizResults,
  quizzesForStudent, getQuizPaper, submitQuizAttempt,
  listThreads, createThread, getThread, addPost, lockThread,
} from "../src/lib/services/lms.service";
import { childDetail } from "../src/lib/services/parent-portal.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER F2E
  const njoroge = await asUser("p.njoroge@karibuhigh.ac.ke"); // TEACHER, no class
  const parent = await asUser("parent@karibuhigh.ac.ke"); // Achieng's parent
  const achieng = await asUser("achieng@karibuhigh.ac.ke"); // STUDENT login
  const principal = await asUser("principal@karibuhigh.ac.ke");

  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 2", stream: "East" } });
  const hw = await db.homework.findFirstOrThrow({ where: { tenantId: t.id, classId: f2e.id } });
  const achiengStudent = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const wanjiru = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Wanjiru" } }); // F1W — other class
  const mat = await db.subject.findFirstOrThrow({ where: { tenantId: t.id, code: "MAT" } });

  // ===== 1) HOMEWORK SUBMISSIONS =====
  // Achieng (STUDENT login) hands in her own work
  const sub = await submitHomework(achieng, { homeworkId: hw.id, text: "Q1-8 done. Q5: x=3 or x=2 by completing the square." });
  console.log("student hand-in:", sub.id ? "✓" : "✗", "| late:", sub.late);

  // teacher sees roster + submissions
  const sheet = await submissionsForHomework(chebet, hw.id);
  const achiengRow = sheet.students.find((s) => s.studentId === achiengStudent.id);
  console.log("teacher sheet:", sheet.students.length === 3 && achiengRow?.submission ? `✓ 3 students, ${sheet.submitted} handed in` : "✗");

  // njoroge (not his class) blocked from the sheet
  try { await submissionsForHomework(njoroge, hw.id); console.log("njoroge sheet: ALLOWED ✗"); }
  catch { console.log("njoroge sheet blocked: ✓"); }

  // grade -> family sees grade + feedback on the portal
  await gradeSubmission(chebet, { submissionId: achiengRow!.submission!.id, gradePct: 85, feedback: "Vizuri sana! Q5 layout was clean." });
  const detail = await childDetail(parent, achiengStudent.id);
  const hwOnPortal = detail.homework.find((h) => h.id === hw.id);
  console.log("portal shows grade:", hwOnPortal?.submission?.gradePct === 85 ? "✓ 85% + feedback" : "✗ " + JSON.stringify(hwOnPortal?.submission));

  // graded -> resubmission locked
  try { await submitHomework(achieng, { homeworkId: hw.id, text: "changed my mind" }); console.log("resubmit after grade: ALLOWED ✗"); }
  catch { console.log("resubmit after grade blocked: ✓"); }

  // ===== 2) QUIZZES =====
  const seededQuiz = await db.quiz.findFirstOrThrow({ where: { tenantId: t.id, classId: f2e.id } });

  // paper has NO correctIndex
  const paper = await getQuizPaper(parent, seededQuiz.id, achiengStudent.id);
  const leaked = JSON.stringify(paper).includes("correctIndex");
  console.log("paper hides answers:", !leaked && paper.questions.length === 3 ? "✓ 3 questions, no correctIndex" : "✗ LEAK");

  // attempt -> server-side auto-grade (all correct = 100%)
  const result = await submitQuizAttempt(parent, { quizId: seededQuiz.id, answers: [0, 0, 0] }, achiengStudent.id);
  console.log("auto-grade:", result.scorePct === 100 && result.score === 3 ? "✓ 3/3 = 100%" : "✗ " + JSON.stringify(result));
  console.log("review reveals corrections:", result.review.length === 3 && result.review[0].correctIndex === 0 ? "✓" : "✗");

  // one attempt only
  try { await submitQuizAttempt(parent, { quizId: seededQuiz.id, answers: [1, 1, 1] }, achiengStudent.id); console.log("second attempt: ALLOWED ✗"); }
  catch { console.log("second attempt blocked: ✓"); }

  // student list shows the score; wanjiru (other class) can't see this quiz
  const list = await quizzesForStudent(parent, achiengStudent.id);
  console.log("student quiz list:", list.length >= 1 && list[0].attempt?.scorePct === 100 ? "✓ shows 100%" : "✗");
  try { await getQuizPaper(parent, seededQuiz.id, wanjiru.id); console.log("other-family paper: ALLOWED ✗ LEAK"); }
  catch { console.log("other-family paper blocked: ✓"); }

  // teacher results + draft gate
  const res = await quizResults(chebet, seededQuiz.id);
  console.log("teacher results:", res.attempted >= 2 && res.avgPct !== null ? `✓ ${res.attempted} attempted, avg ${res.avgPct}%` : "✗ " + JSON.stringify({ a: res.attempted }));
  const draft = await createQuiz(chebet, {
    classId: f2e.id, subjectId: mat.id, title: "Draft quiz — not visible",
    questions: [{ prompt: "1+1?", options: ["2", "3"], correctIndex: 0 }],
  });
  const listAfterDraft = await quizzesForStudent(parent, achiengStudent.id);
  console.log("draft hidden from students:", listAfterDraft.find((q) => q.id === draft.id) ? "✗ VISIBLE" : "✓");
  await publishQuiz(chebet, draft.id, true);
  const listAfterPublish = await quizzesForStudent(parent, achiengStudent.id);
  console.log("publish gate works:", listAfterPublish.find((q) => q.id === draft.id) ? "✓ visible after publish" : "✗");

  // njoroge can't create a quiz for F2E
  try {
    await createQuiz(njoroge, { classId: f2e.id, subjectId: mat.id, title: "Should fail", questions: [{ prompt: "?", options: ["a", "b"], correctIndex: 0 }] });
    console.log("njoroge quiz on F2E: ALLOWED ✗");
  } catch { console.log("njoroge quiz on F2E blocked: ✓"); }

  // teacher list (principal oversight = all)
  const tQuizzes = await listQuizzesForTeacher(principal);
  console.log("principal sees quizzes:", tQuizzes.length >= 2 ? "✓" : "✗");

  // ===== 3) FORUM =====
  const threads = await listThreads(achieng, f2e.id);
  console.log("student reads forum:", threads.length >= 1 ? `✓ ${threads.length} thread(s)` : "✗");

  // wanjiru's family (no login user) -> use njoroge teacher scope instead: njoroge has no classes
  try { await listThreads(njoroge, f2e.id); console.log("njoroge forum: ALLOWED ✗"); }
  catch { console.log("njoroge forum blocked: ✓"); }

  // student replies; teacher locks; reply then blocked
  const tThread = threads[0];
  await addPost(achieng, { threadId: tThread.id, body: "Asante madam — nimeelewa sasa." });
  await lockThread(chebet, tThread.id, true);
  try { await addPost(achieng, { threadId: tThread.id, body: "one more thing" }); console.log("post on locked: ALLOWED ✗"); }
  catch { console.log("post on locked blocked: ✓"); }
  // student cannot lock (route gate blocks; service would too via assertTeacherClass -> teacherClassIds(STUDENT) ... verify)
  const detail2 = await getThread(achieng, tThread.id);
  console.log("locked thread readable:", detail2.locked && detail2.posts.length >= 2 ? "✓ (read-only)" : "✗");
  await lockThread(chebet, tThread.id, false); // restore

  // parent can create a thread in own child's class; not in another class
  const pThread = await createThread(parent, { classId: f2e.id, title: "PTA question", body: "When is the next parents' meeting?" });
  console.log("parent thread: ✓", pThread.id.slice(0, 8));
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 1", stream: "West" } });
  try { await createThread(parent, { classId: f1w.id, title: "x", body: "y" }); console.log("parent thread other class: ALLOWED ✗"); }
  catch { console.log("parent thread other class blocked: ✓"); }

  // ===== cleanup test rows (keep seed) =====
  await db.quizAttempt.deleteMany({ where: { quizId: draft.id } });
  await db.quizQuestion.deleteMany({ where: { quizId: draft.id } });
  await db.quiz.delete({ where: { id: draft.id } });
  await db.forumPost.deleteMany({ where: { threadId: pThread.id } });
  await db.forumThread.delete({ where: { id: pThread.id } });
  // keep achieng's graded submission + 100% attempt: nice demo data, idempotent reseed clears them
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
