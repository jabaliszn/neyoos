import { requirePageUser } from "@/lib/core/page-guards";
import { PrintLimitsManager } from "@/components/settings/print-limits-manager";

export const dynamic = "force-dynamic";

/**
 * H.2 Customized Printing Limits. Privileged roles (Principal/Deputy/HOD/Owner)
 * set the daily limit and approve requests; other staff see their own usage
 * and can request more prints.
 */
export default async function PrintingLimitsPage() {
  await requirePageUser();

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Printing limits
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Control how many documents staff can print each day. Leadership sets the limit and approves extra prints.
        </p>
      </div>
      <PrintLimitsManager />
    </div>
  );
}
