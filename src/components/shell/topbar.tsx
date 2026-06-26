"use client";

import * as React from "react";
import { Search, Menu, ChevronDown } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { NeyoLogo } from "@/components/brand/neyo-logo";

/**
 * Top bar (Odoo module switcher + Linear Cmd+K search affordance).
 * The module switcher and search are wired to real features in later chunks
 * (A.11 Search, A.7 Notifications). For now they present the correct surface.
 * Upgraded to show the school badge/logo in place of NEYO's icon at the top-left.
 */
export function Topbar({
  tenantName,
  tenantLogoUrl,
  userName,
  userRole,
  canViewAs = false,
  onMenuClick,
}: {
  tenantName: string;
  tenantLogoUrl?: string | null;
  userName: string;
  userRole: string;
  canViewAs?: boolean;
  onMenuClick: () => void;
}) {
  const [showExtra, setShowExtra] = React.useState(false);
  const lastNotifierTapRef = React.useRef(0);

  function handleNotifierTap(e: React.MouseEvent) {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) return;
    const now = Date.now();
    const isSecondTap = now - lastNotifierTapRef.current < 450;
    lastNotifierTapRef.current = now;
    if (isSecondTap) {
      e.preventDefault();
      e.stopPropagation();
      setShowExtra((s) => !s);
      lastNotifierTapRef.current = 0;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-navy-100 bg-warm-50/90 px-3 backdrop-blur-md dark:border-navy-800 dark:bg-navy-950/90 sm:px-5">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Brand + module switcher */}
      <div className="flex items-center gap-2">
        {tenantLogoUrl ? (
          <img
            src={tenantLogoUrl}
            alt={tenantName}
            className="h-8 w-8 rounded-full object-cover border border-navy-200/50 shadow-sm"
          />
        ) : (
          <NeyoLogo variant="mark" className="h-8" title="NEYO" />
        )}
        <button className="hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-navy-800 hover:bg-navy-100 dark:text-navy-100 dark:hover:bg-navy-800 sm:flex">
          {tenantName}
          <ChevronDown className="h-4 w-4 text-navy-400" />
        </button>
      </div>

      {/* Cmd+K search */}
      <button
        onClick={() => window.dispatchEvent(new Event("neyo:open-search"))}
        className="ml-2 hidden h-9 max-w-xs flex-1 items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 text-sm text-navy-400 transition-colors duration-200 ease-apple hover:border-navy-300 dark:border-navy-700 dark:bg-navy-900 md:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search students, fees, staff…</span>
        <kbd className="ml-auto rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500 dark:border-navy-700 dark:bg-navy-800">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Mobile notch/island rule: show ONE right-side element only — the notifier.
            Double-tapping this notifier reveals the hidden utility controls below. */}
        <div className="sm:hidden" onClickCapture={handleNotifierTap} title="Double tap notifications for more controls">
          <NotificationBell />
        </div>

        {/* Desktop utilities */}
        <div className="hidden sm:flex items-center gap-1.5">
          <NotificationBell />
          <OfflineIndicator />
          <ThemeToggle />
          <UserMenu userName={userName} userRole={userRole} canViewAs={canViewAs} />
        </div>
      </div>

      {/* Mobile Dropped-Down Secondary controls */}
      {showExtra && (
        <div className="absolute top-14 left-0 right-0 z-40 flex sm:hidden items-center justify-around gap-2 bg-white/95 dark:bg-black/90 p-3 border-b border-navy-100 dark:border-navy-800 shadow-pop animate-fade-in backdrop-blur-md">
          <OfflineIndicator />
          <ThemeToggle />
          <UserMenu userName={userName} userRole={userRole} canViewAs={canViewAs} />
        </div>
      )}
    </header>
  );
}
