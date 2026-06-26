import { currentSubdomainTenant } from "@/lib/core/current-tenant";
import { ApplyForm } from "@/components/admissions/apply-form";
import { NeyoLogo } from "@/components/brand/neyo-logo";

export const dynamic = "force-dynamic";

/** B.2.1 PUBLIC online application form — lives on the school's subdomain. */
export default async function ApplyPage() {
  const tenant = await currentSubdomainTenant();

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 flex flex-col items-center text-center">
        <NeyoLogo variant="mark" className="h-10 w-10" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          {tenant ? `Apply to ${tenant.name}` : "Apply to a school"}
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {tenant
            ? "Fill in the learner's details below. The school will contact you on the phone number you provide."
            : "Open this page on your school's NEYO address (e.g. karibu-high.neyo.co.ke/apply)."}
        </p>
      </div>
      {tenant && <ApplyForm schoolName={tenant.name} />}
    </div>
  );
}
