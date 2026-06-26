import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { redirect } from "next/navigation";
import { LmsClient } from "@/components/lms/lms-client";

export const dynamic = "force-dynamic";

/** B.13 LMS — staff side: quizzes, homework grading, class forums. */
export default async function LmsPage() {
  const user = await requirePagePermission("academics.view");
  // Families use the shared portal for LMS; staff without teaching scope see a hint.
  if (!can(user.role, "homework.assign")) redirect("/portal");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Learning</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Auto-graded quizzes, homework hand-ins to grade, and class discussions.
        </p>
      </div>
      <LmsClient />
    </div>
  );
}
