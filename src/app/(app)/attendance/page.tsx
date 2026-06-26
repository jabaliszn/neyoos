import { requirePagePermission } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { AttendanceTabs } from "@/components/attendance/attendance-tabs";

export const dynamic = "force-dynamic";

/** B.3 Attendance — registers, staff clock in/out, insights. */
export default async function AttendancePage() {
  const user = await requirePagePermission("attendance.view");
  const effectivePermissions = await effectivePermissionsForUser(user);
  const canRecord = effectivePermissions.includes("attendance.record");
  const canInsights = effectivePermissions.includes("attendance.view") && user.role !== "STUDENT" && user.role !== "PARENT";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Attendance</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Mark the daily register per class. Works offline — saves sync when you reconnect.
        </p>
      </div>
      <AttendanceTabs canRecord={canRecord} canInsights={canInsights} currentUserId={user.id} />
    </div>
  );
}
