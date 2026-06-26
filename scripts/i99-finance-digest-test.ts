import { db } from "@/lib/db";
import { sendFinanceDigest } from "@/lib/services/finance.service";
import { readFileSync } from "node:fs";
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.99 automated fee digest test");
 const bursar=await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}});
 const principal=await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}});
 const res=await sendFinanceDigest(bursar.tenantId,"daily");
 assert(res.recipients>=2 && res.message.includes("collected") && res.message.includes("outstanding"), "digest summarizes collected/outstanding/open invoice data for bursar/principal");
 const notif=await db.notification.findFirst({where:{recipientId:principal.id,title:"Daily fees digest"}, orderBy:{createdAt:"desc"}});
 assert(Boolean(notif?.href==="/finance"), "principal receives in-app finance digest deep-linked to Finance");
 const registry=readFileSync("src/lib/jobs/registry.ts","utf8");
 assert(registry.includes("finance-digest-daily") && registry.includes("finance-digest-weekly"), "daily and weekly finance digest jobs are scheduled");
 const api=readFileSync("src/app/api/finance/digest/route.ts","utf8");
 assert(api.includes("finance.view") && api.includes("comms.send") && api.includes("sendFinanceDigest"), "digest API is finance/comms gated");
 const ui=readFileSync("src/components/finance/finance-client.tsx","utf8");
 assert(ui.includes("Automated fee digest to bursar & principal") && ui.includes("/api/finance/digest"), "Finance UI exposes manual daily/weekly digest actions");
 console.log("\n✅ I.99 automated fee digest test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
