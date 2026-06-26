import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { ClinicClient } from "@/components/clinic/clinic-client";

export const dynamic = "force-dynamic";

/** B.21 Medical / Clinic — visits, allergies, medications, health report. */
export default async function ClinicPage() {
  const user = await requirePagePermission("clinic.view");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Clinic</h1>
      <p className="-mt-4 text-sm text-navy-500 dark:text-navy-400">
        Sickbay visits, the allergy register, medication tracking — referrals SMS the parent.
      </p>
      <ClinicClient canManage={can(user.role, "clinic.manage")} />
    </div>
  );
}
