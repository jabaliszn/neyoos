import { db } from "@/lib/db";
import { sendAllOpenFeeReminders } from "@/lib/services/finance.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.99 one-tap fee reminders test");
 const bursar=asUser(await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}}));
 const parent=await db.user.findFirstOrThrow({where:{email:"parent@karibuhigh.ac.ke"}});
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:bursar.tenantId,archived:false}});
 const admissionNo=await nextTenantId(bursar.tenantId,"STUDENT");
 const student=await db.student.create({data:{tenantId:bursar.tenantId,admissionNo,legacyAdmissionNo:`REM-${Date.now()}`,firstName:"Reminder",lastName:"Learner",gender:"F",classId:cls.id,status:"ACTIVE"}});
 const guardian=await db.guardian.findFirstOrThrow({where:{tenantId:bursar.tenantId,userId:parent.id}});
 await db.studentGuardian.create({data:{tenantId:bursar.tenantId,studentId:student.id,guardianId:guardian.id,relationship:"Parent",isPrimary:true}});
 const invoice=await db.invoice.create({data:{tenantId:bursar.tenantId,invoiceNo:await nextTenantId(bursar.tenantId,"INVOICE"),studentId:student.id,description:"I.99 reminder fees",totalKes:4000,paidKes:1000,status:"PARTIAL",dueDate:"2099-09-01",year:2099,term:2}});
 try{
  const res=await sendAllOpenFeeReminders(bursar);
  assert(res.families>=1 && res.totalBalanceKes>=3000, "one-tap reminder groups families with open balances");
  const updated=await db.invoice.findUniqueOrThrow({where:{id:invoice.id}});
  assert(Boolean(updated.reminderSentAt), "reminded invoices are stamped to prevent accidental repeat blasts");
  const notif=await db.notification.findFirst({where:{recipientId:parent.id,title:"Fee balance reminder"},orderBy:{createdAt:"desc"}});
  assert(Boolean(notif?.href==="/portal" && notif.body.includes("M-Pesa")), "linked parent receives in-app reminder with M-Pesa/portal guidance");
  const service=readFileSync("src/lib/services/finance.service.ts","utf8");
  assert(service.includes("sendAllOpenFeeReminders") && service.includes("finance.one_tap_reminders_sent"), "finance service has audited one-tap reminder workflow");
  const api=readFileSync("src/app/api/finance/reminders/route.ts","utf8");
  assert(api.includes("finance.view") && api.includes("comms.send"), "one-tap reminder API requires finance and comms permissions");
  const ui=readFileSync("src/components/finance/finance-client.tsx","utf8");
  assert(ui.includes("One-tap fee reminders to all who owe") && ui.includes("/api/finance/reminders"), "finance UI exposes one-tap reminder action");
 } finally {
  await db.notification.deleteMany({where:{recipientId:parent.id,title:"Fee balance reminder"}});
  await db.invoice.deleteMany({where:{id:invoice.id}});
  await db.studentGuardian.deleteMany({where:{studentId:student.id,guardianId:guardian.id}});
  await db.student.deleteMany({where:{id:student.id}});
 }
 console.log("\n✅ I.99 one-tap fee reminders test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
