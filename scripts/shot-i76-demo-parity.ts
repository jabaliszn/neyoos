import { chromium } from "playwright";
import { db } from "@/lib/db";

async function deleteDemoTenant(slug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return;
  const users = await db.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
  await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.user.deleteMany({ where: { tenantId: tenant.id } });
  await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
}

async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 const start=await page.request.post("http://localhost:3000/api/demo/start");
 const json=await start.json();
 if(!json.ok) throw new Error(json.error?.message || "Demo start failed");
 await page.goto("http://localhost:3000/academics",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2000);
 await page.locator("button").filter({ hasText: /^Timetable$/ }).click({ force:true });
 await page.waitForFunction(() => document.body.innerText.includes("Print all classes"), null, { timeout: 15000 }).catch(()=>{});
 await page.waitForFunction(() => document.body.innerText.includes("08:00 AM") || document.body.innerText.includes("ENG") || document.body.innerText.includes("Unassigned"), null, { timeout: 20000 }).catch(()=>{});
 await page.waitForTimeout(1500);
 await page.screenshot({path:"screenshots/i76-demo-timetable-parity.png", fullPage:false});
 await browser.close();
 await deleteDemoTenant(json.data.tenantSlug);
 console.log("✓ screenshots/i76-demo-timetable-parity.png");
}
main().finally(async()=>db.$disconnect());
