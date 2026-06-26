"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. Matches the Input look. */
export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, error, id, ...props }, ref) => {
  const [show, setShow] = React.useState(false);

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-white px-3.5 transition-colors duration-200 ease-apple dark:bg-navy-900",
          error
            ? "border-red-400 focus-within:ring-2 focus-within:ring-red-400/40"
            : "border-navy-200 focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-green-500/30 dark:border-navy-700"
        )}
      >
        <Lock className="h-4 w-4 text-navy-400 dark:text-navy-500" />
        <input
          id={id}
          ref={ref}
          type={show ? "text" : "password"}
          className={cn(
            "h-12 w-full bg-transparent text-[15px] text-navy-900 outline-none placeholder:text-navy-300 dark:text-navy-50 dark:placeholder:text-navy-600",
            className
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="text-navy-400 transition-colors hover:text-navy-700 dark:hover:text-navy-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
