import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { PayrollClient } from "@/components/payroll/payroll-client";

export const dynamic = "force-dynamic";

/** B.8 Payroll — salaries, statutory deductions, runs and payslips.
 *  ANY-of: staff.manage (leadership) OR finance.manage_structure (bursar). */
export default async function PayrollPage() {
  const user = await requirePageUser();
  if (!can(user.role, "staff.manage") && !can(user.role, "finance.manage_structure")) redirect("/forbidden");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Payroll</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Gross to net with PAYE, SHIF, NSSF and the housing levy — payslips included.
        </p>
      </div>
      <PayrollClient />
    </div>
  );
}
