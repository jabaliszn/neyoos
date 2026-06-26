import { chromium } from "playwright";
import path from "path";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "..", "screenshots");
async function cookie(email: string) {
  const res = await fetch(`${BASE}/api/auth/password/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Karibu2026!" }) });
  const m = (res.headers.get("set-cookie") ?? "").match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("no cookie for " + email);
  return m[1];
}
async function shoot(token: string, url: string, file: string, w=1280, h=1000, dismiss=true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "neyo_session", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" }).catch(()=>{});
  await page.waitForTimeout(3500);
  if (dismiss) await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(()=>{});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log("  ✓", file);
  await ctx.close();
}
let browser: any;
async function main() {
  browser = await chromium.launch({ args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const principal = await cookie("principal@karibuhigh.ac.ke");
  await shoot(principal, "/students", "26-students-list.png");
  // open first student profile
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "neyo_session", value: principal, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/students`, { waitUntil: "domcontentloaded" }).catch(()=>{});
  await page.waitForTimeout(3500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(()=>{});
  await page.getByText("Achieng Mary Otieno").first().click().catch(()=>{});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "27-student-profile.png"), fullPage: false });
  console.log("  ✓ 27-student-profile.png");
  await ctx.close();
  // PARENT view — should only see their child (row-scoping)
  const parent = await cookie("parent@karibuhigh.ac.ke");
  await shoot(parent, "/students", "28-parent-view.png");
  await browser.close();
}
main().catch((e)=>{console.error(e);process.exit(1);});
