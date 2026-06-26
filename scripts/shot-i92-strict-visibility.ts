import { chromium } from "playwright";
import { db } from "@/lib/db";
import { generateNeyoLoginId } from "@/lib/services/identity.service";
import { hash as argonHash } from "@node-rs/argon2";
async function main(){
 const principal=await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}});
 const passwordHash=await argonHash("Karibu2026!");
 const email=`kitchen-shot-${Date.now()}@karibuhigh.ac.ke`;
 const user=await db.user.create({data:{tenantId:principal.tenantId,neyoLoginId:await generateNeyoLoginId(),fullName:"Kitchen Visibility Demo",email,role:"SUPPORT_STAFF",isActive:true,passwordHash}});
 await db.staffProfile.create({data:{tenantId:principal.tenantId,userId:user.id,contractType:"PERMANENT",visibilityAreas:JSON.stringify(["KITCHEN"])} as any});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try{
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email,password:"Karibu2026!"}});
  await page.goto("http://localhost:3000/dashboard",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1800);
  await page.screenshot({path:"screenshots/i92-kitchen-strict-visibility.png",fullPage:false});
  console.log("✓ screenshots/i92-kitchen-strict-visibility.png");
 } finally { await browser.close(); await db.staffProfile.deleteMany({where:{userId:user.id}}); await db.user.deleteMany({where:{id:user.id}}); }
}
main().finally(async()=>db.$disconnect());
