import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";

/** School calendar (A.17): month/week/day, KE holidays, iCal, invites. */
export default async function CalendarPage() {
  const user = await requirePagePermission("calendar.view");
  const canManage = can(user.role, "calendar.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Calendar
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Term dates, meetings and exams alongside Kenyan public holidays. Use ← →
          to move, T for today.
        </p>
      </div>
      <CalendarView canManage={canManage} />
    </div>
  );
}
