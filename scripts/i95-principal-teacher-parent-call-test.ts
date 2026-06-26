import crypto from "crypto";
import { db } from "@/lib/db";
import { intercomBoard, startIntercomCall, decideIntercomCall } from "@/lib/services/intercom.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.95 principal/teacher to parent intercom test");
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const teacher=asUser(await db.user.findFirstOrThrow({where:{email:"f.chebet@karibuhigh.ac.ke"}}));
 const parent=await db.user.findFirstOrThrow({where:{email:"parent@karibuhigh.ac.ke"}});
 const session=await db.session.create({data:{token:`i95_${crypto.randomBytes(8).toString("hex")}`, userId:parent.id, expiresAt:new Date(Date.now()+3600_000), userAgent:"i95-test"}});
 try {
   const principalBoard=await intercomBoard(principal);
   assert(principalBoard.directory.some((d)=>d.id===parent.id && d.role==="PARENT"), "principal directory includes linked parent contacts");
   const pCall=await startIntercomCall(principal, parent.id);
   assert(pCall.status==="RINGING" && pCall.targetId===parent.id, "principal can call a parent directly");
   await decideIntercomCall(principal, pCall.id, "end");
   const teacherBoard=await intercomBoard(teacher);
   assert(teacherBoard.directory.some((d)=>d.id===parent.id && d.role==="PARENT"), "class teacher directory includes own-class parent contacts");
   const tCall=await startIntercomCall(teacher, parent.id);
   assert(tCall.status==="RINGING" && tCall.targetId===parent.id, "teacher can call an own-class parent directly");
   const notif=await db.notification.findFirst({where:{recipientId:parent.id,title:"Incoming intercom call"}, orderBy:{createdAt:"desc"}});
   assert(Boolean(notif?.href==="/dashboard"), "parent receives incoming call dashboard notification");
   const service=readFileSync("src/lib/services/intercom.service.ts","utf8");
   assert(service.includes("Staff-to-parent directory") && service.includes("guardian: { userId: { not: null } }"), "intercom service explicitly builds staff-to-parent directory from linked guardians");
   const ui=readFileSync("src/components/dashboard/dashboard-intercom-client.tsx","utf8");
   assert(ui.includes("Call online contacts") || ui.includes("Call online staff"), "dashboard intercom has call directory UI");
   await decideIntercomCall(teacher, tCall.id, "end");
 } finally {
   await db.intercomCall.deleteMany({where:{OR:[{callerId:principal.id},{callerId:teacher.id},{targetId:parent.id}]}});
   await db.session.deleteMany({where:{id:session.id}});
 }
 console.log("\n✅ I.95 principal/teacher to parent intercom test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
