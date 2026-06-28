import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { tenantDb } from "@/lib/core/tenant-db";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const tDb = tenantDb();
    
    const tenant = await tDb.tenant.findUnique({ where: { id: user.tenantId } });
    const exams = await tDb.exam.findMany({ include: { results: { include: { student: { include: { schoolClass: true } } } } } });

    // Build a class-wise/stream-wise average array for the print roster
    const raw: any[] = [];
    for (const ex of exams) {
      for (const res of ex.results) {
        raw.push({
          className: res.student.schoolClass ? \`\${res.student.schoolClass.level} \${res.student.schoolClass.stream || ""}\` : "Unknown",
          studentName: \`\${res.student.firstName} \${res.student.lastName}\`,
          admNo: res.student.admissionNo,
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

    return ok({ data: { tenant, results } });
  } catch (error) {
    return handleError(error);
  }
}
