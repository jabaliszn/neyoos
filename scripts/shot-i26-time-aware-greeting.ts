import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "screenshots/i26-time-aware-greeting.png";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=/Good (morning|afternoon|evening),/", { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
