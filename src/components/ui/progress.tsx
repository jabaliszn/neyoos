import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 percentage. Values are clamped to this range. */
  value?: number;
  /** Class applied to the moving indicator bar. */
  indicatorClassName?: string;
}

/**
 * Progress bar (UI primitive). Liquid-glass friendly: the track carries the
 * background, the indicator carries the fill colour. Accessible via ARIA.
 */
export function Progress({ value = 0, className, indicatorClassName, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full bg-navy-600 transition-all duration-500 ease-out", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default Progress;
