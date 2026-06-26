/** B.20 Discipline — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  reportIncident, listIncidents, behaviorBoard, issueSuspension, listSuspensions,
  completeSuspension, addCounselingNote, listCounselingNotes, childDiscipline,
} from "../src/lib/services/discipline.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  // Self-heal: reset discipline tables + quota, reseed.
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.disciplineIncident.deleteMany({ where: { tenantId: t.id } });
  await db.suspension.deleteMany({ where: { tenantId: t.id } });
  await db.counselingNote.deleteMany({ where: { tenantId: t.id } });
  await db.usageCounter.updateMany({ where: { tenantId: t.id, metric: "smsPerTerm" }, data: { used: 1240 } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });

  const deputy = await asUser("deputy@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER F2E
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");

  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } }); // F2E
  const wanjiru = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Wanjiru" } }); // F1W — NOT chebet's
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

  // 1) seeded incidents
  const incidents = await listIncidents(deputy);
  console.log("seeded incidents:", incidents.length === 2 ? "✓ 2 (Kamau)" : "✗ " + incidents.length);

  // 2) teacher reports MINOR for own class — no SMS
  const minor = await reportIncident(chebet, {
    studentId: achieng.id, date: today, category: "LATENESS", severity: "MINOR",
    description: "Late to the Mathematics lesson by 15 minutes.",
  });
  console.log("minor incident:", minor.points === 1 && !minor.parentNotified ? "✓ 1pt, no SMS" : "✗ " + JSON.stringify(minor));

  // 3) MAJOR -> auto parent SMS + quota recorded
  const before = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  const major = await reportIncident(deputy, {
    studentId: achieng.id, date: today, category: "BULLYING", severity: "MAJOR",
    description: "Took a Form 1 student's lunch money at break.",
    actionTaken: "Money returned; referred for counseling",
  });
  const after = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  console.log("major incident SMS:", major.parentNotified && (after?.used ?? 0) === (before?.used ?? 0) + 1 ? "✓ parent SMS + quota +1" : "✗ " + JSON.stringify(major));

  // 4) teacher CANNOT report outside their class
  try {
    await reportIncident(chebet, { studentId: wanjiru.id, date: today, category: "LATENESS", severity: "MINOR", description: "Should fail — not her class." });
    console.log("teacher outside class: ALLOWED ✗");
  } catch { console.log("teacher outside class blocked: ✓"); }

  // 5) behavior board: Achieng 1+3=4 -> WATCH; Kamau 1+3=4 -> WATCH
  const board = await behaviorBoard(deputy);
  const aRow = board.find((b) => b.studentName.includes("Achieng"))!;
  console.log("behavior board:", aRow.points === 4 && aRow.status === "WATCH" ? "✓ Achieng 4pts WATCH" : "✗ " + JSON.stringify(aRow));

  // 6) suspension: teacher blocked; deputy issues w/ parent SMS; dup blocked
  try {
    await issueSuspension(chebet, { studentId: achieng.id, startDate: today, endDate: today, reason: "Should fail — teachers can't suspend." });
    console.log("teacher suspend: ALLOWED ✗");
  } catch { console.log("teacher suspend blocked: ✓"); }
  const endDate = new Date(Date.now() + 3 * 3600_000 + 7 * 24 * 3600_000).toISOString().slice(0, 10);
  const susp = await issueSuspension(deputy, {
    studentId: achieng.id, startDate: today, endDate,
    reason: "Bullying — second major incident", conditions: "Return with a parent",
  });
  console.log("suspension:", susp.parentNotified ? "✓ issued + parent SMS" : "✗");
  try {
    await issueSuspension(deputy, { studentId: achieng.id, startDate: today, endDate, reason: "Duplicate should fail." });
    console.log("dup suspension: ALLOWED ✗");
  } catch { console.log("dup active suspension blocked: ✓"); }
  const susps = await listSuspensions(deputy);
  console.log("effective flag:", susps.find((s) => s.id === susp.id)?.effective ? "✓ suspended now" : "✗");

  // 7) CONFIDENTIAL counseling: deputy writes; teacher/bursar BLOCKED from reading
  await addCounselingNote(deputy, {
    studentId: achieng.id, date: today, sessionType: "INDIVIDUAL",
    note: "Discussed the bullying incident; explored home stressors. Achieng committed to a written apology.",
    followUpOn: endDate,
  });
  const notes = await listCounselingNotes(deputy, achieng.id);
  console.log("counseling note saved:", notes.length === 1 ? "✓" : "✗");
  try { await listCounselingNotes(chebet); console.log("teacher reads counseling: ALLOWED ✗ LEAK"); }
  catch { console.log("teacher blocked from counseling: ✓"); }
  try { await listCounselingNotes(bursar); console.log("bursar reads counseling: ALLOWED ✗ LEAK"); }
  catch { console.log("bursar blocked from counseling: ✓"); }
  // audit must NOT contain the note text
  const auditRow = await db.auditLog.findFirst({ where: { tenantId: t.id, action: "discipline.counseling_added" }, orderBy: { createdAt: "desc" } });
  console.log("audit hides note content:", auditRow && !auditRow.metadata?.includes("apology") ? "✓ confidential" : "✗ LEAK");

  // 8) family portal: parent sees own child's incidents + suspensions, NEVER counseling
  const childView = await childDiscipline(parent, achieng.id);
  console.log("parent sees incidents:", childView.incidents.length >= 2 && childView.suspensions.length === 1 ? "✓ incidents + suspension" : "✗");
  console.log("no counseling in payload:", !("counseling" in childView) && !JSON.stringify(childView).includes("apology") ? "✓" : "✗ LEAK");
  const kamau = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Kamau" } });
  try { await childDiscipline(parent, kamau.id); console.log("other family: ALLOWED ✗ LEAK"); }
  catch { console.log("other-family discipline blocked: ✓"); }

  // 9) close suspension + double close
  await completeSuspension(deputy, susp.id);
  try { await completeSuspension(deputy, susp.id); console.log("double close: ALLOWED ✗"); }
  catch { console.log("double close blocked: ✓"); }

  // cleanup test rows beyond seed
  await db.disciplineIncident.deleteMany({ where: { tenantId: t.id, studentId: achieng.id } });
  await db.suspension.deleteMany({ where: { tenantId: t.id } });
  await db.counselingNote.deleteMany({ where: { tenantId: t.id } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
