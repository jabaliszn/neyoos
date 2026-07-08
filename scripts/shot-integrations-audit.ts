import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60000);

  // --- SUPER_ADMIN: NEYO Ops Integration Credential Vault ---
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "support@neyo.co.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Admin login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/founder`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(500);

  // Click into the "Business Operations" tab, which hosts the Integration Credential Vault.
  const settingsTab = page.getByText("Business Operations", { exact: true }).first();
  await settingsTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const vaultHeading = page.getByText("Integration Credential Vault", { exact: false }).first();
  await vaultHeading.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "integrations-audit-01-ops-vault.png") });
  console.log("✅ Screenshot captured: integrations-audit-01-ops-vault.png");

  // Scroll further to catch WEBRTC / YOUTUBE / CENTRAL_DARAJA groups.
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "integrations-audit-02-ops-vault-more.png") });
  console.log("✅ Screenshot captured: integrations-audit-02-ops-vault-more.png");

  await browser.close();

  // --- PRINCIPAL: school-side M-Pesa settings page ---
  const browser2 = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx2 = await browser2.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page2 = await ctx2.newPage();
  page2.setDefaultNavigationTimeout(60000);
  await page2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(700);
  const login2 = await page2.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login2?.ok) throw new Error(`Principal login failed: ${JSON.stringify(login2)}`);

  await page2.goto(`${BASE}/settings/payments`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(2500);
  await page2.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(OUT, "integrations-audit-03-school-mpesa-settings.png") });
  console.log("✅ Screenshot captured: integrations-audit-03-school-mpesa-settings.png");

  await browser2.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
