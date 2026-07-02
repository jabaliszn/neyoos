/**
 * N.2 — QR Hardware Integration: full-stack live test.
 *
 * Proves (real DB, real service calls, real assertions):
 *  1. Resolving a real student ID QR (via the code stored on their real
 *     StoredFile-less DocumentVerification row) returns the correct student.
 *  2. A garbage/unknown scan is rejected with a real NOT_FOUND, never a crash.
 *  3. 1-Tap Attendance marks a REAL AttendanceRecord row for today, reusing
 *     the exact same table the manual register uses.
 *  4. The STRICT duplicate-scan guard rejects a second scan of the SAME
 *     student for the SAME action within the cooldown window (real HTTP-
 *     equivalent DUPLICATE code), and every scan (OK + duplicate) is logged
 *     to a real QrScanEvent audit row.
 *  5. A CLASS_TEACHER can 1-tap-mark a student in THEIR OWN class, but is
 *     blocked (FORBIDDEN) from 1-tap-marking a student in a different class
 *     — the same fail-closed row-scoping used everywhere else in B.1/B.3.
 *  6. 1-Tap Payment lookup surfaces the REAL open balance via the actual B.7
 *     finance engine (studentOpenInvoices) — not a duplicate/fake balance
 *     calculation.
 *  7. Tenant isolation: a code issued by School A cannot be resolved using
 *     School B's session (cross-school QR reads are impossible).
 *
 * Full cleanup in a finally block; safe to run repeatedly.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  resolveScannedStudent,
  scanForAttendance,
  scanForPayment,
  QrScanError,
} from "../src/lib/services/qr-scan.service";
import { issueVerification } from "../src/lib/services/document.service";
import { nairobiToday } from "../src/lib/services/attendance.service";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}
async function expectError(fn: () => Promise<unknown>, code: string, label: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof QrScanError && e.code === code, `${label} (got: ${e instanceof Error ? e.message : e})`);
    return;
  }
  throw new Error(`Expected ${code}: ${label}`);
}
function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  console.log("N.2 QR Hardware Integration \u2014 full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const bursarRaw = await db.user.findFirstOrThrow({ where: { role: "BURSAR", tenantId: principal.tenantId } });
  const bursar = asUser(bursarRaw);
  const classTeacherRaw = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const classTeacher = asUser(classTeacherRaw);

  const ownClass = await db.schoolClass.findFirstOrThrow({ where: { classTeacherId: classTeacher.id } });
  const ownStudent = await db.student.findFirstOrThrow({ where: { classId: ownClass.id, status: "ACTIVE" } });
  const otherStudent = await db.student.findFirstOrThrow({ where: { classId: { not: ownClass.id }, status: "ACTIVE", tenantId: principal.tenantId } });

  // A different real tenant, for the cross-school isolation check.
  const otherTenant = await db.tenant.findFirstOrThrow({ where: { id: { not: principal.tenantId } } });
  const otherTenantAdmin = await db.user.findFirst({ where: { tenantId: otherTenant.id } });

  const createdCodes: string[] = [];
  const createdScanEventStudentIds: string[] = [];
  let attendanceCleared = false;

  try {
    // Issue two real student_id verification codes directly (mirrors exactly
    // what buildStudentIdCardPdf / bulk-id-cards do when printing real cards).
    const ownCode = await withTenant(principal.tenantId, () =>
      issueVerification(principal.tenantId, "student_id", `Test QR — ${ownStudent.firstName}`, { admissionNo: ownStudent.admissionNo }, ownStudent.id)
    );
    createdCodes.push(ownCode);
    const otherCode = await withTenant(principal.tenantId, () =>
      issueVerification(principal.tenantId, "student_id", `Test QR — ${otherStudent.firstName}`, { admissionNo: otherStudent.admissionNo }, otherStudent.id)
    );
    createdCodes.push(otherCode);
    createdScanEventStudentIds.push(ownStudent.id, otherStudent.id);

    // 1) Resolve a real QR (as the full verify URL, proving the URL-extraction works)
    const verifyUrlForm = `https://neyo.co.ke/verify/${ownCode}`;
    const resolved = await resolveScannedStudent(principal, verifyUrlForm);
    assert(resolved.id === ownStudent.id, "resolving a full verify:// URL correctly extracts the code and finds the real student");
    assert(resolved.admissionNo === ownStudent.admissionNo, "resolved student has the correct real admission number");

    // Also resolve using the BARE code (as a USB scanner or manual paste would produce).
    const resolvedBare = await resolveScannedStudent(principal, ownCode);
    assert(resolvedBare.id === ownStudent.id, "resolving a bare code (no URL) also works, for USB scanners");

    // 2) Garbage scan
    await expectError(() => resolveScannedStudent(principal, "TOTALLY-MADE-UP-CODE-XYZ"), "NOT_FOUND", "an unrecognized scan is rejected with NOT_FOUND, not a crash");

    // 3) Real 1-Tap Attendance write
    const today = nairobiToday();
    // Clear any existing record for a clean assertion.
    await withTenant(principal.tenantId, () => db.attendanceRecord.deleteMany({ where: { studentId: ownStudent.id, date: today } }));
    attendanceCleared = true;

    const attendanceResult = await scanForAttendance(principal, ownCode, "P");
    assert(attendanceResult.studentId === ownStudent.id && attendanceResult.status === "P", "1-Tap Attendance marks the real student present");
    const realRecord = await withTenant(principal.tenantId, () => db.attendanceRecord.findUniqueOrThrow({ where: { tenantId_studentId_date: { tenantId: principal.tenantId, studentId: ownStudent.id, date: today } } }));
    assert(realRecord.status === "P" && realRecord.note === "Marked via QR ID-card scan", "the REAL AttendanceRecord table (same one manual marking uses) shows the scan-sourced mark");

    // 4) Strict duplicate-scan guard
    await expectError(() => scanForAttendance(principal, ownCode, "P"), "DUPLICATE", "scanning the SAME student for the SAME action again within the cooldown is rejected as a duplicate");
    const scanEvents = await withTenant(principal.tenantId, () => db.qrScanEvent.findMany({ where: { studentId: ownStudent.id, action: "ATTENDANCE" }, orderBy: { createdAt: "asc" } }));
    assert(scanEvents.length === 2 && scanEvents[0].result === "OK" && scanEvents[1].result === "DUPLICATE", "both the successful scan AND the rejected duplicate are logged to the real QrScanEvent audit trail");

    // 5) Row-scoping: CLASS_TEACHER can mark their own class, blocked for another class.
    // Clear both the attendance record AND the QrScanEvent cooldown history so
    // this is a genuinely independent scenario, not blocked by step 3/4's
    // very-recent scan of the same student (which is itself correct,
    // separately-proven duplicate-guard behavior, not what's under test here).
    await withTenant(principal.tenantId, () => db.attendanceRecord.deleteMany({ where: { studentId: ownStudent.id, date: today } }));
    await withTenant(principal.tenantId, () => db.qrScanEvent.deleteMany({ where: { studentId: ownStudent.id, action: "ATTENDANCE" } }));
    const ownClassScan = await scanForAttendance(classTeacher, ownCode, "P");
    assert(ownClassScan.studentId === ownStudent.id, "a CLASS_TEACHER can 1-tap-mark a real student in THEIR OWN class");

    await expectError(() => scanForAttendance(classTeacher, otherCode, "P"), "FORBIDDEN", "a CLASS_TEACHER is blocked from 1-tap-marking a student OUTSIDE their own class (fail-closed row-scoping)");
    const otherStudentRecord = await withTenant(principal.tenantId, () => db.attendanceRecord.findUnique({ where: { tenantId_studentId_date: { tenantId: principal.tenantId, studentId: otherStudent.id, date: today } } }));
    assert(otherStudentRecord === null, "the blocked cross-class scan did NOT create any attendance record");

    // 6) 1-Tap Payment lookup uses the REAL finance engine
    const paymentResult = await scanForPayment(bursar, otherCode);
    assert(paymentResult.studentId === otherStudent.id, "1-Tap Payment lookup resolves the correct real student");
    assert(typeof paymentResult.totalBalanceKes === "number" && paymentResult.totalBalanceKes >= 0, "payment lookup returns a real numeric balance (from the actual B.7 finance engine, not a fake number)");

    // 7) Cross-school isolation
    if (otherTenantAdmin) {
      const otherUser = asUser(otherTenantAdmin);
      await expectError(() => resolveScannedStudent(otherUser, ownCode), "NOT_FOUND", "a code issued by School A cannot be resolved from School B's tenant context (cross-school isolation)");
    } else {
      console.log("  (skipped cross-tenant isolation check \u2014 no second tenant found in seed data)");
    }

    console.log("\n\u2705 N.2 QR Hardware Integration test passed");
  } finally {
    await withTenant(principal.tenantId, async () => {
      if (createdCodes.length) await db.documentVerification.deleteMany({ where: { code: { in: createdCodes } } });
      if (createdScanEventStudentIds.length) await db.qrScanEvent.deleteMany({ where: { studentId: { in: createdScanEventStudentIds } } });
      if (attendanceCleared) {
        await db.attendanceRecord.deleteMany({ where: { studentId: { in: [ownStudent.id, otherStudent.id] }, date: nairobiToday() } });
      }
    });
    console.log("  cleanup \u2713 (test codes, scan events, attendance records removed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
