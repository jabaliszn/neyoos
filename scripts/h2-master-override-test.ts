/** H.2 Master Attendance Override — live test (self-healing). */
import { db } from "../src/lib/db";
import { markRegister, getRegister, nairobiToday } from "../src/lib/services/attendance.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER of Form 2 East
  const today = nairobiToday();
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });

  let pass = 0, fail = 0;
  const ok = (c: boolean, label: string) => { if (c) { pass++; console.log("  ✓", label); } else { fail++; console.log("  ✗ FAIL:", label); } };

  // record current audit count for override action
  const before = await db.auditLog.count({ where: { action: "attendance.master_override" } });

  // 1) Teacher CANNOT use masterOverride to escape scope (F1W is not chebet's class)
  try {
    const reg = await getRegister(principal, f1w.id, today); // principal reads to get student ids
    const marks = reg.students.map((s) => ({ studentId: s.id, status: "P" as const }));
    await markRegister(chebet, { classId: f1w.id, date: today, marks, notifyAbsent: false, masterOverride: true });
    ok(false, "teacher with masterOverride=true should be BLOCKED");
  } catch (e: any) {
    ok(e?.code === "FORBIDDEN", "teacher masterOverride blocked (FORBIDDEN): " + (e?.message || ""));
  }

  // 2) Principal CAN override and mark Form 1 West (not their own class)
  const regP = await getRegister(principal, f1w.id, today);
  const marksP = regP.students.map((s) => ({ studentId: s.id, status: "P" as const }));
  const res = await markRegister(principal, { classId: f1w.id, date: today, marks: marksP, notifyAbsent: false, masterOverride: true });
  ok(res.saved === regP.students.length, `principal override saved ${res.saved}/${regP.students.length}`);

  // 3) It was audited as attendance.master_override (not attendance.marked)
  const after = await db.auditLog.count({ where: { action: "attendance.master_override" } });
  ok(after === before + 1, "audited as attendance.master_override (+1)");
  const lastOverride = await db.auditLog.findFirst({ where: { action: "attendance.master_override" }, orderBy: { createdAt: "desc" } });
  const meta = lastOverride ? JSON.parse(lastOverride.metadata || "{}") : {};
  ok(meta.masterOverride === true, "override audit metadata.masterOverride = true");

  // 4) Principal marking WITHOUT override still works (normal path), audited as attendance.marked
  const beforeMarked = await db.auditLog.count({ where: { action: "attendance.marked" } });
  await markRegister(principal, { classId: f2e.id, date: today, marks: (await getRegister(principal, f2e.id, today)).students.map(s => ({ studentId: s.id, status: "P" as const })), notifyAbsent: false });
  const afterMarked = await db.auditLog.count({ where: { action: "attendance.marked" } });
  ok(afterMarked === beforeMarked + 1, "normal mark (no override) audited as attendance.marked");

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
