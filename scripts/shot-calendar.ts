import { chromium, type Page } from "playwright";
import path from "path";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "..", "screenshots");

async function cookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/password/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("no cookie");
  return m[1];
}

async function main() {
  const token = await cookie();
  const browser = await chromium.launch({ args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "neyo_session", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();

  // Month view (default = current month, June 2026 -> shows Madaraka + Eid)
  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  // navigate to August (has Mid-term Break + End of Term Exams) for richer view
  await page.getByRole("button", { name: "Next" }).click().catch(() => {});
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Next" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "18-calendar-month.png"), fullPage: false });
  console.log("  ✓ 18-calendar-month.png");

  // Week agenda view
  await page.getByRole("button", { name: "week", exact: true }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "19-calendar-week.png"), fullPage: false });
  console.log("  ✓ 19-calendar-week.png");

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
