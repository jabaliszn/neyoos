import { requirePagePermission } from "@/lib/core/page-guards";
import { SyllabusClient } from "@/components/syllabus/syllabus-client";

export const dynamic = "force-dynamic";

export default async function SyllabusPage() {
  await requirePagePermission("academics.view");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-navy-50">Syllabus coverage</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Track required scope, deadlines and taught topics per class and subject.</p>
      </div>
      <SyllabusClient />
    </div>
  );
}
