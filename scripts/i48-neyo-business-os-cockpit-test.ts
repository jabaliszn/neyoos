import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }

async function main() {
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const doc = readFileSync(join(process.cwd(), "docs/NEYO-BUSINESS-OS-ANALYSIS.md"), "utf8");
  assert(ui.includes("function NeyoBusinessOsCockpit") && ui.includes("NEYO Business OS Cockpit"), "NEYO Ops has a Business OS cockpit component");
  for (const label of ["Accounts, billing, subscriptions, payments", "OS lifecycle planning", "NEYO staff, founder page & ideas", "Company documents", "Maintenance / shutdown", "Subscriber communications", "Pricing & plan controls", "YouTube / social management", "Contracts & signing", "Grace enforcement", "Customer communication hub", "Brand assets"]) {
    assert(ui.includes(label), `cockpit includes ${label}`);
  }
  assert(ui.includes("BusinessOperationsTab") && ui.includes("<NeyoBusinessOsCockpit"), "Business Operations tab mounts the cockpit");
  assert(doc.includes("NEYO must run NEYO inside NEYO") && doc.includes("Future OS launches") && doc.includes("Company payment credentials"), "analysis doc explains NEYO Ops architecture, OS launches and company credentials");
  assert(doc.includes("SUPER_ADMIN") && doc.includes("audit logged"), "analysis doc records security guarantees");
  console.log("\nI.48 NEYO Business OS cockpit checkpoint test passed.");
}
main().catch((e)=>{ console.error(e); process.exit(1); });
