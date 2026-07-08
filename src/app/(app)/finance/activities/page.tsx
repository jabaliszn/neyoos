import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { ActivitiesClient } from "@/components/finance/activities-client";

export const dynamic = "force-dynamic";

/** R.6 — Trips & activities: a "Form 4 trip"-style optional fee tracker,
 * kept deliberately separate from B.7 compulsory fee invoicing. */
export default async function ActivitiesPage() {
  const user = await requirePagePermission("finance.view");

  return (
    <ActivitiesClient
      canManage={can(user.role, "finance.manage_structure")}
      canRecord={can(user.role, "finance.record_payment")}
    />
  );
}
