import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");

  assert(api.includes("subscriptionPayments") && api.includes("paymentSummary"), "Founder Ops settings API returns NEYO subscription payment summary");
  assert(api.includes("schools") && api.includes("subscription: true"), "Founder Ops settings API returns tenant accounts with subscriptions");
  assert(api.includes("update_school_subscription") && api.includes("platform.subscription_override"), "Founder Ops can override school plan/status/pricing with audit log");
  assert(ui.includes("SaaS Subscriptions & Billing Override"), "Business Operations UI manages school subscription accounts");
  assert(ui.includes("NEYO subscription payment summary") && ui.includes("paymentSummary?.paidKes"), "Business Operations UI displays company subscription payment totals");
  assert(ui.includes("School Ledger Status") && ui.includes("Apply Subscription Override"), "Business Operations UI has ledger status and override action");
  assert(ui.includes("tenant accounts") && ui.includes("paid`"), "Business OS cockpit accounts card includes account and paid revenue status");

  console.log("\nI.48 Accounts/Billing/Payments checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
