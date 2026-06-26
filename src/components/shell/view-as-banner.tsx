"use client";

import * as React from "react";
import { Eye, Loader2 } from "lucide-react";

/**
 * Read-only "View As" banner (G.5). Blue, to distinguish from the amber
 * super-admin impersonation banner (A.2.9).
 */
export function ViewAsBanner({ actingAs }: { actingAs: string }) {
  const [loading, setLoading] = React.useState(false);

  async function exit() {
    setLoading(true);
    try {
      await fetch("/api/view-as/stop", { method: "POST" });
    } finally {
      window.location.assign("/dashboard");
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-center text-sm font-medium text-blue-50">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        Read-only preview — you&apos;re viewing as <strong>{actingAs}</strong>
      </span>
      <button
        onClick={exit}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-50 transition-colors hover:bg-blue-950/60 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Exit preview
      </button>
    </div>
  );
}
