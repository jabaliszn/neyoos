import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO logo (A.20). Pure inline SVG so it renders everywhere — including the
 * sandboxed preview — and adapts to light/dark automatically:
 *  - the mark tile uses the brand green;
 *  - the wordmark uses `currentColor`, so set text color on the parent
 *    (e.g. text-navy-900 dark:text-navy-50).
 *
 * Variants:
 *  - "full"  → mark + wordmark (default)
 *  - "mark"  → just the rounded-square N tile (for tight spaces / favicons)
 *  - "wordmark" → just the "NEYO" text
 */
export function NeyoLogo({
  variant = "full",
  className,
  title = "NEYO",
}: {
  variant?: "full" | "mark" | "wordmark";
  className?: string;
  title?: string;
}) {
  const Mark = (
    <svg viewBox="0 0 40 40" className="h-full w-auto shrink-0" role="img" aria-label={title}>
      {/* Navy rounded tile — matches the app icon (navy + green leaf). */}
      <rect x="0" y="0" width="40" height="40" rx="11" className="fill-navy-900" />
      {/* Stylized N in warm white */}
      <path
        d="M11 29V11h3.4l11.2 12.1V11H29v18h-3.4L14.4 16.9V29H11Z"
        fill="#fdfcf9"
      />
      {/* Green growth leaf at the top-right of the N */}
      <path
        d="M27.5 9.2c2.4-.2 4.3.3 4.3.3s.4 2-.6 3.7c-1 1.7-2.8 2.2-4 1.5-1.2-.7-1.5-2.5-.6-4.1.2-.4.5-.9.9-1.4Z"
        className="fill-green-500"
      />
    </svg>
  );

  const Wordmark = (
    <svg
      viewBox="0 0 132 34"
      className="h-full w-auto"
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      {/* NEYO set in a geometric, slightly condensed face */}
      <text
        x="0"
        y="26"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="0.5"
      >
        NEYO
      </text>
    </svg>
  );

  if (variant === "mark") {
    return <span className={cn("inline-flex h-8 items-center", className)}>{Mark}</span>;
  }
  if (variant === "wordmark") {
    return <span className={cn("inline-flex h-7 items-center", className)}>{Wordmark}</span>;
  }
  return (
    <span className={cn("inline-flex h-8 items-center gap-2.5", className)}>
      {Mark}
      <span className="h-7">{Wordmark}</span>
    </span>
  );
}
