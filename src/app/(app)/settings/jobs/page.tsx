import { requirePageRole } from "@/lib/core/page-guards";
import { JobsPanel } from "@/components/settings/jobs-panel";

export const dynamic = "force-dynamic";

/** Settings → Background Jobs (A.12). NEYO admin only. */
export default async function JobsPage() {
  await requirePageRole("SUPER_ADMIN");
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Background jobs
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Scheduled tasks and their recent runs. Runs in-process now; uses Redis
          (BullMQ) when configured.
        </p>
      </div>
      <JobsPanel />
    </div>
  );
}
