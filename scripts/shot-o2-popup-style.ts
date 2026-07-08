import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

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

  async function openModalAndMeasure(label: string, popupStyle: "glass" | "solid") {
    const setRes = await page.evaluate(async (style) => {
      const res = await fetch("/api/me/popup-style", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ popupStyle: style }),
      });
      return res.json();
    }, popupStyle);
    if (!setRes?.ok) throw new Error(`Set ${popupStyle} failed: ${JSON.stringify(setRes)}`);

    // Reload so the SERVER-RENDERED <html data-popup-style="..."> takes effect —
    // the real code path used by every actual page load, not just the client
    // instant-apply the Settings toggle also does.
    await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.getByText("Sync to phone", { exact: true }).click();
    // Same generous wait in BOTH states so the async feed-link fetch has
    // equally finished loading — a fair visual comparison, not a timing artifact.
    await page.waitForTimeout(2500);

    const htmlAttr = await page.evaluate(() => document.documentElement.getAttribute("data-popup-style"));

    // Objective, numeric proof (not just eyeballing pixels): read the REAL
    // computed CSS backdrop-filter + background-color on the actual modal
    // panel DOM node.
    const computed = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll("div.fixed.inset-0 > div, div.fixed .rounded-2xl, div.fixed .rounded-3xl"));
      // Find the one that actually looks like our modal card (has "Sync with your phone" as an ancestor text).
      const panel = panels.find((el) => el.textContent?.includes("Sync with your phone") && (el.className.includes("rounded-2xl") || el.className.includes("rounded-3xl")));
      if (!panel) return null;
      const style = window.getComputedStyle(panel);
      return {
        backdropFilter: style.backdropFilter || (style as any).webkitBackdropFilter || "",
        backgroundColor: style.backgroundColor,
        className: panel.className,
      };
    });

    console.log(`[${label}] data-popup-style attr:`, htmlAttr, "| computed:", JSON.stringify(computed));
    await page.screenshot({ path: path.join(OUT, `o2-popup-style-${popupStyle}.png`), fullPage: false });
    return { htmlAttr, computed };
  }

  const glassResult = await openModalAndMeasure("GLASS", "glass");
  const solidResult = await openModalAndMeasure("SOLID", "solid");

  // Reset to glass so we don't leave test state behind.
  await page.evaluate(async () => {
    await fetch("/api/me/popup-style", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ popupStyle: "glass" }),
    });
  });

  await browser.close();

  if (glassResult.htmlAttr !== null) throw new Error("Expected no data-popup-style attribute in default glass state.");
  if (solidResult.htmlAttr !== "solid") throw new Error("Expected data-popup-style=solid in solid state.");
  if (!glassResult.computed?.backdropFilter || glassResult.computed.backdropFilter === "none") {
    throw new Error(`Expected a real backdrop-filter blur in GLASS state, got: ${glassResult.computed?.backdropFilter}`);
  }
  if (solidResult.computed?.backdropFilter && solidResult.computed.backdropFilter !== "none") {
    throw new Error(`Expected NO backdrop-filter in SOLID state, got: ${solidResult.computed?.backdropFilter}`);
  }
  console.log("✅ O.2 popup style: GLASS has a real blur, SOLID has none — objectively verified via computed CSS, not just screenshots.");
}
main().catch((e) => { console.error(e); process.exit(1); });
