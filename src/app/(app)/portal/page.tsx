import { requirePagePermission } from "@/lib/core/page-guards";
import { ParentPortalClient } from "@/components/portal/parent-portal-client";
import { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";

export const dynamic = "force-dynamic";

/** B.10 Parent Portal — My Children: fees, results, attendance, messaging. */
export default async function PortalPage() {
  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();
  await requirePagePermission("portal.parent");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">My children</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Fees, results, attendance and a direct line to the school.
        </p>
      </div>
      <ParentPortalClient isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />
    </div>
  );
}
