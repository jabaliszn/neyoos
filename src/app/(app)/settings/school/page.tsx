import { requirePagePermission } from "@/lib/core/page-guards";
import { SchoolProfileEditor } from "@/components/settings/school-profile-editor";

export const dynamic = "force-dynamic";

/** Settings → School profile (G.9). */
export default async function SchoolProfilePage() {
  await requirePagePermission("tenant.manage_settings");
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          School profile
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Your school&apos;s identity, branding and new-student requirements. Used on
          receipts, reports and (later) your public page.
        </p>
      </div>
      <SchoolProfileEditor />
    </div>
  );
}
