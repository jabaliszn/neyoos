/** B.25 Supplier Management — live service test (SELF-HEALS). */
import { db } from "../src/lib/db";
import { createSupplier, rateSupplier, archiveSupplier, addContract, supplierDirectory } from "../src/lib/services/supplier.service";
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
  // clean leftovers from crashed runs
  await db.supplier.deleteMany({ where: { tenantId: bursar.tenantId, name: "Test Cleaners Ltd" } });

  // 1) directory reads seed w/ expiry flags
  const dir = await supplierDirectory(bursar);
  const naivas = dir.find((s) => s.name.includes("Naivas"))!;
  const tailor = dir.find((s) => s.name.includes("Wanjiku"))!;
  assert("seeded suppliers present", !!naivas && !!tailor);
  assert("Naivas rated 4, tailor 5", naivas.rating === 4 && tailor.rating === 5);
  assert("Naivas contract expiring ≤30d (amber)", naivas.hasExpiring === true);
  assert("tailor contract active (no flags)", tailor.activeContracts === 1 && !tailor.hasExpiring && !tailor.hasExpired);
  const exp = naivas.contracts.find((c) => c.expiringSoon)!;
  assert(`daysLeft sane (got ${exp.daysLeft})`, exp.daysLeft > 0 && exp.daysLeft <= 30);

  // 2) create + dup 409 + bad phone 422
  const created = await createSupplier(bursar, { name: "Test Cleaners Ltd", category: "Cleaning", phone: "0711000222" });
  assert("phone normalized to +254", created.phone === "+254711000222");
  try { await createSupplier(bursar, { name: "Test Cleaners Ltd", category: "Cleaning" }); assert("dup name rejected", false); }
  catch { assert("dup name rejected", true); }
  try { await createSupplier(bursar, { name: "Bad Phone Ltd", category: "Other", phone: "12345" }); assert("bad phone rejected", false); }
  catch { assert("bad phone rejected", true); }

  // 3) rating rules
  await rateSupplier(bursar, created.id, 3);
  try { await rateSupplier(bursar, created.id, 9); assert("rating 9 rejected", false); }
  catch { assert("rating 9 rejected", true); }
  const rated = (await supplierDirectory(bursar)).find((s) => s.id === created.id)!;
  assert("rating saved (3)", rated.rating === 3);

  // 4) contract rules: end<=start 422; expired flag
  try { await addContract(bursar, { supplierId: created.id, title: "Backwards", startsOn: "2026-06-10", endsOn: "2026-06-01", valueKes: 0 }); assert("end<=start rejected", false); }
  catch { assert("end<=start rejected", true); }
  await addContract(bursar, { supplierId: created.id, title: "Old cleaning deal", startsOn: "2025-01-01", endsOn: "2025-12-31", valueKes: 50000 });
  const withOld = (await supplierDirectory(bursar)).find((s) => s.id === created.id)!;
  assert("expired contract flagged red", withOld.hasExpired === true && withOld.contracts[0].expired === true);

  // 5) archive hides from directory
  await archiveSupplier(bursar, created.id);
  const after = await supplierDirectory(bursar);
  assert("archived supplier hidden", !after.some((s) => s.id === created.id));

  // 6) audits
  const audits = await db.auditLog.count({ where: { tenantId: bursar.tenantId, action: { in: ["supplier.created", "supplier.rated", "supplier.contract_added", "supplier.archived"] } } });
  assert("audit rows written", audits >= 4);

  // restore: hard-delete the test supplier (cascades contracts)
  await db.supplier.deleteMany({ where: { tenantId: bursar.tenantId, name: "Test Cleaners Ltd" } });
  console.log("  (seed state restored)");

  console.log(`\nB.25 Suppliers: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
