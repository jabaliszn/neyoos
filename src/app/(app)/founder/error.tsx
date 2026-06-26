"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** F.1 Founder Operations — route-level error state. */
export default function FounderOpsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-card dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      <AlertTriangle className="h-6 w-6" />
      <h2 className="mt-3 text-lg font-semibold">Founder Operations could not load</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6">
        This is NEYO’s internal operating cockpit. Retry once; if it repeats, keep the page open and send the error context to the Build Partner.
      </p>
      <Button className="mt-5" variant="secondary" onClick={reset}>Retry</Button>
    </div>
  );
}
