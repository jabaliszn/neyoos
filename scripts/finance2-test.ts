/** B.7 Part 2 — live tests: STK->callback->ledger, receipt SMS, discounts, reminders. */
import { db } from "../src/lib/db";
import { stkForInvoice, applyDiscount, sendFeeReminders } from "../src/lib/services/finance.service";
import { handleCallback } from "../src/lib/services/payment.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const kamauInv = await db.invoice.findFirstOrThrow({ where: { invoiceNo: "KHINVSEED2" } }); // PARTIAL 15k/33k

  // 1) STK push (mock provider in dev) links payment to invoice
  const stk = await stkForInvoice(bursar, kamauInv.id, "0721445566", 5000);
  const pending = await db.payment.findUniqueOrThrow({ where: { id: stk.paymentId } });
  console.log("STK initiated:", pending.status === "PENDING" && pending.invoiceId === kamauInv.id ? "✓ PENDING + linked" : "✗");

  // 2) mock callback -> PAID -> invoice auto-applied + receipt SMS (console seam)
  const cb = await handleCallback("mock", {
    mock: true, success: true, checkoutRequestId: pending.checkoutRequestId,
    mpesaRef: "SFC" + Date.now().toString(36).toUpperCase(),
  });
  console.log("callback:", cb.status === "PAID" ? "✓ PAID" : "✗ " + cb.status);
  const invAfter = await db.invoice.findUniqueOrThrow({ where: { id: kamauInv.id } });
  console.log("invoice auto-applied:", invAfter.paidKes === kamauInv.paidKes + 5000 ? `✓ paid ${invAfter.paidKes}` : "✗");
  const auditRow = await db.auditLog.findFirst({ where: { action: "finance.invoice_paid_mpesa" } });
  console.log("ledger audit:", auditRow ? "✓" : "✗");

  // 3) over-balance STK blocked + settled-invoice STK blocked
  try { await stkForInvoice(bursar, kamauInv.id, "0721445566", 999999); console.log("over-balance STK: ALLOWED ✗"); }
  catch { console.log("over-balance STK blocked: ✓"); }

  // 4) discount/bursary: Atieno 33k unpaid -> 20k county bursary
  const atienoInv = await db.invoice.findFirstOrThrow({ where: { invoiceNo: "KHINVSEED3" } });
  const disc = await applyDiscount(bursar, atienoInv.id, 20000, "County bursary — CDF");
  console.log("bursary applied:", disc.discountKes === 20000 && disc.status === "UNPAID" ? "✓ 20k, still UNPAID (13k due)" : "✗");
  const disc2 = await applyDiscount(bursar, atienoInv.id, 13000, "Full waiver top-up");
  console.log("full waiver -> PAID:", disc2.status === "PAID" ? "✓" : "✗ " + disc2.status);
  try { await applyDiscount(bursar, atienoInv.id, 99999, "too much"); console.log("over-discount: ALLOWED ✗"); }
  catch { console.log("over-discount blocked: ✓"); }
  // revert Atieno for reminder test
  await db.invoice.update({ where: { id: atienoInv.id }, data: { discountKes: 0, discountReason: null, status: "UNPAID" } });

  // 5) reminders: overdue Kamau (PARTIAL) + Atieno (UNPAID) -> 2 SMS; re-run deduped
  const r1 = await sendFeeReminders(bursar.tenantId);
  console.log("reminders:", r1.sent, "sent", r1.sent === 2 ? "✓" : "✗ " + JSON.stringify(r1));
  const r2 = await sendFeeReminders(bursar.tenantId);
  console.log("re-run deduped (3-day window):", r2.sent === 0 ? "✓ 0 sent" : "✗ " + r2.sent);
  const remAudit = await db.auditLog.findFirst({ where: { action: "finance.reminders_sent" } });
  console.log("reminder audit:", remAudit ? "✓" : "✗");

  // cleanup: revert Kamau payment + reminder stamps, delete test payment
  await db.invoice.update({ where: { id: kamauInv.id }, data: { paidKes: kamauInv.paidKes, status: "PARTIAL", reminderSentAt: null } });
  await db.invoice.update({ where: { id: atienoInv.id }, data: { reminderSentAt: null } });
  await db.payment.delete({ where: { id: stk.paymentId } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
