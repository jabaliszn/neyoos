import { db } from "../src/lib/db";
import { NAVIGATION, filterNavigation } from "../src/lib/core/navigation";
import { MODULES } from "../src/lib/core/modules";
import { type Role } from "../src/lib/core/roles";
import { effectivePermissionsForUser, type SessionUser } from "../src/lib/core/session";
import { getNavVisibility, isHiddenFor, setNavVisibility } from "../src/lib/services/nav-visibility.service";
import { ownerCount } from "../src/lib/services/owner-approval.service";
import { promoteStaff } from "../src/lib/services/hr.service";
import { readFileSync } from "node:fs";

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function expectThrows(name: string, fn: () => Promise<unknown>, code?: string) {
  return fn()
    .then(() => check(name, false, "expected an error"))
    .catch((e) => check(name, code ? e?.code === code : true, `blocked with ${e?.code ?? e?.name ?? "error"}`));
}
function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: (u.secondaryRole ?? null) as Role | null,
    language: u.language ?? "en",
  };
}
function flatHref(sections: any[]) {
  return new Set<string>(sections.flatMap((s) => s.items.map((i: any) => i.href)));
}
async function navFor(user: SessionUser) {
  const permissions = await effectivePermissionsForUser(user);
  const enabled = new Set(MODULES.map((m) => m.key));
  const hidden = await getNavVisibility(user.tenantId);
  return flatHref(filterNavigation(NAVIGATION, enabled, (p) => permissions.includes(p as any), (href) => isHiddenFor(hidden, href, user.role, user.secondaryRole)));
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Karibu tenant missing. Run npm run db:seed first.");

  const [principalRow, deputyRow, bursarRow, teacherRow, librarianRow, superRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "deputy@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "bursar@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "library@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "support@neyo.co.ke" } }),
  ]);

  const originalTenantNav = tenant.navVisibility;
  const originalBursarSecondary = bursarRow.secondaryRole;
  const originalPrincipalSecondary = principalRow.secondaryRole;
  const originalLibrarianRole = librarianRow.role;
  const tempOwnerIds: string[] = [];

  try {
    const principal = asUser(principalRow);
    const deputy = asUser(deputyRow);
    const bursar = asUser(bursarRow);
    const teacher = asUser(teacherRow);
    const superAdmin = asUser(superRow);

    const principalPerms = await effectivePermissionsForUser(principal);
    const bursarPerms = await effectivePermissionsForUser(bursar);
    const deputyPerms = await effectivePermissionsForUser(deputy);
    check("Principal has owner.dashboard", principalPerms.includes("owner.dashboard"));
    check("Bursar does not have owner.dashboard", !bursarPerms.includes("owner.dashboard"));
    check("Deputy does not have owner.dashboard", !deputyPerms.includes("owner.dashboard"));

    const dashboardSource = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    check("dashboard money cards are gated by owner.dashboard only", dashboardSource.includes('const canSeeFinanceCards = has("owner.dashboard");'));
    check("dashboard money cards are not gated by finance.view", !dashboardSource.includes('has("finance.view") || has("owner.dashboard")'));
    check("dashboard subscription plan card is owner/principal-only", dashboardSource.includes('const canSeeBillingCard = has("owner.dashboard");'));

    const principalNav = await navFor(principal);
    const bursarNav = await navFor(bursar);
    const teacherNav = await navFor(teacher);
    const superNav = await navFor(superAdmin);
    check("Principal sees My School navigation", principalNav.has("/owner"));
    check("Bursar does not see My School navigation", !bursarNav.has("/owner"));
    check("Teacher does not see My School navigation", !teacherNav.has("/owner"));
    check("Bursar does not see NEYO subscription billing settings", !bursarNav.has("/settings/billing"));
    check("Teacher keeps only safe settings basics in system nav", teacherNav.has("/settings") && teacherNav.has("/settings/security") && !teacherNav.has("/settings/billing") && !teacherNav.has("/settings/modules"));
    check("School principal does not see NEYO Ops", !principalNav.has("/founder"));
    check("SUPER_ADMIN sees NEYO Ops", superNav.has("/founder"));

    const settingsHubSource = readFileSync("src/app/(app)/settings/page.tsx", "utf8");
    check("settings hub strips non-concerned staff to security only", settingsHubSource.includes('items = items.filter((i) => i.href === "/settings/security")'));
    check("settings billing tile requires owner.dashboard", settingsHubSource.includes('href: "/settings/billing", icon: CreditCard, permission: "owner.dashboard"'));

    const pageGuardSource = readFileSync("src/lib/core/page-guards.ts", "utf8");
    const appLayoutSource = readFileSync("src/app/(app)/layout.tsx", "utf8");
    check("server page guards use effective dual-role/per-staff permissions", pageGuardSource.includes("effectivePermissionsForUser"));
    check("app layout seeds effective permissions without a nav flash", appLayoutSource.includes("const permissions = await effectivePermissionsForUser(user);"));

    const visibilitySource = readFileSync("src/components/settings/visibility-manager.tsx", "utf8");
    check("visibility UI can hide My School from Owners and Principals", visibilitySource.includes("OWNER_VIEW_RESTRICTABLE_ROLES") && visibilitySource.includes('item.href === "/owner"'));

    await setNavVisibility(principal, { href: "/owner", hiddenRoles: ["SCHOOL_OWNER", "PRINCIPAL", "BURSAR"] });
    const hiddenMap = await getNavVisibility(tenant.id);
    check("owner/principal can hide My School from Principal", isHiddenFor(hiddenMap, "/owner", "PRINCIPAL", null));
    check("owner/principal can hide My School from School Owner", isHiddenFor(hiddenMap, "/owner", "SCHOOL_OWNER", null));
    check("settings and security can never be hidden", !isHiddenFor(hiddenMap, "/settings/security", "PRINCIPAL", null));
    await setNavVisibility(principal, { href: "/owner", hiddenRoles: [] });

    await db.user.update({ where: { id: bursarRow.id }, data: { secondaryRole: "PRINCIPAL" } });
    const dualBursar = asUser(await db.user.findUniqueOrThrow({ where: { id: bursarRow.id } }));
    const dualPerms = await effectivePermissionsForUser(dualBursar);
    check("dual-role staff receives combined owner/principal permissions", dualPerms.includes("owner.dashboard") && dualPerms.includes("tenant.manage_settings"));
    const dualNav = await navFor(dualBursar);
    check("dual-role staff sees My School when secondary role is Principal", dualNav.has("/owner"));

    const temp1 = await db.user.create({ data: { tenantId: tenant.id, neyoLoginId: `NEYO-I5-OWNER-A-${Date.now()}`, fullName: "Wanjiku Test Owner", email: `i5-owner-a-${Date.now()}@karibuhigh.ac.ke`, role: "SCHOOL_OWNER" } });
    const temp2 = await db.user.create({ data: { tenantId: tenant.id, neyoLoginId: `NEYO-I5-OWNER-B-${Date.now()}`, fullName: "Kamau Test Owner", email: `i5-owner-b-${Date.now()}@karibuhigh.ac.ke`, role: "SCHOOL_OWNER" } });
    tempOwnerIds.push(temp1.id, temp2.id);
    await db.user.update({ where: { id: principalRow.id }, data: { secondaryRole: "SCHOOL_OWNER" } });
    check("Owners can be many, and Principal can also be Owner", (await ownerCount(tenant.id)) >= 3);

    await expectThrows("Deputy cannot confirm role assignment", () => promoteStaff(deputy, librarianRow.id, "SUPPORT_STAFF", "I.5 negative test"), "FORBIDDEN");
    await promoteStaff(principal, librarianRow.id, "SUPPORT_STAFF", "I.5 principal confirmation test");
    await promoteStaff(dualBursar, librarianRow.id, originalLibrarianRole, "I.5 secondary-principal confirmation restores role");
    const audit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, action: "hr.staff_promoted", entityId: librarianRow.id }, orderBy: { createdAt: "desc" } });
    check("role assignment audit stores Principal/Owner confirmation", !!audit?.metadata?.includes("confirmedByName") && !!audit?.metadata?.includes("confirmedByRole"));
  } finally {
    await db.tenant.update({ where: { id: tenant.id }, data: { navVisibility: originalTenantNav } });
    await db.user.update({ where: { id: bursarRow.id }, data: { secondaryRole: originalBursarSecondary } });
    await db.user.update({ where: { id: principalRow.id }, data: { secondaryRole: originalPrincipalSecondary } });
    await db.user.update({ where: { id: librarianRow.id }, data: { role: originalLibrarianRole } });
    if (tempOwnerIds.length) await db.user.deleteMany({ where: { id: { in: tempOwnerIds } } });
    await db.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nI.5 role dashboard visibility: ${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
