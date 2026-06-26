import { chromium } from "playwright";
import { db } from "../src/lib/db";
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
  const student = await db.student.findFirstOrThrow({ where: { firstName: "Achieng" } });

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
  console.log(`Loading student profile for Achieng (${student.id})...`);
  await page.goto(`${BASE}/students/${student.id}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000); // Allow content to load fully

  // Dismiss cookie banner or accept if any
  await page.evaluate(() => {
    const btn = document.querySelector("button");
    if (btn && btn.textContent?.includes("Accept")) {
      btn.click();
    }
  });
  await page.waitForTimeout(500);

  const desktopPath = path.join(OUT, "student-profile-g10.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log("Saved student profile screenshot with G.10 buttons to:", desktopPath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
