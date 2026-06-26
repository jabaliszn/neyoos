import { chromium } from "playwright";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import { parentAddPickupPerson, parentCreateAltPickup } from "@/lib/services/parent-portal.service";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, role: u.role, secondaryRole: u.secondaryRole, fullName: u.fullName, email: u.email, phone: u.phone, language: u.language ?? "en", neyoLoginId: u.neyoLoginId, viewAsReadOnly: false } as SessionUser;
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const parent = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }));
  const child = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, guardians: { some: { guardian: { userId: parent.id } } } } });
  const person = await parentAddPickupPerson(parent, { studentId: child.id, fullName: "Njeri Wambui", relationship: "Aunt", phone: "+254711222333", nationalId: "12345678" });
  const alt = await parentCreateAltPickup(parent, { studentId: child.id, pickerName: "Otieno Brian", relationship: "Family friend", pickerPhone: "+254722333444", validHours: 12 });

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
    await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "parent@karibuhigh.ac.ke", password: "Karibu2026!" } });
    await page.goto("http://localhost:3000/portal", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page.locator("button").filter({ hasText: /Achieng|KH-S|KHS/i }).first().click({ force: true });
    await page.waitForFunction(() => document.body.innerText.includes("Pickup safety") && document.body.innerText.includes("Njeri Wambui"), null, { timeout: 20000 }).catch(() => {});
    await page.locator("text=Pickup safety").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: "screenshots/i4-parent-pickup-safety.png", fullPage: false });
    await browser.close();
    console.log("✓ screenshots/i4-parent-pickup-safety.png");
  } finally {
    await db.pickupPerson.deleteMany({ where: { id: person.id } });
    await db.altPickupAuthorization.deleteMany({ where: { id: alt.id } });
  }
}

main().finally(async () => db.$disconnect());
