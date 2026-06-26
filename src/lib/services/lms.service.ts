/**
 * B.13 LMS — homework submissions + grading, MCQ quizzes with SERVER-side
 * auto-grading, and per-class discussion forums.
 *
 * ACCESS MODEL (fail-closed everywhere):
 * - Teachers: their classes via teacherClassIds() (B.12 rule — class-teacher
 *   OR on the timetable). Leadership unrestricted.
 * - Students: their own class only (Student.userId -> classId).
 * - Parents: their children's classes (scopeWhere A.3.9).
 * - Quiz correct answers NEVER leave the server before an attempt is graded.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { teacherClassIds, TeacherPortalError } from "@/lib/services/teacher-portal.service";
import type { SessionUser } from "@/lib/core/session";
import { assertRespectfulContent } from "@/lib/services/content-moderation.service";

export class LmsError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "ALREADY_DONE" | "CLOSED" | "LOCKED",
    message: string
  ) {
    super(message);
    this.name = "LmsError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** The student this family-portal user acts as, inside one class. */
async function resolveStudentInClass(user: SessionUser, classId: string) {
  const scope = await scopeWhere(user);
  const student = await tenantDb().student.findFirst({
    where: { AND: [scope, { classId, status: "ACTIVE", deletedAt: null }] },
    select: { id: true, firstName: true, middleName: true, lastName: true },
  });
  if (!student) throw new LmsError("FORBIDDEN", "No student of yours is in this class.");
  return student;
}

/** Class ids a family-portal user (STUDENT/PARENT) belongs to. */
async function familyClassIds(user: SessionUser): Promise<string[]> {
  const scope = await scopeWhere(user);
  const kids = await tenantDb().student.findMany({
    where: { AND: [scope, { status: "ACTIVE", deletedAt: null }] },
    select: { classId: true },
  });
  const ids = [...new Set(kids.map((k) => k.classId).filter((x): x is string => Boolean(x)))];
  return ids.length ? ids : ["__none__"];
}

async function assertTeacherClass(user: SessionUser, classId: string) {
  const allowed = await teacherClassIds(user);
  if (allowed !== null && !allowed.includes(classId))
    throw new TeacherPortalError("FORBIDDEN", "That is not one of your classes.");
}

// ---------------------------------------------------------------------------
// Homework submissions (B.13.3)
// ---------------------------------------------------------------------------

/** Family side: submit (or re-submit until graded) work for a homework task. */
export async function submitHomework(
  user: SessionUser,
  input: { homeworkId: string; text?: string; fileUrl?: string; fileName?: string }
) {
  return withTenant(user.tenantId, async () => {
    const hw = await tenantDb().homework.findUnique({ where: { id: input.homeworkId } });
    if (!hw) throw new LmsError("NOT_FOUND", "Homework not found.");
    const student = await resolveStudentInClass(user, hw.classId);

    const existing = await tenantDb().homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId: hw.id, studentId: student.id } },
    });
    if (existing?.gradePct != null)
      throw new LmsError("ALREADY_DONE", "This work has already been graded — it can no longer be changed.");

    const late = nairobiToday() > hw.dueDate;
    const row = existing
      ? await tenantDb().homeworkSubmission.update({
          where: { id: existing.id },
          data: { text: input.text ?? null, fileUrl: input.fileUrl ?? null, fileName: input.fileName ?? null, late, submittedAt: new Date() },
        })
      : await db.homeworkSubmission.create({
          data: {
            tenantId: user.tenantId, homeworkId: hw.id, studentId: student.id,
            text: input.text ?? null, fileUrl: input.fileUrl ?? null, fileName: input.fileName ?? null, late,
          },
        });
    await audit(user, "lms.homework_submitted", "homeworkSubmission", row.id, { homework: hw.title, student: fullName(student), late });
    return { id: row.id, late, resubmitted: Boolean(existing) };
  });
}

/** Teacher side: every submission for a task + who has NOT submitted. */
export async function submissionsForHomework(user: SessionUser, homeworkId: string) {
  return withTenant(user.tenantId, async () => {
    const hw = await tenantDb().homework.findUnique({ where: { id: homeworkId }, include: { subject: true } });
    if (!hw) throw new LmsError("NOT_FOUND", "Homework not found.");
    await assertTeacherClass(user, hw.classId);

    const [subs, roster] = await Promise.all([
      tenantDb().homeworkSubmission.findMany({ where: { homeworkId }, orderBy: { submittedAt: "asc" } }),
      tenantDb().student.findMany({
        where: { classId: hw.classId, status: "ACTIVE", deletedAt: null },
        select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
    const subByStudent = new Map(subs.map((s) => [s.studentId, s]));
    return {
      homework: { id: hw.id, title: hw.title, dueDate: hw.dueDate, subjectName: hw.subject.name },
      students: roster.map((s) => {
        const sub = subByStudent.get(s.id);
        return {
          studentId: s.id, name: fullName(s), admissionNo: s.admissionNo,
          submission: sub
            ? {
                id: sub.id, text: sub.text, fileUrl: sub.fileUrl, fileName: sub.fileName,
                late: sub.late, submittedAt: sub.submittedAt, gradePct: sub.gradePct, feedback: sub.feedback,
              }
            : null,
        };
      }),
      submitted: subs.length,
      graded: subs.filter((s) => s.gradePct != null).length,
    };
  });
}

export async function gradeSubmission(user: SessionUser, input: { submissionId: string; gradePct: number; feedback?: string }) {
  return withTenant(user.tenantId, async () => {
    const sub = await tenantDb().homeworkSubmission.findUnique({
      where: { id: input.submissionId }, include: { homework: true },
    });
    if (!sub) throw new LmsError("NOT_FOUND", "Submission not found.");
    await assertTeacherClass(user, sub.homework.classId);
    const row = await tenantDb().homeworkSubmission.update({
      where: { id: sub.id },
      data: { gradePct: input.gradePct, feedback: input.feedback ?? null, gradedById: user.id, gradedAt: new Date() },
    });
    await audit(user, "lms.submission_graded", "homeworkSubmission", row.id, { gradePct: input.gradePct });
    return row;
  });
}

/** Family side: submission status per homework for one child (portal card). */
export async function mySubmissions(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new LmsError("NOT_FOUND", "Student not found.");
    const subs = await tenantDb().homeworkSubmission.findMany({ where: { studentId } });
    return new Map(subs.map((s) => [s.homeworkId, s]));
  });
}

// ---------------------------------------------------------------------------
// Quizzes with auto-grade (B.13.2)
// ---------------------------------------------------------------------------

export async function createQuiz(
  user: SessionUser,
  input: {
    classId: string; subjectId: string; title: string; instructions?: string; dueDate?: string;
    questions: { prompt: string; options: string[]; correctIndex: number }[];
  }
) {
  return withTenant(user.tenantId, async () => {
    await assertTeacherClass(user, input.classId);
    const subject = await tenantDb().subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new LmsError("NOT_FOUND", "Subject not found.");

    const quiz = await db.quiz.create({
      data: {
        tenantId: user.tenantId, classId: input.classId, subjectId: input.subjectId,
        teacherId: user.id, teacherName: user.fullName,
        title: input.title, instructions: input.instructions ?? null, dueDate: input.dueDate ?? null,
      },
    });
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      await db.quizQuestion.create({
        data: {
          tenantId: user.tenantId, quizId: quiz.id, order: i + 1,
          prompt: q.prompt, options: JSON.stringify(q.options), correctIndex: q.correctIndex,
        },
      });
    }
    await audit(user, "lms.quiz_created", "quiz", quiz.id, { title: input.title, questions: input.questions.length });
    return quiz;
  });
}

export async function publishQuiz(user: SessionUser, quizId: string, published: boolean) {
  return withTenant(user.tenantId, async () => {
    const quiz = await tenantDb().quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new LmsError("NOT_FOUND", "Quiz not found.");
    await assertTeacherClass(user, quiz.classId);
    const row = await tenantDb().quiz.update({ where: { id: quizId }, data: { published } });
    await audit(user, published ? "lms.quiz_published" : "lms.quiz_unpublished", "quiz", quizId, {});
    return row;
  });
}

/** Teacher list: quizzes in my classes with attempt stats. */
export async function listQuizzesForTeacher(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const allowed = await teacherClassIds(user);
    const where = allowed === null ? {} : { classId: { in: allowed } };
    const quizzes = await tenantDb().quiz.findMany({
      where, include: { subject: true, questions: { select: { id: true } }, attempts: { select: { scorePct: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    const classIds = [...new Set(quizzes.map((q) => q.classId))];
    const classes = classIds.length ? await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    return quizzes.map((q) => ({
      id: q.id, title: q.title, className: cMap.get(q.classId) ?? "—", classId: q.classId,
      subjectName: q.subject.name, published: q.published, dueDate: q.dueDate,
      questions: q.questions.length, attempts: q.attempts.length,
      avgPct: q.attempts.length ? Math.round(q.attempts.reduce((a, x) => a + x.scorePct, 0) / q.attempts.length) : null,
      mine: q.teacherId === user.id, teacherName: q.teacherName,
    }));
  });
}

/** Teacher: per-student results for one quiz. */
export async function quizResults(user: SessionUser, quizId: string) {
  return withTenant(user.tenantId, async () => {
    const quiz = await tenantDb().quiz.findUnique({ where: { id: quizId }, include: { subject: true, questions: { orderBy: { order: "asc" } } } });
    if (!quiz) throw new LmsError("NOT_FOUND", "Quiz not found.");
    await assertTeacherClass(user, quiz.classId);
    const [attempts, roster] = await Promise.all([
      tenantDb().quizAttempt.findMany({ where: { quizId }, orderBy: { submittedAt: "asc" } }),
      tenantDb().student.findMany({
        where: { classId: quiz.classId, status: "ACTIVE", deletedAt: null },
        select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
    const byStudent = new Map(attempts.map((a) => [a.studentId, a]));
    return {
      quiz: { id: quiz.id, title: quiz.title, published: quiz.published, subjectName: quiz.subject.name, questionCount: quiz.questions.length },
      students: roster.map((s) => {
        const a = byStudent.get(s.id);
        return { studentId: s.id, name: fullName(s), admissionNo: s.admissionNo, scorePct: a?.scorePct ?? null, score: a?.score ?? null, total: a?.total ?? null, submittedAt: a?.submittedAt ?? null };
      }),
      attempted: attempts.length,
      avgPct: attempts.length ? Math.round(attempts.reduce((a, x) => a + x.scorePct, 0) / attempts.length) : null,
    };
  });
}

/** Family side: published quizzes for one child, with their attempt result. */
export async function quizzesForStudent(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new LmsError("NOT_FOUND", "Student not found.");
    if (!child.classId) return [];
    const quizzes = await tenantDb().quiz.findMany({
      where: { classId: child.classId, published: true },
      include: { subject: true, questions: { select: { id: true } } },
      orderBy: { createdAt: "desc" }, take: 30,
    });
    const attempts = await tenantDb().quizAttempt.findMany({ where: { studentId, quizId: { in: quizzes.map((q) => q.id) } } });
    const aMap = new Map(attempts.map((a) => [a.quizId, a]));
    const today = nairobiToday();
    return quizzes.map((q) => {
      const a = aMap.get(q.id);
      return {
        id: q.id, title: q.title, subjectName: q.subject.name, teacherName: q.teacherName,
        instructions: q.instructions, dueDate: q.dueDate, questions: q.questions.length,
        closed: Boolean(q.dueDate && q.dueDate < today),
        attempt: a ? { scorePct: a.scorePct, score: a.score, total: a.total, submittedAt: a.submittedAt } : null,
      };
    });
  });
}

/** Family side: the quiz paper WITHOUT answers (to take it). */
export async function getQuizPaper(user: SessionUser, quizId: string, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new LmsError("NOT_FOUND", "Student not found.");
    const quiz = await tenantDb().quiz.findUnique({ where: { id: quizId }, include: { subject: true, questions: { orderBy: { order: "asc" } } } });
    if (!quiz || !quiz.published || quiz.classId !== child.classId)
      throw new LmsError("NOT_FOUND", "Quiz not found.");
    const existing = await tenantDb().quizAttempt.findUnique({ where: { quizId_studentId: { quizId, studentId } } });
    if (existing) throw new LmsError("ALREADY_DONE", "This quiz has already been taken — one attempt per learner.");
    if (quiz.dueDate && quiz.dueDate < nairobiToday())
      throw new LmsError("CLOSED", "This quiz is closed (past the due date).");
    return {
      id: quiz.id, title: quiz.title, instructions: quiz.instructions, subjectName: quiz.subject.name,
      // SECURITY: correctIndex deliberately stripped.
      questions: quiz.questions.map((q) => ({ order: q.order, prompt: q.prompt, options: JSON.parse(q.options) as string[] })),
    };
  });
}

/** Family side: submit answers — graded on the SERVER, one attempt only. */
export async function submitQuizAttempt(user: SessionUser, input: { quizId: string; answers: number[] }, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new LmsError("NOT_FOUND", "Student not found.");
    const quiz = await tenantDb().quiz.findUnique({ where: { id: input.quizId }, include: { questions: { orderBy: { order: "asc" } } } });
    if (!quiz || !quiz.published || quiz.classId !== child.classId)
      throw new LmsError("NOT_FOUND", "Quiz not found.");
    if (quiz.dueDate && quiz.dueDate < nairobiToday())
      throw new LmsError("CLOSED", "This quiz is closed (past the due date).");
    const existing = await tenantDb().quizAttempt.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId } } });
    if (existing) throw new LmsError("ALREADY_DONE", "This quiz has already been taken — one attempt per learner.");

    const total = quiz.questions.length;
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (input.answers[i] === q.correctIndex) score++;
    });
    const scorePct = total ? Math.round((score / total) * 100) : 0;
    const row = await db.quizAttempt.create({
      data: {
        tenantId: user.tenantId, quizId: quiz.id, studentId,
        answers: JSON.stringify(input.answers.slice(0, total)), score, total, scorePct,
      },
    });
    await audit(user, "lms.quiz_attempted", "quizAttempt", row.id, { quiz: quiz.title, student: fullName(child), scorePct });
    // Reveal the corrections AFTER grading (review mode).
    return {
      score, total, scorePct,
      review: quiz.questions.map((q, i) => ({
        prompt: q.prompt, options: JSON.parse(q.options) as string[],
        yourAnswer: input.answers[i] ?? -1, correctIndex: q.correctIndex,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Discussion forums (B.13.4)
// ---------------------------------------------------------------------------

/** Classes whose forum this user may read/write. null = all (leadership). */
async function forumClassIds(user: SessionUser): Promise<string[] | null> {
  const role = user.role;
  if (role === "STUDENT" || role === "PARENT") return familyClassIds(user);
  return teacherClassIds(user); // teachers own classes; leadership null
}

export async function listThreads(user: SessionUser, classId: string) {
  return withTenant(user.tenantId, async () => {
    const allowed = await forumClassIds(user);
    if (allowed !== null && !allowed.includes(classId))
      throw new LmsError("FORBIDDEN", "You are not part of this class forum.");
    const threads = await tenantDb().forumThread.findMany({
      where: { classId },
      include: { posts: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return threads.map((t) => ({
      id: t.id, title: t.title, body: t.body, authorName: t.authorName, authorRole: t.authorRole,
      locked: t.locked, createdAt: t.createdAt, replies: t.posts.length,
      lastActivity: t.posts.length ? t.posts[t.posts.length - 1].createdAt : t.createdAt,
    }));
  });
}

export async function createThread(user: SessionUser, input: { classId: string; title: string; body: string }) {
  assertRespectfulContent(`${input.title} ${input.body}`, "class discussion");
  return withTenant(user.tenantId, async () => {
    const allowed = await forumClassIds(user);
    if (allowed !== null && !allowed.includes(input.classId))
      throw new LmsError("FORBIDDEN", "You are not part of this class forum.");
    const row = await db.forumThread.create({
      data: {
        tenantId: user.tenantId, classId: input.classId, title: input.title, body: input.body,
        authorId: user.id, authorName: user.fullName, authorRole: user.role,
      },
    });
    await audit(user, "lms.thread_created", "forumThread", row.id, { title: input.title });
    return row;
  });
}

export async function getThread(user: SessionUser, threadId: string) {
  return withTenant(user.tenantId, async () => {
    const t = await tenantDb().forumThread.findUnique({
      where: { id: threadId }, include: { posts: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) throw new LmsError("NOT_FOUND", "Thread not found.");
    const allowed = await forumClassIds(user);
    if (allowed !== null && !allowed.includes(t.classId))
      throw new LmsError("FORBIDDEN", "You are not part of this class forum.");
    return {
      id: t.id, classId: t.classId, title: t.title, body: t.body,
      authorName: t.authorName, authorRole: t.authorRole, locked: t.locked, createdAt: t.createdAt,
      posts: t.posts.map((p) => ({ id: p.id, body: p.body, authorName: p.authorName, authorRole: p.authorRole, createdAt: p.createdAt, mine: p.authorId === user.id })),
    };
  });
}

export async function addPost(user: SessionUser, input: { threadId: string; body: string }) {
  assertRespectfulContent(input.body, "class discussion reply");
  return withTenant(user.tenantId, async () => {
    const t = await tenantDb().forumThread.findUnique({ where: { id: input.threadId } });
    if (!t) throw new LmsError("NOT_FOUND", "Thread not found.");
    if (t.locked) throw new LmsError("LOCKED", "This thread is locked by the teacher.");
    const allowed = await forumClassIds(user);
    if (allowed !== null && !allowed.includes(t.classId))
      throw new LmsError("FORBIDDEN", "You are not part of this class forum.");
    const row = await db.forumPost.create({
      data: {
        tenantId: user.tenantId, threadId: t.id, body: input.body,
        authorId: user.id, authorName: user.fullName, authorRole: user.role,
      },
    });
    return row;
  });
}

/** Teacher/leadership: lock or unlock a thread. */
export async function lockThread(user: SessionUser, threadId: string, locked: boolean) {
  return withTenant(user.tenantId, async () => {
    const t = await tenantDb().forumThread.findUnique({ where: { id: threadId } });
    if (!t) throw new LmsError("NOT_FOUND", "Thread not found.");
    await assertTeacherClass(user, t.classId); // students/parents never reach here (route is permission-gated)
    const row = await tenantDb().forumThread.update({ where: { id: threadId }, data: { locked } });
    await audit(user, locked ? "lms.thread_locked" : "lms.thread_unlocked", "forumThread", threadId, {});
    return row;
  });
}
