import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/students", { waitUntil: "domcontentloaded" });
  await page.waitForResponse((res) => res.url().includes("/api/students") && res.status() === 200, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Print Newsletters/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "screenshots/n3-newsletter-modal.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/n3-newsletter-modal.png");
}

main();
