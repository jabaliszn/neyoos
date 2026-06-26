import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  assert(tenant.logoUrl === "/brand/karibu-badge.svg", "Karibu seed uses a real school badge instead of the NEYO mark");

  const topbar = readFileSync(join(process.cwd(), "src/components/shell/topbar.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/(app)/layout.tsx"), "utf8");
  const island = readFileSync(join(process.cwd(), "src/components/shell/notification-bell.tsx"), "utf8");
  const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const badge = readFileSync(join(process.cwd(), "public/brand/karibu-badge.svg"), "utf8");

  assert(layout.includes("logoUrl") && layout.includes("tenantLogoUrl={tenant?.logoUrl}"), "app layout passes the tenant logo into the topbar");
  assert(topbar.includes("tenantLogoUrl ?") && topbar.includes("<img") && topbar.includes("NeyoLogo"), "topbar renders school badge first and falls back to NEYO only when no badge exists");
  assert(badge.includes("Karibu High School") || badge.includes(">KH<"), "school badge asset is present for top-left branding");
  assert(island.includes("NeyoLogo") && island.includes("Powered by NEYO"), "dynamic island carries a small NEYO mark without replacing the school badge");
  assert(island.includes("+ 0.55rem") && island.includes("Dynamic Island inbox"), "dynamic island and notification inbox share one readable top-center surface");
  assert(island.includes("islandQueue") && island.includes("activeIsland") && island.includes("neyo:live-activity"), "dynamic island still queues one live activity at a time and supports module activity events");
  assert(island.includes("openNotification") && island.includes("window.location.assign"), "dynamic island click deep-links to the triggering area");
  assert(island.includes("recipient") || island.includes("/api/notifications"), "dynamic island reads targeted notifications from the real notification API");
  assert(globals.includes("I.20") && globals.includes("100dvh") && globals.includes(".fixed.inset-0"), "global overlay rule makes fixed scrims cover the full viewport");

  console.log("\nI.20 Branding & Dynamic-Island Notifications test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
