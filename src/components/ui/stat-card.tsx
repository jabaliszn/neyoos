import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import type { LucideIcon } from "lucide-react";

/**
 * Sparkline sub-component for tiny, visual progress charts inside stat cards.
 * Performance-safe, native HTML/SVG rendering with zero dependencies.
 */
function Sparkline({
  data,
  tone,
}: {
  data: number[];
  tone: "navy" | "green" | "amber" | "red";
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 80;
  const height = 18;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      // Subtract y from height to draw bottom-to-top, plus a 1px safety margin
      const y = height - ((val - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  const color = {
    navy: "stroke-navy-400 dark:stroke-navy-300",
    green: "stroke-green-500 dark:stroke-green-400",
    amber: "stroke-amber-500 dark:stroke-amber-400",
    red: "stroke-red-500 dark:stroke-red-400",
  }[tone];

  return (
    <div className="flex items-center" title={`Trend: ${data.join(" → ")}`}>
      <svg className="h-5 w-20 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("stroke-[1.75]", color)}
          points={points}
        />
      </svg>
    </div>
  );
}

/** Sparse, visual dashboard stat card (Principle 7 — dashboard density). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
  sparklineData,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "navy" | "green" | "amber" | "red";
  sparklineData?: number[];
  className?: string;
}) {
  const toneClasses = {
    navy: "bg-navy-50 text-navy-600 dark:bg-navy-800 dark:text-navy-200",
    green: "bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    red: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  }[tone];

  return (
    <Card className={cn("p-5 sm:p-6 group relative overflow-hidden", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight text-navy-900 dark:text-navy-50 transition-transform duration-300 group-hover:scale-[1.01]">
            {value}
          </p>
          <div className="flex items-center gap-3">
            {hint && (
              <p className="text-xs text-navy-500 dark:text-navy-400 truncate max-w-[160px] sm:max-w-none">
                {hint}
              </p>
            )}
            {sparklineData && (
              <span className="inline-block border-l border-navy-200/50 dark:border-navy-800 pl-2">
                <Sparkline data={sparklineData} tone={tone} />
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
              toneClasses
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
      </div>
    </Card>
  );
}
