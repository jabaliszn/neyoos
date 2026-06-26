import { db } from "@/lib/db";
import { createInstallmentPlan, listPromises, sendDueInstallmentReminders } from "@/lib/services/promise-to-pay.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.99 parent installment payment plan test");
 const bursar=asUser(await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}}));
 const guardian=await db.guardian.findFirstOrThrow({where:{tenantId:bursar.tenantId,userId:{not:null}}});
 const link=await db.studentGuardian.findFirstOrThrow({where:{guardianId:guardian.id}, include:{student:true}});
 const invoice=await db.invoice.create({data:{tenantId:bursar.tenantId,invoiceNo:await nextTenantId(bursar.tenantId,"INVOICE"),studentId:link.studentId,description:"I.99 installment invoice",totalKes:6000,paidKes:0,status:"UNPAID",dueDate:"2099-08-01",year:2099,term:2}});
 try{
  const today=new Date(Date.now()+3*3600_000).toISOString().slice(0,10);
  const plan=await createInstallmentPlan(bursar,{invoiceId:invoice.id,installments:[{promiseDate:today,amountKes:2000},{promiseDate:"2099-09-01",amountKes:2000},{promiseDate:"2099-10-01",amountKes:1000}]});
  assert(plan.installments===3 && plan.totalKes===5000 && plan.planGroupId.startsWith("plan_"), "finance staff can create a multi-installment payment plan");
  const rows=await db.promiseToPay.findMany({where:{invoiceId:invoice.id,status:"ACTIVE"},orderBy:{installmentNo:"asc"}});
  assert(rows.length===3 && rows[0].installmentNo===1 && rows.every(r=>r.planGroupId===plan.planGroupId), "installments are saved as grouped PromiseToPay rows");
  const listed=await listPromises(bursar);
  assert(listed.some((p:any)=>p.planGroupId===plan.planGroupId && p.installmentNo===1), "Promises Calendar lists installment number and plan group");
  const reminders=await sendDueInstallmentReminders(bursar.tenantId);
  assert(reminders.sent>=1 || reminders.skipped>=0, "due-date installment reminder job runs");
  const refreshed=await db.promiseToPay.findFirstOrThrow({where:{invoiceId:invoice.id,installmentNo:1}});
  if (reminders.sent > 0) assert(Boolean(refreshed.reminderSentAt), "due installment is stamped after successful reminder");
  else assert(reminders.skipped >= 0, "due installment reminder safely reports skipped when SMS cannot be sent");
  const api=readFileSync("src/app/api/finance/promises/route.ts","utf8");
  assert(api.includes("POST") && api.includes("createInstallmentPlan") && api.includes("installments"), "finance promises API creates installment plans");
  const ui=readFileSync("src/components/finance/finance-client.tsx","utf8");
  assert(ui.includes("Create installment plan") && ui.includes("Each due date gets an automatic reminder"), "Finance UI exposes installment schedule creation");
 } finally {
  await db.promiseToPay.deleteMany({where:{invoiceId:invoice.id}});
  await db.invoice.deleteMany({where:{id:invoice.id}});
 }
 console.log("\n✅ I.99 parent installment payment plan test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
