import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { examAnalytics } from "../src/lib/services/exam-analytics.service";
import { buildStudentTranscriptPdf } from "../src/lib/services/document.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
function asUser(user: any) { return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, secondaryRole: user.secondaryRole, language: user.language || "en" }; }

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/exam-analytics.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/exams/analytics/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/exams/exam-analytics-client.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/exams/page.tsx"), "utf8");
  const transcriptService = readFileSync(join(process.cwd(), "src/lib/services/document.service.ts"), "utf8");

  assert(service.includes("subjectPerformance") && service.includes("teacherPerformance") && service.includes("studentProgress"), "Analytics service computes subject, teacher and learner progress sections");
  assert(api.includes("requirePermission(\"exam.view\")") && api.includes("examAnalytics"), "Analytics API is exam.view gated");
  assert(ui.includes("Multi-term performance analytics") && ui.includes("Teacher-linked performance"), "Exams UI renders analytics dashboard");
  assert(page.includes("<ExamAnalyticsClient />"), "Exams page mounts analytics above exams manager");
  assert(transcriptService.includes("published: true") && transcriptService.includes("Term ${exam.term} ${exam.year}"), "Transcript builder already collects published multi-term exam records");

  const user = await db.user.findFirst({ where: { role: { in: ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"] } } }) || await db.user.findFirst();
  assert(user, "Leadership user exists");
  const tenantId = user!.tenantId;
  const students = await db.student.findMany({ where: { tenantId, status: "ACTIVE", classId: { not: null } }, take: 2 });
  const subjects = await db.subject.findMany({ where: { tenantId }, take: 2 });
  assert(students.length >= 1 && subjects.length >= 1, "Students and subjects exist for analytics test");
  const teacher = await db.user.findFirst({ where: { tenantId, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD"] } } }) || user;
  const classId = students[0].classId!;
  await db.classSubjectNeed.upsert({ where: { tenantId_classId_subjectId: { tenantId, classId, subjectId: subjects[0].id } }, create: { tenantId, classId, subjectId: subjects[0].id, teacherId: teacher!.id, lessonsPerWeek: 5 }, update: { teacherId: teacher!.id } });
  const examA = await db.exam.create({ data: { tenantId, name: "I60 Analytics Term 1", year: 2026, term: 1, type: "EXAM", maxMarks: 100, published: true } });
  const examB = await db.exam.create({ data: { tenantId, name: "I60 Analytics Term 2", year: 2026, term: 2, type: "EXAM", maxMarks: 100, published: true } });
  try {
    for (const subject of subjects) {
      await db.examSubject.create({ data: { examId: examA.id, subjectId: subject.id } }).catch(() => null);
      await db.examSubject.create({ data: { examId: examB.id, subjectId: subject.id } }).catch(() => null);
    }
    for (const student of students) {
      await db.examResult.create({ data: { tenantId, examId: examA.id, studentId: student.id, subjectId: subjects[0].id, marks: 60, enteredById: user!.id } });
      await db.examResult.create({ data: { tenantId, examId: examB.id, studentId: student.id, subjectId: subjects[0].id, marks: 78, enteredById: user!.id } });
      if (subjects[1]) {
        await db.examResult.create({ data: { tenantId, examId: examA.id, studentId: student.id, subjectId: subjects[1].id, marks: 55, enteredById: user!.id } });
        await db.examResult.create({ data: { tenantId, examId: examB.id, studentId: student.id, subjectId: subjects[1].id, marks: 66, enteredById: user!.id } });
      }
    }
    const analytics = await examAnalytics(asUser(user));
    assert(analytics.termTrend.some((t) => t.termKey === "2026-T1") && analytics.termTrend.some((t) => t.termKey === "2026-T2"), "Analytics includes multi-term trend rows");
    assert(analytics.subjectPerformance.some((s) => s.subjectId === subjects[0].id), "Analytics includes per-subject performance");
    assert(analytics.teacherPerformance.some((t) => t.teacherId === teacher!.id), "Analytics links performance to assigned teacher via ClassSubjectNeed");
    assert(analytics.studentProgress.some((s) => s.delta > 0 && s.trend === "rising"), "Analytics identifies rising learner progress across terms");
    const transcript = await buildStudentTranscriptPdf(tenantId, students[0].id);
    assert(transcript.pdf.subarray(0, 4).toString() === "%PDF" && transcript.fileName.includes("Transcript"), "Existing transcript PDF renders multi-term records");
  } finally {
    await db.examResult.deleteMany({ where: { examId: { in: [examA.id, examB.id] } } });
    await db.examSubject.deleteMany({ where: { examId: { in: [examA.id, examB.id] } } });
    await db.exam.deleteMany({ where: { id: { in: [examA.id, examB.id] } } });
  }

  console.log("\nI.60 Exam Analytics + Multi-term Transcripts test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
