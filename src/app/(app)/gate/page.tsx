import { requirePagePermission } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { GateClient } from "@/components/security/gate-client";

export const dynamic = "force-dynamic";

/** B.22 Security — gate passes, pickup authorisation, panic alerts. */
export default async function GatePage() {
  const user = await requirePagePermission("security.view");
  const effectivePermissions = await effectivePermissionsForUser(user);
  const roleSet = [user.role, user.secondaryRole].filter(Boolean);
  const canIssuePass = roleSet.some((r) => ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN", "HOD", "DEAN_OF_STUDIES"].includes(r!));
  const canApprovePass = roleSet.some((r) => ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].includes(r!));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Security</h1>
      <p className="-mt-4 text-sm text-navy-500 dark:text-navy-400">
        Gate passes, who may pick each learner, and the emergency panic button.
      </p>
      <GateClient canManage={effectivePermissions.includes("security.manage")} canPanic={effectivePermissions.includes("panic.raise")} canIssuePass={canIssuePass} canApprovePass={canApprovePass} currentUserId={user.id} />
    </div>
  );
}
