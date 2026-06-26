import crypto from "crypto";
import { db } from "@/lib/db";
import { applyPaymentToInvoice } from "@/lib/services/finance.service";
import { mzaziPay } from "@/lib/services/mzazi.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function expectThrows(fn:()=>Promise<unknown>, label:string){ try{ await fn(); } catch { console.log(`  ✓ ${label}`); return; } throw new Error(`Expected failure: ${label}`); }
async function main(){
 console.log("I.99 partial-payment friendly test");
 const bursar=asUser(await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}}));
 const guardian=await db.guardian.findFirstOrThrow({where:{tenantId:bursar.tenantId,userId:{not:null}}});
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:bursar.tenantId,archived:false}});
 const admissionNo=await nextTenantId(bursar.tenantId,"STUDENT");
 const student=await db.student.create({data:{tenantId:bursar.tenantId,admissionNo,legacyAdmissionNo:`PP-${Date.now()}`,firstName:"Partial",lastName:"Learner",gender:"F",classId:cls.id,status:"ACTIVE"}});
 await db.studentGuardian.create({data:{tenantId:bursar.tenantId,studentId:student.id,guardianId:guardian.id,relationship:"Parent",isPrimary:true}});
 const invoice=await db.invoice.create({data:{tenantId:bursar.tenantId,invoiceNo:await nextTenantId(bursar.tenantId,"INVOICE"),studentId:student.id,description:"I.99 partial payment invoice",totalKes:5000,paidKes:0,status:"UNPAID",dueDate:"2099-08-01",year:2099,term:2}});
 const code=`PP${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
 const payloadHash=crypto.createHash("sha256").update(`mzazi:${bursar.tenantId}:${student.id}`).digest("hex");
 await db.documentVerification.create({data:{tenantId:bursar.tenantId,code,docType:"mzazi_card",summary:"Partial payment test",payloadHash}});
 try{
  const updated=await applyPaymentToInvoice(bursar, invoice.id, 1200);
  assert(updated.status==="PARTIAL" && updated.paidKes===1200, "cash/desk ledger accepts partial payment and keeps invoice PARTIAL");
  const pay=await mzaziPay(code, guardian.phone, 500);
  assert(pay.amountKes===500 && pay.invoiceId===invoice.id, "Mzazi QR/STK accepts any amount below current balance");
  const pending=await db.payment.findUniqueOrThrow({where:{id:pay.paymentId}});
  assert(pending.amount===500 && pending.invoiceId===invoice.id, "partial Mzazi payment is linked to the open invoice for live callback update");
  await expectThrows(()=>mzaziPay(code, guardian.phone, 999999), "Mzazi QR rejects payment above live balance");
  const mzaziUi=readFileSync("src/components/mzazi/mzazi-lookup-client.tsx","utf8");
  assert(mzaziUi.includes("Amount to pay") && mzaziUi.includes("payAmount"), "Mzazi public page lets parent enter any amount to pay");
  const finance=readFileSync("src/lib/services/finance.service.ts","utf8");
  assert(finance.includes("statusFor") && finance.includes("PARTIAL"), "finance ledger has partial payment status support");
 } finally {
  await db.payment.deleteMany({where:{invoiceId:invoice.id}});
  await db.documentVerification.deleteMany({where:{code}});
  await db.invoice.deleteMany({where:{id:invoice.id}});
  await db.studentGuardian.deleteMany({where:{studentId:student.id,guardianId:guardian.id}});
  await db.student.deleteMany({where:{id:student.id}});
 }
 console.log("\n✅ I.99 partial-payment friendly test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
