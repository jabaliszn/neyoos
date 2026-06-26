import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { FinanceClient } from "@/components/finance/finance-client";

export const dynamic = "force-dynamic";

/** B.7 Finance — fee structures, invoices, arrears. (Payments = A.6 page.) */
export default async function FinancePage() {
  const user = await requirePagePermission("finance.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Finance</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Fee structures, invoicing and arrears — all in KES.
        </p>
      </div>
      <FinanceClient
        canStructure={can(user.role, "finance.manage_structure")}
        canInvoice={can(user.role, "finance.create_invoice")}
        canRecord={can(user.role, "finance.record_payment")}
      />
    </div>
  );
}
