import { chromium } from "playwright";
import { db } from "@/lib/db";
import { nextTenantId } from "@/lib/services/identity.service";
import crypto from "crypto";
async function main(){
 const bursar=await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}});
 const guardian=await db.guardian.findFirstOrThrow({where:{tenantId:bursar.tenantId,userId:{not:null}}});
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:bursar.tenantId,archived:false}});
 const admissionNo=await nextTenantId(bursar.tenantId,"STUDENT");
 const student=await db.student.create({data:{tenantId:bursar.tenantId,admissionNo,legacyAdmissionNo:`PART-${Date.now()}`,firstName:"Partial",lastName:"Learner",gender:"F",classId:cls.id,status:"ACTIVE"}});
 await db.studentGuardian.create({data:{tenantId:bursar.tenantId,studentId:student.id,guardianId:guardian.id,relationship:"Parent",isPrimary:true}});
 const invoice=await db.invoice.create({data:{tenantId:bursar.tenantId,invoiceNo:await nextTenantId(bursar.tenantId,"INVOICE"),studentId:student.id,description:"Partial-friendly fees",totalKes:5000,paidKes:1200,status:"PARTIAL",dueDate:"2099-08-01",year:2099,term:2}});
 const code=`SHOT${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
 const payloadHash=crypto.createHash("sha256").update(`mzazi:${bursar.tenantId}:${student.id}`).digest("hex");
 await db.documentVerification.create({data:{tenantId:bursar.tenantId,code,docType:"mzazi_card",summary:"Partial screenshot",payloadHash}});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try{
  await page.goto(`http://localhost:3000/mzazi/${code}`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/07/i).fill(guardian.phone.replace("+254","0"));
  const amount=page.locator('input[type="number"]').first();
  await amount.fill("500").catch(()=>{});
  await page.waitForTimeout(500);
  await page.screenshot({path:"screenshots/i99-partial-payment-mzazi.png",fullPage:false});
  console.log("✓ screenshots/i99-partial-payment-mzazi.png");
 } finally { await browser.close(); await db.payment.deleteMany({where:{invoiceId:invoice.id}}); await db.documentVerification.deleteMany({where:{code}}); await db.invoice.deleteMany({where:{id:invoice.id}}); await db.studentGuardian.deleteMany({where:{studentId:student.id,guardianId:guardian.id}}); await db.student.deleteMany({where:{id:student.id}}); }
}
main().finally(async()=>db.$disconnect());
