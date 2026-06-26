/**
 * G.33 2.0 + B.23 Bundi — screenshots at 1920×1080 (founder standing rule).
 * 104 glass-light dashboard · 105 glass-dark dashboard · 106 ⌘K liquid search
 * 107 liquidity level 3 (deep) · 108 Bundi layer (paused) · 109 glass mobile.
 * Pattern: login via fetch inside page.evaluate; domcontentloaded + fixed
 * waits (NEVER networkidle — SSE hangs); Escape before shots.
 */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "/home/user/screenshots";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  // Login as principal.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });

  // Dismiss cookie banner once.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const cookieBtn = page.locator("button", { hasText: /accept|sawa|ok/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) await cookieBtn.click();
  await page.keyboard.press("Escape");

  // Default = glass light, level 2.
  await page.evaluate(() => {
    localStorage.setItem("neyo-theme", "glass");
    localStorage.setItem("neyo-liquid", "2");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/104-liquid2-light-dashboard.png` });
  console.log("104 ✓ glass light dashboard");

  // Glass DARK.
  await page.evaluate(() => localStorage.setItem("neyo-theme", "glass-dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/105-liquid2-dark-dashboard.png` });
  console.log("105 ✓ glass dark dashboard");

  // ⌘K search on glass — every element liquid.
  await page.evaluate(() => localStorage.setItem("neyo-theme", "glass"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  await page.keyboard.type("Achieng", { delay: 60 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/106-liquid2-search.png` });
  console.log("106 ✓ liquid ⌘K search");
  await page.keyboard.press("Escape");

  // Liquidity level 3 (deep) — company setting preview.
  await page.evaluate(() => localStorage.setItem("neyo-liquid", "3"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/107-liquid2-level3-deep.png` });
  console.log("107 ✓ liquidity level 3 (deep)");
  await page.evaluate(() => localStorage.setItem("neyo-liquid", "2"));

  // Bundi layer (paused state) on glass.
  await page.goto(`${BASE}/bundi`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/108-bundi-layer-paused.png` });
  console.log("108 ✓ Bundi layer (paused)");

  // Mobile glass (360px — Kenyan baseline).
  const mctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const m = await mctx.newPage();
  await m.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await m.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    localStorage.setItem("neyo-theme", "glass");
  });
  await m.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(2500);
  const mc = m.locator("button", { hasText: /accept|sawa|ok/i }).first();
  if (await mc.isVisible().catch(() => false)) await mc.click();
  await m.screenshot({ path: `${OUT}/109-liquid2-mobile.png` });
  console.log("109 ✓ glass mobile 360px");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
