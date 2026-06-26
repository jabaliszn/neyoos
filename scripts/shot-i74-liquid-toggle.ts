import { chromium } from "playwright";
import { db } from "@/lib/db";
import { setAppearanceSettings } from "@/lib/services/platform-appearance.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
async function main(){
 const superAdmin=asUser(await db.user.findFirstOrThrow({where:{email:"support@neyo.co.ke"}}));
 await setAppearanceSettings(superAdmin,{liquidEnabled:true, liquidLevel:"2"});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"support@neyo.co.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/settings/school",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 await page.getByText("Company Liquid Glass Master Toggle").scrollIntoViewIfNeeded().catch(()=>{});
 await page.waitForTimeout(400);
 await page.screenshot({path:"screenshots/i74-liquid-glass-master-toggle.png", fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i74-liquid-glass-master-toggle.png");
}
main().finally(async()=>db.$disconnect());
