import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "screenshots/i60-exam-analytics.png";
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.goto(`${BASE}/exams`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Multi-term performance analytics", { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
