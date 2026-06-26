/**
 * Capture screenshots of NEYO screens (founder review).
 * Assumes the dev server is already running on http://localhost:3000.
 * Run: tsx scripts/screenshots.ts
 */
import { chromium, type Page } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "..", "screenshots");

async function getSessionCookie(): Promise<string> {
  // Log in as the principal via the API to obtain the session cookie.
  const res = await fetch(`${BASE}/api/auth/password/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("could not get session cookie");
  return m[1];
}

async function shoot(page: Page, url: string, file: string, waitMs = 1200) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log("  ✓", file);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const token = await getSessionCookie();

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  // ---- Public (no auth) ----
  const pub = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const pubPage = await pub.newPage();
  console.log("Public screens:");
  await shoot(pubPage, "/login", "01-login.png");
  await shoot(pubPage, "/login?tenant=karibu-high", "02-login-school.png");
  await shoot(pubPage, "/get-started", "03-get-started.png");
  await shoot(pubPage, "/status", "04-status.png");
  await shoot(pubPage, "/privacy", "05-privacy.png");
  await pub.close();

  // ---- Authenticated (desktop) ----
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  });
  await ctx.addCookies([
    { name: "neyo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await ctx.newPage();
  console.log("App screens (desktop):");
  await shoot(page, "/dashboard", "06-dashboard.png");
  await shoot(page, "/messages", "07-messages.png");
  await shoot(page, "/settings/billing", "08-billing.png");
  await shoot(page, "/settings/modules", "09-modules.png");
  await shoot(page, "/settings/security", "10-security.png");
  await shoot(page, "/settings/payments", "11-payments.png");
  await shoot(page, "/finance/payments", "12-payments-list.png");

  // Dark mode dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("neyo-theme", "dark");
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "13-dashboard-dark.png") });
  console.log("  ✓ 13-dashboard-dark.png");

  // Command palette (⌘K)
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dispatchEvent(new Event("neyo:open-search")));
  await page.waitForTimeout(500);
  await page.keyboard.type("achieng");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "14-command-palette.png") });
  console.log("  ✓ 14-command-palette.png");
  await ctx.close();

  // ---- Mobile (360px) ----
  const mob = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 3,
    isMobile: true,
  });
  await mob.addCookies([
    { name: "neyo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const mPage = await mob.newPage();
  console.log("App screens (mobile 360px):");
  await shoot(mPage, "/dashboard", "15-mobile-dashboard.png");
  await shoot(mPage, "/login", "16-mobile-login.png");
  await mob.close();

  await browser.close();
  console.log("\nDone. Screenshots in /home/user/screenshots");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
