import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/students/import", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const text = [
    "Full Name\tGender\tClass\tAdmission No\tUPI\tBirth Cert",
    "Duplicate Learner\tF\tForm 2 East\tDUP-SHOT-1\tUPI-SHOT-1\tBC-SHOT-1",
    "Duplicate Learner Two\tM\tForm 2 East\tDUP-SHOT-1\tUPI-SHOT-2\tBC-SHOT-2",
  ].join("\n");
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: /Preview pasted rows/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/i93-duplicate-import-preview.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i93-duplicate-import-preview.png");
}

main();
