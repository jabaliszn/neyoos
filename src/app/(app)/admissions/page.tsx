import { requirePagePermission } from "@/lib/core/page-guards";
import { AdmissionsClient } from "@/components/admissions/admissions-client";

export const dynamic = "force-dynamic";

/** B.2 Admissions — application pipeline (registrar/leadership). */
export default async function AdmissionsPage() {
  await requirePagePermission("student.create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Admissions</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Applications from your online form, front desk and walk-ins — through to admission.
        </p>
      </div>
      <AdmissionsClient />
    </div>
  );
}
