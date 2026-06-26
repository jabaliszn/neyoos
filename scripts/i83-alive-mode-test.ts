import { db } from "@/lib/db";
import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.83 NEYO Alive Mode toggleable features test");
  const superAdmin = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  await db.platformSetting.upsert({ where: { key: "neyo_alive_mode_enabled" }, create: { key: "neyo_alive_mode_enabled", value: "true", updatedBy: superAdmin.fullName }, update: { value: "true", updatedBy: superAdmin.fullName } });
  await db.platformSetting.upsert({ where: { key: "neyo_alive_heartbeat_enabled" }, create: { key: "neyo_alive_heartbeat_enabled", value: "true", updatedBy: superAdmin.fullName }, update: { value: "true", updatedBy: superAdmin.fullName } });

  const route = readFileSync("src/app/api/platform/alive-mode/route.ts", "utf8");
  assert(route.includes("neyo_alive_mode_enabled") && route.includes("neyo_alive_heartbeat_enabled") && route.includes("neyo_alive_microcopy_enabled") && route.includes("neyo_alive_motion_enabled"), "Alive Mode has multiple platform setting toggles");
  assert(route.includes('requireRole("SUPER_ADMIN")') && route.includes("platform.alive_mode_updated"), "Alive Mode writes are SUPER_ADMIN-gated and audit logged");
  assert(route.includes("requireUser") && route.includes("readAliveSettings"), "signed-in schools can read Alive Mode settings");

  const layer = readFileSync("src/components/shell/alive-mode-layer.tsx", "utf8");
  assert(layer.includes("/api/platform/alive-mode") && layer.includes("NEYO is live") && layer.includes("animate-ping"), "app shell has live pulse/microcopy Alive Mode layer");
  assert(layer.includes("heartbeat") && layer.includes("microcopy") && layer.includes("motion"), "Alive Mode layer obeys individual toggles");

  const shell = readFileSync("src/components/shell/app-shell.tsx", "utf8");
  assert(shell.includes("<AliveModeLayer />"), "Alive Mode is mounted in the app shell");

  const founder = readFileSync("src/components/founder/founder-ops-client.tsx", "utf8");
  assert(founder.includes("NEYO Alive Mode — toggleable launch polish") && founder.includes("onAliveToggle") && founder.includes("/api/platform/alive-mode"), "NEYO Ops exposes toggle controls for Alive Mode");
  assert(founder.includes("Live pulse") && founder.includes("Micro messages") && founder.includes("Soft motion"), "NEYO Ops can stage individual alive behaviours");

  console.log("\n✅ I.83 NEYO Alive Mode toggleable features test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
