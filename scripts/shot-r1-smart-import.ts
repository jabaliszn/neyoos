import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  // Seed a real pre-existing student for this screenshot to genuinely match against.
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const cls = await db.schoolClass.findFirst({ where: { tenantId: tenant.id, archived: false } });
  const existing = await db.student.create({
    data: {
      tenantId: tenant.id,
      admissionNo: `SHOT-R1-${Date.now()}`,
      legacyAdmissionNo: "R1-SHOT-001",
      firstName: "Naomi", lastName: "Chebet", gender: "F",
      classId: cls?.id ?? null,
      upiNumber: "UPI-OLD-777",
    },
  });

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60000);
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

  await page.goto(`${BASE}/students/import`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(500);

  // Screenshot 1: the new "smart update" toggle on step 1.
  await page.locator("text=Re-importing an updated register?").scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "r1-smart-import-step1-toggle.png") });
  console.log("✅ Screenshot captured: r1-smart-import-step1-toggle.png");

  // Paste rows that will match Naomi (same admission no) with a NEW UPI (a real conflict) plus a genuinely new guardian phone (fillable).
  const pasteBox = page.locator("textarea").first();
  await pasteBox.fill(
    "Full Name,Gender,Admission No,UPI,Guardian Phone\nNaomi Chebet,F,R1-SHOT-001,UPI-NEW-999,0799222333"
  );
  await page.getByText("Preview pasted rows", { exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(1500);

  // Screenshot 2: the matched-rows + conflict panel.
  await page.locator("text=match learners already in NEYO").scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "r1-smart-import-step2-matches.png") });
  console.log("✅ Screenshot captured: r1-smart-import-step2-matches.png");

  await browser.close();

  // Cleanup the seeded student.
  await db.student.delete({ where: { id: existing.id } }).catch(() => {});
  console.log("cleanup ✓ (seeded screenshot student removed)");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
