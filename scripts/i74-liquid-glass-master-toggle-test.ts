import { db } from "@/lib/db";
import { getAppearanceSettings, setAppearanceSettings } from "@/lib/services/platform-appearance.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.74 Liquid Glass company master toggle test");
  const superAdmin = asUser(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const before = await getAppearanceSettings();

  const off = await setAppearanceSettings(superAdmin, { liquidEnabled: false, liquidLevel: "3" });
  assert(off.liquidEnabled === false && off.liquidLevel === "3", "SUPER_ADMIN can turn Liquid Glass off and set deep level globally");
  const storedOff = await db.platformSetting.findUnique({ where: { key: "neyo_liquid_system_active" } });
  assert(storedOff?.value === "false", "master toggle is stored as a platform setting, not tenant data");

  const on = await setAppearanceSettings(superAdmin, { liquidEnabled: true, liquidLevel: "2" });
  assert(on.liquidEnabled === true && on.liquidLevel === "2", "SUPER_ADMIN can turn Liquid Glass back on globally");
  const audit = await db.auditLog.findFirst({ where: { action: "platform.appearance_updated", actorId: superAdmin.id }, orderBy: { createdAt: "desc" } });
  assert(Boolean(audit?.metadata?.includes("liquidEnabled")), "appearance changes are audit logged with enabled state");

  const route = readFileSync("src/app/api/platform/appearance/route.ts", "utf8");
  assert(route.includes('requireRole("SUPER_ADMIN")') && route.includes("liquidEnabled"), "appearance API is SUPER_ADMIN gated and accepts liquidEnabled");
  const themeToggle = readFileSync("src/components/shell/theme-toggle.tsx", "utf8");
  assert(themeToggle.includes("neyo-liquid-enabled") && themeToggle.includes("wantsGlass"), "client shell applies the company master switch before using glass");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert(layout.includes("neyo_liquid_system_active") && layout.includes("neyo-liquid-enabled"), "root layout uses server and cached pre-paint Liquid Glass master state");
  const ui = readFileSync("src/components/settings/school-profile-editor.tsx", "utf8");
  assert(ui.includes("Company Liquid Glass Master Toggle") && ui.includes("Only NEYO Super Admin"), "settings UI exposes the NEYO Ops master toggle honestly");

  await setAppearanceSettings(superAdmin, before);
  console.log("\n✅ I.74 Liquid Glass company master toggle test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
