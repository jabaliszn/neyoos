/** B.18 Inventory + founder invoice rule — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  listStores, createStore, listItems, createItem, stockIn, stockOut,
  sellToStudent, itemMovements, alerts, addAsset,
} from "../src/lib/services/inventory.service";
import { billFineToInvoice } from "../src/lib/services/library.service";
import { childDetail } from "../src/lib/services/parent-portal.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  // Self-heal: reset inventory tables + sale invoices, then reseed.
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.stockMovement.deleteMany({ where: { tenantId: t.id } });
  await db.stockBatch.deleteMany({ where: { tenantId: t.id } });
  await db.stockItem.deleteMany({ where: { tenantId: t.id } });
  await db.store.deleteMany({ where: { tenantId: t.id } });
  await db.asset.deleteMany({ where: { tenantId: t.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "school store" } } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Library fine" } } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });

  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const librarian = await asUser("library@karibuhigh.ac.ke");

  // 1) stores + low-stock counts
  const stores = await listStores(bursar);
  const kitchen = stores.find((s) => s.name === "Kitchen Store")!;
  console.log("stores:", stores.length === 2 ? "✓ 2" : "✗");
  console.log("low-stock count on store card:", kitchen.lowStock === 1 ? "✓ kitchen has 1 (rice)" : "✗ " + kitchen.lowStock);

  // 2) dup store/item blocked
  try { await createStore(bursar, { name: "Main Store" }); console.log("dup store: ALLOWED ✗"); }
  catch { console.log("dup store blocked: ✓"); }
  const items = await listItems(bursar);
  const flour = items.find((i) => i.name.includes("Maize"))!;
  const rice = items.find((i) => i.name.includes("Rice"))!;
  const sweater = items.find((i) => i.name.includes("sweater"))!;
  try { await createItem(bursar, { storeId: flour.storeId, name: "Maize flour (2kg)", category: "Food", unit: "bales", reorderLevel: 0 }); console.log("dup item: ALLOWED ✗"); }
  catch { console.log("dup item blocked: ✓"); }

  // 3) alerts: rice low, flour batch expiring
  const al = await alerts(bursar);
  console.log("reorder alert:", al.lowStock.some((l) => l.name.includes("Rice")) ? "✓ rice flagged (4 ≤ 6)" : "✗");
  console.log("expiry alert:", al.expiring.some((e) => e.item.includes("Maize") && e.batchNo === "B-2026-05") ? "✓ batch B-2026-05 expiring" : "✗");

  // 4) stock in: batch REQUIRED for trackExpiry items
  try { await stockIn(bursar, { itemId: flour.id, qty: 5 }); console.log("batchless IN on perishable: ALLOWED ✗"); }
  catch { console.log("batch required for perishables: ✓"); }
  await stockIn(bursar, { itemId: rice.id, qty: 10, reason: "Emergency top-up" });
  const riceAfter = (await listItems(bursar)).find((i) => i.id === rice.id)!;
  console.log("stock in:", riceAfter.qty === 14 && !riceAfter.low ? "✓ 4→14, low flag cleared" : "✗ " + riceAfter.qty);

  // 5) stock out: insufficient blocked; FIFO batch depletion; low-stock warning
  try { await stockOut(bursar, { itemId: sweater.id, qty: 1000, reason: "x" }); console.log("oversell: ALLOWED ✗"); }
  catch { console.log("insufficient stock blocked: ✓"); }
  const out = await stockOut(bursar, { itemId: flour.id, qty: 8, reason: "Kitchen issue — week 7 lunches" });
  const flourBatches = (await listItems(bursar)).find((i) => i.id === flour.id)!.batches;
  const oldBatch = flourBatches.find((b) => b.batchNo === "B-2026-05");
  console.log("FIFO depletion:", !oldBatch || oldBatch.qty === 0 ? "✓ expiring batch consumed first" : "✗ " + JSON.stringify(oldBatch));
  console.log("qty after out:", out.qtyLeft === 10 ? "✓ 18−8=10" : "✗ " + out.qtyLeft);

  // 6) ===== FOUNDER RULE: SALE → STUDENT INVOICE =====
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const sale = await sellToStudent(bursar, { itemId: sweater.id, studentId: achieng.id, qty: 2 });
  console.log("sale:", sale.totalKes === 2400 ? `✓ 2 sweaters = KES 2,400 → invoice ${sale.invoiceNo}` : "✗ " + JSON.stringify(sale));
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: sale.invoiceId } });
  console.log("REAL B.7 invoice:", inv.status === "UNPAID" && inv.totalKes === 2400 && inv.studentId === achieng.id ? "✓ UNPAID, on Achieng's ledger" : "✗");
  // family portal sees it
  const detail = await childDetail(parent, achieng.id);
  const onPortal = detail.invoices.find((i) => i.id === sale.invoiceId);
  console.log("FAMILY PORTAL shows the sale:", onPortal ? `✓ "${onPortal.description}" balance ${onPortal.balanceKes}` : "✗ NOT VISIBLE");
  // stock decremented + SALE movement w/ links
  const sweaterAfter = (await listItems(bursar)).find((i) => i.id === sweater.id)!;
  const mv = await db.stockMovement.findFirst({ where: { tenantId: t.id, type: "SALE", invoiceId: sale.invoiceId } });
  console.log("stock + movement:", sweaterAfter.qty === 38 && mv?.studentName?.includes("Achieng") ? "✓ 40→38, SALE row links student+invoice" : "✗");

  // 7) sale rules: no price / not enough stock
  try { await sellToStudent(bursar, { itemId: rice.id, studentId: achieng.id, qty: 1 }); console.log("no-price sale: ALLOWED ✗"); }
  catch { console.log("no-price sale blocked: ✓"); }

  // 8) ===== FOUNDER RULE: LIBRARY FINE → STUDENT INVOICE =====
  // Kamau's seeded overdue book: return it (creates the fine), then bill it.
  const { returnBook, openIssues } = await import("../src/lib/services/library.service");
  const open = await openIssues(librarian);
  const kamauIssue = open.find((o) => o.studentName.includes("Kamau"))!;
  const ret = await returnBook(librarian, { issueId: kamauIssue.id, finePaid: false });
  const billed = await billFineToInvoice(librarian, kamauIssue.id);
  console.log("fine → invoice:", billed.fineKes === ret.fineKes && billed.invoiceNo ? `✓ KES ${billed.fineKes} on invoice ${billed.invoiceNo}` : "✗");
  const fineInv = await db.invoice.findUniqueOrThrow({ where: { id: billed.invoiceId } });
  console.log("fine invoice real:", fineInv.status === "UNPAID" && fineInv.description.includes("Library fine") ? "✓ " + fineInv.description.slice(0, 40) : "✗");
  // double-bill blocked
  try { await billFineToInvoice(librarian, kamauIssue.id); console.log("double-bill fine: ALLOWED ✗"); }
  catch { console.log("double-bill fine blocked: ✓"); }

  // 9) movements trail + asset register
  const trail = await itemMovements(bursar, flour.id);
  console.log("movement trail:", trail.movements.length >= 2 ? `✓ ${trail.movements.length} rows (IN + OUT)` : "✗");
  const asset = await addAsset(bursar, { name: "Test projector", category: "ICT", valueKes: 45000 });
  console.log("asset auto-tag:", asset.tag === "AST3" ? "✓ AST3" : "✗ " + asset.tag);

  // cleanup test extras (seed state restored on next run by self-heal)
  await db.asset.delete({ where: { id: asset.id } });
  await db.invoice.delete({ where: { id: sale.invoiceId } });
  await db.invoice.delete({ where: { id: billed.invoiceId } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
