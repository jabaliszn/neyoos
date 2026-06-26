"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Breadcrumbs (Odoo). Builds a trail from the URL path automatically. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200"
      >
        NEYO
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-navy-300 dark:text-navy-600" />
          {c.last ? (
            <span className="font-medium text-navy-800 dark:text-navy-100">
              {c.label}
            </span>
          ) : (
            <Link
              href={c.href}
              className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
