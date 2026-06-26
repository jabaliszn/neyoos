import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { TransportClient } from "@/components/transport/transport-client";

export const dynamic = "force-dynamic";

/** B.17 Transport — routes, drivers, vehicles, fuel + maintenance, riders. */
export default async function TransportPage() {
  const user = await requirePagePermission("transport.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Transport</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Routes and riders, drivers and vehicles, fuel and maintenance — with expiry alerts.
        </p>
      </div>
      <TransportClient canManage={can(user.role, "transport.manage")} />
    </div>
  );
}
