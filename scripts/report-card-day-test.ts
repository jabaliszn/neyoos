/** G.29 — Report-Card Day Mode live tests (SELF-HEALS). */
import { db } from "../src/lib/db";
import { checkInParent, listCheckIns, printOneTap, updateCheckInStatus } from "../src/lib/services/report-card-day.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const receptionist = await su("frontoffice@karibuhigh.ac.ke");
  const student = await db.student.findFirstOrThrow({ where: { tenantId: receptionist.tenantId, firstName: "Achieng" } });

  // Cleanup leftovers from prior test runs
  await db.reportCardDayCheckIn.deleteMany({ where: { tenantId: receptionist.tenantId, studentId: student.id } });
  await db.printJob.deleteMany({ where: { tenantId: receptionist.tenantId, title: { contains: "(Queue #" } } });

  // 1) Check-In parent -> queue #1
  const c1 = await checkInParent(receptionist, {
    studentId: student.id,
    guardianName: "Otieno Brian",
  });
  assert("parent checked in successfully", !!c1.id && c1.guardianName === "Otieno Brian" && c1.queueNo === 1);

  // 2) Duplicate check-in blocked
  try {
    await checkInParent(receptionist, { studentId: student.id, guardianName: "Otieno Brian" });
    assert("duplicate check-in blocked", false);
  } catch {
    assert("duplicate check-in blocked", true);
  }

  // 3) List check-ins
  const list = await listCheckIns(receptionist);
  assert("list contains our check-in", list.some((c) => c.id === c1.id));

  // 4) One-Tap Print -> Queues Report Card & Invoice to Print Station + updates status to MEETING
  const pResult = await printOneTap(receptionist, c1.id);
  assert("one-tap print successfully executed", pResult.success === true && pResult.status === "MEETING");

  const c1After = await db.reportCardDayCheckIn.findUniqueOrThrow({ where: { id: c1.id } });
  assert("status updated to MEETING", c1After.status === "MEETING");
  assert("printed timestamp recorded", c1After.printedAt !== null);

  const queuedJobs = await db.printJob.findMany({
    where: { tenantId: receptionist.tenantId, title: { contains: "(Queue #1)" } },
  });
  assert("documents auto-queued to Print Station", queuedJobs.length > 0);

  // 5) Update status (MEETING -> COMPLETE)
  await updateCheckInStatus(receptionist, c1.id, "COMPLETE");
  const finalState = await db.reportCardDayCheckIn.findUniqueOrThrow({ where: { id: c1.id } });
  assert("status updated to COMPLETE", finalState.status === "COMPLETE");

  // Cleanup
  await db.reportCardDayCheckIn.deleteMany({ where: { id: c1.id } });
  await db.printJob.deleteMany({ where: { tenantId: receptionist.tenantId, title: { contains: "(Queue #1)" } } });

  console.log(`\nG.29 Report-Card Day Mode: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
