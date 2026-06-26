import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { HostelClient } from "@/components/hostel/hostel-client";

export const dynamic = "force-dynamic";

/** B.16 Hostel — dorms, beds, curfew register, boarding fees, visitors. */
export default async function HostelPage() {
  const user = await requirePagePermission("hostel.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Hostel</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Dorms and beds, the nightly curfew register, and boarding fees.
        </p>
      </div>
      <HostelClient canManage={can(user.role, "hostel.manage")} />
    </div>
  );
}
