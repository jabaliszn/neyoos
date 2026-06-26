import { chromium } from "playwright";
import path from "path";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "..", "screenshots");
async function cookie() {
  const res = await fetch(`${BASE}/api/auth/password/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  const m = (res.headers.get("set-cookie") ?? "").match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("no cookie");
  return m[1];
}
async function main() {
  const token = await cookie();
  const browser = await chromium.launch({ args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "neyo_session", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/brand`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(600);
  // top of page (logo + mascot + colors)
  await page.screenshot({ path: path.join(OUT, "21-brand-top.png"), fullPage: false });
  console.log("  ✓ 21-brand-top.png");
  // scroll to component library
  await page.locator("#components").scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "22-brand-components.png"), fullPage: false });
  console.log("  ✓ 22-brand-components.png");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
