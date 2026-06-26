import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO Input — calm, rounded, soft border. Apple-craft.
 * Props:
 *  - error: shows red border + message below.
 *  - leftAddon: fixed prefix inside the field (e.g. "+254").
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftAddon, id, ...props }, ref) => {
    return (
      <div className="w-full">
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-white px-3.5 transition-colors duration-200 ease-apple",
            "dark:bg-navy-900",
            error
              ? "border-red-400 focus-within:ring-2 focus-within:ring-red-400/40"
              : "border-navy-200 focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-green-500/30 dark:border-navy-700",
          )}
        >
          {leftAddon && (
            <span className="select-none text-sm font-medium text-navy-400 dark:text-navy-500">
              {leftAddon}
            </span>
          )}
          <input
            id={id}
            ref={ref}
            className={cn(
              "h-12 w-full bg-transparent text-[15px] text-navy-900 outline-none placeholder:text-navy-300",
              "dark:text-navy-50 dark:placeholder:text-navy-600",
              className
            )}
            aria-invalid={Boolean(error)}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
