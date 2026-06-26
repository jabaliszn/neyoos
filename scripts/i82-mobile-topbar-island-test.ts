import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.82 mobile top-bar / island behaviour test");
  const topbar = readFileSync("src/components/shell/topbar.tsx", "utf8");
  assert(topbar.includes("show ONE right-side element only — the notifier"), "mobile topbar documents one visible right-side element: notifier");
  assert(topbar.includes('className="sm:hidden" onClickCapture={handleNotifierTap}') && topbar.includes("<NotificationBell />"), "mobile right side renders only NotificationBell as the visible control");
  assert(!topbar.includes("Double-tap chevron controller"), "old extra mobile chevron button has been removed");
  assert(topbar.includes("lastNotifierTapRef") && topbar.includes("isSecondTap") && topbar.includes("setShowExtra"), "double-tapping the notifier reveals hidden controls");
  assert(topbar.includes("Mobile Dropped-Down Secondary controls") && topbar.includes("<ThemeToggle />") && topbar.includes("<UserMenu"), "hidden mobile controls drop down below the topbar");
  assert(topbar.includes("hidden sm:flex") && topbar.includes("Desktop utilities"), "desktop topbar still shows full utility controls normally");
  console.log("\n✅ I.82 mobile top-bar / island behaviour test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
