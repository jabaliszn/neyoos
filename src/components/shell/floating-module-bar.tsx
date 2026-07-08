"use client";

/**
 * Shell V2 — the floating bottom module bar (founder-requested "NEYO 2.0",
 * 2026-07-04). Modeled on the founder's own WhatsApp Updates/Calls/
 * Communities/Chats/You reference: a pill-shaped, horizontally-scrollable
 * bar that shrinks out of the way while the page is being scrolled, then
 * expands back the moment scrolling stops or reverses.
 *
 * Deliberately reuses the EXACT SAME real module list the Shell V1 sidebar
 * uses — `NAVIGATION` + `filterNavigation()` (same permission/module-enabled
 * filtering, same Lucide icons already used everywhere else in NEYO) — so
 * Shell V1 and Shell V2 can never drift into showing two different sets of
 * modules.
 *
 * REAL LIQUID GLASS FIX (2026-07-05, founder feedback: "too blue and not
 * liquid glass fully... even if one isn't scrolling"). Root cause found and
 * fixed: the bar's background was a fully OPAQUE brand-color gradient
 * (alpha = 1) — so even though the `[data-lg-bar]` CSS rule in globals.css
 * already applied a real `backdrop-filter: blur()` at ALL times (never
 * conditional on scrolling), there was nothing visible behind it, since an
 * opaque layer hides whatever it blurs. Per Apple's own WWDC 2025/26 Liquid
 * Glass material spec (apple.com/newsroom, June 2025: "a translucent
 * material [that] reflects and refracts its surroundings... dynamically
 * reacts to movement with specular highlights" — genuinely translucent at
 * ALL times, on tab bars/sidebars/toolbars, not only while idle), the bar's
 * own tint is now built from real semi-transparent RGBA brand colors so the
 * blur genuinely has real page content to blend with underneath, plus a
 * real top specular highlight band and a subtle reactive sheen on hover —
 * matching the "lensing"/specular-highlight behavior Apple's own material
 * describes, never a flat opaque painted bar.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION, filterNavigation } from "@/lib/core/navigation";
import { usePermissions } from "@/components/auth/permissions-provider";
import { useT } from "@/components/i18n/lang-provider";
import { cn } from "@/lib/utils";

/** #RRGGBB (or #RGB) -> "r, g, b" for building real rgba() translucency —
 * a school's brandPrimary/brandAccent are stored as hex, but genuine glass
 * translucency requires a real alpha channel, which hex alone can't carry. */
function hexToRgbTriple(hex: string | null | undefined, fallback: string): string {
  const raw = (hex || fallback).trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) {
    const f = fallback.replace("#", "");
    const fi = parseInt(f, 16);
    return `${(fi >> 16) & 255}, ${(fi >> 8) & 255}, ${fi & 255}`;
  }
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

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

export function FloatingModuleBar({
  enabledModules,
  hiddenNav,
  platformHiddenHrefs,
  /** The school's own brand colors (Tenant.brandPrimary/brandAccent) — the
   * bar's gradient always reflects the SIGNED-IN SCHOOL, never a fixed color,
   * per the founder's explicit "follow the neyo company colours too". */
  brandPrimary,
  brandAccent,
}: {
  enabledModules?: string[];
  hiddenNav?: Record<string, string[]>;
  platformHiddenHrefs?: string[];
  brandPrimary?: string | null;
  brandAccent?: string | null;
}) {
  const pathname = usePathname();
  const { has, role, secondaryRole } = usePermissions();
  const { t } = useT();
  const barRef = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const lastScrollYRef = React.useRef(0);
  const collapseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Flatten every section into ONE horizontally-scrollable list — Shell V2
  // has no room for section headers, matching the founder's WhatsApp
  // reference (one flat row of tabs), not a categorized menu.
  const items = React.useMemo(() => {
    const sections = filterNavigation(NAVIGATION, new Set(enabledModules ?? []), has, isHidden);
    return sections.flatMap((s) => s.items);
  }, [enabledModules, has, isHidden]);

  // Scroll-to-collapse: listens on the page's real scroll container. NEYO's
  // content well itself scrolls the window (not an inner div) in Shell V2's
  // layout below, so this listens on `window`.
  React.useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const goingDown = y > lastScrollYRef.current;
      lastScrollYRef.current = y < 0 ? 0 : y;

      if (goingDown && y > 40) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }

      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(() => setCollapsed(false), 1400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // REAL translucency, not an opaque coat of paint — every stop below
  // carries a genuine alpha channel (0.50-0.68) so the browser's own
  // backdrop-filter blur (applied unconditionally by the [data-lg-bar] CSS
  // rule, in EVERY state, not just while scrolling) has real page content
  // underneath to actually blend with. This is the crux of the WWDC26
  // Liquid Glass material vs a plain colored bar.
  const primaryRgb = hexToRgbTriple(brandPrimary, "#1c2740");
  const accentRgb = hexToRgbTriple(brandAccent, "#137e4c");
  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, rgba(${primaryRgb}, 0.66) 0%, rgba(${primaryRgb}, 0.58) 45%, rgba(${accentRgb}, 0.52) 100%)`,
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        ref={barRef}
        data-lg-bar
        style={gradientStyle}
        className={cn(
          "pointer-events-auto relative flex max-w-[94vw] items-center gap-1 overflow-x-auto rounded-full p-2 shadow-[0_10px_36px_-8px_rgba(18,26,46,0.45)] transition-all duration-300 ease-apple sm:max-w-[80vw] lg:max-w-[70vw]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // The bar stays genuinely translucent glass in EVERY state now —
          // collapsing while scrolling only shrinks/dims it further for
          // focus (Apple's own real tab-bar behavior), it never toggles
          // glass ON/OFF like the old opaque version effectively did.
          collapsed ? "scale-[0.94] gap-0.5 p-1.5 opacity-75" : "opacity-100"
        )}
      >
        {/* Real specular highlight band along the top edge — the reflective
            "glass catching light" cue WWDC26's material always shows,
            independent of scroll state. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
        />
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const label = NAV_I18N[item.label] ? t(NAV_I18N[item.label]) : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-full border border-transparent px-3.5 py-2 text-[11px] font-semibold text-white/70 transition-all duration-200 ease-apple hover:text-white",
                active && "border-white/20 bg-white/15 text-white",
                collapsed && "px-2.5 py-1.5"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-all duration-200", collapsed && "h-4.5 w-4.5")} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
