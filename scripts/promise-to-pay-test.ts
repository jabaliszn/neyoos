/** G.28 — Fee Promise-to-Pay live tests (SELF-HEALS). */
import { db } from "../src/lib/db";
import { createPromiseToPay, listPromises, checkBrokenPromises } from "../src/lib/services/promise-to-pay.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const parent = await su("parent@karibuhigh.ac.ke");
  const bursar = await su("bursar@karibuhigh.ac.ke");
  const invoice = await db.invoice.findFirstOrThrow({ where: { tenantId: parent.tenantId, status: "UNPAID" } });

  // Cleanup leftovers
  await db.promiseToPay.deleteMany({ where: { tenantId: parent.tenantId, invoiceId: invoice.id } });

  // 1) Create Promise-to-Pay from parent
  const p1 = await createPromiseToPay(parent, {
    invoiceId: invoice.id,
    promiseDate: "2026-06-20",
    amountKes: 5000,
  });
  assert("promise created by parent successfully", !!p1.id && p1.amountKes === 5000);

  // 2) Duplicate promise blocked
  try {
    await createPromiseToPay(parent, { invoiceId: invoice.id, promiseDate: "2026-06-25", amountKes: 1000 });
    assert("duplicate promise blocked", false);
  } catch {
    assert("duplicate promise blocked", true);
  }

  // 3) List promises for bursar
  const list = await listPromises(bursar);
  assert("list contains our promise", list.some((p) => p.id === p1.id));

  // 4) Check broken promises (we'll set date to past temporarily to test)
  await db.promiseToPay.update({
    where: { id: p1.id },
    data: { promiseDate: "2026-06-01" }, // in the past!
  });

  const check = await checkBrokenPromises(parent.tenantId);
  assert("promise marked as BROKEN because of past date", check.brokenCount === 1);

  const p1After = await db.promiseToPay.findUniqueOrThrow({ where: { id: p1.id } });
  assert("status updated to BROKEN", p1After.status === "BROKEN");

  // Cleanup
  await db.promiseToPay.deleteMany({ where: { id: p1.id } });

  console.log(`\nG.28 Promise-to-Pay: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
