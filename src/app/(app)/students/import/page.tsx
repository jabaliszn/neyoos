import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { ImportWizard } from "@/components/students/import-wizard";

export const dynamic = "force-dynamic";

/** B.1 Bulk import — upload CSV/XLSX or paste from Google Sheets. */
export default async function StudentImportPage() {
  await requirePagePermission("student.create");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-navy-500 transition-colors duration-200 ease-apple hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Students
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Import students
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Upload your existing register as CSV or Excel, or paste rows straight from Google Sheets.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
