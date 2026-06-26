import { chromium } from "playwright";
import { db } from "@/lib/db";
import { clearSlot, setSlot } from "@/lib/services/academics.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }

async function main(){
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:principal.tenantId, archived:false}, orderBy:[{curriculum:"asc"},{level:"asc"},{stream:"asc"}]});
 const subjects=await db.subject.findMany({where:{tenantId:principal.tenantId, archived:false}, take:3});
 const teacher=await db.user.findFirst({where:{tenantId:principal.tenantId, role:{in:["TEACHER","CLASS_TEACHER","HOD","DEPUTY_PRINCIPAL"]}}});
 await db.timetableConfig.upsert({ where:{classId:cls.id}, create:{tenantId:principal.tenantId,classId:cls.id,shortBreakStart:2,longBreakStart:4,lunchStart:6,hasSaturday:true}, update:{shortBreakStart:2,longBreakStart:4,lunchStart:6,hasSaturday:true} });
 await clearSlot(principal, cls.id, 1, 1); await clearSlot(principal, cls.id, 2, 1); await clearSlot(principal, cls.id, 3, 1);
 await setSlot(principal,{classId:cls.id,subjectId:subjects[0].id,venue:"Science Lab",dayOfWeek:1,period:1});
 await setSlot(principal,{classId:cls.id,subjectId:subjects[1]?.id || subjects[0].id,teacherId:teacher?.id,venue:"Room 8 East",dayOfWeek:2,period:1}).catch(()=>{});
 await setSlot(principal,{classId:cls.id,subjectId:subjects[2]?.id || subjects[0].id,venue:"Main Hall",dayOfWeek:3,period:1});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/academics",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2200);
 await page.locator("button").filter({ hasText: /^Timetable$/ }).click({ force: true });
 await page.waitForFunction(() => document.body.innerText.includes("Print all classes"), null, { timeout: 15000 }).catch(() => {});
 await page.waitForTimeout(1500);
 await page.getByText("Vertical days", { exact: true }).click().catch(()=>{});
 await page.locator('select').nth(1).selectOption('13').catch(()=>{});
 await page.waitForTimeout(1200);
 await page.screenshot({path:"screenshots/i73-timetable-advanced-rendering.png", fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i73-timetable-advanced-rendering.png");
}
main().finally(async()=>db.$disconnect());
