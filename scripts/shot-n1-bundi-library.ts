import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60000);
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

  await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(1000);

  await page.getByText("Import books", { exact: true }).first().click({ timeout: 20000 });
  await page.waitForTimeout(800);

  // Click the new "Bundi Intelligent (scan)" tab.
  await page.getByText("Bundi Intelligent (scan)", { exact: false }).click({ timeout: 8000, force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "n1-bundi-library-step1-fields.png") });
  console.log("✅ Screenshot captured: n1-bundi-library-step1-fields.png");

  // Fill a field label and continue to step 2 (upload).
  const labelInput = page.locator('input[placeholder*="Kitabu"]').first();
  await labelInput.fill("Title");
  await page.locator('select').first().selectOption("title");
  await page.getByText("Continue", { exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "n1-bundi-library-step2-upload.png") });
  console.log("✅ Screenshot captured: n1-bundi-library-step2-upload.png");

  // Upload the real test scan and let Bundi actually extract it.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("/tmp/library-test-scan.png");
  await page.waitForSelector("text=Review", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, "n1-bundi-library-step3-review.png") });
  console.log("✅ Screenshot captured: n1-bundi-library-step3-review.png");

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
