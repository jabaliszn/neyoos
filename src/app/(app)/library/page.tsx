import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { LibraryClient } from "@/components/library/library-client";

export const dynamic = "force-dynamic";

/** B.15 Library — catalog, issue/return, fines, barcode, reading history. */
export default async function LibraryPage() {
  const user = await requirePagePermission("library.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Library</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Catalog, issue and return books, and collect overdue fines — KES 10 per day late.
        </p>
      </div>
      <LibraryClient canManage={can(user.role, "library.manage")} />
    </div>
  );
}
