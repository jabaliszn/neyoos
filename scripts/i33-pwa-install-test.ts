import { chromium } from "playwright";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.33 PWA install button test");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("neyo-cookie-ack", new Date().toISOString());
    localStorage.removeItem("neyo-pwa-install-dismissed");
  });
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const install = page.getByText("Install NEYO").first();
  await install.waitFor({ state: "visible", timeout: 10_000 });
  assert(await install.isVisible(), "Install NEYO button is visible bottom-right");
  await install.click();
  await page.waitForTimeout(500);
  assert((await page.textContent("body"))?.includes("Add NEYO to your Home Screen"), "manual install instructions open when browser prompt is unavailable");
  await page.screenshot({ path: "screenshots/i33-pwa-install-button.png", fullPage: false });
  await browser.close();
  console.log("\n✅ I.33 PWA install button test passed");
  console.log("✓ screenshots/i33-pwa-install-button.png");
}

main().catch((err) => { console.error(err); process.exit(1); });
