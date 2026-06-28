import { redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { requirePageUser } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { PortfolioClient } from "@/components/portfolio/portfolio-client";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({ searchParams }: { searchParams?: { studentId?: string } }) {
  const user = await requirePageUser();
  const effective = await effectivePermissionsForUser(user);
  const canRead = effective.includes("academics.view") || effective.includes("exam.view") || effective.includes("student.view");
  if (!canRead) redirect("/forbidden");

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
          <FolderOpen className="h-4 w-4" /> Future-proof learner evidence
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Student Portfolio</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-navy-500 dark:text-navy-400">
          Track projects, creative work, certificates, coding pieces and community activities in one learner timeline. Student uploads stay encrypted until the school reviews what families may see.
        </p>
      </div>
      <PortfolioClient initialStudentId={searchParams?.studentId ?? ""} />
    </div>
  );
}
