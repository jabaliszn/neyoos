import { chromium } from "playwright";
import { db } from "@/lib/db";
import { requestOnlineClass, setOnlineClassStatus, raiseOnlineClassHand, joinOnlineClassRoom } from "@/lib/services/online-class.service";
import type { Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
async function main(){
 const teacher=asUser(await db.user.findFirstOrThrow({where:{email:"p.njoroge@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:teacher.tenantId,archived:false}});
 const s=await requestOnlineClass(teacher,{classId:cls.id,title:"Meeting controls demo",scheduledAt:"2099-09-01T08:00"});
 await setOnlineClassStatus(teacher,s.id,"RUNNING");
 const principalDb=await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}});
 const studentUser=asUser(principalDb);
 await joinOnlineClassRoom(studentUser, s.roomId, {peerId:"peer_student_question_shot", role:"STUDENT"});
 await raiseOnlineClassHand(studentUser, s.roomId, {peerId:"peer_student_question_shot", question:"Teacher, may I answer the next question?"});
 const browser=await chromium.launch({headless:true, args:["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]});
 const context=await browser.newContext({viewport:{width:1440,height:900}, permissions:["camera","microphone"]});
 const page=await context.newPage();
 try{
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"p.njoroge@karibuhigh.ac.ke",password:"Karibu2026!"}});
  await page.goto(`http://localhost:3000${s.joinUrl}`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1200);
  await page.locator("button").filter({ hasText: "Join mobile" }).click({ force: true });
  await page.waitForFunction(() => document.body.innerText.includes("Raise hand") || document.body.innerText.includes("Mute all students"), null, { timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1200);
  await page.screenshot({path:"screenshots/i90-online-meeting-controls.png",fullPage:false});
  console.log("✓ screenshots/i90-online-meeting-controls.png");
 } finally { await browser.close(); await db.onlineClassSignal.deleteMany({where:{sessionId:s.id}}); await db.onlineClassParticipant.deleteMany({where:{sessionId:s.id}}); await db.onlineClassSession.deleteMany({where:{id:s.id}}); }
}
main().finally(async()=>db.$disconnect());
