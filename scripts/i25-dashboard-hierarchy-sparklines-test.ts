import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const dashboard = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");
  const card = readFileSync(join(process.cwd(), "src/components/ui/card.tsx"), "utf8");
  const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  const order = ["Outstanding Fees", "Fees Collected Today", "Collection Rate", "Students Present"].map((label) => dashboard.indexOf(label));
  assert(order.every((i) => i > -1), "dashboard contains all four money-first top cards");
  assert(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], "top cards are ordered Outstanding Fees → Fees Collected Today → Collection Rate → Students Present");

  assert(dashboard.includes("function MiniSparkline") && dashboard.includes("feeCollectionTrend") && dashboard.includes("attendanceTrend") && dashboard.includes("enrollmentTrend"), "dashboard builds mini sparkline data for fees, attendance and enrollment");
  assert(dashboard.includes('label="Fee collection trend"') && dashboard.includes('label="Attendance trend"') && dashboard.includes('label="Enrollment trend"'), "dashboard renders fee, attendance and enrollment sparklines inside cards");
  assert(dashboard.includes("dashboard-metric-card") && dashboard.includes("hover:-translate-y-0.5") && dashboard.includes("hover:shadow-card-hover"), "dashboard metric cards have hover lift and stronger shadow motion");
  assert(card.includes("hover:-translate-y-0.5") && card.includes("hover:shadow-card-hover"), "shared Card component keeps app-shell hover micro-motion");
  assert(globals.includes("I.25") && globals.includes("dashboard-metric-card") && globals.includes("opacity: 0.045"), "global CSS adds subtle dashboard depth and reduced reflection sheen");
  assert(globals.includes("fixed.inset-0") && globals.includes("100dvh"), "I.20 overlay full-screen blur fix remains consolidated in global CSS");

  console.log("\nI.25 Dashboard Hierarchy, Sparklines & Glass Motion test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
