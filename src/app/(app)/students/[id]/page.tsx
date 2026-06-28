import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { getStudent, StudentError } from "@/lib/services/student.service";
import { StudentProfileClient } from "@/components/students/student-profile-client";
import { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";

export const dynamic = "force-dynamic";

/** Student profile (B.1.2). Row-scoped: getStudent enforces visibility. */
export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("student.view");
  const canEdit = can(user.role, "student.edit");
  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();

  let student;
  try {
    student = await getStudent(user, params.id);
  } catch (e) {
    if (e instanceof StudentError) notFound();
    throw e;
  }

  // Serialize dates for the client component.
  const initial = JSON.parse(JSON.stringify(student));

  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> All students
      </Link>
      <StudentProfileClient initial={initial} canEdit={canEdit} isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />
    </div>
  );
}
