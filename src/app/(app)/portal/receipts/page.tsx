import { requirePagePermission } from "@/lib/core/page-guards";
import { ReceiptsClient } from "@/components/portal/receipts-client";

export const dynamic = "force-dynamic";

/** R.5 — every real receipt for the parent's own children, delivered here
 * automatically the moment a payment is confirmed PAID — never dependent on
 * whether the school desk actually printed a physical copy. */
export default async function ReceiptsPage() {
  await requirePagePermission("portal.parent");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Receipts</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Every confirmed payment for your children lands here automatically — no need to ask the school office for a copy.
        </p>
      </div>
      <ReceiptsClient />
    </div>
  );
}
