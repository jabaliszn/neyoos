import { requirePagePermission } from "@/lib/core/page-guards";
import { db } from "@/lib/db";
import { ReceptionDesk } from "@/components/reception/reception-desk";

export const dynamic = "force-dynamic";

/** Front desk (A.18): receptionist operations workspace. */
export default async function ReceptionPage() {
  const user = await requirePagePermission("reception.operate");
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Front desk
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Sign in visitors, record walk-in payments, capture inquiries and relay
          calls — everything for today, in one place.
        </p>
      </div>
      <ReceptionDesk schoolName={tenant?.name ?? "School"} />
    </div>
  );
}
