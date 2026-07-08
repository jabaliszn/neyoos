import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

function parseRgbaAlpha(rgba: string): number {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return NaN;
  const parts = m[1].split(",").map((s) => s.trim());
  return parts.length === 4 ? Number(parts[3]) : 1;
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  // Confirm SUPER_ADMIN-gating: a non-super-admin (this PRINCIPAL) trying to
  // change the COMPANY default must be rejected server-side, not just hidden in UI.
  const forbiddenAttempt = await page.evaluate(async () => {
    const res = await fetch("/api/platform/appearance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liquidColorLevel: "3" }),
    });
    return { status: res.status, json: await res.json() };
  });
  console.log("PRINCIPAL attempting to change COMPANY liquidColorLevel ->", forbiddenAttempt.status, JSON.stringify(forbiddenAttempt.json));
  if (forbiddenAttempt.status !== 403) throw new Error(`Expected 403 for non-super-admin company appearance write, got ${forbiddenAttempt.status}`);

  async function measureDashboardCard(label: string) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-lg-contrast"));
    const computed = await page.evaluate(() => {
      const el = document.querySelector(".rounded-2xl.bg-white, .rounded-3xl.bg-white") as HTMLElement | null;
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
    });
    console.log(`[${label}] data-lg-contrast:`, attr, "| computed:", JSON.stringify(computed));
    return { attr, computed };
  }

  // ---- Baseline: no personal override, company default ("1" out of the box) ----
  await page.evaluate(async () => {
    await fetch("/api/me/lg-contrast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lgContrast: "company" }),
    });
  });
  const baseline = await measureDashboardCard("BASELINE (company default)");
  await page.screenshot({ path: path.join(OUT, "o3-contrast-baseline.png"), fullPage: false });

  // ---- Personal override: MAXIMUM (3) ----
  const setRes = await page.evaluate(async () => {
    const res = await fetch("/api/me/lg-contrast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lgContrast: "3" }),
    });
    return res.json();
  });
  if (!setRes?.ok) throw new Error(`Set personal lgContrast=3 failed: ${JSON.stringify(setRes)}`);
  const maxed = await measureDashboardCard("PERSONAL OVERRIDE = 3 (maximum)");
  await page.screenshot({ path: path.join(OUT, "o3-contrast-maximum.png"), fullPage: false });

  // ---- Reset back to company default ----
  await page.evaluate(async () => {
    await fetch("/api/me/lg-contrast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lgContrast: "company" }),
    });
  });
  const reverted = await measureDashboardCard("REVERTED to company default");

  await browser.close();

  if (baseline.attr !== "1") throw new Error(`Expected baseline data-lg-contrast="1", got ${baseline.attr}`);
  if (maxed.attr !== "3") throw new Error(`Expected override data-lg-contrast="3", got ${maxed.attr}`);
  if (reverted.attr !== "1") throw new Error(`Expected reverted data-lg-contrast="1", got ${reverted.attr}`);

  const baseAlpha = parseRgbaAlpha(baseline.computed?.backgroundColor || "");
  const maxAlpha = parseRgbaAlpha(maxed.computed?.backgroundColor || "");
  console.log(`Background alpha — baseline: ${baseAlpha}, maximum: ${maxAlpha}`);
  if (!(maxAlpha > baseAlpha)) {
    throw new Error(`Expected MAXIMUM contrast to have a strictly higher background alpha than baseline (${maxAlpha} vs ${baseAlpha}).`);
  }

  console.log("✅ O.3 colour intensity: SUPER_ADMIN-gated company write confirmed (403 for non-admin), personal override changes the real attribute AND the real computed background opacity, revert works.");
}
main().catch((e) => { console.error(e); process.exit(1); });
