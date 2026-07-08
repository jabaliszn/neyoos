import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
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
  await page.waitForTimeout(2500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(500);

  // Screenshot 1: the Library catalog page showing the new "Import books" button.
  await page.screenshot({ path: path.join(OUT, "n1-library-catalog-import-button.png") });
  console.log("✅ Screenshot captured: n1-library-catalog-import-button.png");

  // Screenshot 2: open the Import Books modal.
  const importBtn = page.getByText("Import books", { exact: true }).first();
  await importBtn.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "n1-library-import-modal.png") });
  console.log("✅ Screenshot captured: n1-library-import-modal.png");

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
