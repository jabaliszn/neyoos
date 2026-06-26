"use client";

import * as React from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

/**
 * Persistent banner shown while a NEYO admin is impersonating a school (A.2.9).
 * Impossible to miss; one clear action to exit back to the admin's identity.
 */
export function ImpersonationBanner({
  tenantName,
  actingAs,
}: {
  tenantName: string;
  actingAs: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function exit() {
    setLoading(true);
    try {
      await fetch("/api/admin/impersonate/stop", { method: "POST" });
    } finally {
      window.location.assign("/dashboard");
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        Support mode — viewing <strong>{tenantName}</strong> as{" "}
        <strong>{actingAs}</strong>
      </span>
      <button
        onClick={exit}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-950/90 px-3 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-950 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Exit
      </button>
    </div>
  );
}
