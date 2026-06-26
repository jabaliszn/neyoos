/** B.25 Procurement — full pipeline live test (SELF-HEALS). */
import { db } from "../src/lib/db";
import {
  createRequest, addQuote, createOrderFromQuote, approveOrder,
  markSent, recordDelivery, threeWayMatch, cancelOrder, procurementBoard,
} from "../src/lib/services/procurement.service";
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
  const principal = await su("principal@karibuhigh.ac.ke");
  // cleanup leftovers
  await db.purchaseRequest.deleteMany({ where: { tenantId: bursar.tenantId, title: { startsWith: "TEST " } } });
  await db.purchaseOrder.deleteMany({ where: { tenantId: bursar.tenantId, title: { startsWith: "TEST " } } });

  const naivas = await db.supplier.findFirstOrThrow({ where: { tenantId: bursar.tenantId, name: { contains: "Naivas" } } });

  // 1) board reads seed
  const board0 = await procurementBoard(bursar);
  assert("threshold default 50,000", board0.thresholdKes === 50000);
  assert("seed request w/ 2 quotes, cheapest first", board0.requests.some((r) => r.quotes.length === 2 && r.quotes[0].amountKes === 86500));
  assert("seed MATCHED PO present + clean", board0.orders.some((o) => o.poNo === "KHPO1" && o.matchOk === true));

  // 2) UNDER-threshold flow: auto-approved, then full clean pipeline
  const reqA = await createRequest(bursar, { title: "TEST chalk + dusters" });
  const qA = await addQuote(bursar, { requestId: reqA.id, supplierId: naivas.id, amountKes: 12000 });
  const poA = await createOrderFromQuote(bursar, qA.id);
  assert("under threshold → auto-APPROVED", poA.status === "APPROVED" && poA.needsApproval === false);
  assert("PO number generated (KHPO...)", /^KHPO\d+$/.test(poA.poNo));
  await markSent(bursar, poA.id);
  await recordDelivery(bursar, { poId: poA.id, deliveredValueKes: 12000 });
  const mA = await threeWayMatch(bursar, { poId: poA.id, supplierInvoiceNo: "TST-1", supplierInvoiceKes: 12000 });
  assert("clean 3-way match → matchOk", mA.matchOk === true && mA.status === "MATCHED");

  // 3) OVER-threshold flow: pending; creator cannot approve own; principal approves
  const reqB = await createRequest(bursar, { title: "TEST lab equipment" });
  const qB = await addQuote(bursar, { requestId: reqB.id, supplierId: naivas.id, amountKes: 75000 });
  const poB = await createOrderFromQuote(bursar, qB.id);
  assert("over threshold → PENDING_APPROVAL", poB.status === "PENDING_APPROVAL" && poB.needsApproval === true);
  try { await markSent(bursar, poB.id); assert("cannot send unapproved", false); } catch { assert("cannot send unapproved", true); }
  try { await approveOrder(bursar, poB.id); assert("creator cannot self-approve", false); } catch { assert("creator cannot self-approve", true); }
  const approved = await approveOrder(principal, poB.id);
  assert("principal approves", approved.status === "APPROVED" && approved.approvedByName === principal.fullName);

  // 4) MISMATCH detection: short delivery + inflated invoice → flagged
  await markSent(bursar, poB.id);
  await recordDelivery(bursar, { poId: poB.id, deliveredValueKes: 70000, note: "1 microscope missing" });
  const mB = await threeWayMatch(bursar, { poId: poB.id, supplierInvoiceNo: "TST-2", supplierInvoiceKes: 78000 });
  assert("mismatch flagged (matchOk=false)", mB.matchOk === false);
  assert("mismatch note explains all diffs", (mB.matchNote ?? "").includes("70,000") && (mB.matchNote ?? "").includes("78,000"));

  // 5) state machine guards
  try { await threeWayMatch(bursar, { poId: poB.id, supplierInvoiceNo: "TST-3", supplierInvoiceKes: 1 }); assert("double match blocked", false); } catch { assert("double match blocked", true); }
  const reqC = await createRequest(bursar, { title: "TEST cancel flow" });
  const qC = await addQuote(bursar, { requestId: reqC.id, supplierId: naivas.id, amountKes: 5000 });
  const poC = await createOrderFromQuote(bursar, qC.id);
  await cancelOrder(bursar, poC.id);
  const reqCAfter = await db.purchaseRequest.findUniqueOrThrow({ where: { id: reqC.id } });
  assert("cancel reopens the request", reqCAfter.status === "OPEN");
  try { await addQuote(bursar, { requestId: reqA.id, supplierId: naivas.id, amountKes: 100 }); assert("quote on ORDERED request blocked", false); } catch { assert("quote on ORDERED request blocked", true); }

  // 6) audits
  const audits = await db.auditLog.count({ where: { tenantId: bursar.tenantId, action: { startsWith: "procurement." } } });
  assert("procurement audits written", audits >= 8);

  // cleanup
  await db.purchaseRequest.deleteMany({ where: { tenantId: bursar.tenantId, title: { startsWith: "TEST " } } });
  await db.purchaseOrder.deleteMany({ where: { tenantId: bursar.tenantId, title: { startsWith: "TEST " } } });
  console.log("  (test rows removed)");

  console.log(`\nB.25 Procurement: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
