import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { AlumniClient } from "@/components/students/alumni-client";

export const dynamic = "force-dynamic";

/** B.1 Alumni directory — graduated students by "Class of YYYY". */
export default async function AlumniPage() {
  const user = await requirePagePermission("student.view");
  const canEdit = can(user.role, "student.edit");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-navy-500 transition-colors duration-200 ease-apple hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Students
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Alumni</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Former students by graduating class.
        </p>
      </div>
      <AlumniClient canEdit={canEdit} />
    </div>
  );
}
