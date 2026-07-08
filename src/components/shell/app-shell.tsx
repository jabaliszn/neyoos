"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { HelpOverlay } from "./help-overlay";
import { PwaProvider } from "@/components/offline/pwa-provider";
import { SeasonalThemeBanner } from "./seasonal-theme-banner";
import { AliveModeLayer } from "./alive-mode-layer";
import { cn } from "@/lib/utils";

/**
 * The Odoo app shell: top bar + left sidebar + breadcrumbs + content well.
 * Fully responsive — sidebar collapses to an overlay drawer below `lg`.
 * Tenant/user identity comes from settings later; passed in as props for now.
 */
export function AppShell({
  children,
  tenantName = "Karibu High School",
  tenantLogoUrl,
  userName = "Wanjiru Kamau",
  userRole = "Principal",
  rawRole,
  enabledModules,
  hiddenNav,
  platformHiddenHrefs,
  canViewAs = false,
}: {
  children: React.ReactNode;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  userName?: string;
  userRole?: string;
  rawRole?: string;
  enabledModules?: string[];
  hiddenNav?: Record<string, string[]>;
  platformHiddenHrefs?: string[];
  canViewAs?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-warm-100 dark:bg-navy-950">
      <CommandPalette />
      <HelpOverlay />
      <PwaProvider />
      <AliveModeLayer />
      <Topbar
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        userName={userName}
        userRole={userRole}
        rawRole={rawRole}
        canViewAs={canViewAs}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="flex">
        {/* Desktop sidebar — deliberately reads as its OWN pane vs the module
            content (founder 2026-06-13): distinct tint + hairline + soft edge
            shadow in every theme; the glass theme adds heavier frost on top. */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-navy-200/70 bg-warm-50 shadow-[6px_0_24px_-18px_rgba(28,39,64,0.35)] dark:border-navy-800 dark:bg-navy-900/60 lg:block">
          <Sidebar enabledModules={enabledModules} hiddenNav={hiddenNav} platformHiddenHrefs={platformHiddenHrefs} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-64 animate-fade-in overflow-y-auto border-r border-navy-100 bg-warm-50 shadow-pop dark:border-navy-800 dark:bg-navy-950">
              <Sidebar enabledModules={enabledModules} hiddenNav={hiddenNav} platformHiddenHrefs={platformHiddenHrefs} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Content well */}
        <main className="min-w-0 flex-1">
          <div className="border-b border-navy-100 bg-warm-50/60 px-4 py-3 dark:border-navy-800 dark:bg-navy-950/60 sm:px-8">
            <Breadcrumbs />
          </div>
          <SeasonalThemeBanner />
          {/* FOUNDER 2026-06-12: desktop uses the FULL width — no max-width cap. */}
          <div className={cn("w-full px-4 py-6 sm:px-8 sm:py-8")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
