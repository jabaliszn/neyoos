import { db } from "@/lib/db";
import { feeCollectionLeaderboard } from "@/lib/services/finance.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.99 fee collection leaderboard test");
 const bursar=asUser(await db.user.findFirstOrThrow({where:{email:"bursar@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:bursar.tenantId,archived:false}});
 const rows=await feeCollectionLeaderboard(bursar);
 assert(rows.some(r=>r.classId===cls.id), "leaderboard includes class/stream rows");
 const row=rows.find(r=>r.classId===cls.id)!;
 assert(typeof row.collectionRate==="number" && row.className && row.classTeacherName, "leaderboard row includes rate, class and teacher labels");
 assert(rows.every((r,i)=>i===0 || rows[i-1].collectionRate>=r.collectionRate), "leaderboard is sorted by collection rate descending");
 const api=readFileSync("src/app/api/finance/leaderboard/route.ts","utf8");
 assert(api.includes("finance.view") && api.includes("feeCollectionLeaderboard"), "leaderboard API is finance-view gated");
 const ui=readFileSync("src/components/finance/finance-client.tsx","utf8");
 assert(ui.includes("Fee collection leaderboard by class/stream") && ui.includes("/api/finance/leaderboard"), "Finance overview renders the class fee leaderboard");
 console.log("\n✅ I.99 fee collection leaderboard test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
