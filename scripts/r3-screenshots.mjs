import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function safe(label, fn) {
  try {
    await fn();
    console.log(`OK: ${label}`);
  } catch (e) {
    console.log(`SKIP (${label}): ${e.message}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sign in with email & password" }).click();
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", "principal@karibuhigh.ac.ke");
  await page.fill("#password", "Karibu2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(4000);

  await page.evaluate(async () => {
    await fetch("/api/finance/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
  });

  await safe("settings-security-on", async () => {
    await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "screenshots/r3-settings-finance-security-on.png", fullPage: true });
  });

  await safe("reception-page", async () => {
    await page.goto(`${BASE}/reception`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const paymentBtn = page.locator('button:has-text("Record payment"), button:has-text("Payment")').first();
    if (await paymentBtn.count() > 0) {
      await paymentBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "screenshots/r3-reception-payment-dialog-gated.png", fullPage: true });
    } else {
      await page.screenshot({ path: "screenshots/r3-reception-page.png", fullPage: true });
    }
  });

  await page.evaluate(async () => {
    await fetch("/api/finance/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
  });

  await safe("settings-security-off", async () => {
    await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "screenshots/r3-settings-finance-security-off.png", fullPage: true });
  });

  await safe("finance-invoices", async () => {
    await page.goto(`${BASE}/finance`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const invoicesTab = page.locator('button:has-text("Invoices")').first();
    if (await invoicesTab.count() > 0) {
      await invoicesTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "screenshots/r3-finance-invoices-discount-button.png", fullPage: true });
  });

  await browser.close();
  console.log("Screenshots done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
