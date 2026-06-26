import { requirePagePermission } from "@/lib/core/page-guards";
import { VisibilityManager } from "@/components/settings/visibility-manager";

export const dynamic = "force-dynamic";

/**
 * H.2 Role-Based Settings & Module Visibility Control. School Owner / Principal
 * hide nav items + admin menus from chosen roles.
 */
export default async function VisibilityPage() {
  await requirePagePermission("tenant.manage_settings");

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Menu &amp; access visibility
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Hide menus and admin pages from staff who don&apos;t need them. Everyone always keeps their own Security (password &amp; language) settings.
        </p>
      </div>
      <VisibilityManager />
    </div>
  );
}
