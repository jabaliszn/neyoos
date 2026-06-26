/**
 * B.5 Examination — service.
 * Exams + subject mapping, marks entry (idempotent, teacher row-scoped),
 * positions + mean scores, CBC/8-4-4 grading, report-card data + publishing.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { cbcLevel, grade844 } from "@/lib/validations/exams";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { sendSms } from "@/lib/notifications/sms";
import { notify } from "@/lib/services/notification.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class ExamError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "ExamError";
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "exam", entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}


const RELEASE_REQUEST_ROLES: Role[] = ["HOD", "DEAN_OF_STUDIES", "DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
const RELEASE_APPROVER_ROLES: Role[] = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];

function hasAnyRole(user: SessionUser, roles: Role[]) {
  return roles.includes(user.role as Role) || (user.secondaryRole ? roles.includes(user.secondaryRole as Role) : false);
}

function assertReleaseRequester(user: SessionUser) {
  if (!hasAnyRole(user, RELEASE_REQUEST_ROLES)) {
    throw new ExamError("FORBIDDEN", "Only an Academics HOD, Dean, Deputy, Principal or Owner can request result release.");
  }
}

function assertReleaseApprover(user: SessionUser) {
  if (!hasAnyRole(user, RELEASE_APPROVER_ROLES)) {
    throw new ExamError("FORBIDDEN", "Only the Principal or School Owner can approve and release results.");
  }
}

async function notifyReleaseApprovers(user: SessionUser, examName: string, examId: string) {
  const approvers = await db.user.findMany({
    where: {
      tenantId: user.tenantId,
      isActive: true,
      OR: [
        { role: { in: ["PRINCIPAL", "SCHOOL_OWNER"] } },
        { secondaryRole: { in: ["PRINCIPAL", "SCHOOL_OWNER"] } },
      ],
    },
    select: { id: true },
  });
  await Promise.all(approvers.map((u) => notify({
    tenantId: user.tenantId,
    recipientId: u.id,
    title: "Results release approval needed",
    body: `${user.fullName} requested approval to release ${examName}.`,
    category: "exams",
    href: `/exams?open=${examId}`,
    channels: ["in_app", "push"],
  })));
}

async function releaseApprovalSnapshot(user: SessionUser, examId: string) {
  const summary = await examSummary(user, examId);
  return {
    learners: summary.students.length,
    subjects: summary.subjectMeans.length,
    subjectMeans: summary.subjectMeans.map((s) => ({ code: s.code, mean: s.mean })),
    classMeans: summary.classMeans.map((c) => ({ label: c.label, mean: c.mean, students: c.students })),
  };
}

// ---------------------------------------------------------------------------
// Exams + subject mapping
// ---------------------------------------------------------------------------

export async function listExams(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const exams = await tenantDb().exam.findMany({
      orderBy: [{ year: "desc" }, { term: "desc" }, { createdAt: "desc" }],
      include: { subjects: true, _count: { select: { results: true } } },
    });
    return exams.map((e) => ({
      id: e.id, name: e.name, year: e.year, term: e.term, type: e.type,
      maxMarks: e.maxMarks, published: e.published,
      subjectCount: e.subjects.length, resultCount: e._count.results,
    }));
  });
}

export async function createExam(user: SessionUser, input: { name: string; year: number; term: number; type: string; maxMarks: number; subjectIds: string[] }) {
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.create({
      data: {
        name: input.name, year: input.year, term: input.term,
        type: input.type, maxMarks: input.maxMarks,
        subjects: { create: input.subjectIds.map((subjectId) => ({ subjectId })) },
      } as never,
    });
    await audit(user, "exam.created", exam.id, { name: input.name, subjects: input.subjectIds.length });
    return exam;
  });
}

export async function publishExam(user: SessionUser, examId: string, published: boolean) {
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: examId } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");
    
    await tenantDb().exam.update({ where: { id: examId }, data: { published } });
    await audit(user, published ? "exam.published" : "exam.unpublished", examId);

    // 1-Tap Mean Grade Release Auto-Notification (Chunk C - Part 2)
    if (published) {
      const summary = await examSummary(user, examId);
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
      const students = summary.students;

      // Check remaining school SMS quota before dispatching bulk alerts
      const quota = await checkSmsQuota(user.tenantId, students.length);
      if (quota.allowed) {
        let sentCount = 0;
        for (const s of students) {
          const link = await tenantDb().studentGuardian.findFirst({
            where: { studentId: s.studentId, isPrimary: true },
            include: { guardian: true },
          }) ?? await tenantDb().studentGuardian.findFirst({
            where: { studentId: s.studentId },
            include: { guardian: true },
          });

          if (link?.guardian.phone) {
            const msg = `Dear Parent, ${tenant.name} has released results for "${exam.name}". Your child ${s.name} got average: ${s.avgPct}% (Pos ${s.position}). View full details on NEYO Parent Portal.`;
            try {
              await sendSms(link.guardian.phone, msg);
              sentCount++;
            } catch {
              // skip failed carrier logs
            }
          }
        }
        if (sentCount > 0) {
          await recordUsage(user.tenantId, "smsPerTerm", sentCount);
          await db.auditLog.create({
            data: {
              tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
              action: "exam.release_sms_sent", entityType: "exam", entityId: examId,
              metadata: JSON.stringify({ sent: sentCount }),
            },
          });
        }
      }
    }

    return { id: examId, published };
  });
}

// ---------------------------------------------------------------------------
// Marks entry (B.5.3) — teacher row-scoped, idempotent
// ---------------------------------------------------------------------------

/** The marks sheet for one exam+subject+class: students + existing marks. */
export async function getMarksSheet(user: SessionUser, examId: string, subjectId: string, classId: string) {
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: examId }, include: { subjects: true } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");
    if (!exam.subjects.some((s) => s.subjectId === subjectId))
      throw new ExamError("INVALID", "That subject is not part of this exam.");

    // Row-scoping: teachers can only open sheets for their own classes.
    const scope = await scopeWhere(user);
    const students = await tenantDb().student.findMany({
      where: { AND: [scope, { classId, status: "ACTIVE" }] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true },
    });
    if (students.length === 0) throw new ExamError("FORBIDDEN", "No students here (or not your class).");

    const existing = await tenantDb().examResult.findMany({
      where: { examId, subjectId, studentId: { in: students.map((s) => s.id) } },
    });
    const byStudent = new Map(existing.map((r) => [r.studentId, r.marks]));
    return {
      exam: { id: exam.id, name: exam.name, maxMarks: exam.maxMarks, published: exam.published },
      students: students.map((s) => ({
        id: s.id,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        admissionNo: s.admissionNo,
        marks: byStudent.get(s.id) ?? null,
      })),
    };
  });
}

/** Save a sheet (autosave target — upserts, null clears). */
export async function saveMarks(user: SessionUser, input: { examId: string; subjectId: string; classId: string; marks: { studentId: string; marks: number | null }[] }) {
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: input.examId } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");

    // Validate marks against maxMarks + row-scope the students.
    const scope = await scopeWhere(user);
    const allowed = new Set(
      (await tenantDb().student.findMany({
        where: { AND: [scope, { classId: input.classId, status: "ACTIVE" }] },
        select: { id: true },
      })).map((s) => s.id)
    );

    let saved = 0;
    let cleared = 0;
    for (const m of input.marks) {
      if (!allowed.has(m.studentId)) continue; // defense in depth
      if (m.marks === null) {
        await db.examResult.deleteMany({
          where: { tenantId: user.tenantId, examId: input.examId, subjectId: input.subjectId, studentId: m.studentId },
        });
        cleared++;
        continue;
      }
      if (m.marks > exam.maxMarks)
        throw new ExamError("INVALID", `Marks cannot exceed ${exam.maxMarks}.`);
      await db.examResult.upsert({
        where: { examId_studentId_subjectId: { examId: input.examId, studentId: m.studentId, subjectId: input.subjectId } },
        create: {
          tenantId: user.tenantId, examId: input.examId, studentId: m.studentId,
          subjectId: input.subjectId, marks: m.marks, enteredById: user.id,
        },
        update: { marks: m.marks, enteredById: user.id },
      });
      saved++;
    }
    await audit(user, "exam.marks_saved", input.examId, { subjectId: input.subjectId, classId: input.classId, saved, cleared });
    return { saved, cleared };
  });
}


// ---------------------------------------------------------------------------
// I.2 release approval workflow — HOD/academics request, Principal/Owner approves
// ---------------------------------------------------------------------------

export async function latestExamReleaseApproval(user: SessionUser, examId: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().examReleaseApprovalRequest.findFirst({
      where: { examId },
      orderBy: { requestedAt: "desc" },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      requestedByName: row.requestedByName,
      requestedAt: row.requestedAt.toISOString(),
      decidedByName: row.decidedByName,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      decisionNote: row.decisionNote,
    };
  });
}

export async function requestExamRelease(user: SessionUser, examId: string, note?: string) {
  assertReleaseRequester(user);
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: examId } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");
    if (exam.published) throw new ExamError("INVALID", "This exam has already been released.");

    const resultCount = await tenantDb().examResult.count({ where: { examId } });
    if (resultCount === 0) throw new ExamError("INVALID", "Enter marks before requesting result release.");

    const pending = await tenantDb().examReleaseApprovalRequest.findFirst({ where: { examId, status: "PENDING" } });
    if (pending) throw new ExamError("INVALID", "A release request is already waiting for approval.");

    const snapshot = await releaseApprovalSnapshot(user, examId);
    const request = await tenantDb().examReleaseApprovalRequest.create({
      data: {
        tenantId: user.tenantId,
        examId,
        status: "PENDING",
        requestedById: user.id,
        requestedByName: user.fullName,
        decisionNote: note || null,
        summaryJson: JSON.stringify(snapshot),
      } as never,
    });

    await audit(user, "exam.release_requested", examId, { requestId: request.id, note, ...snapshot });
    await notifyReleaseApprovers(user, exam.name, examId);
    return { id: request.id, status: request.status, summary: snapshot };
  });
}

export async function decideExamRelease(user: SessionUser, examId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  assertReleaseApprover(user);
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: examId } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");
    if (exam.published && decision === "APPROVED") throw new ExamError("INVALID", "This exam has already been released.");

    const request = await tenantDb().examReleaseApprovalRequest.findFirst({
      where: { examId, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    });
    if (!request) throw new ExamError("INVALID", "There is no pending release request for this exam.");

    const updated = await tenantDb().examReleaseApprovalRequest.update({
      where: { id: request.id },
      data: {
        status: decision,
        decidedById: user.id,
        decidedByName: user.fullName,
        decidedAt: new Date(),
        decisionNote: note || request.decisionNote || null,
      },
    });

    await audit(user, decision === "APPROVED" ? "exam.release_approved" : "exam.release_rejected", examId, { requestId: request.id, note });

    if (decision === "APPROVED") {
      await publishExam(user, examId, true);
    } else {
      await notify({
        tenantId: user.tenantId,
        recipientId: request.requestedById,
        title: "Results release request returned",
        body: `${user.fullName} returned ${exam.name}${note ? `: ${note}` : "."}`,
        category: "exams",
        href: `/exams?open=${examId}`,
        channels: ["in_app", "push"],
      });
    }

    return { id: updated.id, status: updated.status, examReleased: decision === "APPROVED" };
  });
}

// ---------------------------------------------------------------------------
// Results: positions, means, grading (B.5.5/6)
// ---------------------------------------------------------------------------

export interface StudentSummary {
  studentId: string;
  name: string;
  admissionNo: string;
  classId: string | null;
  className: string | null;
  total: number;
  subjectCount: number;
  avgPct: number;
  grade: string; // CBC level or 8-4-4 letter (school curriculum)
  position: number;
  classPosition: number;
}

export async function examSummary(user: SessionUser, examId: string) {
  return withTenant(user.tenantId, async () => {
    const exam = await tenantDb().exam.findUnique({ where: { id: examId }, include: { subjects: true } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { curriculum: true } });
    const isCbc = (tenant.curriculum ?? "CBC") === "CBC";

    const results = await tenantDb().examResult.findMany({ where: { examId } });
    const releaseApproval = await latestExamReleaseApproval(user, examId);
    if (results.length === 0) return { exam: { id: exam.id, name: exam.name, maxMarks: exam.maxMarks, published: exam.published }, students: [] as StudentSummary[], classMeans: [], levelMeans: [], subjectMeans: [], releaseApproval };

    const scope = await scopeWhere(user); // parents see own child rows only
    const students = await tenantDb().student.findMany({
      where: { AND: [scope, { id: { in: [...new Set(results.map((r) => r.studentId))] } }] },
      include: { schoolClass: true },
    });
    const visible = new Set(students.map((s) => s.id));

    // Aggregate per student (over ALL results for fair positioning).
    const agg = new Map<string, { total: number; count: number }>();
    for (const r of results) {
      const a = agg.get(r.studentId) ?? { total: 0, count: 0 };
      a.total += r.marks; a.count++;
      agg.set(r.studentId, a);
    }
    const ranked = [...agg.entries()]
      .map(([studentId, a]) => ({ studentId, total: a.total, count: a.count, avgPct: Math.round((a.total / (a.count * exam.maxMarks)) * 100) }))
      .sort((x, y) => y.total - x.total);

    // Overall positions (ties share a position).
    const positions = new Map<string, number>();
    ranked.forEach((r, i) => {
      const prev = ranked[i - 1];
      positions.set(r.studentId, prev && prev.total === r.total ? positions.get(prev.studentId)! : i + 1);
    });

    // Class positions.
    const classOf = new Map(students.map((s) => [s.id, s.classId]));
    const classRank = new Map<string, number>();
    const perClassCounter = new Map<string, { lastTotal: number; lastPos: number; n: number }>();
    for (const r of ranked) {
      const cid = classOf.get(r.studentId) ?? "none";
      const c = perClassCounter.get(cid) ?? { lastTotal: -1, lastPos: 0, n: 0 };
      c.n++;
      const pos = c.lastTotal === r.total ? c.lastPos : c.n;
      c.lastTotal = r.total; c.lastPos = pos;
      perClassCounter.set(cid, c);
      classRank.set(r.studentId, pos);
    }

    const sMap = new Map(students.map((s) => [s.id, s]));
    const summaries: StudentSummary[] = ranked
      .filter((r) => visible.has(r.studentId))
      .map((r) => {
        const s = sMap.get(r.studentId)!;
        return {
          studentId: r.studentId,
          name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
          admissionNo: s.admissionNo,
          classId: s.classId,
          className: s.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : null,
          total: r.total,
          subjectCount: r.count,
          avgPct: r.avgPct,
          grade: isCbc ? cbcLevel(r.avgPct) : grade844(r.avgPct),
          position: positions.get(r.studentId)!,
          classPosition: classRank.get(r.studentId)!,
        };
      });

    // Mean score per class + per subject (B.5.6 + analytics input).
    // NOTE: stream/level means are computed over ALL ranked students (not just
    // visible) so the comparison is honest school data; only leadership and
    // teachers see this endpoint section in the UI.
    const allSummaryLike = ranked.map((r) => {
      const s = sMap.get(r.studentId);
      return s ? { classId: s.classId, className: s.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : null, level: s.schoolClass?.level ?? null, avgPct: r.avgPct } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const classTotals = new Map<string, { sum: number; n: number; label: string; level: string | null }>();
    for (const sm of allSummaryLike) {
      const key = sm.classId ?? "none";
      const c = classTotals.get(key) ?? { sum: 0, n: 0, label: sm.className ?? "—", level: sm.level };
      c.sum += sm.avgPct; c.n++;
      classTotals.set(key, c);
    }
    // Inter-stream comparison: rank streams within each level + level overall.
    const classMeans = [...classTotals.values()]
      .map((c) => ({ label: c.label, level: c.level, mean: Math.round(c.sum / c.n), students: c.n }))
      .sort((a, b) => b.mean - a.mean)
      .map((c, i) => ({ ...c, rank: i + 1 }));
    const levelTotals = new Map<string, { sum: number; n: number }>();
    for (const sm of allSummaryLike) {
      if (!sm.level) continue;
      const l = levelTotals.get(sm.level) ?? { sum: 0, n: 0 };
      l.sum += sm.avgPct; l.n++;
      levelTotals.set(sm.level, l);
    }
    const levelMeans = [...levelTotals.entries()]
      .map(([level, v]) => ({ level, mean: Math.round(v.sum / v.n), students: v.n }))
      .sort((a, b) => b.mean - a.mean);

    const subjAgg = new Map<string, { sum: number; n: number }>();
    for (const r of results) {
      if (!visible.has(r.studentId)) continue;
      const a = subjAgg.get(r.subjectId) ?? { sum: 0, n: 0 };
      a.sum += (r.marks / exam.maxMarks) * 100; a.n++;
      subjAgg.set(r.subjectId, a);
    }
    const subjects = await tenantDb().subject.findMany({ where: { id: { in: [...subjAgg.keys()] } } });
    const subjectMeans = subjects.map((s) => ({
      subjectId: s.id, name: s.name, code: s.code,
      mean: Math.round(subjAgg.get(s.id)!.sum / subjAgg.get(s.id)!.n),
    })).sort((a, b) => b.mean - a.mean);

    return { exam: { id: exam.id, name: exam.name, maxMarks: exam.maxMarks, published: exam.published }, students: summaries, classMeans, levelMeans, subjectMeans, releaseApproval };
  });
}

/** One student's full result for the report card / result slip. */
export async function studentReport(user: SessionUser, examId: string, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] }, include: { schoolClass: true } });
    if (!student) throw new ExamError("NOT_FOUND", "Student not found.");
    const exam = await tenantDb().exam.findUnique({ where: { id: examId } });
    if (!exam) throw new ExamError("NOT_FOUND", "Exam not found.");

    // Parents/students can only see PUBLISHED exams (B.5 publishing gate).
    if (["PARENT", "STUDENT"].includes(user.role) && !exam.published)
      throw new ExamError("FORBIDDEN", "Results for this exam have not been released yet.");

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const isCbc = (tenant.curriculum ?? "CBC") === "CBC";

    const rows = await tenantDb().examResult.findMany({ where: { examId, studentId } });
    const subjects = await tenantDb().subject.findMany({ where: { id: { in: rows.map((r) => r.subjectId) } } });
    const subMap = new Map(subjects.map((s) => [s.id, s]));

    const summary = await examSummary(user, examId);
    const mine = summary.students.find((s) => s.studentId === studentId);

    return {
      exam: { id: exam.id, name: exam.name, year: exam.year, term: exam.term, maxMarks: exam.maxMarks, published: exam.published },
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      },
      school: {
        name: tenant.name, motto: tenant.motto, county: tenant.county,
        addressLine: tenant.addressLine, brandPrimary: tenant.brandPrimary || "#1c2740", logoUrl: tenant.logoUrl,
      },
      curriculum: isCbc ? "CBC" : "8-4-4",
      rows: rows.map((r) => {
        const pct = Math.round((r.marks / exam.maxMarks) * 100);
        return {
          subject: subMap.get(r.subjectId)?.name ?? "—",
          code: subMap.get(r.subjectId)?.code ?? "",
          marks: r.marks,
          pct,
          grade: isCbc ? cbcLevel(pct) : grade844(pct),
        };
      }).sort((a, b) => b.marks - a.marks),
      total: mine?.total ?? rows.reduce((a, r) => a + r.marks, 0),
      avgPct: mine?.avgPct ?? 0,
      overallGrade: mine?.grade ?? "—",
      position: mine?.position ?? null,
      classPosition: mine?.classPosition ?? null,
      cohortSize: summary.students.length,
    };
  });
}
