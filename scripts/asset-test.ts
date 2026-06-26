/** B.25 School Assets — depreciation + maintenance live test (SELF-HEALS). */
import { db } from "../src/lib/db";
import { bookValueKes, assetRegister, updateAsset, logAssetMaintenance } from "../src/lib/services/inventory.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const bursar = await su("bursar@karibuhigh.ac.ke");

  // 1) bookValueKes pure-function spot checks (deterministic dates).
  const ref = new Date("2026-06-13T00:00:00Z");
  assert("no depreciation = full value", bookValueKes({ valueKes: 100000, acquiredOn: "2020-01-01", depreciationPctPerYear: 0 }, ref) === 100000);
  assert("no acquiredOn = full value", bookValueKes({ valueKes: 100000, acquiredOn: null, depreciationPctPerYear: 25 }, ref) === 100000);
  const oneYear = bookValueKes({ valueKes: 100000, acquiredOn: "2025-06-13", depreciationPctPerYear: 25 }, ref);
  assert(`25%/yr after exactly 1yr ≈ 75,000 (got ${oneYear})`, Math.abs(oneYear - 75000) < 200);
  assert("floors at 0 (10 yrs at 25%)", bookValueKes({ valueKes: 100000, acquiredOn: "2016-06-13", depreciationPctPerYear: 25 }, ref) === 0);

  // 2) register: seeded laptop has computed book value + OVERDUE service flag.
  const reg = await assetRegister(bursar);
  const laptop = reg.find((a) => a.tag === "AST1")!;
  assert("laptop book value < cost (25%/yr since 2025-01-15)", laptop.bookValueKes < laptop.valueKes && laptop.bookValueKes > 0);
  assert("laptop service OVERDUE flag (2026-06-01 past)", laptop.maintenanceDue === true);
  assert("laptop has 1 seeded service @3,500", laptop.history.length === 1 && laptop.maintenanceCostKes === 3500);
  const benches = reg.find((a) => a.tag === "AST2")!;
  assert("benches no due flag (no next date)", !benches.maintenanceDue && !benches.maintenanceSoon);

  // 3) updateAsset: depreciation guard + custodian change.
  try { await updateAsset(bursar, laptop.id, { depreciationPctPerYear: 150 }); assert("dep >100% rejected", false); }
  catch { assert("dep >100% rejected", true); }
  await updateAsset(bursar, laptop.id, { custodian: "Otieno Brian" });
  const after = (await assetRegister(bursar)).find((a) => a.tag === "AST1")!;
  assert("custodian updated", after.custodian === "Otieno Brian");

  // 4) log maintenance + clears the due flag via nextMaintenanceOn.
  const log = await logAssetMaintenance(bursar, { assetId: laptop.id, date: "2026-06-13", kind: "REPAIR", costKes: 2000, note: "Hinge replaced", nextMaintenanceOn: "2026-12-01" });
  assert("log created", !!log.id);
  const final = (await assetRegister(bursar)).find((a) => a.tag === "AST1")!;
  assert("history grew to 2 + cost 5,500", final.history.length === 2 && final.maintenanceCostKes === 5500);
  assert("due flag CLEARED (next = 2026-12-01)", final.maintenanceDue === false);
  try { await logAssetMaintenance(bursar, { assetId: laptop.id, date: "2026-06-13", kind: "REPAIR", costKes: -5 }); assert("negative cost rejected", false); }
  catch { assert("negative cost rejected", true); }

  // 5) audit rows.
  const audits = await db.auditLog.count({ where: { tenantId: bursar.tenantId, action: { in: ["inventory.asset_updated", "inventory.asset_maintained"] } } });
  assert("audit rows written", audits >= 2);

  // --- restore seed state ---
  await db.assetMaintenance.deleteMany({ where: { tenantId: bursar.tenantId, assetId: laptop.id, note: "Hinge replaced" } });
  await db.asset.update({ where: { id: laptop.id }, data: { custodian: "Achieng Mary", nextMaintenanceOn: "2026-06-01" } });
  console.log("  (seed state restored)");

  console.log(`\nB.25 School Assets: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
