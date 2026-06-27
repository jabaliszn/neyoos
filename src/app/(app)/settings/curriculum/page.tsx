import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { requirePageUser } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { CurriculumEngineClient } from "@/components/curriculum/curriculum-engine-client";

export const dynamic = "force-dynamic";

export default async function CurriculumSettingsPage() {
  const user = await requirePageUser();
  const effective = await effectivePermissionsForUser(user);
  const canRead = effective.includes("academics.view") || effective.includes("tenant.manage_settings");
  if (!canRead) redirect("/forbidden");

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
            <Compass className="h-4 w-4" />
            Future-proof Education OS
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            Curriculum Engine
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-navy-500 dark:text-navy-400">
            Configure curriculum versions, education levels, grade bands and learning areas. Existing subjects, classes and terms are mapped here instead of being duplicated.
          </p>
        </div>
      </div>

      <CurriculumEngineClient />
    </div>
  );
}
