import { chromium } from "playwright";
import { db } from "@/lib/db";
import crypto from "crypto";
async function main(){
 const parent=await db.user.findFirstOrThrow({where:{email:"parent@karibuhigh.ac.ke"}});
 const session=await db.session.create({data:{token:`shot_i95_${crypto.randomBytes(8).toString("hex")}`,userId:parent.id,expiresAt:new Date(Date.now()+3600_000),userAgent:"shot-i95"}});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try{
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"f.chebet@karibuhigh.ac.ke",password:"Karibu2026!"}});
  await page.goto("http://localhost:3000/dashboard",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.body.innerText.includes("Parent") || document.body.innerText.includes("Otieno Brian"), null, {timeout:15000}).catch(()=>{});
  await page.waitForTimeout(800);
  await page.screenshot({path:"screenshots/i95-teacher-parent-intercom.png",fullPage:false});
  console.log("✓ screenshots/i95-teacher-parent-intercom.png");
 } finally { await browser.close(); await db.session.deleteMany({where:{id:session.id}}); }
}
main().finally(async()=>db.$disconnect());
