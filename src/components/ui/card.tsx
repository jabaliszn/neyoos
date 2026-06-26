import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO Card — rounded-2xl, soft brand-tinted shadow.
 * Upgraded with premium micro-motion: on hover, the card slightly lifts,
 * the shadow increases, and the specular glass reflection shifts beautifully (ease-apple).
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-card border border-navy-100/70",
        "dark:bg-navy-900 dark:border-navy-800",
        "transition-all duration-300 ease-apple",
        "hover:-translate-y-0.5 hover:shadow-card-hover hover:border-navy-200/50 dark:hover:border-navy-700/50",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-navy-900 dark:text-navy-50",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // BALANCE RULE (founder 2026-06-13): a card's inner spacing must be even —
  // start-of-card → text === text → edges/dividers. Standalone CardContent
  // (first child) gets FULL equal padding on every side; only when it follows
  // a CardHeader is its top padding removed (the header already provided it).
  // The old static "pt-0 sm:pt-0" leaked zero top-padding into standalone
  // cards on desktop (twMerge kept sm:pt-0) — that was the imbalance.
  return (
    <div
      className={cn("p-5 sm:p-6 [&:not(:first-child)]:pt-0", className)}
      {...props}
    />
  );
}
