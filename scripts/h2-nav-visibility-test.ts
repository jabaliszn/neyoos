/** H.2 Role-Based Settings & Module Visibility — live test (self-healing). */
import { db } from "../src/lib/db";
import {
  getNavVisibility, setNavVisibility, isHiddenFor, ALWAYS_VISIBLE_HREFS, NavVisibilityError,
} from "../src/lib/services/nav-visibility.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const tenantId = principal.tenantId;
  const orig = (await db.tenant.findUnique({ where: { id: tenantId } }))?.navVisibility ?? null;
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  await db.tenant.update({ where: { id: tenantId }, data: { navVisibility: null } });

  // 1) default empty
  const m0 = await getNavVisibility(tenantId);
  ok(Object.keys(m0).length === 0, "default visibility map is empty");

  // 2) non-leadership cannot set
  try { await setNavVisibility(bursar, { href: "/owner", hiddenRoles: ["TEACHER"] }); ok(false, "bursar set should be FORBIDDEN"); }
  catch (e: any) { ok(e instanceof NavVisibilityError && e.code === "FORBIDDEN", "bursar setNavVisibility blocked (FORBIDDEN)"); }

  // 3) principal hides /finance from TEACHER + BURSAR
  const m1 = await setNavVisibility(principal, { href: "/finance", hiddenRoles: ["TEACHER", "BURSAR"] });
  ok(JSON.stringify(m1["/finance"]) === JSON.stringify(["TEACHER", "BURSAR"]), "rule saved: /finance hidden from TEACHER+BURSAR");

  // 4) isHiddenFor logic
  ok(isHiddenFor(m1, "/finance", "TEACHER") === true, "finance hidden for TEACHER");
  ok(isHiddenFor(m1, "/finance", "PRINCIPAL") === false, "finance NOT hidden for PRINCIPAL");
  ok(isHiddenFor(m1, "/finance", "ACCOUNTANT", "BURSAR") === true, "finance hidden via SECONDARY role (BURSAR)");
  ok(isHiddenFor(m1, "/dashboard", "TEACHER") === false, "dashboard never hideable");

  // 5) cannot hide an always-visible item
  try { await setNavVisibility(principal, { href: "/settings/security", hiddenRoles: ["TEACHER"] }); ok(false, "hiding security should be INVALID"); }
  catch (e: any) { ok(e?.code === "INVALID", "cannot hide /settings/security (INVALID — keeps password access)"); }
  ok(ALWAYS_VISIBLE_HREFS.has("/settings/security") && ALWAYS_VISIBLE_HREFS.has("/dashboard"), "always-visible set includes security + dashboard");

  // 6) empty array clears a rule
  const m2 = await setNavVisibility(principal, { href: "/finance", hiddenRoles: [] });
  ok(m2["/finance"] === undefined, "empty hiddenRoles clears the rule");

  // 7) audit recorded
  const a = await db.auditLog.findFirst({ where: { action: "settings.nav_visibility_updated" }, orderBy: { createdAt: "desc" } });
  ok(!!a, "visibility change audited (settings.nav_visibility_updated)");

  // self-heal
  await db.tenant.update({ where: { id: tenantId }, data: { navVisibility: orig } });
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
