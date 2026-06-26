"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicSiteSettingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-card dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      <AlertTriangle className="h-6 w-6" />
      <h2 className="mt-3 text-lg font-semibold">Public website settings could not load</h2>
      <p className="mt-1 text-sm">Please retry. If it repeats, keep the current page open and tell NEYO support what you were editing.</p>
      <Button className="mt-5" variant="secondary" onClick={reset}>Retry</Button>
    </div>
  );
}
