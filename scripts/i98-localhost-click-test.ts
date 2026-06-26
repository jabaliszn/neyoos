import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3000";

const ROUTES = [
  "/dashboard",
  "/students",
  "/students/import",
  "/students/alumni",
  "/students/promotion",
  "/attendance",
  "/finance",
  "/finance/payments",
  "/classes",
  "/admissions",
  "/academics",
  "/exams",
  "/cbc",
  "/teacher",
  "/lms",
  "/comms",
  "/messages",
  "/calendar",
  "/staff",
  "/payroll",
  "/portal",
  "/library",
  "/hostel",
  "/transport",
  "/inventory",
  "/cafeteria",
  "/discipline",
  "/clinic",
  "/gate",
  "/reception",
  "/print-station",
  "/owner",
  "/founder",
  "/settings",
  "/settings/school",
  "/settings/billing",
  "/settings/payments",
  "/settings/modules",
  "/settings/security",
  "/settings/developer",
  "/settings/printing",
  "/settings/visibility",
  "/settings/owners",
  "/settings/public-site",
  "/settings/hardware",
];

const DASHBOARD_LINKS = [
  "/finance",
  "/attendance",
  "/students",
  "/staff",
  "/calendar",
  "/settings/billing",
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function assertHealthyPage(page: Page, route: string) {
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert(res && res.status() < 500, `${route} responds without server error (${res?.status()})`);
  await page.waitForTimeout(250);
  const body = (await page.textContent("body")) || "";
  assert(!body.includes("Something went wrong"), `${route} has no app error boundary`);
  const visible404 = await page.locator("text=This page could not be found").count();
  assert(visible404 === 0, `${route} is not a visible 404`);
}

async function main() {
  console.log("I.98 localhost click-test readiness");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  const login = await page.request.post(`${BASE}/api/auth/password/login`, {
    data: { email: "support@neyo.co.ke", password: "Karibu2026!" },
  });
  assert(login.ok(), "super-admin login API works");

  for (const route of ROUTES) {
    await assertHealthyPage(page, route);
  }

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  for (const href of DASHBOARD_LINKS) {
    const count = await page.locator(`a[href="${href}"]`).count();
    assert(count > 0, `dashboard has clickable card/link to ${href}`);
  }

  // Verify the command/search surface opens and closes without crashing.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await page.waitForTimeout(400);
  const bodyAfterSearch = (await page.textContent("body")) || "";
  assert(bodyAfterSearch.toLowerCase().includes("search"), "keyboard command search opens");
  await page.keyboard.press("Escape");

  await page.screenshot({ path: "screenshots/i98-localhost-click-test-dashboard.png", fullPage: false });
  await browser.close();
  console.log("\n✅ I.98 localhost click-test readiness passed");
  console.log("✓ screenshots/i98-localhost-click-test-dashboard.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
