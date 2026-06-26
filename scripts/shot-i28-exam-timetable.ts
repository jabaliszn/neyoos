import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createExamTimetableSlot } from "@/lib/services/exam-timetable.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
async function main(){
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:principal.tenantId, archived:false}});
 const sub=await db.subject.findFirstOrThrow({where:{tenantId:principal.tenantId, archived:false}});
 await db.examTimetableSlot.deleteMany({where:{tenantId:principal.tenantId, examDate:"2099-11-11"}});
 const slot=await createExamTimetableSlot(principal,{classId:cls.id,subjectId:sub.id,examName:"End Term Test",examDate:"2099-11-11",startTime:"08:00",endTime:"09:30",venue:"Main Hall"});
 const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"}); await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/exam-timetable",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(1200);
 await page.screenshot({path:"screenshots/i28-exam-timetable.png",fullPage:false});
 await browser.close(); await db.examTimetableSlot.delete({where:{id:slot.id}}).catch(()=>{}); console.log("✓ screenshots/i28-exam-timetable.png");
}
main().finally(async()=>db.$disconnect());
