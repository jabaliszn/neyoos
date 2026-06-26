/** B.7 Part 1 — live tests. */
import { db } from "../src/lib/db";
import { listStructures, createStructure, batchInvoice, createManualInvoice, applyPaymentToInvoice, listInvoices, arrearsAging } from "../src/lib/services/finance.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");

  // 1) structures + dup blocked
  const structures = await listStructures(bursar);
  console.log("structures:", structures.length, "| total:", structures[0]?.totalKes === 33000 ? "✓ KES 33,000" : "✗");
  try { await createStructure(bursar, { level: "Form 2", year: structures[0].year, term: 2, items: [{ label: "X", amountKes: 1 }] }); console.log("dup structure: ALLOWED ✗"); }
  catch { console.log("dup structure blocked: ✓"); }

  // 2) batch idempotent: re-run skips already-invoiced students
  const batch = await batchInvoice(bursar, structures[0].id, "2026-07-01");
  console.log("re-batch: created", batch.created, "skipped", batch.skipped, batch.created === 0 && batch.skipped === 3 ? "✓ idempotent" : "✗");

  // 3) manual invoice + payment transitions UNPAID->PARTIAL->PAID
  const student = await db.student.findFirstOrThrow({ where: { firstName: "Kiprono" } });
  const inv = await createManualInvoice(bursar, { studentId: student.id, description: "Lost library book", totalKes: 800, dueDate: "2026-06-30", year: 2026, term: 2 });
  console.log("manual invoice:", inv.invoiceNo, inv.status === "UNPAID" ? "✓ UNPAID" : "✗");
  const p1 = await applyPaymentToInvoice(bursar, inv.id, 300);
  console.log("after 300:", p1.status === "PARTIAL" ? "✓ PARTIAL" : "✗");
  const p2 = await applyPaymentToInvoice(bursar, inv.id, 500);
  console.log("after 500 more:", p2.status === "PAID" ? "✓ PAID" : "✗");

  // 4) aging buckets: seed has not-due (PAID excluded), 1-30 late, >60 late
  const aging = await arrearsAging(bursar);
  console.log("aging:", JSON.stringify(aging.buckets), "| outstanding:", aging.totalOutstanding, "| rate:", aging.collectionRate + "%");
  console.log("buckets populated:", aging.buckets.d30 > 0 && aging.buckets.d90 > 0 ? "✓ (overdue spread)" : "✗");
  console.log("outstanding = 18000+33000:", aging.totalOutstanding === 51000 ? "✓" : "✗ " + aging.totalOutstanding);

  // 5) parent sees ONLY own child's invoices
  const mine = await listInvoices(parent, {});
  const kids = await db.studentGuardian.findMany({ where: { guardian: { userId: parent.id } }, select: { studentId: true } });
  const kidIds = new Set(kids.map(k => k.studentId));
  console.log("parent invoices:", mine.length, mine.every(i => kidIds.has(i.studentId)) ? "✓ own child only" : "✗ LEAK");

  // 6) bursar search filter
  const found = await listInvoices(bursar, { q: "kamau" });
  console.log("search 'kamau':", found.length >= 1 && found.every(i => i.studentName.toLowerCase().includes("kamau")) ? "✓" : "✗");

  // cleanup manual invoice
  await db.invoice.delete({ where: { id: inv.id } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
