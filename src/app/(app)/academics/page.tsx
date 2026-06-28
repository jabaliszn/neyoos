import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { AcademicsClient } from "@/components/academics/academics-client";
import { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";

export const dynamic = "force-dynamic";

/** B.4 Academics — subjects, departments, terms, timetable, lesson plans. */
export default async function AcademicsPage() {
  const user = await requirePagePermission("academics.view");
  const hasPrimary = can(user.role, "academics.manage");
  const hasSecondary = user.secondaryRole ? can(user.secondaryRole, "academics.manage") : false;
  const canManage = hasPrimary || hasSecondary;
  const principalOwnerRoles = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
  const canAppointHod = principalOwnerRoles.includes(user.role) || (user.secondaryRole ? principalOwnerRoles.includes(user.secondaryRole) : false);
  const isScopedHod = !canAppointHod && (user.role === "HOD" || user.secondaryRole === "HOD");
  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Academics</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Subjects, departments, term dates, the weekly timetable and lesson plans.
        </p>
      </div>
      <AcademicsClient canManage={canManage} canAppointHod={canAppointHod} isScopedHod={isScopedHod} isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />
    </div>
  );
}
