/** G.14 Day-One Demo Mode — live test (SELF-HEALS: deletes any demo tenants it makes). */
import { db } from "../src/lib/db";
import { createDemoSchool, purgeExpiredDemos, demoStatus, DEMO_TTL_HOURS } from "../src/lib/services/demo.service";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}

async function deleteDemoTenant(id: string) {
  const users = await db.user.findMany({ where: { tenantId: id }, select: { id: true } });
  await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.user.deleteMany({ where: { tenantId: id } });
  await db.tenant.delete({ where: { id } });
}

async function main() {
  // 1) create a demo school
  const demo = await createDemoSchool();
  assert("slug looks like demo-XXXXXX", /^demo-[0-9a-f]{6}$/.test(demo.tenantSlug));

  const t = await db.tenant.findUniqueOrThrow({ where: { id: demo.tenantId } });
  assert("tenant flagged isDemo", t.isDemo === true);
  assert("demoExpiresAt ~24h out", !!t.demoExpiresAt && Math.abs((t.demoExpiresAt.getTime() - Date.now()) - DEMO_TTL_HOURS * 3600_000) < 60_000);

  // 2) real Kenyan data seeded
  const students = await db.student.count({ where: { tenantId: demo.tenantId } });
  const invoices = await db.invoice.count({ where: { tenantId: demo.tenantId } });
  const owner = await db.user.findFirst({ where: { tenantId: demo.tenantId, role: "SCHOOL_OWNER" } });
  assert("5 students seeded", students === 5);
  assert("5 invoices seeded", invoices === 5);
  assert("owner login created", !!owner && owner.email === demo.ownerEmail);
  const achieng = await db.student.findFirst({ where: { tenantId: demo.tenantId, firstName: "Achieng" } });
  assert("real KE name present (Achieng)", !!achieng);

  // 3) a valid session for auto-login exists
  const session = await db.session.findFirst({ where: { token: demo.sessionToken } });
  assert("auto-login session created", !!session && session.userId === owner!.id);

  // 4) demoStatus reports correctly
  const status = await demoStatus(demo.tenantId);
  assert("demoStatus isDemo true + hoursLeft ~24", status.isDemo === true && (status.hoursLeft ?? 0) >= 23 && (status.hoursLeft ?? 0) <= 24);

  // 5) a NON-demo tenant reports not-demo
  const karibu = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const karibuStatus = await demoStatus(karibu.id);
  assert("real school is not a demo", karibuStatus.isDemo === false);

  // 6) purge does NOT remove a still-valid demo
  const before = await purgeExpiredDemos();
  const stillThere = await db.tenant.findUnique({ where: { id: demo.tenantId } });
  assert("valid demo NOT purged", !!stillThere);

  // 7) expire it, then purge removes it (and its users/sessions)
  await db.tenant.update({ where: { id: demo.tenantId }, data: { demoExpiresAt: new Date(Date.now() - 3600_000) } });
  const purge = await purgeExpiredDemos();
  assert("expired demo purged (>=1)", purge.purged >= 1);
  const gone = await db.tenant.findUnique({ where: { id: demo.tenantId } });
  assert("demo tenant deleted", gone === null);
  const orphanUsers = await db.user.count({ where: { tenantId: demo.tenantId } });
  const orphanStudents = await db.student.count({ where: { tenantId: demo.tenantId } });
  assert("no orphan users", orphanUsers === 0);
  assert("no orphan students (cascade)", orphanStudents === 0);

  // 8) the real school survived the purge
  const karibuAlive = await db.tenant.findUnique({ where: { id: karibu.id } });
  assert("real school untouched by purge", !!karibuAlive);

  // self-heal: ensure no stray demo tenants linger from this run
  const strays = await db.tenant.findMany({ where: { isDemo: true } });
  for (const s of strays) await deleteDemoTenant(s.id);

  console.log(`\nG.14 Demo Mode: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
