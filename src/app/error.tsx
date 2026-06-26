"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary (Error state). A calm, branded screen — never a raw
 * stack trace. Gives the user one clear recovery action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 dark:bg-navy-950">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
          Something went wrong
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          We hit an unexpected problem. Your data is safe — please try again.
        </p>
        <div className="mt-6">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
        {error?.digest && (
          <p className="mt-4 text-xs text-navy-300 dark:text-navy-600">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
