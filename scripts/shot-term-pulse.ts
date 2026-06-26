import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  // login via API within the page
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await page.goto("http://localhost:3000/owner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // dismiss cookie banner if present
  try { await page.getByRole("button", { name: /accept|got it|ok/i }).first().click({ timeout: 1500 }); } catch {}
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/home/user/screenshots/131-term-pulse-owner.png" });
  // mobile
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageM = await ctxM.newPage();
  await pageM.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await pageM.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await pageM.goto("http://localhost:3000/owner", { waitUntil: "domcontentloaded" });
  await pageM.waitForTimeout(3500);
  await pageM.screenshot({ path: "/home/user/screenshots/132-term-pulse-mobile.png" });
  await browser.close();
  console.log("shots done");
}
main().catch((e) => { console.error(e); process.exit(1); });
