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
  const m = (res.headers.get("set-cookie") ?? "").match(/neyo_session=([^;]+)/);
  if (!m) throw new Error("could not get session cookie");
  return m[1];
}

async function main() {
  const token = await getSessionCookie();

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  await ctx.addCookies([
    { name: "neyo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  const page = await ctx.newPage();
  console.log("Loading student directory for Saved Views screenshot...");
  await page.goto(`${BASE}/students`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000); // Allow content to load fully

  // Dismiss cookie banner or accept if any
  await page.evaluate(() => {
    const btn = document.querySelector("button");
    if (btn && btn.textContent?.includes("Accept")) {
      btn.click();
    }
  });
  await page.waitForTimeout(500);

  // Set a filter (e.g. select 'Boys' or 'Form 2 East') to show the "Save current view..." button
  console.log("Selecting 'Boys' filter...");
  await page.selectOption("select:nth-of-type(4)", "M"); // 4th select is gender
  await page.waitForTimeout(1500);

  const desktopPath = path.join(OUT, "saved-views-g8.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log("Saved student list screenshot with G.8 Saved Views bar to:", desktopPath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
