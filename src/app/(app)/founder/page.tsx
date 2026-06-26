import { BriefcaseBusiness } from "lucide-react";
import { requirePageRole } from "@/lib/core/page-guards";
import { FounderOpsClient } from "@/components/founder/founder-ops-client";

export const dynamic = "force-dynamic";

/** PART F.1 — NEYO Founder Operations. Company-level; SUPER_ADMIN only. */
export default async function FounderOpsPage() {
  await requirePageRole("SUPER_ADMIN");

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
            <BriefcaseBusiness className="h-4 w-4" />
            NEYO internal operations
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            Founder Operations
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-navy-500 dark:text-navy-400">
            NEYO uses NEYO here: build logs, metrics reviews, company cadence, investor/board updates and customer interviews.
          </p>
        </div>
      </div>

      <FounderOpsClient />
    </div>
  );
}
