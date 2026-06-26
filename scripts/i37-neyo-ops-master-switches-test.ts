import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { isPaused, listFlags, pausedFeatureHrefs, setFlag } from "@/lib/services/platform-flags.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }

async function main() {
  const superAdmin = asUser(await db.user.findFirstOrThrow({ where: { email: "support@neyo.co.ke" } }));

  const flags = await listFlags();
  assert(flags.some((f: any) => f.moduleKey === "bundi"), "NEYO Ops flag list includes Bundi mascot launch flag");
  assert(flags.some((f: any) => f.moduleKey === "feature:/finance" && f.kind === "feature"), "NEYO Ops flag list includes individual feature/page switches, not only modules");

  await setFlag(superAdmin, "feature:/finance", true, "I.37 test pause Finance");
  let hidden = await pausedFeatureHrefs();
  assert(hidden.has("/finance"), "pausing a feature hides its href platform-wide");
  await setFlag(superAdmin, "feature:/finance", false, "I.37 test release Finance");
  hidden = await pausedFeatureHrefs();
  assert(!hidden.has("/finance"), "releasing a feature restores its href platform-wide");

  await setFlag(superAdmin, "bundi", false, "I.37 launch rehearsal");
  let bundi = await isPaused("bundi");
  assert(!bundi.paused, "Bundi can be launched from the official platform flag path");
  await setFlag(superAdmin, "bundi", true, "Bundi is getting ready — meet your new helper soon.");
  bundi = await isPaused("bundi");
  assert(bundi.paused, "Bundi is returned to paused ship-state after launch rehearsal");

  const service = readFileSync(join(process.cwd(), "src/lib/services/platform-flags.service.ts"), "utf8");
  const founderUi = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/(app)/layout.tsx"), "utf8");
  const sidebar = readFileSync(join(process.cwd(), "src/components/shell/sidebar.tsx"), "utf8");

  assert(service.includes("NAVIGATION") && service.includes("pausedFeatureHrefs") && service.includes("feature:"), "platform flag service supports module and nav-feature toggles");
  assert(layout.includes("pausedFeatureHrefs") && sidebar.includes("platformHiddenHrefs"), "app shell/sidebar apply platform-hidden feature hrefs");
  assert(founderUi.includes("Launch Bundi") && founderUi.includes("Bundi Mascot Layer"), "NEYO Ops Platform Flags tab is the official Bundi launch place");
  assert(founderUi.includes("Pause") && founderUi.includes("Release"), "NEYO Ops Platform Flags tab exposes pause/release controls");

  console.log("\nI.37 NEYO Ops Master Switches + Mascot Launch test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
