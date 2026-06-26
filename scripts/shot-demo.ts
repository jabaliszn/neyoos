/** G.14 Demo Mode screenshots (129 login CTA, 130 demo banner on dashboard). Desktop 1920x1080. */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 1) login page — show the "Try a demo school" CTA
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  for (const name of ["Got it", "Accept", "Accept all"]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/129-demo-login-cta.png` });

  // 2) click it -> demo school spins up -> dashboard with the amber demo banner
  await page.getByRole("button", { name: /try neyo with a demo school/i }).click();
  // wait for navigation to /dashboard (demo creation + redirect)
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  for (const name of ["Got it", "Accept", "Accept all"]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/130-demo-banner-dashboard.png` });

  await browser.close();
  console.log("✓ screenshots 129-130 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
