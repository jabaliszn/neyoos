/**
 * PART N.2 — QR Hardware Integration.
 *
 * The REAL scanning surface for a student's printed ID card: a staff member
 * (gate/reception/class teacher) scans the QR with their phone/tablet camera
 * (BarcodeDetector, same pattern already used in the library module) or a
 * USB handheld scanner (which just types the decoded URL/code + Enter, no
 * special hardware driver needed). This service resolves that scan to a
 * real student, then offers the two REAL 1-tap actions the checklist wants:
 *   - 1-Tap Attendance: marks today's register instantly.
 *   - 1-Tap Payments: looks up the real open balance so a bursar/reception
 *     can immediately prompt for M-Pesa payment (reuses the REAL B.7
 *     finance engine — never a second invoice/payment system).
 *
 * STRICT duplicate-scan guard (explicit checklist requirement): the same
 * student cannot be scanned for the SAME action twice within a cooldown
 * window — protects against a camera reading one QR multiple times in a
 * single pass, or someone re-tapping a card. Every scan (successful,
 * duplicate, or blocked) is logged to `QrScanEvent` for a real audit trail.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { nairobiToday } from "@/lib/services/attendance.service";

export class QrScanError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "DUPLICATE" | "INVALID", message: string) {
    super(message);
    this.name = "QrScanError";
  }
}

/** Cooldown window: the same student + action combo within this many seconds is a duplicate scan. */
const DUPLICATE_COOLDOWN_SEC = 15;

/**
 * Extract a bare verification code from whatever the scanner actually reads.
 * A QR encodes the FULL verify URL (`https://.../verify/<CODE>`); a USB
 * barcode-scanner or manual paste might just be the bare code. Handles both.
 */
export function extractVerifyCode(scanned: string): string {
  const trimmed = scanned.trim();
  const match = trimmed.match(/\/verify\/([A-Za-z0-9]+)\/?$/);
  if (match) return match[1].toUpperCase();
  return trimmed.toUpperCase();
}

async function logScan(
  user: SessionUser,
  studentId: string,
  action: "ATTENDANCE" | "PAYMENT_LOOKUP",
  result: "OK" | "DUPLICATE" | "BLOCKED",
  detail?: string
) {
  await db.qrScanEvent.create({
    data: {
      tenantId: user.tenantId,
      studentId,
      action,
      result,
      detail: detail ?? null,
      scannedById: user.id,
      scannedByName: user.fullName,
    },
  });
}

async function assertNotDuplicate(user: SessionUser, studentId: string, action: "ATTENDANCE" | "PAYMENT_LOOKUP") {
  const cutoff = new Date(Date.now() - DUPLICATE_COOLDOWN_SEC * 1000);
  const recent = await db.qrScanEvent.findFirst({
    where: { tenantId: user.tenantId, studentId, action, result: "OK", createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const secondsAgo = Math.max(1, Math.round((Date.now() - recent.createdAt.getTime()) / 1000));
    await logScan(user, studentId, action, "DUPLICATE", `Already scanned ${secondsAgo}s ago`);
    throw new QrScanError("DUPLICATE", `This card was already scanned ${secondsAgo} second${secondsAgo === 1 ? "" : "s"} ago. Wait a moment before scanning again.`);
  }
}

/**
 * Resolve a raw scan (QR text or bare code) to the real student it belongs
 * to. Tenant-isolated: a code issued by ANOTHER school's ID card resolves to
 * nothing here (DocumentVerification rows are tenant-scoped), so a scanner
 * at School A can never accidentally read School B's student data.
 */
export async function resolveScannedStudent(user: SessionUser, scanned: string) {
  return withTenant(user.tenantId, async () => {
    const code = extractVerifyCode(scanned);
    if (!code) throw new QrScanError("INVALID", "Could not read a code from that scan.");

    const record = await tenantDb().documentVerification.findFirst({
      where: { code, docType: "student_id" },
    });
    if (!record || !record.studentId) {
      throw new QrScanError("NOT_FOUND", "This QR code is not a recognized NEYO student ID.");
    }

    const student = await tenantDb().student.findFirst({
      where: { id: record.studentId, status: "ACTIVE" },
      include: { schoolClass: true },
    });
    if (!student) throw new QrScanError("NOT_FOUND", "Student not found or no longer active.");

    return {
      id: student.id,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      admissionNo: student.admissionNo,
      photoUrl: student.photoUrl,
      className: student.schoolClass
        ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
        : "Unassigned",
      classId: student.classId,
    };
  });
}

/**
 * 1-Tap Attendance: scan → mark today's register for that student instantly.
 * Reuses the REAL AttendanceRecord table (same one the manual register uses)
 * — never a parallel/second attendance system. Row-scoped: a TEACHER/
 * CLASS_TEACHER can only 1-tap-mark students in their OWN class (same rule
 * as the manual register); leadership/reception roles with attendance.record
 * may mark any class (front-desk / gate covering the whole school).
 */
export async function scanForAttendance(user: SessionUser, scanned: string, status: "P" | "L" = "P") {
  return withTenant(user.tenantId, async () => {
    const code = extractVerifyCode(scanned);
    const record = await tenantDb().documentVerification.findFirst({ where: { code, docType: "student_id" } });
    if (!record || !record.studentId) {
      throw new QrScanError("NOT_FOUND", "This QR code is not a recognized NEYO student ID.");
    }
    const student = await tenantDb().student.findFirst({ where: { id: record.studentId, status: "ACTIVE" } });
    if (!student) throw new QrScanError("NOT_FOUND", "Student not found or no longer active.");

    // Row-scope: TEACHER/CLASS_TEACHER can only 1-tap their own class.
    const teacherLike = ["TEACHER", "CLASS_TEACHER"].includes(user.role) || user.secondaryRole === "TEACHER" || user.secondaryRole === "CLASS_TEACHER";
    if (teacherLike && student.classId) {
      const owns = await tenantDb().schoolClass.findFirst({ where: { id: student.classId, classTeacherId: user.id } });
      if (!owns) {
        await logScan(user, student.id, "ATTENDANCE", "BLOCKED", "Not this teacher's class");
        throw new QrScanError("FORBIDDEN", "This student is not in a class you teach.");
      }
    }

    await assertNotDuplicate(user, student.id, "ATTENDANCE");

    const date = nairobiToday();
    const result = await tenantDb().attendanceRecord.upsert({
      where: { tenantId_studentId_date: { tenantId: user.tenantId, studentId: student.id, date } },
      create: {
        tenantId: user.tenantId, studentId: student.id, classId: student.classId, date, status,
        markedById: user.id, markedByName: user.fullName, note: "Marked via QR ID-card scan",
      } as never,
      update: { status, markedById: user.id, markedByName: user.fullName, note: "Marked via QR ID-card scan" },
    });

    await logScan(user, student.id, "ATTENDANCE", "OK", `Marked ${status === "P" ? "present" : "late"} for ${date}`);

    return {
      studentId: student.id,
      studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      admissionNo: student.admissionNo,
      date,
      status: result.status,
    };
  });
}

/**
 * 1-Tap Payments: scan → instantly surface the student's REAL open fee
 * balance so reception/bursar can prompt for M-Pesa payment right away.
 * Reuses the REAL `studentOpenInvoices` from the B.7 finance engine — this
 * is a lookup only (no money moves here); the actual STK push still goes
 * through the existing `stkForInvoice` finance flow once the invoice is
 * chosen, so there is exactly ONE real payment code path in the whole app.
 */
export async function scanForPayment(user: SessionUser, scanned: string) {
  return withTenant(user.tenantId, async () => {
    const code = extractVerifyCode(scanned);
    const record = await tenantDb().documentVerification.findFirst({ where: { code, docType: "student_id" } });
    if (!record || !record.studentId) {
      throw new QrScanError("NOT_FOUND", "This QR code is not a recognized NEYO student ID.");
    }
    const student = await tenantDb().student.findFirst({
      where: { id: record.studentId, status: "ACTIVE" },
      include: { schoolClass: true, guardians: { include: { guardian: true } } },
    });
    if (!student) throw new QrScanError("NOT_FOUND", "Student not found or no longer active.");

    await assertNotDuplicate(user, student.id, "PAYMENT_LOOKUP");

    const { studentOpenInvoices } = await import("@/lib/services/finance.service");
    const { invoices, hasFeeInvoices } = await studentOpenInvoices(user, student.id);
    const totalBalanceKes = invoices.reduce((sum, inv) => sum + inv.balanceKes, 0);
    const primaryGuardian = student.guardians.find((g) => g.isPrimary) ?? student.guardians[0];

    await logScan(user, student.id, "PAYMENT_LOOKUP", "OK", `Balance KES ${totalBalanceKes.toLocaleString("en-KE")}`);

    return {
      studentId: student.id,
      studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      admissionNo: student.admissionNo,
      className: student.schoolClass
        ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
        : "Unassigned",
      totalBalanceKes,
      invoices,
      // R.2 — false means no invoice has EVER been raised for this student;
      // the caller must show a distinct "not billed yet" state, never
      // conflate it with a genuinely fully-paid zero balance.
      hasFeeInvoices,
      guardianPhone: primaryGuardian?.guardian.phone ?? null,
      guardianName: primaryGuardian?.guardian.fullName ?? null,
    };
  });
}

/** Real scan history for the school's own audit visibility. */
export async function recentScans(user: SessionUser, limit = 20) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().qrScanEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      studentName: r.student ? [r.student.firstName, r.student.lastName].filter(Boolean).join(" ") : "Unknown",
      admissionNo: r.student?.admissionNo ?? null,
      action: r.action,
      result: r.result,
      detail: r.detail,
      scannedByName: r.scannedByName,
      createdAt: r.createdAt,
    }));
  });
}
