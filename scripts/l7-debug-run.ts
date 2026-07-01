import { PrismaClient } from "@prisma/client";
import { runGeneration } from "../src/lib/services/timetable-engine.service";
const db = new PrismaClient();
async function main() {
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error("tenant not found");
  const tid = t.id;
  const principal = await db.user.findFirst({ where: { tenantId: tid, role: "PRINCIPAL" } });
  if (!principal) throw new Error("principal not found");
  const user: any = { id: principal.id, tenantId: tid, neyoLoginId: principal.id, fullName: principal.fullName, phone: null, email: principal.email, role: principal.role, secondaryRole: null, language: 'en' };
  const job = await db.timetableGenerationJob.create({ data: { tenantId: tid, status: 'QUEUED', phase: 'Queued', startedById: user.id, startedByName: user.fullName } });
  console.log('job', job.id);
  const started = Date.now();
  const res = await runGeneration(tid, job.id, user);
  console.log('ms', Date.now()-started);
  console.log(res);
  await db.timetableGenerationJob.delete({ where: { id: job.id } }).catch(()=>{});
  await db.$disconnect();
}
main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
