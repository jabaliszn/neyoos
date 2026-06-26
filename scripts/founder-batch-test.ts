/** G.21-G.25 founder batch — live tests. */
import { db } from "../src/lib/db";
import { getSchoolProfile, updateSchoolProfile } from "../src/lib/services/school-profile.service";
import { getModuleStates } from "../src/lib/services/module.service";
import { setFlag, listFlags, isPaused } from "../src/lib/services/platform-flags.service";
import { PLANS, ADD_ONS, estimateTermCost, getPlan } from "../src/lib/core/plans";
import { catalogue, placeOrder, listOrders, markDelivered } from "../src/lib/services/uniform.service";
import { buildInvoicePdf } from "../src/lib/services/finance.service";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { Document, Page } from "@react-pdf/renderer";
import { SchoolStamp } from "../src/lib/documents/school-stamp";
import { childDetail } from "../src/lib/services/parent-portal.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  // reset: uniform orders + invoices from prior runs + flags
  await db.uniformOrder.deleteMany({ where: { tenantId: t.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Uniform order" } } });
  await db.platformFlag.deleteMany({});
  await db.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: t.id, moduleKey: "hostel" } },
    update: { enabled: true }, create: { tenantId: t.id, moduleKey: "hostel", enabled: true },
  });

  const principal = await asUser("principal@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const superAdmin = await asUser("support@neyo.co.ke");

  // ===== G.21 SCHOOL TYPE =====
  const profile = await getSchoolProfile(t.id);
  console.log("G.21 school type:", profile.schoolType === "DAY_AND_BOARDING" ? "✓ DAY_AND_BOARDING (seeded)" : "✗ " + profile.schoolType);
  // switch to DAY -> hostel module auto-disables
  await updateSchoolProfile(t.id, { schoolType: "DAY" }, { id: principal.id, name: principal.fullName });
  const statesDay = await getModuleStates(t.id);
  console.log("G.21 DAY hides hostel:", statesDay.find((m) => m.key === "hostel")?.enabled === false ? "✓ hostel auto-off" : "✗");
  // back to boarding + re-enable
  await updateSchoolProfile(t.id, { schoolType: "DAY_AND_BOARDING" }, { id: principal.id, name: principal.fullName });
  await db.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: t.id, moduleKey: "hostel" } },
    update: { enabled: true }, create: { tenantId: t.id, moduleKey: "hostel", enabled: true },
  });

  // ===== G.22 PLATFORM PAUSE =====
  await setFlag(superAdmin, "cafeteria", true, "Cafeteria is in beta — back soon");
  const states = await getModuleStates(t.id);
  console.log("G.22 pause beats tenant-enable:", states.find((m) => m.key === "cafeteria")?.enabled === false ? "✓ cafeteria hidden for ALL schools" : "✗");
  const p = await isPaused("cafeteria");
  console.log("G.22 isPaused note:", p.paused && p.note?.includes("beta") ? "✓ " + p.note : "✗");
  await setFlag(superAdmin, "cafeteria", false);
  const states2 = await getModuleStates(t.id);
  console.log("G.22 release:", states2.find((m) => m.key === "cafeteria")?.enabled === true ? "✓ back live" : "✗");
  const flags = await listFlags();
  console.log("G.22 console list:", flags.length >= 7 && flags.every((f) => !f.paused) ? `✓ ${flags.length} pausable modules` : "✗");

  // ===== G.23 DETAILED PACKAGES =====
  console.log("G.23 plans:", PLANS.length === 4 && PLANS.some((pl) => pl.key === "msingi") ? "✓ 4 packages (Free Karibu/Msingi/Pro/Elite)" : "✗");
  console.log("G.23 add-ons:", ADD_ONS.length >= 6 ? `✓ ${ADD_ONS.length} add-ons` : "✗");
  const pro = getPlan("pro")!;
  console.log("G.23 module entitlements:", pro.includedModules.includes("hostel") && !getPlan("msingi")!.includedModules.includes("hostel")
    ? "✓ Pro has hostel, Msingi doesn't" : "✗");
  const cost = estimateTermCost(pro, 300, ["sms_topup_1000", "priority_support"]);
  console.log("G.23 cost estimate:", cost === 9000 + 800 + 3000 ? "✓ 9,000 + add-ons = 12,800" : "✗ " + cost);

  // ===== G.24 UNIFORM CATALOGUE =====
  const cat = await catalogue(parent);
  console.log("G.24 catalogue:", cat.length === 1 && cat[0].name.includes("sweater") ? "✓ sweater listed w/ price " + cat[0].priceKes : "✗ " + cat.length);
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const order = await placeOrder(parent, { itemId: cat[0].id, studentId: achieng.id, qty: 1, size: "Size 32" });
  console.log("G.24 parent order:", order.orderNo === "UO1" && order.totalKes === 1200 ? `✓ ${order.orderNo} KES 1,200 → ${order.invoiceNo}` : "✗");
  console.log("G.24 supplier SMS:", order.supplierNotified && order.supplierName === "Mama Wanjiku Tailors" ? "✓ relayed to Mama Wanjiku Tailors" : "✗");
  // invoice on family portal
  const detail = await childDetail(parent, achieng.id);
  console.log("G.24 invoice on portal:", detail.invoices.some((i) => i.id === order.invoiceId) ? "✓ visible" : "✗");
  // other family blocked
  const kamau = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Kamau" } });
  try { await placeOrder(parent, { itemId: cat[0].id, studentId: kamau.id, qty: 1 }); console.log("G.24 other family: ALLOWED ✗"); }
  catch { console.log("G.24 other-family order blocked: ✓"); }
  // staff delivery -> stock decrement + SALE movement
  const before = await db.stockItem.findFirstOrThrow({ where: { id: cat[0].id } });
  await markDelivered(bursar, order.orderId);
  const after = await db.stockItem.findFirstOrThrow({ where: { id: cat[0].id } });
  console.log("G.24 delivery depletes stock:", after.qty === before.qty - 1 ? `✓ ${before.qty}→${after.qty}` : "✗");
  const staffOrders = await listOrders(bursar, false);
  console.log("G.24 staff sees orders:", staffOrders.some((o) => o.status === "DELIVERED") ? "✓ DELIVERED status" : "✗");

  // ===== G.25 DIGITAL STAMP + A5 + POWERED BY NEYO =====
  const stampDoc = React.createElement(
    Document, null,
    React.createElement(Page, { size: "A5" } as never,
      React.createElement(SchoolStamp, { d: { schoolName: t.name, county: t.county, addressLine: t.addressLine, logoDataUrl: null, dateText: "12 JUN 2026" }, width: 170 }))
  );
  const stampPdf = await renderToBuffer(stampDoc as never);
  console.log("G.25 stamp renders:", stampPdf.length > 800 ? "✓ stamp draws (react-pdf SVG primitives)" : "✗");
  const { pdf } = await buildInvoicePdf(bursar, (await db.invoice.findFirstOrThrow({ where: { id: order.invoiceId } })).id);
  console.log("G.25 invoice renders A5 w/ stamp:", pdf.length > 5000 ? `✓ PDF ${Math.round(pdf.length / 1024)}KB` : "✗");

  // cleanup
  await db.uniformOrder.deleteMany({ where: { tenantId: t.id } });
  await db.invoice.deleteMany({ where: { tenantId: t.id, description: { contains: "Uniform order" } } });
  await db.stockItem.update({ where: { id: cat[0].id }, data: { qty: before.qty } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
