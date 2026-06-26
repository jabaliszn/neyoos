/** B.25 Uniform Management (per-size stock) — live service test. */
import { db } from "../src/lib/db";
import { setSizeStock, sizeBoard, placeOrder, markDelivered } from "../src/lib/services/uniform.service";
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
  const parentUser = await db.user.findFirstOrThrow({ where: { role: "PARENT", tenantId: bursar.tenantId } });
  const parent = { id: parentUser.id, tenantId: parentUser.tenantId, fullName: parentUser.fullName, role: parentUser.role, email: parentUser.email, phone: parentUser.phone, language: "en" } as SessionUser;

  const sweater = await db.stockItem.findFirstOrThrow({ where: { tenantId: bursar.tenantId, name: "School sweater" } });

  // --- cleanup from previous runs: restore seed sizes ---
  await db.uniformSize.deleteMany({ where: { tenantId: bursar.tenantId, itemId: sweater.id } });
  for (const [size, qty] of [["S", 8], ["M", 14], ["L", 12], ["XL", 6]] as [string, number][]) {
    await db.uniformSize.create({ data: { tenantId: bursar.tenantId, itemId: sweater.id, size, qty } });
  }
  await db.stockItem.update({ where: { id: sweater.id }, data: { qty: 40 } });
  await db.uniformOrder.deleteMany({ where: { tenantId: bursar.tenantId, studentName: { contains: "Achieng" }, itemName: "School sweater", status: "DELIVERED" } });

  // 1) size board reads seeded split
  const board = await sizeBoard(bursar);
  const sw = board.find((b) => b.id === sweater.id)!;
  assert("board shows 4 sizes", sw.sizes.length === 4);
  assert("sum of sizes = master qty 40", sw.sizes.reduce((s, x) => s + x.qty, 0) === 40 && sw.totalQty === 40);

  // 2) set size stock upserts + syncs master qty
  await setSizeStock(bursar, { itemId: sweater.id, size: "M", qty: 20 }); // 14 -> 20 => total 46
  const after = (await sizeBoard(bursar)).find((b) => b.id === sweater.id)!;
  assert("M updated to 20", after.sizes.find((s) => s.size === "M")!.qty === 20);
  assert("master qty synced to 46", after.totalQty === 46);

  // 3) negative qty rejected
  try { await setSizeStock(bursar, { itemId: sweater.id, size: "M", qty: -1 }); assert("negative qty rejected", false); }
  catch { assert("negative qty rejected", true); }

  // 4) non-uniform item rejected
  const book = await db.stockItem.findFirstOrThrow({ where: { tenantId: bursar.tenantId, category: "Stationery" } });
  try { await setSizeStock(bursar, { itemId: book.id, size: "M", qty: 5 }); assert("non-uniform item rejected", false); }
  catch { assert("non-uniform item rejected", true); }

  // 5) ORDER with a size -> deliver -> size row decremented + master decremented
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: bursar.tenantId, firstName: "Achieng" } });
  const order = await placeOrder(parent, { itemId: sweater.id, studentId: achieng.id, qty: 2, size: "M" });
  assert("parent order placed w/ invoice", !!order.invoiceNo);
  await markDelivered(bursar, order.orderId);
  const final = (await sizeBoard(bursar)).find((b) => b.id === sweater.id)!;
  assert("size M decremented 20 -> 18", final.sizes.find((s) => s.size === "M")!.qty === 18);
  assert("master qty decremented 46 -> 44", final.totalQty === 44);

  // 6) sold-out info correct (set XS to 0 -> appears as 0)
  await setSizeStock(bursar, { itemId: sweater.id, size: "XS", qty: 0 });
  const withXs = (await sizeBoard(bursar)).find((b) => b.id === sweater.id)!;
  assert("XS row exists with qty 0 (sold-out pill)", withXs.sizes.find((s) => s.size === "XS")!.qty === 0);

  // --- restore seed state ---
  await db.uniformSize.deleteMany({ where: { tenantId: bursar.tenantId, itemId: sweater.id } });
  for (const [size, qty] of [["S", 8], ["M", 14], ["L", 12], ["XL", 6]] as [string, number][]) {
    await db.uniformSize.create({ data: { tenantId: bursar.tenantId, itemId: sweater.id, size, qty } });
  }
  await db.stockItem.update({ where: { id: sweater.id }, data: { qty: 40 } });
  // remove the test order + its invoice
  const testOrder = await db.uniformOrder.findFirst({ where: { id: order.orderId } });
  if (testOrder) {
    await db.invoice.deleteMany({ where: { id: testOrder.invoiceId } });
    await db.uniformOrder.delete({ where: { id: testOrder.id } });
  }
  await db.stockMovement.deleteMany({ where: { tenantId: bursar.tenantId, reason: { contains: order.orderNo } } });
  console.log("  (seed state restored)");

  console.log(`\nB.25 Uniform sizes: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
