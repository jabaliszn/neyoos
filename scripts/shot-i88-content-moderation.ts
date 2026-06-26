import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createConversation } from "@/lib/services/messaging.service";
import type { Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
async function main(){
 const principalDb=await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}});
 const teacher=await db.user.findFirstOrThrow({where:{email:"p.njoroge@karibuhigh.ac.ke"}});
 const principal=asUser(principalDb);
 const convo=await createConversation(principal.tenantId, principal, {type:"DIRECT", participantIds:[teacher.id]});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try{
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
  await page.goto(`http://localhost:3000/messages?open=${convo.id}`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1800);
  await page.getByPlaceholder("Type a message…").fill("You are pumbavu");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  await page.screenshot({path:"screenshots/i88-content-moderation-message.png",fullPage:false});
  console.log("✓ screenshots/i88-content-moderation-message.png");
 } finally {
  await browser.close();
  await db.message.deleteMany({where:{conversationId:convo.id}});
  await db.conversationParticipant.deleteMany({where:{conversationId:convo.id}});
  await db.conversation.deleteMany({where:{id:convo.id}});
 }
}
main().finally(async()=>db.$disconnect());
