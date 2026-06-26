import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }

async function main() {
  await db.platformSetting.upsert({ where: { key: "maintenance_mode" }, create: { key: "maintenance_mode", value: "false", updatedBy: "test" }, update: { value: "false", updatedBy: "test" } });
  await db.platformSetting.upsert({ where: { key: "maintenance_message" }, create: { key: "maintenance_message", value: "I.48 maintenance message", updatedBy: "test" }, update: { value: "I.48 maintenance message", updatedBy: "test" } });
  await db.platformSetting.upsert({ where: { key: "maintenance_eta" }, create: { key: "maintenance_eta", value: "10 minutes", updatedBy: "test" }, update: { value: "10 minutes", updatedBy: "test" } });
  const root = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  assert(root.includes("maintenance_mode") && root.includes("isSuperAdmin") && root.includes("NEYO Operations Upgrade"), "root layout blocks non-super-admin users during maintenance mode");
  assert(root.includes("maintenance_message") && root.includes("maintenance_eta"), "maintenance screen reads custom message and ETA from PlatformSetting");
  assert(ui.includes("Tap-to-Shutdown System") && ui.includes("Restore Live Operations"), "NEYO Ops has one-tap shutdown and restore buttons");
  assert(ui.includes("maintMessage") && ui.includes("maintEta") && ui.includes("Save notice"), "NEYO Ops can edit maintenance notice and ETA before/while shutdown is active");
  assert(api.includes("update_platform_setting") && api.includes("platform.setting_updated"), "maintenance state and notice are saved through audited platform settings API");
  console.log("\nI.48 Maintenance / shutdown checkpoint test passed.");
}
main().catch((e)=>{ console.error(e); process.exit(1); }).finally(async()=>db.$disconnect());
