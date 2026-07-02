/**
 * Document service (Feature A.10).
 * - Issues verifiable document codes (QR -> /verify/<code>) with a payload hash.
 * - Verifies a code on the public verify page.
 * Rendering (PDF/XLSX/CSV) lives in src/lib/documents/* and the receipt doc.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export function hashPayload(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/** Create a verifiable document record; returns the public code. */
export async function issueVerification(
  tenantId: string,
  docType: string,
  summary: string,
  payload: unknown,
  studentId?: string
): Promise<string> {
  const code = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 chars
  await db.documentVerification.create({
    data: {
      tenantId,
      code,
      docType,
      summary,
      payloadHash: hashPayload(payload),
      studentId: studentId ?? null,
    },
  });
  return code;
}

/** Build a co-branded, QR-verifiable PDF receipt for a Payment (A.6/A.10). */
export async function buildPaymentReceiptPdf(tenantId: string, paymentId: string) {
  const { renderReceiptPdf } = await import("@/lib/documents/receipt-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
  const { formatPhoneKE } = await import("@/lib/utils");

  const [payment, tenant] = await Promise.all([
    db.payment.findFirst({ where: { id: paymentId, tenantId } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!payment || !tenant) throw new Error("Payment not found.");

  const receiptNo = `RCP-${payment.id.slice(-8).toUpperCase()}`;
  const payload = {
    receiptNo,
    amount: payment.amount,
    mpesaRef: payment.mpesaRef,
    paidAt: payment.paidAt,
  };
  const code = await issueVerification(
    tenantId,
    "payment_receipt",
    `${receiptNo} — KES ${payment.amount.toLocaleString("en-KE")} from ${payment.phone}`,
    payload
  );

  const qr = await qrDataUrl(verifyUrl(code));

  const pdf = await renderReceiptPdf({
    schoolName: tenant.name,
    motto: tenant.motto,
    county: tenant.county,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    logoDataUrl: tenant.logoUrl,
    receiptNo,
    date: (payment.paidAt ?? payment.createdAt).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    payerName: payment.accountRef ?? "Customer",
    phone: formatPhoneKE(payment.phone),
    amountKes: payment.amount,
    description: payment.description ?? "Payment",
    mpesaRef: payment.mpesaRef,
    verifyCode: code,
    qrDataUrl: qr,
  });

  return { pdf, receiptNo, code };
}

/** Build the QR-verified school leaving/transfer letter (B.1 + G.10). */
export async function buildTransferLetterPdf(tenantId: string, studentId: string, issuedByName: string) {
  const { renderTransferLetterPdf } = await import("@/lib/documents/transfer-letter-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");

  const [student, tenant, transfer] = await Promise.all([
    db.student.findFirst({ where: { id: studentId, tenantId }, include: { schoolClass: true } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.studentTransfer.findFirst({
      where: { studentId, tenantId, reversedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!student || !tenant) throw new Error("Student not found.");
  if (!transfer) throw new Error("No transfer recorded for this student.");

  const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  const letterNo = `TRF-${transfer.id.slice(-8).toUpperCase()}`;
  const payload = {
    letterNo,
    student: studentName,
    admissionNo: student.admissionNo,
    destination: transfer.destinationSchool,
    transferDate: transfer.transferDate,
  };

  // Reuse the letter's verification code on re-download (idempotent).
  let code = transfer.letterCode;
  if (!code) {
    code = await issueVerification(
      tenantId,
      "transfer_letter",
      `${letterNo} — ${studentName} (${student.admissionNo}) to ${transfer.destinationSchool}`,
      payload
    );
    await db.studentTransfer.update({ where: { id: transfer.id }, data: { letterCode: code } });
  }

  // Previous class label: the seat was freed, so read previousClassId.
  let className: string | null = student.schoolClass
    ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
    : null;
  if (!className && transfer.previousClassId) {
    const prev = await db.schoolClass.findUnique({ where: { id: transfer.previousClassId } });
    if (prev) className = [prev.level, prev.stream].filter(Boolean).join(" ");
  }

  const pdf = await renderTransferLetterPdf({
    schoolName: tenant.name,
    county: tenant.county,
    motto: tenant.motto,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    logoUrl: tenant.logoUrl,
    studentName,
    admissionNo: student.admissionNo,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    className,
    upiNumber: student.upiNumber,
    admittedOn: student.admittedOn.toISOString().slice(0, 10),
    destinationSchool: transfer.destinationSchool,
    destinationCounty: transfer.destinationCounty,
    transferDate: transfer.transferDate,
    reason: transfer.reason ?? "—",
    letterNo,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
    issuedByName,
    issuedDate: new Date().toISOString().slice(0, 10),
  });
  return { pdf, fileName: `${letterNo}-${student.admissionNo}.pdf`, code };
}

/** Build the QR-verified report card PDF (B.5.7 + G.10). */
export async function buildReportCardPdf(
  user: { tenantId: string; id: string; fullName: string; role: string },
  examId: string,
  studentId: string
) {
  const { studentReport } = await import("@/lib/services/exam.service");
  const { renderReportCardPdf, buildComment } = await import("@/lib/documents/report-card-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");

  const r = await studentReport(user as never, examId, studentId);
  const letterNo = `RPT-${examId.slice(-4).toUpperCase()}${studentId.slice(-4).toUpperCase()}`;
  const code = await issueVerification(
    user.tenantId,
    "report_card",
    `${letterNo} — ${r.student.name} (${r.student.admissionNo}) ${r.exam.name} T${r.exam.term} ${r.exam.year}: avg ${r.avgPct}% ${r.overallGrade}`,
    { letterNo, student: r.student.admissionNo, exam: r.exam.name, avg: r.avgPct, grade: r.overallGrade }
  );

  const pdf = await renderReportCardPdf({
    schoolName: r.school.name,
    motto: r.school.motto,
    county: r.school.county,
    addressLine: r.school.addressLine,
    brandPrimary: r.school.brandPrimary,
    logoUrl: (r.school as any).logoUrl ?? null,
    examName: r.exam.name,
    year: r.exam.year,
    term: r.exam.term,
    curriculum: r.curriculum,
    studentName: r.student.name,
    admissionNo: r.student.admissionNo,
    className: r.student.className,
    rows: r.rows,
    maxMarks: r.exam.maxMarks,
    total: r.total,
    avgPct: r.avgPct,
    overallGrade: r.overallGrade,
    position: r.position,
    classPosition: r.classPosition,
    cohortSize: r.cohortSize,
    comment: buildComment(r.avgPct, r.student.name, r.curriculum),
    letterNo,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
    issuedDate: new Date().toISOString().slice(0, 10),
  });
  return { pdf, fileName: `${letterNo}-${r.student.admissionNo}.pdf` };
}

/** Build the KICD-format CBC competency report PDF (B.6.3/6 + G.10). */
export async function buildCbcReportPdf(
  user: { tenantId: string },
  data: Awaited<ReturnType<typeof import("@/lib/services/cbc.service").studentCompetencies>>
) {
  const { renderCbcReportPdf } = await import("@/lib/documents/cbc-report-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

  const letterNo = `CBC-${data.student.id.slice(-8).toUpperCase()}`;
  const code = await issueVerification(
    user.tenantId,
    "cbc_report",
    `${letterNo} — ${data.student.name} (${data.student.admissionNo}) competency report, ${data.subjects.length} learning areas`,
    { letterNo, student: data.student.admissionNo, areas: data.subjects.length }
  );

  const pdf = await renderCbcReportPdf({
    schoolName: tenant.name,
    motto: tenant.motto,
    county: tenant.county,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    logoUrl: tenant.logoUrl,
    studentName: data.student.name,
    admissionNo: data.student.admissionNo,
    className: data.student.className,
    subjects: data.subjects,
    letterNo,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
    issuedDate: new Date().toISOString().slice(0, 10),
  });
  return { pdf, fileName: `${letterNo}-${data.student.admissionNo}.pdf` };
}

/** Build a student ID card PDF (G.10). */
export async function buildStudentIdCardPdf(tenantId: string, studentId: string) {
  const { renderStudentIdCardsPdf } = await import("@/lib/documents/student-id-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
  const { getDocumentDesign } = await import("@/lib/services/document-design.service");
  const { logoAsDataUrl } = await import("@/lib/documents/school-stamp");

  const [student, tenant, design] = await Promise.all([
    db.student.findFirst({ where: { id: studentId, tenantId }, include: { schoolClass: true } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
    getDocumentDesign(tenantId),
  ]);
  if (!student || !tenant) throw new Error("Student not found.");

  const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  const letterNo = `ID-${student.id.slice(-8).toUpperCase()}`;
  const payload = {
    letterNo,
    student: studentName,
    admissionNo: student.admissionNo,
  };

  const code = await issueVerification(
    tenantId,
    "student_id",
    `Student ID Card — ${studentName} (${student.admissionNo})`,
    payload,
    student.id
  );

  const className = student.schoolClass
    ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
    : "Unassigned";

  const logoDataUrl = design.idStampEnabled ? await logoAsDataUrl(tenant.logoUrl) : null;
  const issuedDateText = new Date().toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

  const pdf = await renderStudentIdCardsPdf([{
    schoolName: tenant.name,
    motto: tenant.motto,
    county: tenant.county,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    studentName,
    admissionNo: student.admissionNo,
    className,
    photoUrl: student.photoUrl,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
    logoUrl: tenant.logoUrl,
    logoDataUrl,
    issuedDateText,
  }], { width: design.idCardWidthMm, height: design.idCardHeightMm, template: design.idTemplate, showStamp: design.idStampEnabled });

  return { pdf, fileName: `ID-${student.admissionNo}.pdf`, code };
}

/** Build a student transcript PDF (G.10). */
export async function buildStudentTranscriptPdf(tenantId: string, studentId: string) {
  const { renderStudentTranscriptPdf } = await import("@/lib/documents/transcript-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
  const { cbcLevel, grade844 } = await import("@/lib/validations/exams");
  const { buildComment } = await import("@/lib/documents/report-card-pdf");

  const [student, tenant, results] = await Promise.all([
    db.student.findFirst({ where: { id: studentId, tenantId }, include: { schoolClass: true } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.examResult.findMany({
      where: { studentId, tenantId },
      orderBy: { updatedAt: "asc" },
    }),
  ]);
  if (!student || !tenant) throw new Error("Student not found.");

  const [exams, subjects] = await Promise.all([
    db.exam.findMany({
      where: { id: { in: results.map((r) => r.examId) }, tenantId, published: true },
    }),
    db.subject.findMany({
      where: { id: { in: results.map((r) => r.subjectId) }, tenantId },
    }),
  ]);

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));

  const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  const letterNo = `TRN-${student.id.slice(-8).toUpperCase()}`;

  // Group exam results by exam ID to build TranscriptExamRow array
  const examRowsMap = new Map<string, any>();
  
  const { examSummary } = await import("@/lib/services/exam.service");

  for (const r of results) {
    const exam = examMap.get(r.examId);
    const subject = subMap.get(r.subjectId);
    if (!exam || !subject) continue;

    if (!examRowsMap.has(r.examId)) {
      let position = 1;
      let cohortSize = 1;
      try {
        const summary = await examSummary({ tenantId, role: "SUPER_ADMIN" } as any, r.examId);
        const rankRow = summary.students.find((st: any) => st.studentId === studentId);
        if (rankRow) {
          position = rankRow.position;
          cohortSize = summary.students.length;
        }
      } catch {
        // Fallback
      }

      examRowsMap.set(r.examId, {
        examName: exam.name,
        termLabel: `Term ${exam.term} ${exam.year}`,
        maxMarks: exam.maxMarks,
        results: [],
        total: 0,
        avgPct: 0,
        overallGrade: "—",
        position,
        cohortSize,
      });
    }

    const row = examRowsMap.get(r.examId)!;
    const cur = tenant.curriculum === "CBC" ? "CBC" : "8-4-4";
    const pct = Math.round((r.marks / exam.maxMarks) * 100);
    const grade = tenant.curriculum === "CBC" ? cbcLevel(pct) : grade844(pct);
    const comment = buildComment(pct, studentName, cur);

    row.results.push({
      subjectName: subject.name,
      subjectCode: subject.code,
      marks: r.marks,
      grade,
      remarks: comment,
    });
    row.total += r.marks;
  }

  // Calculate averages and mean grades for each exam row
  const examsList = Array.from(examRowsMap.values());
  for (const row of examsList) {
    const subCount = row.results.length;
    if (subCount > 0) {
      row.avgPct = Math.round((row.total / (subCount * row.maxMarks)) * 100);
      row.overallGrade = tenant.curriculum === "CBC" ? cbcLevel(row.avgPct) : grade844(row.avgPct);
    }
  }

  const payload = {
    letterNo,
    student: studentName,
    admissionNo: student.admissionNo,
    examsCount: examsList.length,
  };

  const code = await issueVerification(
    tenantId,
    "student_transcript",
    `Official Academic Transcript — ${studentName} (${student.admissionNo})`,
    payload
  );

  const className = student.schoolClass
    ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
    : "Unassigned";

  const pdf = await renderStudentTranscriptPdf({
    schoolName: tenant.name,
    motto: tenant.motto,
    county: tenant.county,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    logoUrl: tenant.logoUrl,
    studentName,
    admissionNo: student.admissionNo,
    className,
    gender: student.gender,
    upiNumber: student.upiNumber,
    admittedOn: student.admittedOn.toISOString().slice(0, 10),
    exams: examsList,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
  });

  return { pdf, fileName: `Transcript-${student.admissionNo}.pdf`, code };
}

/** Build the Mwalimu Day-One Pack PDF (G.27). */
export async function buildMwalimuPackPdf(user: SessionUser) {
  const { renderMwalimuPackPdf } = await import("@/lib/documents/mwalimu-pack-pdf");
  const { teacherClassIds } = await import("@/lib/services/teacher-portal.service");
  
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

  // 1) Today's Teaching Schedule (from TimetableSlot)
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7 + 1; // 1=Mon...7=Sun
  
  const slots = await db.timetableSlot.findMany({
    where: { tenantId: user.tenantId, teacherId: user.id, dayOfWeek },
    orderBy: { period: "asc" },
  });

  const [classesList, subjectsList] = await Promise.all([
    db.schoolClass.findMany({
      where: { id: { in: slots.map((s) => s.classId) }, tenantId: user.tenantId },
    }),
    db.subject.findMany({
      where: { id: { in: slots.map((s) => s.subjectId).filter((id): id is string => Boolean(id)) }, tenantId: user.tenantId },
    }),
  ]);

  const classMap = new Map(classesList.map((c) => [c.id, c]));
  const subMap = new Map(subjectsList.map((s) => [s.id, s]));

  const timetable = slots.map((s) => {
    const cls = classMap.get(s.classId);
    const sub = s.subjectId ? subMap.get(s.subjectId) : undefined;
    return {
      dayOfWeek: s.dayOfWeek,
      period: s.period,
      className: cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "—",
      subjectCode: sub?.code ?? "—",
    };
  });

  // 2) Class Registers for classes where they are Class Teacher
  const myClasses = await db.schoolClass.findMany({
    where: { tenantId: user.tenantId, classTeacherId: user.id, archived: false },
    orderBy: [{ level: "asc" }, { stream: "asc" }],
    include: { students: { where: { status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } },
  });

  const classRosters = myClasses.map((c) => ({
    className: [c.level, c.stream].filter(Boolean).join(" "),
    students: c.students.map((st) => ({
      admissionNo: st.admissionNo,
      name: [st.firstName, st.middleName, st.lastName].filter(Boolean).join(" "),
      gender: st.gender,
    })),
  }));

  // 3) Yesterday's Absentees list for classes they teach
  const allowedIds = await teacherClassIds(user);
  const yesterdayDate = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
  
  const absentees = await db.attendanceRecord.findMany({
    where: {
      tenantId: user.tenantId,
      date: yesterdayDate,
      status: "A",
      ...(allowedIds ? { classId: { in: allowedIds } } : {}),
    },
  });

  const [absStudents, absClasses] = await Promise.all([
    db.student.findMany({
      where: { id: { in: absentees.map((a) => a.studentId) }, tenantId: user.tenantId },
    }),
    db.schoolClass.findMany({
      where: { id: { in: absentees.map((a) => a.classId!).filter(Boolean) }, tenantId: user.tenantId },
    }),
  ]);

  const studentMap = new Map(absStudents.map((s) => [s.id, s]));
  const absClassMap = new Map(absClasses.map((c) => [c.id, c]));

  const yesterdayAbsentees = absentees.map((a) => {
    const st = studentMap.get(a.studentId);
    const cls = a.classId ? absClassMap.get(a.classId) : null;
    return {
      studentName: st ? [st.firstName, st.middleName, st.lastName].filter(Boolean).join(" ") : "—",
      admissionNo: st?.admissionNo ?? "—",
      className: cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "—",
      note: a.note,
    };
  });

  const pdf = await renderMwalimuPackPdf({
    schoolName: tenant.name,
    motto: tenant.motto,
    teacherName: user.fullName,
    date: today.toISOString().slice(0, 10),
    timetable,
    classRosters,
    yesterdayAbsentees,
    brandPrimary: tenant.brandPrimary || "#1c2740",
  });

  const code = `MW-${user.id.slice(-6).toUpperCase()}-${today.toISOString().slice(0, 10).replace(/-/g, "")}`;

  return { pdf, fileName: `Mwalimu-Pack-${user.fullName.replace(/\s+/g, "-")}.pdf`, code };
}

/** Public verify lookup (no auth) — returns a safe summary or null. */
export async function verifyDocument(code: string) {
  const rec = await db.documentVerification.findUnique({
    where: { code: code.toUpperCase() },
    include: { tenant: { select: { name: true } } },
  });
  if (!rec) return null;
  return {
    valid: true,
    docType: rec.docType,
    summary: rec.summary,
    schoolName: rec.tenant.name,
    issuedAt: rec.createdAt,
  };
}
