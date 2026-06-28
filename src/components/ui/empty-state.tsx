import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateActionConfig {
  label: string;
  onClick: () => void;
}

/**
 * Beautiful zero-data view (Principle 3 — UX depth, Empty state).
 * Supports a pre-built custom action node OR one/two simple CTA configs.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  primaryAction?: EmptyStateActionConfig;
  secondaryAction?: EmptyStateActionConfig;
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
      {action ? (
        <div className="mt-6">{action}</div>
      ) : primaryAction || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {secondaryAction ? (
            <Button type="button" variant="secondary" onClick={secondaryAction.onClick} className="rounded-full">
              {secondaryAction.label}
            </Button>
          ) : null}
          {primaryAction ? (
            <Button type="button" onClick={primaryAction.onClick} className="rounded-full">
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
