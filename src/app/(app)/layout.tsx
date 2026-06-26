import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { effectivePermissionsForUser, getSessionContext } from "@/lib/core/session";
import { ROLE_LABELS } from "@/lib/core/roles";
import { db } from "@/lib/db";
import { currentTenantSlug } from "@/lib/core/current-tenant";
import { getEnabledModuleKeys } from "@/lib/services/module.service";
import { getNavVisibility } from "@/lib/services/nav-visibility.service";
import { pausedFeatureHrefs } from "@/lib/services/platform-flags.service";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { DemoBanner } from "@/components/shell/demo-banner";
import { demoStatus } from "@/lib/services/demo.service";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { LangProvider } from "@/components/i18n/lang-provider";
import { isLang } from "@/lib/i18n/dictionaries";

/**
 * Layout for the authenticated app area (A.1 + A.2 + A.3).
 * - Server-side guard: no valid session -> redirect to /login.
 * - Subdomain guard (A.2.3): a tenant subdomain that ISN'T the user's is blocked.
 * - Impersonation banner (A.2.9) shown when a NEYO admin is acting as a school.
 * - The EFFECTIVE user + their school name are passed to the shell.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const user = ctx.user; // effective user (impersonated, if impersonating)

  // Effective tenant for the top-bar module switcher and branding.
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true, slug: true, logoUrl: true },
  });

  // A.2.3 enforcement: skip while impersonating (admin operates cross-tenant).
  if (!ctx.isImpersonating) {
    const slug = currentTenantSlug();
    if (slug && tenant && slug !== tenant.slug) {
      redirect("/wrong-school");
    }
  }

  // A.2.6: sidebar shows only modules this (effective) school has enabled.
  // Pass enabled keys (strings) — NOT pre-filtered nav with icon functions,
  // which can't cross the server->client boundary.
  const enabledModules = Array.from(await getEnabledModuleKeys(user.tenantId));

  // H.2 Role-Based Settings & Module Visibility: owner-configured map of which
  // nav items are hidden for which roles. The sidebar applies it per role.
  const hiddenNav = await getNavVisibility(user.tenantId);
  const platformHiddenHrefs = Array.from(await pausedFeatureHrefs());

  // A.3.4/A.3.5 + I.92: seed the CLIENT with EFFECTIVE permissions from the server.
  // This includes dual roles and strict per-staff support-area scoping, so hidden
  // modules/cards do not briefly flash before /api/auth/permissions refreshes.
  const permissions = await effectivePermissionsForUser(user);

  // Distinguish the two "acting as" modes:
  //  - View-As (G.5): in-school, read-only -> blue banner.
  //  - Impersonation (A.2.9): NEYO super-admin cross-tenant -> amber banner.
  const isViewAs = ctx.isImpersonating && ctx.viewAsReadOnly;
  const isSuperImpersonation = ctx.isImpersonating && !ctx.viewAsReadOnly;

  // The user menu shows "View as" only for leaders who AREN'T already acting.
  const canViewAs =
    !ctx.isImpersonating &&
    ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL"].includes(user.role);

  // G.14 — demo banner when the session's tenant is a sandboxed demo.
  const demo = await demoStatus(user.tenantId);

  return (
    <PermissionsProvider initialRole={user.role} initialSecondaryRole={user.secondaryRole} initialPermissions={permissions}>
      <LangProvider initialLang={isLang(user.language) ? user.language : "en"}>
        {demo.isDemo && <DemoBanner hoursLeft={demo.hoursLeft ?? 0} />}
        {isSuperImpersonation && (
          <ImpersonationBanner
            tenantName={tenant?.name ?? "this school"}
            actingAs={user.fullName}
          />
        )}
        {isViewAs && <ViewAsBanner actingAs={user.fullName} />}
        <AppShell
          tenantName={tenant?.name ?? "NEYO"}
          tenantLogoUrl={tenant?.logoUrl}
          userName={user.fullName}
          userRole={ROLE_LABELS[user.role]}
          enabledModules={enabledModules}
          hiddenNav={hiddenNav}
          platformHiddenHrefs={platformHiddenHrefs}
          canViewAs={canViewAs}
        >
          {children}
        </AppShell>
      </LangProvider>
    </PermissionsProvider>
  );
}
