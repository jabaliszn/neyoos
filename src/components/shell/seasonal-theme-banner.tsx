"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = {
  active: boolean;
  source: "holiday" | "event" | "upcoming" | null;
  title: string;
  message: string;
  tone: "heritage" | "celebration" | "faith" | "academic" | "sports" | "event";
  date: string | null;
  daysAway: number | null;
  emoji: string;
};

const toneClasses: Record<Theme["tone"], string> = {
  heritage: "border-green-300/70 bg-gradient-to-r from-green-50/90 via-white/75 to-red-50/70 text-green-950 dark:from-green-950/30 dark:via-navy-900/70 dark:to-red-950/20 dark:text-green-100",
  celebration: "border-amber-300/70 bg-gradient-to-r from-amber-50/90 via-white/75 to-green-50/80 text-amber-950 dark:from-amber-950/30 dark:via-navy-900/70 dark:to-green-950/20 dark:text-amber-100",
  faith: "border-purple-300/70 bg-gradient-to-r from-purple-50/90 via-white/75 to-sky-50/80 text-purple-950 dark:from-purple-950/30 dark:via-navy-900/70 dark:to-sky-950/20 dark:text-purple-100",
  academic: "border-blue-300/70 bg-gradient-to-r from-blue-50/90 via-white/75 to-green-50/80 text-blue-950 dark:from-blue-950/30 dark:via-navy-900/70 dark:to-green-950/20 dark:text-blue-100",
  sports: "border-lime-300/70 bg-gradient-to-r from-lime-50/90 via-white/75 to-emerald-50/80 text-lime-950 dark:from-lime-950/30 dark:via-navy-900/70 dark:to-emerald-950/20 dark:text-lime-100",
  event: "border-navy-200/80 bg-white/75 text-navy-900 dark:border-navy-700 dark:bg-navy-900/70 dark:text-navy-100",
};

export function SeasonalThemeBanner() {
  const [theme, setTheme] = React.useState<Theme | null>(null);
  const [hiddenKey, setHiddenKey] = React.useState("");

  React.useEffect(() => {
    fetch("/api/seasonal-theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok) setTheme(j.data);
      })
      .catch(() => {});
    setHiddenKey(localStorage.getItem("neyo-seasonal-theme-hidden") || "");
  }, []);

  if (!theme?.active) return null;
  const key = `${theme.title}:${theme.date ?? ""}`;
  if (hiddenKey === key) return null;

  return (
    <div className={cn("mx-4 mt-3 rounded-3xl border px-4 py-3 shadow-card backdrop-blur-xl sm:mx-8", toneClasses[theme.tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg shadow-sm dark:bg-navy-950/50">{theme.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight">
              {theme.source === "upcoming" ? "Coming soon" : "Seasonal theme"}: {theme.title}
            </p>
            <p className="mt-0.5 text-xs font-semibold opacity-75">{theme.message}</p>
          </div>
        </div>
        <button
          className="rounded-full p-1 text-current opacity-60 hover:bg-white/40 hover:opacity-100"
          aria-label="Hide seasonal theme"
          onClick={() => { localStorage.setItem("neyo-seasonal-theme-hidden", key); setHiddenKey(key); }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
