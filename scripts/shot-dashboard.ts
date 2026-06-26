import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // login via API within the page so the cookie is set
  await page.goto("http://localhost:3000/login");
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "/home/user/screenshots/i68-dashboard-working.png", fullPage: true });
  console.log("shot saved");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
