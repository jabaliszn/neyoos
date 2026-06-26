import { requirePagePermission } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { DisciplineClient } from "@/components/discipline/discipline-client";

export const dynamic = "force-dynamic";

/** B.20 Discipline — incidents, behavior board, suspensions, counseling. */
export default async function DisciplinePage() {
  const user = await requirePagePermission("discipline.view");
  const effectivePermissions = await effectivePermissionsForUser(user);
  const roleSet = [user.role, user.secondaryRole].filter(Boolean);
  const canApproveDiscipline = roleSet.some((r) => ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].includes(r!));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Discipline</h1>
      <p className="-mt-4 text-sm text-navy-500 dark:text-navy-400">
        Incident reports, demerit tracking, suspensions — major incidents SMS the parent automatically.
      </p>
      <DisciplineClient
        canManage={effectivePermissions.includes("discipline.manage")}
        canConfidential={canApproveDiscipline}
        canApproveDiscipline={canApproveDiscipline}
      />
    </div>
  );
}
