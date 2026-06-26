"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Apple-style switch. Calm 200ms motion. */
export function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-apple disabled:opacity-50",
        checked ? "bg-green-500" : "bg-navy-200 dark:bg-navy-700"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-apple",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
