/** G.31 Print queue — live tests (service-level). */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { queuedJobs, markPrinted, queueClassBatch } from "../src/lib/services/print-queue.service";
import { applyPaymentToInvoice } from "../src/lib/services/finance.service";
import { recordWalkInPayment } from "../src/lib/services/reception.service";
import { handleCallback, initiateStkPush } from "../src/lib/services/payment.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.printJob.deleteMany({ where: { tenantId: t.id } });

  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const receptionist = await asUser("frontoffice@karibuhigh.ac.ke");

  // 1) CASH at the desk -> receipt auto-queued (no tap)
  const cash = await withTenant(t.id, () =>
    recordWalkInPayment(t.id, { method: "cash", amount: 2500, phone: "+254712223344", description: "Walk-in cash test" }, { id: receptionist.id, name: receptionist.fullName })
  );
  let q = await queuedJobs(receptionist);
  console.log("cash auto-queues receipt:", q.jobs.some((j) => j.kind === "RECEIPT" && j.refId === cash.id) ? "✓ queued without any tap" : "✗");

  // 2) fee payment applied -> invoice (w/ auto-computed balance) auto-queued
  const partial = await db.invoice.findFirstOrThrow({ where: { tenantId: t.id, status: "PARTIAL" } });
  await applyPaymentToInvoice(bursar, partial.id, 1000);
  q = await queuedJobs(bursar);
  const invJob = q.jobs.find((j) => j.kind === "INVOICE" && j.refId === partial.id);
  console.log("payment auto-queues invoice:", invJob ? "✓ " + invJob.title.slice(0, 60) : "✗");
  console.log("balance auto-computed in title:", invJob?.title.includes("bal KES") ? "✓" : "✗ " + invJob?.title);

  // 3) dedupe: paying again does NOT duplicate the queued job
  await applyPaymentToInvoice(bursar, partial.id, 500);
  q = await queuedJobs(bursar);
  const dups = q.jobs.filter((j) => j.kind === "INVOICE" && j.refId === partial.id);
  console.log("queue dedupe:", dups.length === 1 ? "✓ one job despite two payments" : "✗ " + dups.length);

  // 4) M-PESA STK -> callback -> receipt + invoice auto-queued
  const unpaid = await db.invoice.findFirstOrThrow({ where: { tenantId: t.id, status: "UNPAID", description: { contains: "fees" } } });
  const stk = await withTenant(t.id, async () => {
    const { stkForInvoice } = await import("../src/lib/services/finance.service");
    return stkForInvoice(bursar, unpaid.id, "+254712223344", 1500);
  });
  const pending = await db.payment.findUniqueOrThrow({ where: { id: stk.paymentId } });
  await handleCallback("mock", { mock: true, success: true, checkoutRequestId: pending.checkoutRequestId, mpesaRef: "PRNT" + Date.now().toString(36).toUpperCase() });
  q = await queuedJobs(bursar);
  console.log("M-Pesa auto-queues:", q.jobs.some((j) => j.kind === "RECEIPT" && j.refId === stk.paymentId) && q.jobs.some((j) => j.kind === "INVOICE" && j.refId === unpaid.id)
    ? "✓ receipt + updated invoice" : "✗");

  // 5) CLASS BATCH for distribution
  const structure = await db.feeStructure.findFirstOrThrow({ where: { tenantId: t.id } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 2", stream: "East" } });
  const batch = await queueClassBatch(bursar, structure.id, f2e.id);
  console.log("class batch:", batch.queued === 3 && batch.classLabel === "Form 2 East" ? "✓ 3 invoices queued for Form 2 East" : "✗ " + JSON.stringify(batch));
  q = await queuedJobs(bursar);
  const grouped = q.jobs.filter((j) => j.classLabel === "Form 2 East");
  console.log("grouped by class:", grouped.length >= 3 ? `✓ ${grouped.length} under "Form 2 East"` : "✗");

  // 6) station marks printed -> leaves queue; double-print 409; OFFLINE persistence
  const first = q.jobs[0];
  await markPrinted(receptionist, first.id);
  try { await markPrinted(receptionist, first.id); console.log("double print: ALLOWED ✗"); }
  catch { console.log("double print blocked: ✓"); }
  const q2 = await queuedJobs(receptionist);
  console.log("printed leaves queue:", q2.jobs.every((j) => j.id !== first.id) && q2.printedToday >= 1 ? "✓ + printed-today count" : "✗");
  // (batch deduped against the 2 already-queued invoices — so 4 remain after 1 print)
  console.log("offline persistence:", q2.jobs.length >= 4 ? `✓ ${q2.jobs.length} jobs still QUEUED (printer 'off' until station opens)` : "✗ " + q2.jobs.length);

  // 7) bursar allowed; teacher blocked (route-level check is can() — verify service unaffected)
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke");
  const { can } = await import("../src/lib/core/permissions");
  console.log("teacher station access:", !can(chebet.role as never, "reception.operate") && !can(chebet.role as never, "finance.view") ? "✓ would 403 at the route" : "✗");

  // cleanup: restore ledgers + clear queue
  await db.invoice.update({ where: { id: partial.id }, data: { paidKes: partial.paidKes, status: "PARTIAL" } });
  const unpaidAfter = await db.invoice.findUniqueOrThrow({ where: { id: unpaid.id } });
  await db.invoice.update({ where: { id: unpaid.id }, data: { paidKes: unpaidAfter.paidKes - 1500, status: "UNPAID" } });
  await db.payment.delete({ where: { id: stk.paymentId } });
  await db.payment.delete({ where: { id: cash.id } });
  await db.printJob.deleteMany({ where: { tenantId: t.id } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
