import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const doc = readFileSync(join(process.cwd(), "docs/PAYMENTS-DEVELOPER-GUIDE.md"), "utf8");
  const paymentsUi = readFileSync(join(process.cwd(), "src/components/settings/payments-manager.tsx"), "utf8");
  const developerUi = readFileSync(join(process.cwd(), "src/components/settings/developer-panel.tsx"), "utf8");
  const paymentService = readFileSync(join(process.cwd(), "src/lib/services/payment.service.ts"), "utf8");
  const billingService = readFileSync(join(process.cwd(), "src/lib/services/billing.service.ts"), "utf8");

  assert(doc.includes("Settings → Payments") && doc.includes("/settings/payments"), "guide explains where school Daraja credentials are entered");
  assert(doc.includes("NEYO company subscription credentials") && doc.includes("NEYO Ops"), "guide explains company payment credentials belong in NEYO Ops, not school settings");
  assert(doc.includes("/api/payments/webhook/<school-slug>?t=") && doc.includes("DARAJA_WEBHOOK_TOKEN"), "guide documents live Daraja callback setup");
  assert(doc.includes("/settings/developer") && doc.includes("API keys") && doc.includes("Webhooks"), "guide explains the Developer section");
  assert(paymentsUi.includes("School fee credentials go here") && paymentsUi.includes("NEYO company credentials are not entered here"), "Payments UI clarifies school vs company credentials");
  assert(developerUi.includes("What API keys are for") && developerUi.includes("What webhooks are for"), "Developer UI explains API keys and webhooks in product");
  assert(paymentService.includes("PaymentCredential") && paymentService.includes("encryptForTenant"), "payment service stores school credentials encrypted per tenant");
  assert(billingService.includes("chargeViaSeam") && billingService.includes("auto-confirms"), "billing service still documents subscription payment seam/dev behaviour");

  console.log("\nI.22 Payments & Developer Clarity test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
