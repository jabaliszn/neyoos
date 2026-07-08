import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");

    const { tenant, results } = await withTenant(user.tenantId, async () => {
      const tDb = tenantDb();

      const tenant = await tDb.tenant.findUnique({ where: { id: user.tenantId } });
      const exams = await tDb.exam.findMany({ include: { results: true } });

      const studentIds = [...new Set(exams.flatMap((ex) => ex.results.map((r) => r.studentId)))];
      const students = studentIds.length
        ? await tDb.student.findMany({ where: { id: { in: studentIds } }, include: { schoolClass: true } })
        : [];
      const studentMap = new Map(students.map((s) => [s.id, s]));

      // Build a class-wise/stream-wise average array for the print roster
      const raw: any[] = [];
      for (const ex of exams) {
        for (const res of ex.results) {
          const student = studentMap.get(res.studentId);
          if (!student) continue;
          raw.push({
            className: student.schoolClass ? `${student.schoolClass.level} ${student.schoolClass.stream || ""}` : "Unknown",
            studentName: `${student.firstName} ${student.lastName}`,
            admNo: student.admissionNo,
            mark: Math.round((res.marks / Math.max(1, ex.maxMarks)) * 100)
          });
        }
      }

      // Group by student to get their average
      const studentAverages = new Map<string, { className: string, studentName: string, admNo: string, total: number, count: number }>();
      for (const r of raw) {
        const key = r.admNo;
        if (!studentAverages.has(key)) {
          studentAverages.set(key, { className: r.className, studentName: r.studentName, admNo: r.admNo, total: 0, count: 0 });
        }
        const st = studentAverages.get(key)!;
        st.total += r.mark;
        st.count++;
      }

      const results = Array.from(studentAverages.values())
        .map(s => ({ ...s, average: Math.round(s.total / s.count) }))
        .sort((a, b) => a.className.localeCompare(b.className) || b.average - a.average);

      return { tenant, results };
    });

    return ok({ tenant, results });
  } catch (error) {
    return handleError(error);
  }
}
