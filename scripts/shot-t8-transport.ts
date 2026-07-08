import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  // --- Staff side: Transport page — Routes tab w/ real shifts ---
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  const loginRes = await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  console.log("principal login status:", loginRes.status());
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/transport", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshots/t8-01-transport-routes-with-shifts.png", fullPage: false });

  // Open Shifts board for Route A.
  const shiftsButtons = page.getByRole("button", { name: "Shifts" });
  await shiftsButtons.first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/t8-02-shifts-board.png", fullPage: false });

  // ShiftsBoard is a client-side view switch, not a URL navigation —
  // reload the actual /transport page to get back to the tab bar.
  await page.goto("http://localhost:3000/transport", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Requests tab.
  await page.getByRole("button", { name: /Requests/ }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/t8-03-requests-queue.png", fullPage: false });

  // Transport settings dialog.
  await page.getByRole("button", { name: "Transport settings" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/t8-04-settings-dialog.png", fullPage: false });
  await page.keyboard.press("Escape").catch(() => {});

  // --- Parent side: portal transport card + request dialog ---
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  const parentLoginRes = await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "parent@karibuhigh.ac.ke", password: "Karibu2026!" } });
  console.log("parent login status:", parentLoginRes.status());
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/portal", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  // Open the first child (Achieng).
  await page.locator("button:has-text('Achieng')").first().click();
  await page.waitForTimeout(1500);
  // Scroll to the Transport card.
  const transportHeading = page.getByText("Transport", { exact: true }).first();
  await transportHeading.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/t8-05-parent-portal-transport-card.png", fullPage: false });

  await page.getByRole("button", { name: /Request a route\/shift change/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/t8-06-parent-request-dialog.png", fullPage: false });

  await browser.close();
  console.log("✓ T.8 screenshots captured");
}
main().finally(async () => db.$disconnect());
