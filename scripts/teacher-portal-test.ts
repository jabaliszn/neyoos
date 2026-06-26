/** B.12 Teacher Portal — live tests (service-level). */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  teacherHome, teacherClassIds, listHomework, createHomework, deleteHomework,
  listNotes, createNote, deleteNote, classReport,
} from "../src/lib/services/teacher-portal.service";
import { childDetail, myChildren } from "../src/lib/services/parent-portal.service";
import { teacherTimetable } from "../src/lib/services/academics.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER F2E + on timetable
  const njoroge = await asUser("p.njoroge@karibuhigh.ac.ke"); // TEACHER, no class, not on timetable
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");

  // 1) scoping: chebet -> F2E only; njoroge -> fail-closed; principal -> unrestricted
  const cIds = await withTenant(chebet.tenantId, () => teacherClassIds(chebet));
  const nIds = await withTenant(njoroge.tenantId, () => teacherClassIds(njoroge));
  const pIds = await withTenant(principal.tenantId, () => teacherClassIds(principal));
  console.log("scope chebet:", cIds?.length === 1 ? "✓ 1 class" : "✗ " + JSON.stringify(cIds));
  console.log("scope njoroge (no class):", nIds?.length === 1 && nIds[0] === "__none__" ? "✓ fail-closed" : "✗ " + JSON.stringify(nIds));
  console.log("scope principal:", pIds === null ? "✓ unrestricted" : "✗");

  // 2) teacher home: classes + today's lessons + own timetable
  const home = await teacherHome(chebet);
  const f2e = home.classes[0];
  console.log("home: classes", home.classes.length, "| F2E students", f2e?.students,
    home.classes.length === 1 && f2e?.students === 3 && f2e.isClassTeacher ? "✓" : "✗");
  const tt = await teacherTimetable(chebet, chebet.id);
  console.log("own timetable slots:", tt.length, tt.length === 2 ? "✓ (MAT Mon P1 + Tue P2)" : "✗");

  // 3) homework: chebet assigns -> parent sees it on family portal
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: chebet.tenantId, code: "ENG" } });
  const due = new Date(Date.now() + 3 * 3600_000 + 3 * 24 * 3600_000).toISOString().slice(0, 10);
  const hw = await createHomework(chebet, {
    classId: f2e.id, subjectId: subject.id,
    title: "Read 'The River and the Source' Ch. 3-4", instructions: "Summary notes per chapter.", dueDate: due,
  });
  console.log("homework created ✓", hw.id.slice(0, 8));
  const hwList = await listHomework(chebet, { classId: f2e.id });
  console.log("teacher list:", hwList.length >= 2 ? `✓ ${hwList.length} (seed + new)` : "✗");

  const kids = await myChildren(parent);
  const detail = await childDetail(parent, kids[0].id);
  const seen = detail.homework.find((h) => h.id === hw.id);
  console.log("parent portal sees homework:", seen ? "✓ " + seen.title.slice(0, 25) : "✗ NOT VISIBLE");
  console.log("portal notes present:", detail.notes.length >= 1 ? `✓ ${detail.notes.length} (${detail.notes[0].fileName})` : "✗");

  // 4) njoroge (not his class) cannot assign to F2E
  try {
    await createHomework(njoroge, { classId: f2e.id, subjectId: subject.id, title: "Should fail here", dueDate: due });
    console.log("njoroge assign to F2E: ALLOWED ✗ LEAK");
  } catch { console.log("njoroge assign to F2E blocked: ✓"); }

  // 5) past due date rejected
  try {
    await createHomework(chebet, { classId: f2e.id, subjectId: subject.id, title: "Past due test", dueDate: "2020-01-01" });
    console.log("past dueDate: ALLOWED ✗");
  } catch { console.log("past dueDate rejected: ✓"); }

  // 6) only the assigning teacher may delete (principal CAN — leadership)
  try {
    await deleteHomework(njoroge, hw.id);
    console.log("njoroge delete chebet's hw: ALLOWED ✗");
  } catch { console.log("njoroge delete chebet's hw blocked: ✓"); }

  // 7) notes: create + njoroge blocked + delete own
  const note = await createNote(chebet, {
    classId: f2e.id, subjectId: subject.id, title: "Essay structure cheat-sheet",
    fileUrl: "/api/files/serve?key=test", fileName: "essay-cheatsheet.pdf",
  });
  const noteList = await listNotes(chebet, { classId: f2e.id });
  console.log("notes list:", noteList.length >= 2 ? `✓ ${noteList.length}` : "✗");
  try {
    await deleteNote(njoroge, note.id);
    console.log("njoroge delete chebet's note: ALLOWED ✗");
  } catch { console.log("njoroge delete chebet's note blocked: ✓"); }

  // 8) class report: roster + attendance + latest exam; njoroge blocked
  const report = await classReport(chebet, f2e.id);
  console.log("class report:", report.summary.students === 3 && report.summary.attendancePct30d !== null && report.summary.latestExam
    ? `✓ 3 students · att ${report.summary.attendancePct30d}% · ${report.summary.latestExam.name} mean ${report.summary.latestExam.meanPct}%`
    : "✗ " + JSON.stringify(report.summary));
  const flagged = report.students.filter((s) => s.absences30d > 0).length;
  console.log("per-student absences tracked:", flagged >= 1 ? `✓ ${flagged} student(s) with absences` : "✗");
  try {
    await classReport(njoroge, f2e.id);
    console.log("njoroge report on F2E: ALLOWED ✗");
  } catch { console.log("njoroge report on F2E blocked: ✓"); }

  // 9) principal oversight: sees all homework without restriction
  const allHw = await listHomework(principal);
  console.log("principal sees all homework:", allHw.length >= 2 ? "✓" : "✗");

  // cleanup test rows (keep seed rows)
  await db.homework.delete({ where: { id: hw.id } });
  await db.classNote.delete({ where: { id: note.id } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
