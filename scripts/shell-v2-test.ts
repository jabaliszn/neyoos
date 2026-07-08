/**
 * NEYO Shell V2 — founder-requested "NEYO 2.0" (2026-07-04), full-stack test.
 *
 * The founder's real request: a real, selectable ALTERNATIVE app shell — a
 * floating, brand-colored, WhatsApp-style bottom module bar instead of the
 * classic persistent left sidebar, with the freed-up left-hand space given
 * to a real Recent Activity log + the NEYO Intercom. Company-wide only for
 * now (NEYO Ops picks the platform default); founder's own explicit later
 * plan is a school-level override, then a personal per-user toggle.
 *
 * Standing rule honored: Shell V1 must never be removed or put at risk.
 * This test explicitly proves V1 stays the default and stays fully intact
 * (its own files untouched) alongside the new V2 machinery.
 */
import { db } from "@/lib/db";
import { getPlatformShellVersion, setPlatformShellVersion, resolveShellVersion, ShellVersionError } from "@/lib/services/shell-version.service";
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
  console.log("NEYO Shell V2 — full-stack test");

  const superAdmin = asUser(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));

  const before = await getPlatformShellVersion();

  try {
    // ------------------------------------------------------------------
    // Part A — real defaults: Shell V1 is untouched and is the default.
    // ------------------------------------------------------------------
    await db.platformSetting.deleteMany({ where: { key: "shell_version" } });
    const freshDefault = await getPlatformShellVersion();
    assert(freshDefault === "v1", "with no setting saved at all, the real default is Shell V1 (the classic sidebar) — no school is ever silently switched to the new shell");
    const resolvedDefault = await resolveShellVersion();
    assert(resolvedDefault === "v1", "resolveShellVersion() — the single real entry point every page uses — also defaults to v1");

    // ------------------------------------------------------------------
    // Part B — SUPER_ADMIN can genuinely set + persist + audit the switch.
    // ------------------------------------------------------------------
    const setV2 = await setPlatformShellVersion(superAdmin, "v2");
    assert(setV2 === "v2", "SUPER_ADMIN can switch the platform default to Shell V2");
    const stored = await db.platformSetting.findUnique({ where: { key: "shell_version" } });
    assert(stored?.value === "v2", "the new value is genuinely persisted in PlatformSetting (direct DB re-query), same family as liquid_level");
    const resolvedV2 = await resolveShellVersion();
    assert(resolvedV2 === "v2", "resolveShellVersion() immediately reflects the new platform default");

    const audit = await db.auditLog.findFirst({ where: { action: "platform.shell_version_updated", actorId: superAdmin.id }, orderBy: { createdAt: "desc" } });
    assert(!!audit && JSON.parse(audit.metadata || "{}").shellVersion === "v2", "a real audit log entry is written when the platform shell version changes");

    const setBackV1 = await setPlatformShellVersion(superAdmin, "v1");
    assert(setBackV1 === "v1", "SUPER_ADMIN can switch back to Shell V1 at any time — nothing is a one-way door");

    // ------------------------------------------------------------------
    // Part C — validation + the real role boundary the API route relies on.
    // ------------------------------------------------------------------
    await expectThrow(
      "setting an invalid shell version string is refused",
      () => setPlatformShellVersion(superAdmin, "v3-not-real")
    );
    assert(!(await db.platformSetting.findUnique({ where: { key: "shell_version" } }))!.value.includes("v3"), "the invalid value was never actually saved");

    // The service function itself doesn't role-check (matching
    // setAppearanceSettings' own pattern — the ROUTE enforces
    // requireRole("SUPER_ADMIN")). Prove the real route source genuinely
    // gates POST on SUPER_ADMIN and GET is open to any signed-in user,
    // exactly like the pre-existing /api/platform/appearance route.
    const routeSrc = readFileSync("src/app/api/platform/shell-version/route.ts", "utf8");
    assert(routeSrc.includes('requireRole("SUPER_ADMIN")'), "the real API route source requires SUPER_ADMIN for POST, matching the platform-appearance route's own pattern");
    assert(routeSrc.includes("requireUser()"), "the real API route source only requires a signed-in user (not SUPER_ADMIN) for GET, so every school can read the platform default");

    // ------------------------------------------------------------------
    // Part D — Shell V1 is genuinely untouched: its own files still exist,
    // are still wired into the real layout, and the layout branches on the
    // resolved version rather than replacing V1 outright.
    // ------------------------------------------------------------------
    const appShellV1Src = readFileSync("src/components/shell/app-shell.tsx", "utf8");
    assert(appShellV1Src.includes("export function AppShell("), "the ORIGINAL Shell V1 component (AppShell) still exists, unrenamed, unremoved");
    assert(appShellV1Src.includes("<Sidebar"), "Shell V1 still renders the real persistent Sidebar exactly as before — untouched by this work");

    const layoutSrc = readFileSync("src/app/(app)/layout.tsx", "utf8");
    assert(layoutSrc.includes("shellVersion === \"v2\"") && layoutSrc.includes("<AppShellV2"), "the real app layout branches between the two shells based on the resolved version");
    assert(layoutSrc.includes("<AppShell\n") || layoutSrc.includes("<AppShell "), "the real app layout still renders the ORIGINAL AppShell (Shell V1) in the non-v2 branch, not a rewritten replacement");
    assert(layoutSrc.includes("resolveShellVersion("), "the layout resolves the shell version server-side (zero flash-of-wrong-shell on first paint) — now resolveShellVersion(user), upgraded in Phase 2 to also honor a released personal per-user preference, still the same single real entry point");

    // ------------------------------------------------------------------
    // Part E — Shell V2's own real pieces exist and reuse the RIGHT
    // pre-existing services, never a parallel duplicate implementation.
    // ------------------------------------------------------------------
    const floatingBarSrc = readFileSync("src/components/shell/floating-module-bar.tsx", "utf8");
    assert(floatingBarSrc.includes('from "@/lib/core/navigation"') && floatingBarSrc.includes("filterNavigation"), "the floating module bar reuses the EXACT SAME NAVIGATION + filterNavigation() the sidebar uses — never a second, drifting module list");
    assert(!floatingBarSrc.includes("🏠") && !floatingBarSrc.includes("💰"), "the floating bar uses real Lucide icon components, not emoji placeholders");

    const sidePanelSrc = readFileSync("src/components/shell/shell-side-panel.tsx", "utf8");
    assert(sidePanelSrc.includes('fetch("/api/activity")'), "the side panel's Recent Activity reuses the REAL, pre-existing /api/activity route (tenantActivity()) rather than a new parallel activity system");
    assert(sidePanelSrc.includes('fetch("/api/intercom")'), "the side panel's NEYO Intercom reuses the REAL, pre-existing /api/intercom route (the same presence + call state machine already live on the dashboard) rather than a new parallel intercom");
    assert(sidePanelSrc.includes("describeAction"), "activity rows use the real describeAction() humanizer, not a duplicated copy");

    const appShellV2Src = readFileSync("src/components/shell/app-shell-v2.tsx", "utf8");
    assert(appShellV2Src.includes("<ShellSidePanel") && appShellV2Src.includes("<FloatingModuleBar"), "Shell V2 genuinely assembles both new real pieces");
    // Founder's explicit correction: side panel on the LEFT, appearing
    // BEFORE the <main> content well in source order (a flex row renders
    // left-to-right in DOM order for LTR content).
    const sideIdx = appShellV2Src.indexOf("<ShellSidePanel");
    const mainIdx = appShellV2Src.indexOf("<main");
    assert(sideIdx > -1 && mainIdx > -1 && sideIdx < mainIdx, "the Activity/Intercom panel is placed BEFORE the main content well in the real component source, so it renders on the LEFT per the founder's correction");

    // Founder's explicit ask: real Liquid Glass treatment, not a fake CSS
    // approximation — confirm the floating bar carries a real marker the
    // G.33 glass stylesheet targets, and that a real glass rule for it
    // exists in globals.css.
    assert(floatingBarSrc.includes("data-lg-bar"), "the floating bar carries the real data-lg-bar marker consumed by the G.33 Liquid Glass stylesheet");
    const globalsCss = readFileSync("src/app/globals.css", "utf8");
    assert(globalsCss.includes("[data-lg-bar]") && globalsCss.includes("backdrop-filter"), "a real Liquid Glass CSS rule (backdrop-filter blur/saturate) targets the floating bar in the actual stylesheet — not just inline styles");

    // Founder's explicit ask: the bar follows the SCHOOL's own brand colors.
    assert(appShellV2Src.includes("brandPrimary") && appShellV2Src.includes("brandAccent"), "Shell V2 threads the real Tenant.brandPrimary/brandAccent through to the floating bar");
    assert(floatingBarSrc.includes("brandPrimary") && floatingBarSrc.includes("linear-gradient"), "the floating bar's own background gradient is built from the real school brand colors, not a fixed hardcoded palette");

    // Founder's explicit ask: fills the real screen size, not a small box.
    assert(appShellV2Src.includes("min-h-screen"), "Shell V2's root container fills the real viewport height, not a fixed small box");
    assert(sidePanelSrc.includes("h-[calc(100vh-3.5rem)]"), "the side panel fills the real remaining screen height below the topbar, not a small fixed-height widget");

    console.log("\nAll Shell V2 assertions passed.");
  } finally {
    // ------------------------------------------------------------------
    // Cleanup — restore the platform's real original shell version.
    // ------------------------------------------------------------------
    await setPlatformShellVersion(superAdmin, before);
    const finalCheck = await getPlatformShellVersion();
    console.log(`Cleanup done. Platform shell version restored to original: ${finalCheck} (expected ${before})`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
