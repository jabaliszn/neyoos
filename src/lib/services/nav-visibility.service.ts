/**
 * H.2 Role-Based Settings & Module Visibility Control (founder 2026-06-14).
 *
 * Lets the School Owner / Principal hide specific nav items (and whole settings
 * menus) from chosen roles — so non-concerned staff don't see "My School",
 * metrics or admin settings. A per-school JSON map on Tenant.navVisibility:
 *   { "<href>": ["TEACHER","BURSAR", ...] }   // roles for which it is HIDDEN
 *
 * Safety: a small allowlist can NEVER be hidden — every user keeps their own
 * Security (password/2FA) + the Settings hub + their Dashboard, so a locked-down
 * staff member can still change their password and language.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { can, type Permission } from "@/lib/core/permissions";
import type { SessionUser } from "@/lib/core/session";

export class NavVisibilityError extends Error {
  constructor(public code: "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "NavVisibilityError";
  }
}

/** Items that can NEVER be hidden (password change + language live here). */
export const ALWAYS_VISIBLE_HREFS = new Set<string>([
  "/dashboard",
  "/settings",
  "/settings/security",
]);

export type NavVisibilityMap = Record<string, string[]>;

function parseMap(json: string | null): NavVisibilityMap {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object") return obj as NavVisibilityMap;
  } catch { /* ignore */ }
  return {};
}

/** Read this school's visibility map. */
export async function getNavVisibility(tenantId: string): Promise<NavVisibilityMap> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { navVisibility: true } });
  return parseMap(tenant?.navVisibility ?? null);
}

/** Is a nav item hidden for this user (by primary OR secondary role)? */
export function isHiddenFor(map: NavVisibilityMap, href: string, role: string | null, secondaryRole?: string | null): boolean {
  if (ALWAYS_VISIBLE_HREFS.has(href)) return false;
  const roles = map[href];
  if (!roles || roles.length === 0) return false;
  return (!!role && roles.includes(role)) || (!!secondaryRole && roles.includes(secondaryRole));
}

/**
 * Set the hidden-roles list for one nav item. Owner/Principal only.
 * Passing an empty array clears the rule for that href.
 */
function userCan(user: SessionUser, permission: Permission): boolean {
  return can(user.role, permission) || (user.secondaryRole ? can(user.secondaryRole, permission) : false);
}

export async function setNavVisibility(
  user: SessionUser,
  input: { href: string; hiddenRoles: string[] }
): Promise<NavVisibilityMap> {
  return withTenant(user.tenantId, async () => {
    if (!userCan(user, "tenant.manage_settings")) {
      throw new NavVisibilityError("FORBIDDEN", "Only the School Owner or Principal can change menu visibility.");
    }
    if (ALWAYS_VISIBLE_HREFS.has(input.href)) {
      throw new NavVisibilityError("INVALID", "This item is essential and cannot be hidden (staff always keep their password & language settings).");
    }
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const map = parseMap(tenant?.navVisibility ?? null);
    const cleaned = Array.from(new Set(input.hiddenRoles.filter(Boolean)));
    if (cleaned.length === 0) delete map[input.href];
    else map[input.href] = cleaned;

    await db.tenant.update({ where: { id: user.tenantId }, data: { navVisibility: JSON.stringify(map) } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "settings.nav_visibility_updated", entityType: "tenant", entityId: user.tenantId,
        metadata: JSON.stringify({ href: input.href, hiddenRoles: cleaned }),
      },
    });
    return map;
  });
}
