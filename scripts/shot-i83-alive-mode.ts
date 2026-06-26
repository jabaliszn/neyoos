import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main(){
 const admin=await db.user.findFirstOrThrow({where:{email:"support@neyo.co.ke"}});
 for (const [key,value] of Object.entries({neyo_alive_mode_enabled:"true",neyo_alive_heartbeat_enabled:"true",neyo_alive_microcopy_enabled:"true",neyo_alive_motion_enabled:"true"})) {
  await db.platformSetting.upsert({where:{key},create:{key,value,updatedBy:admin.fullName},update:{value,updatedBy:admin.fullName}});
 }
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"support@neyo.co.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/founder",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 await page.getByRole("button",{name:"Business Operations"}).click().catch(()=>{});
 await page.waitForFunction(()=>document.body.innerText.includes("NEYO Alive Mode"), null, {timeout:15000}).catch(()=>{});
 await page.getByText("NEYO Alive Mode").scrollIntoViewIfNeeded().catch(()=>{});
 await page.waitForTimeout(600);
 await page.screenshot({path:"screenshots/i83-alive-mode-neyo-ops.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i83-alive-mode-neyo-ops.png");
}
main().finally(async()=>db.$disconnect());
