/**
 * Screenshots for this chat's features (series continues from 28):
 * 29 students list (Import/Alumni/New year buttons + stream filter)
 * 30 import wizard step 1 · 31 import preview (mapping + issues)
 * 32 alumni directory · 33 promotion plan · 34 reshuffle preview
 * 35 attendance overview · 36 attendance register (one-tap)
 * 37 transfer banner on profile · 38 ⌘K student search
 */
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/user/screenshots";
const PASTE_TSV = "Name\tAdm No\tClass\tSex\tD.O.B\tParent Name\tParent Phone\nBrian Odhiambo Ouma\t\tForm 2 East\tM\t14/03/2010\tGrace Ouma\t0721111222\nCynthia Wairimu Njeri\t\tGrade 4 Blue\tF\t2015-06-02\tPeter Njeri\t0733444555\nBadRow X\t\tForm 9 Z\tX\tnot-a-date\tBad\t12345";

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Karibu2026!" }),
    });
  }, { email });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
  await login(page, "principal@karibuhigh.ac.ke");

  // 29 — students list
  await page.goto(`${BASE}/students`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/29-students-toolbar.png` });

  // 30 — import wizard step 1
  await page.goto(`${BASE}/students/import`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/30-import-step1.png` });

  // 31 — import preview (paste -> preview)
  await page.fill("textarea", PASTE_TSV);
  await page.click("text=Preview pasted rows");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/31-import-preview.png` });

  // 32 — alumni (graduate one student first so it's populated)
  await page.evaluate(async () => {
    const res = await fetch("/api/students?q=Kiprono");
    const j = await res.json();
    const id = j.data.students[0]?.id;
    if (id) await fetch(`/api/students/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "GRADUATED" }) });
  });
  await page.goto(`${BASE}/students/alumni`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/32-alumni.png` });
  // revert graduation
  await page.evaluate(async () => {
    const res = await fetch("/api/students/alumni");
    const j = await res.json();
    const id = j.data.alumni[0]?.id;
    if (id) await fetch(`/api/students/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) });
  });

  // 33 — promotion plan
  await page.goto(`${BASE}/students/promotion`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/33-promotion-plan.png` });

  // 34 — reshuffle preview (Form 2 has only 1 stream in seed; make a temp West class via API? skip if impossible)
  await page.click("text=Reshuffle streams");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/34-reshuffle.png` });

  // 35/36 — attendance as class teacher
  await login(page, "f.chebet@karibuhigh.ac.ke");
  await page.goto(`${BASE}/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/35-attendance-overview.png` });
  await page.click("text=Form 2 East");
  await page.waitForTimeout(2000);
  // tap first student to Absent for a colourful register
  const pills = page.locator("button:has-text('Present')");
  if (await pills.count() > 0) await pills.first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/36-attendance-register.png` });

  // 37 — transfer banner (transfer Kiprono temporarily) as principal
  await login(page, "principal@karibuhigh.ac.ke");
  const sid = await page.evaluate(async () => {
    const res = await fetch("/api/students?q=Kiprono");
    const j = await res.json();
    const id = j.data.students[0]?.id;
    if (id) await fetch(`/api/students/${id}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationSchool: "Moi Forces Academy", destinationCounty: "Nakuru", transferDate: "2026-06-20", reason: "relocation" }) });
    return id;
  });
  await page.goto(`${BASE}/students/${sid}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/37-transfer-banner.png` });
  // undo + clean history
  await page.evaluate(async (id) => { await fetch(`/api/students/${id}/transfer`, { method: "DELETE" }); }, sid);

  // 38 — ⌘K student search
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  await page.keyboard.type("achieng");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/38-cmdk-student.png` });

  await browser.close();
  console.log("✓ 10 screenshots captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
