import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { InventoryClient } from "@/components/inventory/inventory-client";

export const dynamic = "force-dynamic";

/** B.18 Inventory / Stores — stock, reorder + expiry alerts, sales to invoices, assets. */
export default async function InventoryPage() {
  const user = await requirePagePermission("inventory.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Inventory</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Stores and stock, reorder and expiry alerts — and sales billed straight to student invoices.
        </p>
      </div>
      <InventoryClient
        canManage={can(user.role, "inventory.manage")}
        canApprove={can(user.role, "tenant.manage_settings")} // B.25 PO approval = leadership
      />
    </div>
  );
}
