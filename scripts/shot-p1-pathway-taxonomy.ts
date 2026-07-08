import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") console.log("[console.error]", msg.text()); });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/academics`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  // Find and click the "Senior Pathways" tab.
  await page.getByRole("button", { name: /Senior Pathways/i }).click({ timeout: 5000 }).catch(async () => {
    await page.getByText("Senior Pathways", { exact: false }).first().click({ timeout: 5000 });
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, "p1-pathway-taxonomy.png"), fullPage: false });
  await browser.close();
  console.log("✅ Screenshot captured: screenshots/p1-pathway-taxonomy.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
