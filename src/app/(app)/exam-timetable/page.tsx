import { requirePagePermission } from "@/lib/core/page-guards";
import { effectivePermissionsForUser, getCurrentUser } from "@/lib/core/session";
import { examTimetableBoard } from "@/lib/services/exam-timetable.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { ExamMaterialsClient } from "@/components/exams/exam-materials-client";

export const dynamic = "force-dynamic";

export default async function ExamTimetablePage() {
  await requirePagePermission("exam.view");
  const user = await getCurrentUser();
  if (!user) return null;
  const board = await examTimetableBoard(user);
  const permissions = await effectivePermissionsForUser(user);
  const canManage = permissions.includes("exam.manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-navy-50">Exam timetable</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">A dedicated exam schedule separate from the normal lesson timetable.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-green-600" /> Scheduled exams</CardTitle></CardHeader>
        <CardContent>
          {board.slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-navy-200 p-8 text-center text-sm text-navy-400 dark:border-navy-800">No exam timetable slots yet. Add slots from the exam timetable API or upcoming timetable tools.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-navy-400"><tr><th className="py-2">Date</th><th>Time</th><th>Class</th><th>Subject</th><th>Exam</th><th>Venue</th></tr></thead>
                <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
                  {board.slots.map((s) => (
                    <tr key={s.id}><td className="py-3 font-mono text-xs">{s.examDate}</td><td>{s.startTime}–{s.endTime}</td><td>{s.className}</td><td>{s.subjectName}</td><td><Badge tone="blue">{s.examName}</Badge></td><td>{s.venue || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ExamMaterialsClient canManage={canManage} />
    </div>
  );
}
