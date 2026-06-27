import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { requirePageUser } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { CompetencyFrameworkClient } from "@/components/competencies/competency-framework-client";

export const dynamic = "force-dynamic";

export default async function CompetenciesPage() {
  const user = await requirePageUser();
  const effective = await effectivePermissionsForUser(user);
  const canRead = effective.includes("academics.view") || effective.includes("exam.view") || effective.includes("student.view");
  if (!canRead) redirect("/forbidden");

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300"><Brain className="h-4 w-4" /> Future-proof growth tracking</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Competency Framework</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-navy-500 dark:text-navy-400">Track learner growth through configurable competencies connected to curriculum, CBC observations, flexible assessments and teacher evidence.</p>
      </div>
      <CompetencyFrameworkClient />
    </div>
  );
}
