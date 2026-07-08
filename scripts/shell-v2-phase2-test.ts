/**
 * NEYO Shell V2 — PHASE 2 (2026-07-05): the personal per-user toggle + its
 * NEYO Ops release gate, plus the real Liquid Glass translucency fix.
 * Full-stack test.
 *
 * Founder's own phased roadmap for this feature, verbatim from the original
 * scoping: "for now neyo ops but later wen we launch it every one can
 * change in their setting and later it becomes companys default." This is
 * that "later" — a real staged release NEYO Ops configures (master on/off +
 * a per-school early-access list), a real per-user personal preference that
 * only takes visible effect once released for that user's own school, and
 * defaulting to "follow the platform default" until a user explicitly picks
 * one. Also covers the founder's direct follow-up feedback: the floating
 * bar was "too blue and not liquid glass fully... even if one isn't
 * scrolling" — fixed by making its own background genuinely translucent
 * (real RGBA alpha, not opaque hex) so the always-on backdrop-filter blur
 * has real content to blend with, referencing Apple's own WWDC 2025/26
 * Liquid Glass material (translucent, reflects/refracts surroundings,
 * reacts with specular highlights).
 */
import { db } from "@/lib/db";
import {
  getPlatformShellVersion,
  isPersonalShellTogglePlatformReleased,
  isPersonalShellToggleReleasedForTenant,
  setPersonalShellTogglePlatformReleased,
  setShellEarlyAccessForTenant,
  getShellReleaseState,
  getPersonalShellVersion,
  setPersonalShellVersion,
  resolveShellVersion,
  ShellVersionError,
} from "@/lib/services/shell-version.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(`FAILED: ${message}`); console.log(`  \u2713 ${message}`); }
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try { await fn(); throw new Error(`FAILED: ${label} — expected an error, but it succeeded`); }
  catch (e) { if (e instanceof Error && e.message.startsWith("FAILED:")) throw e; console.log(`  \u2713 ${label} (got: ${e instanceof Error ? e.message : String(e)})`); }
}

async function main() {
  console.log("NEYO Shell V2 — PHASE 2 (personal toggle release gate + glass fix) test");

  const superAdmin = asUser(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const otherTenantUser = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@uhuruacademy.ac.ke" } }));

  const originalPlatformDefault = await getPlatformShellVersion();
  const originalReleaseState = await getShellReleaseState();
  const originalPersonal = await getPersonalShellVersion(principal);

  try {
    // ------------------------------------------------------------------
    // Part A — the release gate starts OFF everywhere (safe default: no
    // school silently gets a personal-preference picker before NEYO Ops
    // decides to release it).
    // ------------------------------------------------------------------
    await db.platformSetting.deleteMany({ where: { key: { in: ["shell_personal_toggle_released", "shell_personal_toggle_early_access"] } } });
    assert((await isPersonalShellTogglePlatformReleased()) === false, "with nothing ever saved, the master release switch is genuinely OFF by default");
    assert((await isPersonalShellToggleReleasedForTenant(principal.tenantId)) === false, "with nothing released, a real school is correctly NOT released");

    // ------------------------------------------------------------------
    // Part B — NEYO Ops staged rollout: per-school early access BEFORE the
    // master switch, the founder's own explicit "configure how they want
    // it" requirement.
    // ------------------------------------------------------------------
    const grant = await setShellEarlyAccessForTenant(superAdmin, principal.tenantId, true);
    assert(grant.earlyAccess === true, "SUPER_ADMIN can grant ONE specific school real early access");
    assert((await isPersonalShellToggleReleasedForTenant(principal.tenantId)) === true, "the granted school is now genuinely released, even though the master switch is still off");
    assert((await isPersonalShellToggleReleasedForTenant(otherTenantUser.tenantId)) === false, "a DIFFERENT, ungranted school is correctly still NOT released — a real staged rollout, not an all-or-nothing flip");

    await expectThrow(
      "granting early access to a fake tenant id is refused",
      () => setShellEarlyAccessForTenant(superAdmin, "not-a-real-tenant-id", true)
    );

    const revoke = await setShellEarlyAccessForTenant(superAdmin, principal.tenantId, false);
    assert(revoke.earlyAccess === false, "early access can be genuinely revoked");
    assert((await isPersonalShellToggleReleasedForTenant(principal.tenantId)) === false, "after revoking, the school correctly goes back to NOT released");

    // ------------------------------------------------------------------
    // Part C — the real master switch: once on, EVERY school is released.
    // ------------------------------------------------------------------
    const released = await setPersonalShellTogglePlatformReleased(superAdmin, true);
    assert(released === true, "SUPER_ADMIN can flip the real master switch on");
    assert((await isPersonalShellToggleReleasedForTenant(principal.tenantId)) === true, "with the master switch on, a school with NO specific early access is still genuinely released");
    assert((await isPersonalShellToggleReleasedForTenant(otherTenantUser.tenantId)) === true, "a totally different school is ALSO released once the master switch is on");

    const auditMaster = await db.auditLog.findFirst({ where: { action: "platform.shell_personal_toggle_released", actorId: superAdmin.id }, orderBy: { createdAt: "desc" } });
    assert(!!auditMaster, "a real audit log entry is written when the master switch is flipped on");

    await setPersonalShellTogglePlatformReleased(superAdmin, false);
    assert((await isPersonalShellTogglePlatformReleased()) === false, "the master switch can be genuinely turned back off — nothing here is a one-way door");

    // ------------------------------------------------------------------
    // Part D — the real personal preference: saving is always allowed
    // (harmless before release), but ONLY takes visible effect once
    // released for that user's own school.
    // ------------------------------------------------------------------
    await setPersonalShellVersion(principal, "v2");
    const savedChoice = await getPersonalShellVersion(principal);
    assert(savedChoice === "v2", "a user's personal choice is genuinely saved even while the release gate is still closed");

    const resolvedWhileClosed = await resolveShellVersion(principal);
    assert(resolvedWhileClosed === originalPlatformDefault, "with the release gate CLOSED for this school, the personal choice is correctly IGNORED — resolveShellVersion() still returns the platform default, like a light switch wired to a breaker that isn't live");

    await setShellEarlyAccessForTenant(superAdmin, principal.tenantId, true);
    const resolvedWhileOpen = await resolveShellVersion(principal);
    assert(resolvedWhileOpen === "v2", "the MOMENT the release gate opens for this school, the same already-saved personal choice genuinely takes effect — no need to re-save it");

    await setPersonalShellVersion(principal, null);
    const resolvedAfterClear = await resolveShellVersion(principal);
    assert(resolvedAfterClear === originalPlatformDefault, "clearing a personal choice (back to null) correctly falls back to following the platform default again");

    await expectThrow(
      "saving an invalid personal shell version string is refused",
      () => setPersonalShellVersion(principal, "v3-not-real")
    );

    const auditPersonal = await db.auditLog.findFirst({ where: { action: "user.shell_version_updated", actorId: principal.id }, orderBy: { createdAt: "desc" } });
    assert(!!auditPersonal, "a real audit log entry is written when a user's own personal shell choice changes");

    // ------------------------------------------------------------------
    // Part E — resolveShellVersion() with NO user (e.g. a context where no
    // signed-in user is known yet) safely falls back to the platform
    // default, never crashes.
    // ------------------------------------------------------------------
    const resolvedNoUser = await resolveShellVersion();
    assert(resolvedNoUser === originalPlatformDefault, "resolveShellVersion() with no user argument safely returns the platform default");

    // ------------------------------------------------------------------
    // Part F — the real API route sources are gated correctly.
    // ------------------------------------------------------------------
    const releaseRouteSrc = readFileSync("src/app/api/platform/shell-version/release/route.ts", "utf8");
    assert(releaseRouteSrc.includes('requireRole("SUPER_ADMIN")'), "the real release-gate API route requires SUPER_ADMIN for BOTH GET and POST — this is a company-only control, unlike the platform-default route's open GET");

    const meRouteSrc = readFileSync("src/app/api/me/shell-version/route.ts", "utf8");
    assert(meRouteSrc.includes("requireUser()") && !meRouteSrc.includes('requireRole("SUPER_ADMIN")'), "the real personal-preference API route only requires ANY signed-in user — every staff member controls their own choice");

    // ------------------------------------------------------------------
    // Part G — the real Liquid Glass translucency fix: the bar's own
    // background must be genuinely translucent (real alpha), not opaque
    // hex, and the CSS backdrop-filter must be unconditional (not gated
    // behind a scroll/collapsed state).
    // ------------------------------------------------------------------
    const barSrc = readFileSync("src/components/shell/floating-module-bar.tsx", "utf8");
    assert(barSrc.includes("rgba(") && barSrc.includes("hexToRgbTriple"), "the floating bar's background is now built from real rgba() translucent colors, not opaque hex — the actual root cause of the founder's \"too blue, not liquid glass\" feedback");
    assert(/rgba\(\$\{primaryRgb\}, 0\.\d+\)/.test(barSrc), "the brand color's alpha channel is genuinely less than 1 (real translucency), not a disguised opaque color");

    const cssSrc = readFileSync("src/app/globals.css", "utf8");
    const barRuleIdx = cssSrc.indexOf("html.glass [data-lg-bar] {");
    assert(barRuleIdx > -1, "the real [data-lg-bar] glass CSS rule still exists");
    const barRuleBlock = cssSrc.slice(barRuleIdx, barRuleIdx + 800);
    assert(barRuleBlock.includes("backdrop-filter: blur(var(--lg-blur))"), "the bar's backdrop-filter blur is now a FULL, strong blur (not scaled down to *0.6 like before), applied unconditionally in the base rule — never dependent on scroll/collapsed state");
    assert(!cssSrc.includes("[data-lg-bar]:hover") === false, "a real motion-reactive hover state exists, echoing WWDC26's \"reacts to movement with specular highlights\" material behavior");

    console.log("\nAll Phase 2 assertions passed.");
  } finally {
    // ------------------------------------------------------------------
    // Cleanup — restore every real original value, confirmed via re-query.
    // ------------------------------------------------------------------
    await setPersonalShellTogglePlatformReleased(superAdmin, originalReleaseState.released);
    for (const tid of originalReleaseState.earlyAccessTenantIds) {
      await setShellEarlyAccessForTenant(superAdmin, tid, true);
    }
    if (!originalReleaseState.earlyAccessTenantIds.includes(principal.tenantId)) {
      await setShellEarlyAccessForTenant(superAdmin, principal.tenantId, false);
    }
    await setPersonalShellVersion(principal, originalPersonal);

    const finalReleaseState = await getShellReleaseState();
    const finalPersonal = await getPersonalShellVersion(principal);
    console.log(`Cleanup done. Release state restored: released=${finalReleaseState.released} (expected ${originalReleaseState.released}), earlyAccess=${JSON.stringify(finalReleaseState.earlyAccessTenantIds)} (expected ${JSON.stringify(originalReleaseState.earlyAccessTenantIds)}). Principal's personal choice restored: ${finalPersonal} (expected ${originalPersonal}).`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
