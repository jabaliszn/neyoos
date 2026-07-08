import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { CbcClient } from "@/components/cbc/cbc-client";

export const dynamic = "force-dynamic";

/** B.6 CBC Management — strands, formative assessments, competency reports. */
export default async function CbcPage() {
  const user = await requirePagePermission("academics.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">CBE</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Competency strands, formative observations on the EE/ME/AE/BE rubric, and learner reports.
        </p>
      </div>
      <CbcClient canManage={can(user.role, "academics.manage")} canAssess={can(user.role, "exam.enter_marks")} />
    </div>
  );
}
