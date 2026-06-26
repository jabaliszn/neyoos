import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

function pct(marks: number, maxMarks: number) {
  return Math.round((marks / Math.max(1, maxMarks)) * 100);
}
function avg(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}
function trendLabel(delta: number) {
  if (delta >= 5) return "rising";
  if (delta <= -5) return "falling";
  return "steady";
}

export async function examAnalytics(user: SessionUser) {
  const [exams, results, subjects, students, classNeeds, teachers] = await Promise.all([
    db.exam.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ year: "asc" }, { term: "asc" }, { createdAt: "asc" }] }),
    db.examResult.findMany({ where: { tenantId: user.tenantId } }),
    db.subject.findMany({ where: { tenantId: user.tenantId } }),
    db.student.findMany({ where: { tenantId: user.tenantId }, select: { id: true, classId: true, firstName: true, lastName: true, admissionNo: true } }),
    db.classSubjectNeed.findMany({ where: { tenantId: user.tenantId } }),
    db.user.findMany({ where: { tenantId: user.tenantId }, select: { id: true, fullName: true, role: true } }),
  ]);

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const teacherByClassSubject = new Map(classNeeds.map((n) => [`${n.classId}:${n.subjectId}`, n.teacherId || ""]));

  const termGroups = new Map<string, number[]>();
  const subjectGroups = new Map<string, number[]>();
  const teacherGroups = new Map<string, number[]>();
  const studentTermGroups = new Map<string, Map<string, number[]>>();

  for (const r of results) {
    const exam = examMap.get(r.examId);
    const student = studentMap.get(r.studentId);
    if (!exam || !student) continue;
    const score = pct(r.marks, exam.maxMarks);
    const termKey = `${exam.year}-T${exam.term}`;
    if (!termGroups.has(termKey)) termGroups.set(termKey, []);
    termGroups.get(termKey)!.push(score);
    if (!subjectGroups.has(r.subjectId)) subjectGroups.set(r.subjectId, []);
    subjectGroups.get(r.subjectId)!.push(score);

    const teacherId = student.classId ? teacherByClassSubject.get(`${student.classId}:${r.subjectId}`) : null;
    if (teacherId) {
      if (!teacherGroups.has(teacherId)) teacherGroups.set(teacherId, []);
      teacherGroups.get(teacherId)!.push(score);
    }

    if (!studentTermGroups.has(r.studentId)) studentTermGroups.set(r.studentId, new Map());
    const byTerm = studentTermGroups.get(r.studentId)!;
    if (!byTerm.has(termKey)) byTerm.set(termKey, []);
    byTerm.get(termKey)!.push(score);
  }

  const termTrend = [...termGroups.entries()].map(([termKey, scores]) => ({ termKey, mean: avg(scores), entries: scores.length }));
  const subjectPerformance = [...subjectGroups.entries()].map(([subjectId, scores]) => {
    const subject = subjectMap.get(subjectId);
    return { subjectId, name: subject?.name || "Unknown subject", code: subject?.code || "", mean: avg(scores), entries: scores.length };
  }).sort((a, b) => b.mean - a.mean);
  const teacherPerformance = [...teacherGroups.entries()].map(([teacherId, scores]) => {
    const teacher = teacherMap.get(teacherId);
    return { teacherId, teacherName: teacher?.fullName || "Unassigned teacher", mean: avg(scores), entries: scores.length };
  }).sort((a, b) => b.mean - a.mean);

  const studentProgress = [...studentTermGroups.entries()].map(([studentId, byTerm]) => {
    const s = studentMap.get(studentId);
    const points = [...byTerm.entries()].map(([termKey, scores]) => ({ termKey, mean: avg(scores) })).sort((a, b) => a.termKey.localeCompare(b.termKey));
    const first = points[0]?.mean ?? 0;
    const last = points[points.length - 1]?.mean ?? 0;
    return { studentId, name: [s?.firstName, s?.lastName].filter(Boolean).join(" "), admissionNo: s?.admissionNo || "", points, delta: last - first, trend: trendLabel(last - first) };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 20);

  return {
    summary: {
      exams: exams.length,
      results: results.length,
      subjects: subjects.length,
      teachersWithData: teacherPerformance.length,
      terms: termTrend.length,
    },
    termTrend,
    subjectPerformance,
    teacherPerformance,
    studentProgress,
  };
}
