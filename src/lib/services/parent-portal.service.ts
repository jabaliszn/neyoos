/**
 * B.10 Parent Portal — one service that aggregates everything a parent may
 * see about THEIR OWN children. Every query flows through scopeWhere (A.3.9)
 * so cross-family leakage is impossible by construction.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";
import { addPickupPerson, removePickupPerson, createAltPickup, cancelAltPickup } from "@/lib/services/security.service";

export class PortalError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "PortalError";
  }
}

async function assertOwnChild(user: SessionUser, studentId: string) {
  const scope = await scopeWhere(user);
  const child = await tenantDb().student.findFirst({
    where: { AND: [{ id: studentId, deletedAt: null }, scope] },
    select: { id: true },
  });
  if (!child) throw new PortalError("NOT_FOUND", "Student not found.");
  return child;
}

/** The parent's home: children cards with live attendance + fees + results. */
export async function myChildren(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const children = await tenantDb().student.findMany({
      where: { AND: [scope, { status: { in: ["ACTIVE", "SUSPENDED"] } }] },
      include: { schoolClass: true },
      orderBy: { firstName: "asc" },
    });

    const result = [];
    for (const c of children) {
      // Attendance: last 30 days present %.
      const since = new Date(Date.now() + 3 * 3600_000 - 30 * 24 * 3600_000).toISOString().slice(0, 10);
      const att = await tenantDb().attendanceRecord.findMany({
        where: { studentId: c.id, date: { gte: since } },
        select: { status: true, date: true },
        orderBy: { date: "desc" },
      });
      const present = att.filter((a) => a.status === "P" || a.status === "L").length;
      const attendancePct = att.length ? Math.round((present / att.length) * 100) : null;
      const lastAbsent = att.find((a) => a.status === "A")?.date ?? null;

      // Fees: open invoices balance.
      const invoices = await tenantDb().invoice.findMany({ where: { studentId: c.id } });
      const balance = invoices.reduce((a, i) => a + Math.max(0, i.totalKes - i.discountKes - i.paidKes), 0);

      // Latest PUBLISHED exam summary line.
      const lastResult = await tenantDb().examResult.findFirst({
        where: { studentId: c.id, exam: { published: true } },
        orderBy: { updatedAt: "desc" },
        include: { exam: true },
      });

      result.push({
        id: c.id,
        name: [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" "),
        admissionNo: c.admissionNo,
        photoUrl: c.photoUrl,
        className: c.schoolClass ? [c.schoolClass.level, c.schoolClass.stream].filter(Boolean).join(" ") : null,
        attendancePct,
        lastAbsent,
        feeBalanceKes: balance,
        latestPublishedExam: lastResult ? { examId: lastResult.examId, name: lastResult.exam.name, year: lastResult.exam.year, term: lastResult.exam.term } : null,
      });
    }
    return result;
  });
}

/** One child's detail: attendance history, fee invoices, published exams. */
export async function childDetail(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      include: { schoolClass: true },
    });
    if (!child) throw new PortalError("NOT_FOUND", "Student not found.");

    const since = new Date(Date.now() + 3 * 3600_000 - 60 * 24 * 3600_000).toISOString().slice(0, 10);
    // B.11: own timetable (shared family portal — students use this too).
    const timetable = child.classId
      ? await tenantDb().timetableSlot.findMany({
          where: { classId: child.classId },
          include: { subject: true },
          orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
        })
      : [];

    // B.12: homework assigned to the child's class + notes to download.
    const todayStr = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const [homework, notes] = child.classId
      ? await Promise.all([
          tenantDb().homework.findMany({
            where: { classId: child.classId },
            include: { subject: true },
            orderBy: { dueDate: "desc" },
            take: 30,
          }),
          tenantDb().classNote.findMany({
            where: { classId: child.classId },
            include: { subject: true },
            orderBy: { createdAt: "desc" },
            take: 30,
          }),
        ])
      : [[], []];

    // B.13: this child's submissions (status + grade per homework task).
    const submissions = homework.length
      ? await tenantDb().homeworkSubmission.findMany({
          where: { studentId, homeworkId: { in: homework.map((h) => h.id) } },
        })
      : [];
    const subByHw = new Map(submissions.map((s) => [s.homeworkId, s]));

    const [attendance, invoices, publishedResults, pickupPersons, altPickups] = await Promise.all([
      tenantDb().attendanceRecord.findMany({
        where: { studentId, date: { gte: since } },
        orderBy: { date: "desc" }, take: 40,
        select: { date: true, status: true, note: true },
      }),
      tenantDb().invoice.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
      tenantDb().examResult.findMany({
        where: { studentId, exam: { published: true } },
        include: { exam: true },
        orderBy: { updatedAt: "desc" },
      }),
      tenantDb().pickupPerson.findMany({ where: { studentId, active: true }, orderBy: { createdAt: "desc" } }),
      tenantDb().altPickupAuthorization.findMany({ where: { studentId, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    ]);

    // Group published results by exam for the results list.
    const examMap = new Map<string, { examId: string; name: string; year: number; term: number; maxMarks: number; subjects: number; total: number }>();
    for (const r of publishedResults) {
      const e = examMap.get(r.examId) ?? { examId: r.examId, name: r.exam.name, year: r.exam.year, term: r.exam.term, maxMarks: r.exam.maxMarks, subjects: 0, total: 0 };
      e.subjects++; e.total += r.marks;
      examMap.set(r.examId, e);
    }

    // Teachers the parent can message (class teacher + leadership).
    const classTeacherId = child.schoolClass?.classTeacherId ?? null;
    const contacts = await tenantDb().user.findMany({
      where: {
        isActive: true,
        OR: [
          ...(classTeacherId ? [{ id: classTeacherId }] : []),
          { role: { in: ["PRINCIPAL", "DEPUTY_PRINCIPAL"] } },
        ],
      },
      select: { id: true, fullName: true, role: true },
    });

    return {
      child: {
        id: child.id,
        name: [child.firstName, child.middleName, child.lastName].filter(Boolean).join(" "),
        admissionNo: child.admissionNo,
        photoUrl: child.photoUrl,
        className: child.schoolClass ? [child.schoolClass.level, child.schoolClass.stream].filter(Boolean).join(" ") : null,
        classId: child.classId, // B.13 forum + quizzes
      },
      attendance,
      invoices: invoices.map((i) => ({
        id: i.id, invoiceNo: i.invoiceNo, description: i.description,
        totalKes: i.totalKes, discountKes: i.discountKes, paidKes: i.paidKes,
        balanceKes: Math.max(0, i.totalKes - i.discountKes - i.paidKes),
        status: i.status, dueDate: i.dueDate,
      })),
      exams: [...examMap.values()].map((e) => ({ ...e, avgPct: Math.round((e.total / (e.subjects * e.maxMarks)) * 100) })),
      timetable: timetable.map((t) => ({ dayOfWeek: t.dayOfWeek, period: t.period, code: t.subject?.code ?? null, name: t.subject?.name ?? null })),
      homework: homework.map((h) => {
        const sub = subByHw.get(h.id);
        return {
          id: h.id, title: h.title, instructions: h.instructions,
          subjectName: h.subject.name, subjectCode: h.subject.code,
          teacherName: h.teacherName, dueDate: h.dueDate,
          overdue: h.dueDate < todayStr,
          fileUrl: h.fileUrl, fileName: h.fileName,
          // B.13 submission status for THIS child.
          submission: sub
            ? { id: sub.id, late: sub.late, submittedAt: sub.submittedAt, gradePct: sub.gradePct, feedback: sub.feedback }
            : null,
        };
      }),
      notes: notes.map((n) => ({
        id: n.id, title: n.title, description: n.description,
        subjectName: n.subject.name, subjectCode: n.subject.code,
        teacherName: n.teacherName, fileUrl: n.fileUrl, fileName: n.fileName,
        createdAt: n.createdAt,
      })),
      pickupPersons: pickupPersons.map((p) => ({ id: p.id, fullName: p.fullName, relationship: p.relationship, phone: p.phone, nationalId: p.nationalId, createdAt: p.createdAt })),
      altPickups: altPickups.map((a) => ({ id: a.id, pickerName: a.pickerName, pickerPhone: a.pickerPhone, relationship: a.relationship, code: a.code, screenshotUrl: a.screenshotUrl, expiresAt: a.expiresAt, status: a.status })),
      contacts,
    };
  });
}


export async function parentPickupBoard(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    await assertOwnChild(user, studentId);
    const [pickupPersons, altPickups] = await Promise.all([
      tenantDb().pickupPerson.findMany({ where: { studentId, active: true }, orderBy: { createdAt: "desc" } }),
      tenantDb().altPickupAuthorization.findMany({ where: { studentId, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      pickupPersons: pickupPersons.map((p) => ({ id: p.id, fullName: p.fullName, relationship: p.relationship, phone: p.phone, nationalId: p.nationalId, createdAt: p.createdAt })),
      altPickups: altPickups.map((a) => ({ id: a.id, pickerName: a.pickerName, pickerPhone: a.pickerPhone, relationship: a.relationship, code: a.code, screenshotUrl: a.screenshotUrl, screenshotName: a.screenshotName, expiresAt: a.expiresAt, status: a.status })),
    };
  });
}

export async function parentAddPickupPerson(user: SessionUser, input: { studentId: string; fullName: string; relationship: string; phone: string; nationalId: string }) {
  return withTenant(user.tenantId, async () => {
    await assertOwnChild(user, input.studentId);
    if (!input.nationalId.trim()) throw new PortalError("INVALID", "National ID is required for safe pickup authorization.");
    return addPickupPerson(user, input);
  });
}

export async function parentRemovePickupPerson(user: SessionUser, personId: string) {
  return withTenant(user.tenantId, async () => {
    const person = await tenantDb().pickupPerson.findUnique({ where: { id: personId } });
    if (!person || !person.active) throw new PortalError("NOT_FOUND", "Pickup person not found.");
    await assertOwnChild(user, person.studentId);
    return removePickupPerson(user, personId);
  });
}

export async function parentCreateAltPickup(user: SessionUser, input: { studentId: string; pickerName: string; pickerPhone?: string; relationship?: string; screenshotUrl?: string; screenshotName?: string; validHours?: number }) {
  return withTenant(user.tenantId, async () => {
    await assertOwnChild(user, input.studentId);
    return createAltPickup(user, input);
  });
}

export async function parentCancelAltPickup(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().altPickupAuthorization.findUnique({ where: { id } });
    if (!row) throw new PortalError("NOT_FOUND", "Alternate pickup not found.");
    await assertOwnChild(user, row.studentId);
    return cancelAltPickup(user, id);
  });
}

/** Parent self-serve STK: pay an OWN child's invoice from their own phone. */
export async function parentStk(user: SessionUser, invoiceId: string, phone: string, amountKes?: number) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const inv = await tenantDb().invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new PortalError("NOT_FOUND", "Invoice not found.");
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: inv.studentId }, scope] } });
    if (!child) throw new PortalError("NOT_FOUND", "Invoice not found."); // row-scope: not their child

    const { stkForInvoice } = await import("@/lib/services/finance.service");
    return stkForInvoice(user, invoiceId, phone, amountKes);
  });
}

/**
 * J.10 — Parent/student view of pathway readiness.
 * Reuses the staff readiness engine but only exposes parent-safe fields:
 * - friendly readiness labels (no raw teacher private notes)
 * - the child's stated choices and final allocation
 * - per-pathway "what is still needed" without exposing other students' data
 */
export async function parentChildPathwayReadiness(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    await assertOwnChild(user, studentId);
    const { getStudentPathwayReadiness } = await import("@/lib/services/pathway.service");
    const full = await getStudentPathwayReadiness(user, studentId);

    return {
      student: full.student,
      pathways: full.pathways.map((p) => ({
        pathwayName: p.pathwayName,
        pathwayCode: p.pathwayCode,
        isChoice: p.isChoice,
        choiceOrder: p.choiceOrder,
        isAllocated: p.isAllocated,
        isRecommended: p.isRecommended,
        readiness: p.overallReadiness,
        academicReadinessPct: p.academicReadinessPct,
        requirementsMet: p.requirementsMet,
        requirementsTotal: p.requirementsTotal,
        talentEvidenceCount: p.talentEvidenceCount,
        portfolioEvidenceCount: p.portfolioEvidenceCount,
        // subject-level guidance, parent-safe (child's own averages only)
        subjects: p.subjects.map((s) => ({
          subjectName: s.subjectName,
          isCore: s.isCore,
          minScorePct: s.minScorePct,
          studentAvgPct: s.studentAvgPct,
          met: s.met,
        })),
      })),
    };
  });
}
