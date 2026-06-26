/**
 * Server-component page guards (Feature A.3.7).
 * Unlike the API guards (which throw 401/403), these REDIRECT — so a user who
 * opens a page they can't access lands somewhere calm, never on an error.
 *
 * Use at the top of a Server Component page:
 *   const user = await requirePagePermission("tenant.manage_modules");
 */
import { redirect } from "next/navigation";
import { effectivePermissionsForUser, getSessionContext, type SessionUser } from "@/lib/core/session";
import { type Permission } from "@/lib/core/permissions";
import { type Role } from "@/lib/core/roles";

/** Require a signed-in user, else redirect to /login. */
export async function requirePageUser(opts?: { isSecurityPage?: boolean }): Promise<SessionUser> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.twoFactorEnforcedMissing && !opts?.isSecurityPage) {
    redirect("/settings/security?enforce2fa=1");
  }
  return ctx.user;
}

/** Require ALL given permissions, else redirect to /forbidden. */
export async function requirePagePermission(
  ...needed: Permission[]
): Promise<SessionUser> {
  const user = await requirePageUser();
  const effective = await effectivePermissionsForUser(user);
  const ok = needed.every((p) => effective.includes(p));
  if (!ok) redirect("/forbidden");
  return user;
}

/** Require one of the given roles, else redirect to /forbidden. */
export async function requirePageRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requirePageUser();
  const hasPrimary = allowed.includes(user.role);
  const hasSecondary = user.secondaryRole ? allowed.includes(user.secondaryRole) : false;
  if (allowed.length > 0 && !hasPrimary && !hasSecondary) {
    redirect("/forbidden");
  }
  return user;
}
