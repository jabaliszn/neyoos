import { chromium } from "playwright";
import { db } from "@/lib/db";
import { generateDutyRoster } from "@/lib/services/duty-roster.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
async function main(){
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const teachers=await db.user.findMany({where:{tenantId:principal.tenantId,role:{in:["TEACHER","CLASS_TEACHER","HOD","DEPUTY_PRINCIPAL"]},isActive:true},take:4});
 await generateDutyRoster(principal,{rotationPeriod:"WEEKLY",teacherIds:teachers.map(t=>t.id)});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/academics",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1800);
 await page.locator("button").filter({hasText:/Duty Roster/}).click({force:true});
 await page.waitForFunction(()=>document.body.innerText.includes("Teacher Duty Roster") && document.body.innerText.includes("Block 1"), null, {timeout:15000}).catch(()=>{});
 await page.waitForTimeout(800);
 await page.screenshot({path:"screenshots/i78-duty-roster-timetable.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i78-duty-roster-timetable.png");
}
main().finally(async()=>db.$disconnect());
