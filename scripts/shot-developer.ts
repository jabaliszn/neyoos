import { chromium, type Page } from "playwright";
import path from "path";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "..", "screenshots");

async function getSessionCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/password/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("no session cookie: " + (await res.text()));
  return m[1];
}

async function main() {
  const token = await getSessionCookie();
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "neyo_session", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/settings/developer`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(5000); // let the API key + webhook lists fully fetch
  // dismiss cookie banner if present
  await page.getByText("Got it", { exact: true }).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "17-developer.png"), fullPage: true });
  console.log("  ✓ 17-developer.png");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
