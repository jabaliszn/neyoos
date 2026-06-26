import { requirePagePermission } from "@/lib/core/page-guards";
import { OwnersManager } from "@/components/settings/owners-manager";

export const dynamic = "force-dynamic";

/** H.2 Multi-Owner Support — co-owners + joint-approval policy + pending decisions. */
export default async function OwnersPage() {
  await requirePagePermission("tenant.manage_settings");

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Owners &amp; joint approvals
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Register multiple school owners and require a second owner&apos;s approval for critical actions.
        </p>
      </div>
      <OwnersManager />
    </div>
  );
}
