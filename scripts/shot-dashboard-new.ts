import { chromium } from "playwright";
import path from "path";
import fs from "fs/promises";

const BASE = "http://localhost:3000";
const OUT = "/home/user"; // Save to root for easy user download/viewing

async function getSessionCookie(): Promise<string> {
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

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const token = await getSessionCookie();

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, // Desktop 1080p as per founder rules
    deviceScaleFactor: 1,
  });

  await ctx.addCookies([
    { name: "neyo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  const page = await ctx.newPage();
  console.log("Loading dashboard...");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000); // Allow content to load fully

  // Dismiss cookie banner or any dialogs if any
  await page.evaluate(() => {
    // any cookie consent button?
    const btn = document.querySelector("button");
    if (btn && btn.textContent?.includes("Accept")) {
      btn.click();
    }
  });
  await page.waitForTimeout(500);

  const desktopPath = path.join(OUT, "dashboard-glass.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log("Saved dashboard screenshot to:", desktopPath);

  // Take mobile screenshot too
  const mobCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile scale factor
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobCtx.addCookies([
    { name: "neyo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const mPage = await mobCtx.newPage();
  console.log("Loading mobile dashboard...");
  await mPage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await mPage.waitForTimeout(3000);

  const mobilePath = path.join(OUT, "dashboard-mobile-glass.png");
  await mPage.screenshot({ path: mobilePath });
  console.log("Saved mobile dashboard screenshot to:", mobilePath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
