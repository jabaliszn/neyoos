import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { ExamsClient } from "@/components/exams/exams-client";
import { ExamAnalyticsClient } from "@/components/exams/exam-analytics-client";
import { ExamPrintClient } from "@/components/exams/exam-print-client";
import { AdvancedAnalyticsClient } from "@/components/exams/advanced-analytics-client";
import { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";
import { getSchoolLevelActivationSummary } from "@/lib/services/school-profile.service";

export const dynamic = "force-dynamic";

/** B.5 Examination — exams, marks entry, positions, report cards. */
export default async function ExamsPage() {
  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();
  const user = await requirePagePermission("exam.view");
  const schoolLevelActivation = await getSchoolLevelActivationSummary(user.tenantId);

  const has = (permission: Parameters<typeof can>[1]) => can(user.role, permission) || (user.secondaryRole ? can(user.secondaryRole, permission) : false);
  const requestRoles = ["HOD", "DEAN_OF_STUDIES", "DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
  const approveRoles = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
  const canRequestRelease = requestRoles.includes(user.role) || (user.secondaryRole ? requestRoles.includes(user.secondaryRole) : false);
  const canApproveRelease = approveRoles.includes(user.role) || (user.secondaryRole ? approveRoles.includes(user.secondaryRole) : false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Exams</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Set exams, enter marks, see positions and release report cards.
        </p>
      </div>
      {schoolLevelActivation.isJuniorSchool || schoolLevelActivation.isSeniorSchool ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
          <p className="font-semibold">Level-aware Exams</p>
          <p className="mt-1 text-xs text-green-800 dark:text-green-300">
            Exam analytics here are most relevant for Junior School and Senior School. Pathway-heavy exam complexity should only be expected when Senior School is active.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-semibold">Level-aware Exams</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Senior-pathway exam complexity is currently hidden because this school has not activated Junior School or Senior School in the School Profile.
          </p>
        </div>
      )}
      <ExamAnalyticsClient />
      <AdvancedAnalyticsClient />
      <ExamsClient
        canManage={has("exam.manage")}
        canEnterMarks={has("exam.enter_marks")}
        canPublish={has("exam.publish")}
        canRequestRelease={canRequestRelease}
        canApproveRelease={canApproveRelease}
      />
    </div>
  );
}
