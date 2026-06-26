import { chromium } from "playwright";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { requestPrintApproval, setPrintLimit } from "@/lib/services/print-limits.service";
import { setPrintStationMode } from "@/lib/services/print-queue.service";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: (u.secondaryRole ?? null) as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const librarian = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "library@karibuhigh.ac.ke" } }));
  const originalLimit = tenant.printLimitPerDay;
  const originalMode = tenant.printStationMode;
  const req = await requestPrintApproval(librarian, { docKind: "INVOICE", docRef: "I8-SHOT", reason: "Need one extra invoice copy for parent file" });
  await setPrintLimit(principal, 12);
  await setPrintStationMode(principal, "HOLD");

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
    await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
    await page.goto("http://localhost:3000/settings/printing", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Daily print limit") && document.body.innerText.includes("Need one extra invoice copy"), null, { timeout: 30000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: "screenshots/i8-printing-controls.png", fullPage: false });
    await browser.close();
    console.log("✓ screenshots/i8-printing-controls.png");
  } finally {
    await db.printApprovalRequest.deleteMany({ where: { id: req.id } });
    await db.tenant.update({ where: { id: tenant.id }, data: { printLimitPerDay: originalLimit, printStationMode: originalMode } });
  }
}

main().finally(async () => db.$disconnect());
