/**
 * B.24 Owner Dashboard — service-level live test (SELF-CONTAINED).
 * Run: npx tsx scripts/owner-test.ts
 */
import { db } from "../src/lib/db";
import { ownerDashboard, setCollectionTarget } from "../src/lib/services/owner-dashboard.service";
import { can } from "../src/lib/core/permissions";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}
function report(title: string) {
  console.log(`\n${title}: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  if (failed > 0) process.exitCode = 1;
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirst({ where: { email } });
  if (!u) throw new Error(`seed user missing: ${email}`);
  return {
    id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role as SessionUser["role"],
    email: u.email, phone: u.phone, language: (u as { language?: string }).language ?? "en",
  } as SessionUser;
}

async function main() {
  const principal = await su("principal@karibuhigh.ac.ke");

  // 1) Permission gates.
  assert("principal can owner.dashboard", can(principal.role, "owner.dashboard"));
  assert("SCHOOL_OWNER can owner.dashboard", can("SCHOOL_OWNER", "owner.dashboard"));
  assert("TEACHER cannot owner.dashboard", !can("TEACHER", "owner.dashboard"));
  assert("BURSAR cannot owner.dashboard", !can("BURSAR", "owner.dashboard"));
  assert("PARENT cannot owner.dashboard", !can("PARENT", "owner.dashboard"));

  // 2) Dashboard payload sanity against raw DB truth.
  const d = await ownerDashboard(principal);
  const activeCount = await db.student.count({ where: { tenantId: principal.tenantId, status: "ACTIVE", deletedAt: null } });
  assert(`students.active matches DB (${d.students.active})`, d.students.active === activeCount);
  assert("boys+girls = active", d.students.boys + d.students.girls === d.students.active);
  assert("term present (seeded T2 current)", d.term !== null && d.term.term === 2);
  assert("billed >= collected", d.revenue.termBilledKes >= d.revenue.termCollectedKes);
  assert("collection pct 0..100", d.collection.pct >= 0 && d.collection.pct <= 100);
  const bucketSum = d.arrears.buckets.current + d.arrears.buckets.d30 + d.arrears.buckets.d60 + d.arrears.buckets.d90;
  assert(`buckets sum = outstanding (${bucketSum})`, bucketSum === d.arrears.outstandingKes);
  assert("top debtors sorted desc", d.arrears.topDebtors.every((t, i, a) => i === 0 || a[i - 1].balanceKes >= t.balanceKes));
  assert("staff costs from seeded run 2026-05", d.staffCosts !== null && d.staffCosts.period === "2026-05" && d.staffCosts.staff === 4);
  if (d.staffCosts) {
    assert("gross >= net", d.staffCosts.grossKes >= d.staffCosts.netKes);
    assert("surplus = collected - est payroll - expenses", d.profitability.estSurplusKes === d.revenue.termCollectedKes - d.staffCosts.grossKes * 3 - d.profitability.termExpensesKes);
  }
  assert("6 enrollment months", d.enrollmentTrend.length === 6);
  const joinedTotal = d.enrollmentTrend.reduce((s, m) => s + m.joined, 0);
  assert(`enrollment trend counts seeded students (${joinedTotal} joined in window)`, joinedTotal >= 1);
  assert("exam trend has CAT 1 (published)", d.examTrend.some((e) => e.name.includes("CAT 1")));
  const cat1 = d.examTrend.find((e) => e.name.includes("CAT 1"))!;
  assert(`CAT 1 mean ~65% (got ${cat1.meanPct})`, cat1.meanPct >= 55 && cat1.meanPct <= 75);
  assert("ranking cohort >= 1 + anonymized (no names in payload)", d.ranking.cohort >= 1 && !JSON.stringify(d.ranking).includes("Uhuru"));

  // 3) Target setter: clamp + persist + audit.
  const orig = d.collection.targetPct;
  const set = await setCollectionTarget(principal, 90);
  assert("target set to 90", set === 90);
  const after = await ownerDashboard(principal);
  assert("dashboard reflects new target", after.collection.targetPct === 90);
  const clamped = await setCollectionTarget(principal, 999);
  assert("over-100 clamped to 100", clamped === 100);
  const audit = await db.auditLog.findFirst({
    where: { tenantId: principal.tenantId, action: "owner.target_updated" },
    orderBy: { createdAt: "desc" },
  });
  assert("audit row owner.target_updated", !!audit);
  await setCollectionTarget(principal, orig); // restore seed state
  const restored = await ownerDashboard(principal);
  assert(`target restored to ${orig}`, restored.collection.targetPct === orig);

  report("B.24 Owner Dashboard");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
