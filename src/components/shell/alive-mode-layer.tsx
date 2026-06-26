"use client";

import * as React from "react";
import { Activity, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type AliveSettings = { enabled: boolean; heartbeat: boolean; microcopy: boolean; motion: boolean };
const MESSAGES = [
  "NEYO is live and watching school flow",
  "Payments, attendance and messages are syncing",
  "Everything important is staying close",
  "Bundi-ready signals are calm and current",
];

export function AliveModeLayer() {
  const [settings, setSettings] = React.useState<AliveSettings | null>(null);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/platform/alive-mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setSettings(j.data); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!settings?.enabled || !settings.microcopy) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 9000);
    return () => window.clearInterval(t);
  }, [settings]);

  if (!settings?.enabled) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 hidden sm:block print:hidden">
      <div className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border border-green-300/60 bg-white/70 px-3.5 py-2 text-xs font-bold text-green-900 shadow-card backdrop-blur-xl dark:border-green-900 dark:bg-navy-900/70 dark:text-green-200",
        settings.motion && "animate-fade-in"
      )}>
        <span className="relative flex h-2.5 w-2.5">
          {settings.heartbeat && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600" />
        </span>
        <Activity className="h-3.5 w-3.5" />
        <span>{settings.microcopy ? MESSAGES[idx] : "NEYO live"}</span>
        <Sparkles className="h-3.5 w-3.5 text-green-600" />
      </div>
    </div>
  );
}
