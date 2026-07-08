"use client";

import * as React from "react";
import { Moon, Sun, Droplets, CircleOff } from "lucide-react";

/**
 * G.33/I.74 — LIQUID GLASS is the DEFAULT SYSTEM, but NEYO company can switch
 * the Liquid Glass engine OFF platform-wide from /api/platform/appearance.
 * Theme preference remains local; first launch follows the device light/dark
 * default. The company master switch decides whether the glass class is allowed to apply.
 */
type Theme = "glass" | "glass-dark" | "light" | "dark";
const ORDER: Theme[] = ["glass", "glass-dark", "light", "dark"];

function apply(theme: Theme, liquidEnabled = true) {
  const el = document.documentElement;
  const wantsGlass = liquidEnabled && (theme === "glass" || theme === "glass-dark");
  el.classList.toggle("glass", wantsGlass);
  el.classList.toggle("flat", !wantsGlass);
  el.classList.toggle("dark", theme === "dark" || theme === "glass-dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("glass");
  const [liquidEnabled, setLiquidEnabled] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem("neyo-theme") as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const t: Theme = stored && ORDER.includes(stored) ? stored : prefersDark ? "glass-dark" : "glass";
    const cachedEnabled = localStorage.getItem("neyo-liquid-enabled") !== "false";
    setTheme(t);
    setLiquidEnabled(cachedEnabled);
    apply(t, cachedEnabled);

    // Sync COMPANY appearance settings (non-blocking; cached for pre-paint).
    fetch("/api/platform/appearance")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const level = j?.data?.liquidLevel;
        const enabled = j?.data?.liquidEnabled;
        if (level === "1" || level === "2" || level === "3") {
          document.documentElement.setAttribute("data-liquid", level);
          localStorage.setItem("neyo-liquid", level);
        }
        if (typeof enabled === "boolean") {
          setLiquidEnabled(enabled);
          localStorage.setItem("neyo-liquid-enabled", String(enabled));
          apply(t, enabled);
        }
        // O.3: keep the live company colour-intensity in sync too, UNLESS the
        // signed-in user has a personal override active (data-lg-contrast is
        // already correctly SSR'd for that case on the next real page load;
        // this just avoids a stale value if company settings change mid-session
        // for a user who has no personal override).
        const colorLevel = j?.data?.liquidColorLevel;
        const hasPersonalOverride = document.documentElement.getAttribute("data-lg-contrast-user-override") === "true";
        if (!hasPersonalOverride && (colorLevel === "1" || colorLevel === "2" || colorLevel === "3")) {
          document.documentElement.setAttribute("data-lg-contrast", colorLevel);
        }
      })
      .catch(() => {});
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next, liquidEnabled);
    localStorage.setItem("neyo-theme", next);
  }

  const LABELS: Record<Theme, string> = {
    glass: liquidEnabled ? "Liquid Glass — switch to Liquid Glass dark" : "Liquid Glass is off company-wide — switch theme preference",
    "glass-dark": liquidEnabled ? "Liquid Glass dark — switch to plain light" : "Liquid Glass is off company-wide — switch to plain light",
    light: "Plain light — switch to plain dark",
    dark: "Plain dark — switch to Liquid Glass",
  };

  const icon = !liquidEnabled && (theme === "glass" || theme === "glass-dark") ? (
    <CircleOff className="h-4.5 w-4.5" />
  ) : theme === "glass" ? (
    <Droplets className="h-4.5 w-4.5" />
  ) : theme === "glass-dark" ? (
    <Droplets className="h-4.5 w-4.5 text-green-400" />
  ) : theme === "light" ? (
    <Sun className="h-4.5 w-4.5" />
  ) : (
    <Moon className="h-4.5 w-4.5" />
  );

  return (
    <button
      onClick={cycle}
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
      className="flex h-9 w-9 items-center justify-center rounded-full text-navy-500 transition-colors duration-200 ease-apple hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
    >
      {icon}
    </button>
  );
}
