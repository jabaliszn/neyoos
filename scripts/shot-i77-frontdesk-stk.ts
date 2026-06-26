import { chromium } from "playwright";
import { db } from "@/lib/db";
import { nextTenantId } from "@/lib/services/identity.service";

async function main(){
 const receptionist=await db.user.findFirstOrThrow({where:{email:"frontoffice@karibuhigh.ac.ke"}});
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:receptionist.tenantId, archived:false}});
 const admissionNo=await nextTenantId(receptionist.tenantId,"STUDENT");
 const student=await db.student.create({data:{tenantId:receptionist.tenantId,admissionNo,legacyAdmissionNo:"FD-STK-77",firstName:"Ivy",lastName:"Wairimu",gender:"F",classId:cls.id,status:"ACTIVE"}});
 const invoiceNo=await nextTenantId(receptionist.tenantId,"INVOICE");
 const invoice=await db.invoice.create({data:{tenantId:receptionist.tenantId,invoiceNo,studentId:student.id,description:"Term 2 fees desk collection",totalKes:2500,paidKes:0,status:"UNPAID",dueDate:"2099-08-01",year:2099,term:2}});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 try {
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"frontoffice@karibuhigh.ac.ke",password:"Karibu2026!"}});
  await page.goto("http://localhost:3000/reception",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1800);
  await page.getByRole("button",{name:/M-Pesa fees/i}).click();
  await page.getByPlaceholder(/Name or admission/i).fill("FD-STK-77");
  await page.waitForTimeout(800);
  await page.getByText("Ivy Wairimu").first().click();
  await page.getByPlaceholder("07XX XXX XXX").fill("0712345678");
  await page.waitForTimeout(500);
  await page.screenshot({path:"screenshots/i77-frontdesk-stk-parent.png",fullPage:false});
  console.log("✓ screenshots/i77-frontdesk-stk-parent.png");
 } finally {
  await browser.close();
  await db.payment.deleteMany({where:{invoiceId:invoice.id}});
  await db.invoice.deleteMany({where:{id:invoice.id}});
  await db.student.deleteMany({where:{id:student.id}});
 }
}
main().finally(async()=>db.$disconnect());
