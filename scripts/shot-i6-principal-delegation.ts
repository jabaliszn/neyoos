import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createDelegationTask } from "@/lib/services/delegation.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: (u.secondaryRole ?? null) as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const teacher = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  const task = await createDelegationTask(principal, {
    title: "Confirm Form 2 East consent slips",
    details: "Please confirm the consent slips are complete before Friday.",
    category: "DUTY",
    assignedToId: teacher.id,
    dueDate: "2026-06-26",
  });

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
    await page.request.post("http://localhost:3000/api/auth/password/login", {
      data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
    });
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Principal delegation") && document.body.innerText.includes("Confirm Form 2 East consent slips"), null, { timeout: 30000 });
    await page.locator("text=Principal delegation").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: "screenshots/i6-principal-delegation.png", fullPage: false });
    await browser.close();
    console.log("✓ screenshots/i6-principal-delegation.png");
  } finally {
    await db.principalDelegationTask.deleteMany({ where: { id: task.id } });
    await db.notification.deleteMany({ where: { tenantId: tenant.id, category: "delegation", body: { contains: "Confirm Form 2 East consent slips" } } });
  }
}

main().finally(async () => db.$disconnect());
