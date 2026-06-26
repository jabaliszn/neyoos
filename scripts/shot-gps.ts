import { chromium, type Page } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(800);
  await page.evaluate(async ({ email }) => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Karibu2026!" }) }); }, { email });
}
async function main() {
  const browser = await chromium.launch();
  // grant geolocation at the school gate so the clock-in flow can be shown
  const context = await browser.newContext({
    viewport: { width: 1380, height: 860 },
    geolocation: { latitude: -1.29215, longitude: 36.8219 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await login(page, "f.chebet@karibuhigh.ac.ke");
  await page.goto(`${BASE}/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape");
  await page.locator("button", { hasText: /^Staff$/ }).first().click();
  await page.waitForTimeout(1500);
  // clock in with GPS
  await page.locator("button", { hasText: /Clock in/ }).first().click();
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/44-gps-clockin.png` });
  // 45: school profile geofence card
  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/settings/school`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.locator("text=Staff clock-in location").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/45-geofence-settings.png` });
  await browser.close();
  console.log("✓ 44-45 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
