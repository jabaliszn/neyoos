/** B.19 Cafeteria — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  weekMenu, setMenuEntry, kitchenStock, issueForMeal, listCards, issueCard,
  cancelCard, kitchenToday,
} from "../src/lib/services/cafeteria.service";
import { childDetail } from "../src/lib/services/parent-portal.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  // Self-heal: reset cafeteria + inventory + meal invoices, reseed.
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.mealCard.deleteMany({ where: { tenantId: t.id } });
  await db.mealPlanEntry.deleteMany({ where: { tenantId: t.id } });
  await db.stockMovement.deleteMany({ where: { tenantId: t.id } });
  await db.stockBatch.deleteMany({ where: { tenantId: t.id } });
  await db.stockItem.deleteMany({ where: { tenantId: t.id } });
  await db.store.deleteMany({ where: { tenantId: t.id } });
  await db.asset.deleteMany({ where: { tenantId: t.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Meals —" } } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });

  const bursar = await asUser("bursar@karibuhigh.ac.ke");

  // 1) week menu seeded (21 entries) + upsert edit
  const menu = await weekMenu(bursar);
  console.log("menu:", menu.length === 21 ? "✓ 21 entries (7 days × 3 meals)" : "✗ " + menu.length);
  await setMenuEntry(bursar, { dayOfWeek: 5, mealType: "LUNCH", menu: "Pilau Friday — double portion" });
  const menu2 = await weekMenu(bursar);
  const friday = menu2.find((m) => m.dayOfWeek === 5 && m.mealType === "LUNCH");
  console.log("menu upsert:", friday?.menu.includes("double portion") && menu2.length === 21 ? "✓ edited in place (no dup)" : "✗");

  // 2) kitchen stock = B.18 Kitchen Store (one stock truth)
  const stock = await kitchenStock(bursar);
  console.log("kitchen stock reuse:", stock.items.length === 2 && stock.items.some((i) => i.name.includes("Maize")) ? "✓ flour + rice from B.18 store" : "✗");

  // 3) issue food for a meal -> B.18 stockOut w/ reason
  const flour = stock.items.find((i) => i.name.includes("Maize"))!;
  const out = await issueForMeal(bursar, { itemId: flour.id, qty: 4, meal: "Tuesday lunch — ugali" });
  console.log("kitchen issue:", out.qtyLeft === 14 ? "✓ 18→14" : "✗ " + out.qtyLeft);
  const mv = await db.stockMovement.findFirst({ where: { tenantId: t.id, itemId: flour.id, type: "OUT" }, orderBy: { createdAt: "desc" } });
  console.log("movement reason:", mv?.reason === "Kitchen — Tuesday lunch — ugali" ? "✓ traced to the meal" : "✗ " + mv?.reason);

  // 4) seeded card + FOUNDER RULE invoice
  const cards = await listCards(bursar);
  const wanjiruCard = cards.find((c) => c.cardNo === "MC1")!;
  console.log("seeded card:", wanjiruCard && wanjiruCard.invoiceNo === "KHINVMEAL1" && wanjiruCard.invoiceStatus === "UNPAID"
    ? "✓ MC1 linked to UNPAID KHINVMEAL1" : "✗");

  // 5) issue a NEW card -> invoice created + family portal shows it
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const year = new Date().getFullYear();
  const issued = await issueCard(bursar, { studentId: achieng.id, meals: ["BREAKFAST", "LUNCH"], termFeeKes: 9500, year, term: 2 });
  console.log("issue card:", issued.cardNo === "MC2" && issued.planName.includes("Breakfast + Lunch") ? `✓ ${issued.cardNo} "${issued.planName}"` : "✗ " + JSON.stringify(issued));
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: issued.invoiceId } });
  console.log("FOUNDER RULE invoice:", inv.totalKes === 9500 && inv.status === "UNPAID" ? "✓ KES 9,500 UNPAID on her ledger" : "✗");
  const detail = await childDetail(parent, achieng.id);
  console.log("family portal sees it:", detail.invoices.some((i) => i.id === issued.invoiceId) ? "✓ visible w/ Pay button" : "✗ NOT VISIBLE");

  // 6) one active card per term
  try { await issueCard(bursar, { studentId: achieng.id, meals: ["LUNCH"], termFeeKes: 6500, year, term: 2 }); console.log("dup card: ALLOWED ✗"); }
  catch { console.log("one active card per term: ✓"); }

  // 7) cancel + double-cancel
  await cancelCard(bursar, issued.cardId);
  try { await cancelCard(bursar, issued.cardId); console.log("double cancel: ALLOWED ✗"); }
  catch { console.log("double cancel blocked: ✓"); }

  // 8) kitchen today: headcount = cards + boarders; today's menu present
  const today = await kitchenToday(bursar);
  // boarders = 4 (seed), active cards: MC-0001 lunch only (MC-0002 cancelled)
  console.log("headcount:", today.headcount.LUNCH === 5 && today.headcount.BREAKFAST === 4 && today.boarders === 4
    ? "✓ lunch 5 (4 boarders + 1 card), breakfast 4" : "✗ " + JSON.stringify(today.headcount));
  console.log("today's menu:", today.todayMenu.length === 3 ? `✓ 3 meals (${today.todayMenu.map((m) => m.menu.split(" ")[0]).join("/")})` : "✗ " + today.todayMenu.length);

  // cleanup the test invoice + card (cancelled cards keep ledger refs — remove both)
  await db.mealCard.delete({ where: { id: issued.cardId } });
  await db.invoice.delete({ where: { id: issued.invoiceId } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
