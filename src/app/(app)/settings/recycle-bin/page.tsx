import { requirePagePermission } from "@/lib/core/page-guards";
import { RecycleBin } from "@/components/settings/recycle-bin";

export const dynamic = "force-dynamic";

/** Settings → Recycle Bin (G.6). Leadership only. */
export default async function RecycleBinPage() {
  await requirePagePermission("tenant.manage_settings");

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Recycle bin
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Restore deleted records or remove them permanently.
        </p>
      </div>
      <RecycleBin />
    </div>
  );
}
