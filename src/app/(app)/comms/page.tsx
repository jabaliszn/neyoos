import { requirePagePermission } from "@/lib/core/page-guards";
import { CommsClient } from "@/components/comms/comms-client";

export const dynamic = "force-dynamic";

/** B.14 Communication — bulk SMS / announcements with quota + cost preview. */
export default async function CommsPage() {
  await requirePagePermission("comms.send");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Communication</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Message every parent, one class, or a staff role — with the cost shown before you send.
        </p>
      </div>
      <CommsClient />
    </div>
  );
}
