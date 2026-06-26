"use client";

/** B.3 attendance tabs: Classes (registers) · Staff (clock in/out) · Insights. */
import * as React from "react";
import { AttendanceClient } from "@/components/attendance/attendance-client";
import { StaffAttendanceTab, InsightsTab } from "@/components/attendance/staff-attendance-client";

export function AttendanceTabs({ canRecord, canInsights, currentUserId }: { canRecord: boolean; canInsights: boolean; currentUserId: string }) {
  const [tab, setTab] = React.useState<"classes" | "staff" | "insights">("classes");
  const tabs = [
    { key: "classes" as const, label: "Class registers", show: true },
    { key: "staff" as const, label: "Staff", show: true },
    { key: "insights" as const, label: "Insights", show: canInsights },
  ].filter((t) => t.show);

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${tab === t.key ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "classes" && <AttendanceClient canRecord={canRecord} currentUserId={currentUserId} />}
      {tab === "staff" && <StaffAttendanceTab />}
      {tab === "insights" && <InsightsTab />}
    </div>
  );
}
