import { requirePagePermission } from "@/lib/core/page-guards";
import { listPayments } from "@/lib/services/payment.service";
import { PaymentsList } from "@/components/finance/payments-list";

export const dynamic = "force-dynamic";

/** Finance → Payments (A.6/A.10). View payments + export + download receipts. */
export default async function PaymentsListPage() {
  const user = await requirePagePermission("finance.view");
  const rows = await listPayments(user.tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Payments
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          M-Pesa and offline payments, with downloadable receipts.
        </p>
      </div>
      <PaymentsList rows={rows} />
    </div>
  );
}
