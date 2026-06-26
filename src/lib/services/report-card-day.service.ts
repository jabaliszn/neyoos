/**
 * G.29 — Report-Card Day Mode service.
 * Connects reception check-ins (A.18) ➡️ one-tap print station auto-queuing (G.31)
 * ➡️ teacher-meeting queue status tracking.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { queuePrint } from "@/lib/services/print-queue.service";
import type { SessionUser } from "@/lib/core/session";

export class ReportCardDayError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "ReportCardDayError";
  }
}

/** Check-in a parent on Visiting / Report-Card Day. */
export async function checkInParent(
  user: SessionUser,
  input: { studentId: string; guardianName: string }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    
    // Verify student exists
    const student = await tdb.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new ReportCardDayError("NOT_FOUND", "Student not found.");

    // Check if already checked in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dup = await tdb.reportCardDayCheckIn.findFirst({
      where: { studentId: input.studentId, checkedInAt: { gte: todayStart } },
    });
    if (dup) throw new ReportCardDayError("ALREADY", "Parent is already checked in for this student today.");

    // Calculate sequential queue number for today
    const count = await tdb.reportCardDayCheckIn.count({
      where: { checkedInAt: { gte: todayStart } },
    });
    const queueNo = count + 1;

    const row = await tdb.reportCardDayCheckIn.create({
      data: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        guardianName: input.guardianName.trim(),
        queueNo,
        status: "WAITING",
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "report_day.check_in",
        entityType: "student",
        entityId: input.studentId,
        metadata: JSON.stringify({ queueNo, guardianName: input.guardianName }),
      },
    });

    return row;
  });
}

/** List all check-ins for today. */
export async function listCheckIns(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const list = await tenantDb().reportCardDayCheckIn.findMany({
      where: { checkedInAt: { gte: todayStart } },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { queueNo: "asc" },
    });

    return list.map((c) => ({
      id: c.id,
      studentId: c.studentId,
      studentName: `${c.student.firstName} ${c.student.lastName}`,
      admissionNo: c.student.admissionNo,
      guardianName: c.guardianName,
      queueNo: c.queueNo,
      checkedInAt: c.checkedInAt.toISOString(),
      printedAt: c.printedAt ? c.printedAt.toISOString() : null,
      status: c.status,
    }));
  });
}

/**
 * One-Tap Action:
 * - Auto-queues both the student's latest published report card PDF AND their outstanding fee invoice PDF
 *   to the Print Station (G.31) automatically.
 * - Marks the check-in printed timestamp.
 * - Promotes status from WAITING to MEETING (teacher-meeting queue!).
 */
export async function printOneTap(user: SessionUser, checkInId: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const checkIn = await tdb.reportCardDayCheckIn.findUnique({
      where: { id: checkInId },
      include: { student: { include: { schoolClass: true } } },
    });
    if (!checkIn) throw new ReportCardDayError("NOT_FOUND", "Check-in record not found.");

    const student = checkIn.student;

    // 1) Find the student's latest published exam
    const lastResult = await tdb.examResult.findFirst({
      where: { studentId: student.id, exam: { published: true } },
      orderBy: { updatedAt: "desc" },
    });

    // 2) Find the student's latest open invoice
    const inv = await tdb.invoice.findFirst({
      where: { studentId: student.id, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    });

    const classLabel = student.schoolClass
      ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
      : null;

    let queuedCount = 0;

    // Queue Report Card PDF
    if (lastResult) {
      const letterNo = `RPT-${lastResult.examId.slice(-4).toUpperCase()}${student.id.slice(-4).toUpperCase()}`;
      await queuePrint({
        tenantId: user.tenantId,
        kind: "CLASS_BATCH", // treated as class batch style
        refId: lastResult.examId,
        classId: student.classId,
        classLabel,
        title: `Report Card — ${student.firstName} ${student.lastName} (Queue #${checkIn.queueNo})`,
        url: `/api/exams/${lastResult.examId}/report/${student.id}`,
        queuedBy: user.fullName,
      });
      queuedCount++;
    }

    // Queue Fee Invoice / Statement PDF
    if (inv) {
      await queuePrint({
        tenantId: user.tenantId,
        kind: "INVOICE",
        refId: inv.id,
        classId: student.classId,
        classLabel,
        title: `Fee Invoice ${inv.invoiceNo} — ${student.firstName} ${student.lastName} (Queue #${checkIn.queueNo})`,
        url: `/api/finance/invoices/${inv.id}/pdf`,
        queuedBy: user.fullName,
      });
      queuedCount++;
    }

    // Update check-in record
    await tdb.reportCardDayCheckIn.update({
      where: { id: checkInId },
      data: {
        printedAt: new Date(),
        status: "MEETING", // sent to meeting!
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "report_day.printed",
        entityType: "student",
        entityId: student.id,
        metadata: JSON.stringify({ queueNo: checkIn.queueNo, queuedDocuments: queuedCount }),
      },
    });

    return { success: true, queuedCount, status: "MEETING" };
  });
}

/** Update meeting queue status (e.g. mark MEETING -> COMPLETE). */
export async function updateCheckInStatus(user: SessionUser, checkInId: string, status: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const checkIn = await tdb.reportCardDayCheckIn.findUnique({ where: { id: checkInId } });
    if (!checkIn) throw new ReportCardDayError("NOT_FOUND", "Check-in record not found.");

    await tdb.reportCardDayCheckIn.update({
      where: { id: checkInId },
      data: { status },
    });

    return { success: true, status };
  });
}
