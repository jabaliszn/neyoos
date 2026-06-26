"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION, filterNavigation } from "@/lib/core/navigation";
import { usePermissions } from "@/components/auth/permissions-provider";
import { useT } from "@/components/i18n/lang-provider";
import { cn } from "@/lib/utils";

/** Map nav labels to i18n keys (A.15). Unmapped labels show as-is. */
const NAV_I18N: Record<string, string> = {
  Dashboard: "nav.dashboard",
  Messages: "nav.messages",
  Students: "nav.students",
  Attendance: "nav.attendance",
  Finance: "nav.finance",
  Academics: "nav.academics",
  Staff: "nav.staff",
  Settings: "nav.settings",
};

/**
 * Left sidebar (Odoo structure). Highlights the active route.
 * Filters the static NAVIGATION client-side by BOTH enabled modules (A.2.6)
 * and the user's permissions (A.3.6) — so we never pass icon component
 * functions across the RSC boundary.
 */
export function Sidebar({
  onNavigate,
  enabledModules,
  hiddenNav,
  platformHiddenHrefs,
}: {
  onNavigate?: () => void;
  enabledModules?: string[];
  /** H.2 owner-configured visibility map: { "<href>": ["ROLE",...] } hidden roles. */
  hiddenNav?: Record<string, string[]>;
  /** I.37 NEYO Ops platform-wide feature pause: hrefs hidden for every school/user. */
  platformHiddenHrefs?: string[];
}) {
  const pathname = usePathname();
  const { has, role, secondaryRole } = usePermissions();
  const { t } = useT();
  const isHidden = React.useCallback(
    (href: string) => {
      if (platformHiddenHrefs?.includes(href)) return true;
      if (!hiddenNav) return false;
      if (href === "/dashboard" || href === "/settings" || href === "/settings/security") return false;
      const roles = hiddenNav[href];
      if (!roles || roles.length === 0) return false;
      return (!!role && roles.includes(role)) || (!!secondaryRole && roles.includes(secondaryRole));
    },
    [hiddenNav, platformHiddenHrefs, role, secondaryRole]
  );
  const sections = filterNavigation(
    NAVIGATION,
    new Set(enabledModules ?? []),
    has,
    isHidden
  );

  return (
    <nav className="flex h-full flex-col gap-6 px-3 py-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ease-apple",
                      active
                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4.5 w-4.5 shrink-0",
                        active
                          ? "text-green-600 dark:text-green-400"
                          : "text-navy-400 group-hover:text-navy-600 dark:group-hover:text-navy-200"
                      )}
                      strokeWidth={2}
                    />
                    {NAV_I18N[item.label] ? t(NAV_I18N[item.label]) : item.label}
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
