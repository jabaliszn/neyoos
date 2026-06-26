import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main(){
 const principal=await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}});
 const today=new Date(Date.now()+3*3600_000).toISOString().slice(0,10);
 const event=await db.calendarEvent.create({data:{tenantId:principal.tenantId,title:"Inter-House Sports Finals",description:"Wear house colours and cheer respectfully.",date:today,endDate:today,type:"sports",createdById:principal.id}});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try{
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>{localStorage.setItem("neyo-cookie-ack",new Date().toISOString()); localStorage.removeItem("neyo-seasonal-theme-hidden");});
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
  await page.goto("http://localhost:3000/dashboard",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.body.innerText.includes("Inter-House Sports Finals"), null, {timeout:15000}).catch(()=>{});
  await page.waitForTimeout(800);
  await page.screenshot({path:"screenshots/i79-seasonal-theme-banner.png",fullPage:false});
  console.log("✓ screenshots/i79-seasonal-theme-banner.png");
 } finally {
  await browser.close();
  await db.calendarEvent.delete({where:{id:event.id}}).catch(()=>{});
 }
}
main().finally(async()=>db.$disconnect());
