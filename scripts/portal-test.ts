/** B.10 parent portal — live tests. */
import { db } from "../src/lib/db";
import { myChildren, childDetail, parentStk } from "../src/lib/services/parent-portal.service";
import { handleCallback } from "../src/lib/services/payment.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const parent = await asUser("parent@karibuhigh.ac.ke");

  // 1) children cards: own child only, with live aggregates
  const kids = await myChildren(parent);
  console.log("children:", kids.length, kids[0]?.name, kids.length === 1 ? "✓ own child only" : "✗");
  const k = kids[0];
  console.log("aggregates: attendance", k.attendancePct + "%", "| balance", k.feeBalanceKes, "| latest exam:", k.latestPublishedExam?.name ?? "none",
    k.attendancePct !== null && k.latestPublishedExam ? "✓" : "✗");

  // 2) child detail: attendance + invoices + published exams + contacts
  const detail = await childDetail(parent, k.id);
  console.log("detail: attendance rows", detail.attendance.length, "| invoices", detail.invoices.length, "| exams", detail.exams.length, "| contacts", detail.contacts.length,
    detail.attendance.length > 0 && detail.exams.length > 0 && detail.contacts.length >= 1 ? "✓" : "✗");

  // 3) another family's child -> NOT_FOUND
  const other = await db.student.findFirstOrThrow({ where: { id: { not: k.id }, status: "ACTIVE" } });
  try { await childDetail(parent, other.id); console.log("other child: ALLOWED ✗ LEAK"); }
  catch { console.log("other child blocked: ✓"); }

  // 4) parent STK on own child's invoice -> callback -> applied
  // (Achieng's seed invoice is PAID — create a balance temporarily for the test.)
  const herInv = detail.invoices[0];
  await db.invoice.update({ where: { id: herInv.id }, data: { paidKes: 30000, status: "PARTIAL" } });
  const detail2 = await childDetail(parent, k.id);
  const openInv = detail2.invoices.find(i => i.balanceKes > 0)!;
  console.log("test balance created:", openInv.balanceKes === 3000 ? "✓ 3,000" : "✗");
  const stk = await parentStk(parent, openInv.id, "0712223344", 1000);
  const pending = await db.payment.findUniqueOrThrow({ where: { id: stk.paymentId } });
  await handleCallback("mock", { mock: true, success: true, checkoutRequestId: pending.checkoutRequestId, mpesaRef: "PRNT" + Date.now().toString(36).toUpperCase() });
  const after = await db.invoice.findUniqueOrThrow({ where: { id: openInv.id } });
  console.log("parent STK applied:", after.paidKes === 31000 ? "✓ 30,000 -> 31,000" : "✗ " + after.paidKes);

  // 5) parent STK on ANOTHER family's invoice -> blocked
  const otherInv = await db.invoice.findFirst({ where: { studentId: other.id } });
  if (otherInv) {
    try { await parentStk(parent, otherInv.id, "0712223344", 100); console.log("other family STK: ALLOWED ✗ LEAK"); }
    catch { console.log("other family STK blocked: ✓"); }
  } else console.log("other family STK: (no invoice to test — skip)");

  // cleanup: restore PAID seed state
  await db.invoice.update({ where: { id: herInv.id }, data: { paidKes: 33000, status: "PAID" } });
  await db.payment.delete({ where: { id: stk.paymentId } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
