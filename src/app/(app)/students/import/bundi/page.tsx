import Link from "next/link";
import { ArrowLeft, Feather } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { BundiImportWizard } from "@/components/students/bundi-import-wizard";

export const dynamic = "force-dynamic";

/** M.5 — Bundi Handwritten Import: a separate, unlock-code-gated premium path. */
export default async function BundiImportPage() {
  await requirePagePermission("student.create");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students/import"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-navy-500 transition-colors duration-200 ease-apple hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Standard import
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          <Feather className="h-6 w-6 text-green-600" /> Bundi handwritten import
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          For handwritten or poorly structured paper registers. Requires a NEYO-issued unlock code.
        </p>
      </div>
      <BundiImportWizard />
    </div>
  );
}
