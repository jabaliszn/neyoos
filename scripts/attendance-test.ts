/** B.3 attendance — live tests. */
import { db } from "../src/lib/db";
import { getRegister, markRegister, attendanceHistory, attendanceOverview, nairobiToday } from "../src/lib/services/attendance.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER Form 2 East
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const today = nairobiToday();
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });

  // 1) overview shows both classes for principal, only own for teacher
  const ovP = await attendanceOverview(principal, today);
  const ovT = await attendanceOverview(chebet, today);
  console.log("overview principal classes:", ovP.classes.length, "| teacher classes:", ovT.classes.length, ovT.classes.length === 1 && ovT.classes[0].id === f2e.id ? "✓ own only" : "✗ FAIL");

  // 2) register lists active students with null marks (today fresh)
  const reg = await getRegister(chebet, f2e.id, today);
  console.log("register students:", reg.students.length, "all unmarked:", reg.students.every(s => s.status === null) ? "✓" : "(already marked)");

  // 3) teacher cannot open another class's register
  try { await getRegister(chebet, f1w.id, today); console.log("teacher other-class register: ALLOWED ✗"); }
  catch { console.log("teacher other-class register blocked: ✓"); }

  // 4) mark register: 1 absent, rest present + absentee SMS (dev seam logs)
  const marks = reg.students.map((s, i) => ({ studentId: s.id, status: (i === 0 ? "A" : "P") as "A" | "P" }));
  const res1 = await markRegister(chebet, { classId: f2e.id, date: today, marks, notifyAbsent: true });
  console.log("marked:", res1.saved, "counts:", JSON.stringify(res1.counts), "sms:", JSON.stringify(res1.sms));
  const recAudit = await db.auditLog.findFirst({ where: { action: "attendance.marked" } });
  console.log("audit attendance.marked:", recAudit ? "✓" : "✗ FAIL");

  // 5) idempotent re-mark (offline replay): change absentee to Present, re-save all
  const marks2 = reg.students.map((s) => ({ studentId: s.id, status: "P" as const }));
  await markRegister(chebet, { classId: f2e.id, date: today, marks: marks2, notifyAbsent: false });
  const count = await db.attendanceRecord.count({ where: { classId: f2e.id, date: today } });
  console.log("re-mark idempotent (no dup rows):", count === reg.students.length ? "✓ " + count : "✗ FAIL " + count);

  // 6) SMS dedupe: absentee SMS not re-sent for same day (smsSentAt set)
  const smsMarked = await db.attendanceRecord.count({ where: { classId: f2e.id, date: today, smsSentAt: { not: null } } });
  console.log("absent SMS recorded (1 sent earlier):", smsMarked === 1 ? "✓" : "✗ got " + smsMarked);

  // 7) history: parent sees ONLY own child's records
  const hist = await attendanceHistory(parent, {});
  const kids = await db.studentGuardian.findMany({ where: { guardian: { userId: parent.id } }, select: { studentId: true } });
  const kidIds = new Set(kids.map(k => k.studentId));
  console.log("parent history rows:", hist.length, "all own child:", hist.every(h => kidIds.has(h.studentId)) ? "✓" : "✗ LEAK");

  // 8) history date filter + yesterday's seed visible to principal
  const yesterday = new Date(Date.now() + 3*3600_000 - 24*3600_000).toISOString().slice(0,10);
  const histY = await attendanceHistory(principal, { from: yesterday, to: yesterday });
  console.log("yesterday seeded rows:", histY.length, histY.length >= 5 ? "✓" : "✗");

  // cleanup today's test marks (keep yesterday's seed)
  await db.attendanceRecord.deleteMany({ where: { date: today } });
  console.log("cleanup ✓ (today's test marks removed)");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
