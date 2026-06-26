import { requirePageUser } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { redirect } from "next/navigation";
import { PrintStationClient } from "@/components/reception/print-station-client";

export const dynamic = "force-dynamic";

/** G.31 Print station — leave this open at reception; documents print themselves. */
export default async function PrintStationPage() {
  const user = await requirePageUser();
  const permissions = await effectivePermissionsForUser(user);
  if (!permissions.includes("reception.operate") && !permissions.includes("finance.view")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Print station</h1>
      <p className="-mt-4 text-sm text-navy-500 dark:text-navy-400">
        Keep this page open — every paid invoice and receipt prints itself here. Offline? Jobs queue and flush when you&apos;re back.
      </p>
      <PrintStationClient />
    </div>
  );
}
