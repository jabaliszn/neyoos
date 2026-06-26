import { chromium } from "playwright";
import { db } from "@/lib/db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.29 printable class list test");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", {
    data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
  });
  await page.goto("http://localhost:3000/students", { waitUntil: "domcontentloaded" });
  await page.waitForResponse((res) => res.url().includes("/api/students") && res.status() === 200, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(2500);

  const printButtonCount = await page.getByRole("button", { name: /Print Class List/i }).count();
  assert(printButtonCount > 0, "Students page has a Print Class List action");

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(500);
  const title = await page.locator(".print\\:block h1").first().textContent();
  assert(Boolean(title?.includes("Karibu") || title?.includes("School")), "print view title includes the school/class name");

  const rows = await page.locator(".print\\:block tbody tr").evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim()))
  );
  assert(rows.length > 0, "print view contains learner rows");
  const admNos = rows.map((r) => r[1]);
  const sorted = [...admNos].sort((a, b) => a.localeCompare(b));
  assert(JSON.stringify(admNos) === JSON.stringify(sorted), "print rows are sorted by admission number");
  assert(rows.every((r) => r.length >= 6), "print table has all required columns");

  await page.screenshot({ path: "screenshots/i29-print-class-list.png", fullPage: false });
  await browser.close();
  console.log("\n✅ I.29 printable class list test passed");
  console.log("✓ screenshots/i29-print-class-list.png");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());
