import { Globe2 } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { PublicSiteEditor } from "@/components/settings/public-site-editor";

export const dynamic = "force-dynamic";

/** G.11 corrective pass — Public school landing-site editor. */
export default async function PublicSiteSettingsPage() {
  await requirePagePermission("tenant.manage_settings");

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
            <Globe2 className="h-4 w-4" />
            Public website
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            School landing page
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500 dark:text-navy-400">
            Manage the public page parents see on your school subdomain before they sign in.
          </p>
        </div>
      </div>

      <PublicSiteEditor />
    </div>
  );
}
