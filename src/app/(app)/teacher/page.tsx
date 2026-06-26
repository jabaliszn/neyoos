import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { TeacherPortalClient } from "@/components/teacher/teacher-portal-client";

export const dynamic = "force-dynamic";

/** B.12 Teacher Portal — My Classes: roster, timetable, homework, notes, reports. */
export default async function TeacherPage() {
  const user = await requirePagePermission("portal.teacher");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">My classes</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Your timetable, homework, class notes and one-tap links to registers and marks.
        </p>
      </div>
      <TeacherPortalClient canAssign={can(user.role, "homework.assign")} />
    </div>
  );
}
