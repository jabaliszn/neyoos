import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  assert(ui.includes("NeyoBusinessOsCockpit"), "NEYO Business OS cockpit remains mounted");
  assert(ui.includes("function OsLifecycleBoard") && ui.includes("NEYO OS Lifecycle Board"), "NEYO Ops has an OS lifecycle board");
  assert(ui.includes("School OS") && ui.includes("Business OS") && ui.includes("Farm OS") && ui.includes("Creator OS"), "OS lifecycle board covers School, Business, Farm and Creator OS");
  assert(ui.includes("neyo_os_lifecycle") && ui.includes("updatePlatformSetting"), "OS lifecycle state is stored in PlatformSetting through existing NEYO Ops API");
  assert(ui.includes("PLANNED") && ui.includes("BUILDING") && ui.includes("BETA") && ui.includes("LIVE") && ui.includes("PAUSED"), "OS lifecycle supports launch statuses");
  const route = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  assert(route.includes("update_platform_setting") && route.includes("requireRole(\"SUPER_ADMIN\")"), "lifecycle updates are SUPER_ADMIN-gated through founder ops platform settings");
  console.log("\nI.48 OS lifecycle board test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
