import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // Visit the app first so the root pre-paint script creates the device cookie
  // required by I.39 device-bound sessions. Then login from inside the browser
  // context so both neyo_session and neyo_device_id cookies match.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Could not sign in for screenshot: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});

  // Move to August, where the seed has multi-day events, so date cells show event pressure.
  await page.getByRole("button", { name: "Next" }).click().catch(() => {});
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Next" }).click().catch(() => {});
  await page.waitForTimeout(1200);

  const isLogin = await page.getByText("Sign in to NEYO", { exact: false }).count().catch(() => 0);
  if (isLogin) throw new Error("Screenshot would capture login page; authenticated calendar did not load.");

  await page.screenshot({ path: path.join(OUT, "i9-calendar-big-dates.png"), fullPage: false });
  console.log("✓ screenshots/i9-calendar-big-dates.png");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
