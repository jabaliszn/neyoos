import { requirePagePermission } from "@/lib/core/page-guards";
import { getModuleStates } from "@/lib/services/module.service";
import { ModulesManager } from "@/components/settings/modules-manager";

export const dynamic = "force-dynamic";

/** Settings → Modules. Sectioned settings density (Principle 7). */
export default async function ModulesSettingsPage() {
  // A.3.7: redirect to /forbidden if the user can't manage modules.
  const user = await requirePagePermission("tenant.manage_modules");

  const modules = await getModuleStates(user.tenantId);

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Modules
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Turn on only the parts of NEYO your school uses. Disabled modules are
          hidden from the sidebar for everyone.
        </p>
      </div>

      <ModulesManager initial={modules} canManage={true} />
    </div>
  );
}
