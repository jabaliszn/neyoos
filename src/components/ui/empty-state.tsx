import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Beautiful zero-data view (Principle 3 — UX depth, Empty state).
 * Always pairs a clear message with ONE primary CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed",
        "border-navy-200 bg-white/60 px-6 py-16 text-center",
        "dark:border-navy-700 dark:bg-navy-900/40",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-400 dark:bg-navy-800 dark:text-navy-300">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-navy-900 dark:text-navy-50">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-navy-500 dark:text-navy-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
