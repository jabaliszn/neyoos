import { requirePagePermission } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { StaffClient } from "@/components/hr/staff-client";

export const dynamic = "force-dynamic";

/** B.9 Staff & HR — directory, leave, recruitment, records. */
export default async function StaffPage() {
  const user = await requirePagePermission("staff.view");
  const effectivePermissions = await effectivePermissionsForUser(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Staff</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Records, leave, recruitment and HR files.
        </p>
      </div>
      <StaffClient canManage={effectivePermissions.includes("staff.manage")} />
    </div>
  );
}
