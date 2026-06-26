/**
 * G.15 Term Trends Pulse — live test (SELF-HEALS: removes the TermPulse rows +
 * pulse notifications it creates, and restores any SMS quota it consumes).
 */
import { db } from "../src/lib/db";
import {
  buildPulseSummary,
  computePulse,
  computeAndStorePulse,
  notifyTenantPulse,
  latestPulse,
} from "../src/lib/services/term-pulse.service";
import { withTenant } from "../src/lib/core/tenant-context";
import { dueCronJobs } from "../src/lib/jobs/jobs.service";
import { can } from "../src/lib/core/permissions";
import type { Role } from "../src/lib/core/roles";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function main() {
  const karibu = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: karibu.id, role: "PRINCIPAL" } });
  const principalUser: SessionUser = {
    id: principal.id, tenantId: karibu.id, fullName: principal.fullName, role: "PRINCIPAL",
  } as SessionUser;

  // 1) Rule-based summary — pure function, no DB.
  const up = buildPulseSummary({
    attendancePct: 92, attendancePrevPct: 85, attendanceMarked: 100,
    joinedThisWeek: 2, collectedWeekKes: 50000, weeklyTargetKes: 40000, openDebtors: 3,
  });
  assert("summary reports attendance UP", /up 7 points to 92%/.test(up));
  assert("summary reports fees ON target", /on target/.test(up));
  assert("summary counts new learners", /2 new learners joined/.test(up));
  assert("summary counts debtors", /3 families still owe/.test(up));
  assert("summary never says 'AI'", !/\bAI\b/.test(up));

  const down = buildPulseSummary({
    attendancePct: 70, attendancePrevPct: 80, attendanceMarked: 50,
    joinedThisWeek: 0, collectedWeekKes: 10000, weeklyTargetKes: 40000, openDebtors: 1,
  });
  assert("summary reports attendance DOWN", /down 10 points to 70%/.test(down));
  assert("summary reports fees BEHIND target by gap", /behind target by KES 30,000/.test(down));

  const none = buildPulseSummary({
    attendancePct: 0, attendancePrevPct: 0, attendanceMarked: 0,
    joinedThisWeek: 0, collectedWeekKes: 0, weeklyTargetKes: 0, openDebtors: 0,
  });
  assert("summary handles a quiet week", /No attendance was marked last week/.test(none));

  // 2) computePulse reads real rows (must run inside withTenant scope).
  const data = await withTenant(karibu.id, () => computePulse(karibu.id));
  assert("weekKey looks like YYYY-Www", /^\d{4}-W\d{2}$/.test(data.weekKey));
  assert("weekStart is a Monday (YYYY-MM-DD)", /^\d{4}-\d{2}-\d{2}$/.test(data.weekStart) &&
    new Date(`${data.weekStart}T00:00:00Z`).getUTCDay() === 1);
  assert("active students matches the live count", data.activeStudents === (await db.student.count({ where: { tenantId: karibu.id, status: "ACTIVE", deletedAt: null } })));
  assert("attendance pct within 0..100", data.attendancePct >= 0 && data.attendancePct <= 100);

  // 3) computeAndStorePulse is idempotent (one row per week).
  const before = await db.termPulse.count({ where: { tenantId: karibu.id, weekKey: data.weekKey } });
  await computeAndStorePulse(karibu.id);
  await computeAndStorePulse(karibu.id); // second call must NOT create a duplicate
  const after = await db.termPulse.count({ where: { tenantId: karibu.id, weekKey: data.weekKey } });
  assert("idempotent: exactly one pulse row for the week", after === 1 && after >= before);

  // 4) latestPulse returns the stored row.
  const latest = await latestPulse(principalUser);
  assert("latestPulse returns this week", !!latest && latest.weekKey === data.weekKey);

  // 5) notifyTenantPulse pushes to every owner.dashboard holder.
  const leaders = await db.user.findMany({ where: { tenantId: karibu.id, isActive: true } });
  const expectedLeaders = leaders.filter((u) => can(u.role as Role, "owner.dashboard")).length;
  // remember SMS usage to restore it after (notify may consume quota)
  const periodRows = await db.usageCounter.findMany({ where: { tenantId: karibu.id, metric: "smsPerTerm" } });
  const notifBefore = await db.notification.count({ where: { tenantId: karibu.id, category: "report", title: "Weekly Term Pulse" } });

  const res = await notifyTenantPulse(karibu.id);
  assert("notified all leadership holders", res.notified === expectedLeaders && expectedLeaders > 0);
  const notifAfter = await db.notification.count({ where: { tenantId: karibu.id, category: "report", title: "Weekly Term Pulse" } });
  assert("in-app notifications created for leaders", notifAfter - notifBefore === expectedLeaders);
  const pulseRow = await db.termPulse.findFirstOrThrow({ where: { tenantId: karibu.id, weekKey: data.weekKey } });
  assert("sentCount stamped on the pulse row", pulseRow.sentCount === expectedLeaders);

  // 6) Cron is Monday-only at 07:00 EAT.
  const monday0700utc = (() => {
    // find a Monday, set 04:00 UTC (=07:00 EAT)
    const d = new Date(Date.UTC(2026, 5, 15, 4, 0, 0)); // 2026-06-15 is a Monday
    return d;
  })();
  const tuesday0700utc = new Date(Date.UTC(2026, 5, 16, 4, 0, 0));
  assert("term-pulse is due Monday 07:00 EAT", dueCronJobs(monday0700utc).includes("term-pulse"));
  assert("term-pulse is NOT due Tuesday 07:00 EAT", !dueCronJobs(tuesday0700utc).includes("term-pulse"));

  // ---- SELF-HEAL ----------------------------------------------------------
  // remove the pulse notifications + rows this test created, restore SMS usage
  await db.notification.deleteMany({ where: { tenantId: karibu.id, title: "Weekly Term Pulse" } });
  // re-store the seed pulse cleanly (no notifications), so /owner still shows data
  for (const u of periodRows) {
    await db.usageCounter.update({ where: { id: u.id }, data: { used: u.used } });
  }
  // leave one clean seed pulse row in place (the seed creates it); ensure it exists
  await computeAndStorePulse(karibu.id);

  console.log(`\nG.15 Term Pulse: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
