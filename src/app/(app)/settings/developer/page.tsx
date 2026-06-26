import { requirePagePermission } from "@/lib/core/page-guards";
import { DeveloperPanel } from "@/components/settings/developer-panel";

export const dynamic = "force-dynamic";

/** Settings → Developer (A.16): API keys + webhooks. Leadership only. */
export default async function DeveloperPage() {
  await requirePagePermission("api.manage");
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Developer
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Programmatic access to your school&apos;s data: API keys for the NEYO
          API and webhooks for real-time events. Keep these secret.
        </p>
      </div>
      <DeveloperPanel />
    </div>
  );
}
