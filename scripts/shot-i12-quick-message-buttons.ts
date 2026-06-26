import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "parent@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Achieng Mary Otieno", { timeout: 15000 });
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.getByText("Achieng Mary Otieno").click();
  await page.waitForSelector("text=Talk to the school", { timeout: 15000 });
  await page.locator("text=Talk to the school").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "i12-quick-message-buttons.png"), fullPage: false });
  console.log("✓ screenshots/i12-quick-message-buttons.png");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
