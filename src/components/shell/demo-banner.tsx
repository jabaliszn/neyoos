"use client";

import * as React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * G.14 — Demo Mode banner (amber). Shows hours left + "Convert to real school"
 * which sends the visitor to the prefilled onboarding wizard. Sticky, above the
 * app shell, so it's always visible in a demo tenant.
 */
export function DemoBanner({ hoursLeft }: { hoursLeft: number }) {
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 shrink-0" />
        Demo school — sample Kenyan data.
        {hoursLeft > 0 ? ` Expires in ~${hoursLeft}h.` : " Expiring soon."}
      </span>
      <a
        href="/get-started?from=demo"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-950/15 px-3 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-950/25"
      >
        Convert to a real school <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
