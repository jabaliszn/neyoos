"use client";

/**
 * Shell V2 (founder-requested "NEYO 2.0", 2026-07-04) — the alternative app
 * shell: a floating, brand-colored, WhatsApp-style bottom module bar in
 * place of the persistent left sidebar, with the freed-up space given to a
 * real left-hand Recent Activity + NEYO Intercom rail.
 *
 * Deliberately a SEPARATE component from `AppShell` (Shell V1) — V1 is never
 * touched, edited, or at risk from this file. Selection between the two
 * happens one level up, in `(app)/layout.tsx`, via `resolveShellVersion()`.
 */
import * as React from "react";
import { Topbar } from "./topbar";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { HelpOverlay } from "./help-overlay";
import { PwaProvider } from "@/components/offline/pwa-provider";
import { SeasonalThemeBanner } from "./seasonal-theme-banner";
import { AliveModeLayer } from "./alive-mode-layer";
import { FloatingModuleBar } from "./floating-module-bar";
import { ShellSidePanel } from "./shell-side-panel";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function AppShellV2({
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
  brandPrimary,
  brandAccent,
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
  brandPrimary?: string | null;
  brandAccent?: string | null;
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
        {/* Recent Activity + NEYO Intercom — the space freed up by moving
            modules into the floating bottom bar. Founder's explicit
            correction: LEFT side, full screen height, not a small widget. */}
        <ShellSidePanel />

        {/* Mobile drawer still reuses the real Sidebar/module list (same
            NAVIGATION source as the floating bar) — small screens keep a
            familiar slide-out menu rather than trying to cram the floating
            bar's horizontal scroll into a 360px width on top of everything
            else Shell V2 adds. */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 animate-fade-in overflow-y-auto border-r border-navy-100 bg-warm-50 shadow-pop dark:border-navy-800 dark:bg-navy-950">
              <Sidebar enabledModules={enabledModules} hiddenNav={hiddenNav} platformHiddenHrefs={platformHiddenHrefs} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Content well — fills the real remaining screen size (founder:
            "it should go with the size of the screen not a small thing"),
            with extra bottom padding so real page content never sits
            underneath the floating bar. */}
        <main className="min-w-0 flex-1">
          <div className="border-b border-navy-100 bg-warm-50/60 px-4 py-3 dark:border-navy-800 dark:bg-navy-950/60 sm:px-8">
            <Breadcrumbs />
          </div>
          <SeasonalThemeBanner />
          <div className={cn("w-full px-4 py-6 pb-32 sm:px-8 sm:py-8 sm:pb-36")}>
            {children}
          </div>
        </main>
      </div>

      <FloatingModuleBar
        enabledModules={enabledModules}
        hiddenNav={hiddenNav}
        platformHiddenHrefs={platformHiddenHrefs}
        brandPrimary={brandPrimary}
        brandAccent={brandAccent}
      />
    </div>
  );
}
