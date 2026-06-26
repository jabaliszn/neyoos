import { requirePagePermission } from "@/lib/core/page-guards";
import { getPaymentConfigStatus } from "@/lib/services/payment.service";
import { PaymentsManager } from "@/components/settings/payments-manager";

export const dynamic = "force-dynamic";

/** Settings → Payments (A.6). Leadership only. */
export default async function PaymentsSettingsPage() {
  const user = await requirePagePermission("tenant.manage_settings");
  const status = await getPaymentConfigStatus(user.tenantId);

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Payments
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Connect M-Pesa so parents pay fees directly to your school.
        </p>
      </div>
      <PaymentsManager
        initial={{
          configured: status.configured,
          shortcode: status.shortcode,
          environment: status.environment,
        }}
      />
    </div>
  );
}
