"use client";

import * as React from "react";
import { LogOut, Loader2, MonitorSmartphone, Eye, Languages } from "lucide-react";
import { ViewAsLauncher } from "./view-as-launcher";
import { useT } from "@/components/i18n/lang-provider";
import { LANGUAGES } from "@/lib/i18n/dictionaries";

/** User chip + logout. Calls the real /api/auth/logout, then redirects. */
export function UserMenu({
  userName,
  userRole,
  canViewAs = false,
}: {
  userName: string;
  userRole: string;
  canViewAs?: boolean;
}) {
  const [viewAsOpen, setViewAsOpen] = React.useState(false);
  const { lang, setLang, t } = useT();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const [confirmAll, setConfirmAll] = React.useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  async function logoutEverywhere() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout-everywhere", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-1 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors duration-200 ease-apple hover:bg-navy-100 dark:hover:bg-navy-800"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
          {userName.charAt(0)}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <p className="text-sm font-medium text-navy-900 dark:text-navy-100">
            {userName}
          </p>
          <p className="text-[11px] text-navy-400 dark:text-navy-500">
            {userRole}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 animate-fade-in overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-pop dark:border-navy-700 dark:bg-navy-900">
          <div className="border-b border-navy-100 px-4 py-3 dark:border-navy-800">
            <p className="text-sm font-medium text-navy-900 dark:text-navy-50">
              {userName}
            </p>
            <p className="text-xs text-navy-400 dark:text-navy-500">{userRole}</p>
          </div>

          {canViewAs && (
            <button
              onClick={() => {
                setOpen(false);
                setViewAsOpen(true);
              }}
              className="flex w-full items-center gap-2.5 border-b border-navy-100 px-4 py-3 text-sm text-navy-700 transition-colors hover:bg-navy-50 dark:border-navy-800 dark:text-navy-200 dark:hover:bg-navy-800"
            >
              <Eye className="h-4 w-4" />
              View as staff…
            </button>
          )}

          {/* Language switcher (A.15) */}
          <div className="flex items-center gap-2.5 border-b border-navy-100 px-4 py-3 dark:border-navy-800">
            <Languages className="h-4 w-4 text-navy-400" />
            <span className="text-sm text-navy-600 dark:text-navy-300">
              {t("common.language")}
            </span>
            <div className="ml-auto flex gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                    (lang === l.code
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "text-navy-500 hover:bg-navy-100 dark:text-navy-400 dark:hover:bg-navy-800")
                  }
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={logout}
            disabled={loading}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-60 dark:text-navy-200 dark:hover:bg-navy-800"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {t("common.signOut")}
          </button>

          {confirmAll ? (
            <div className="border-t border-navy-100 px-4 py-3 dark:border-navy-800">
              <p className="text-xs text-navy-500 dark:text-navy-400">
                Sign out on every device you&apos;ve used?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={logoutEverywhere}
                  disabled={loading}
                  className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {loading ? "…" : "Yes, all devices"}
                </button>
                <button
                  onClick={() => setConfirmAll(false)}
                  disabled={loading}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              disabled={loading}
              className="flex w-full items-center gap-2.5 border-t border-navy-100 px-4 py-3 text-sm text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-60 dark:border-navy-800 dark:text-navy-200 dark:hover:bg-navy-800"
            >
              <MonitorSmartphone className="h-4 w-4" />
              Sign out all devices
            </button>
          )}
        </div>
      )}

      {viewAsOpen && <ViewAsLauncher onClose={() => setViewAsOpen(false)} />}
    </div>
  );
}
