import { requirePagePermission } from "@/lib/core/page-guards";
import { StorageVaultClient } from "@/components/settings/storage-vault-client";

export const dynamic = "force-dynamic";

export default async function StorageSettingsPage() {
  await requirePagePermission("tenant.manage_settings");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Storage</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Configure encrypted storage vaults, BYOS provider seams, usage bars and upgrade paths.</p>
      </div>
      <StorageVaultClient />
    </div>
  );
}
