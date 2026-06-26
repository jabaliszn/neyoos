import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { currentTerm } from "@/lib/services/academics.service";
import { approvedExpensesSinceKes } from "@/lib/services/expense.service";

/**
 * B.24 — Owner Dashboard service. The school-wide money + performance view
 * for SCHOOL_OWNER / PRINCIPAL (permission owner.dashboard).
 * Everything computed from REAL rows the other modules already write:
 * B.1 students · B.7 invoices/payments · B.8 payroll · B.5 exams.
 * All tenant-scoped via withTenant + tenantDb (fail-closed).
 */

function nairobiNow(): Date {
  return new Date(Date.now() + 3 * 3600_000);
}
function nairobiToday(): string {
  return nairobiNow().toISOString().slice(0, 10);
}

/** Effective balance honouring discounts (same rule as finance.service). */
function balanceOf(inv: { totalKes: number; discountKes: number; paidKes: number }) {
  return Math.max(0, inv.totalKes - inv.discountKes - inv.paidKes);
}

export async function ownerDashboard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const today = nairobiToday();
    const now = nairobiNow();
    const term = await currentTerm(user.tenantId);
    const year = term?.year ?? now.getUTCFullYear();

    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { collectionTargetPct: true },
    });
    const targetPct = tenant?.collectionTargetPct ?? 85;

    // ---- 1) Students live --------------------------------------------------
    const [active, boys, girls, boarders] = await Promise.all([
      tdb.student.count({ where: { status: "ACTIVE" } }),
      tdb.student.count({ where: { status: "ACTIVE", gender: "M" } }),
      tdb.student.count({ where: { status: "ACTIVE", gender: "F" } }),
      tdb.hostelAllocation.count({ where: { releasedAt: null } }),
    ]);

    // ---- 2) Revenue (today / this term) ------------------------------------
    // Source of truth = money actually applied to invoices (paidKes) for the
    // term figure, + raw PAID Payment rows for "today" (cash desk + M-Pesa).
    const todayStartUtc = new Date(`${today}T00:00:00.000Z`);
    // Nairobi midnight in UTC = today 00:00 EAT - 3h
    const dayStart = new Date(todayStartUtc.getTime() - 3 * 3600_000);
    const paidToday = await tdb.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: dayStart } },
    });

    const termInvoices = term
      ? await tdb.invoice.findMany({ where: { year: term.year, term: term.term } })
      : await tdb.invoice.findMany({ where: { year } });
    const billedTerm = termInvoices.reduce((s, i) => s + i.totalKes - i.discountKes, 0);
    const collectedTerm = termInvoices.reduce((s, i) => s + Math.min(i.paidKes, i.totalKes - i.discountKes), 0);

    // ---- 3) Collection % vs target -----------------------------------------
    const collectionPct = billedTerm > 0 ? Math.round((collectedTerm / billedTerm) * 100) : 0;

    // ---- 4) Outstanding fees breakdown --------------------------------------
    const open = await tdb.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] } } });
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    let outstanding = 0;
    for (const inv of open) {
      const bal = balanceOf(inv);
      outstanding += bal;
      const daysLate = Math.floor(
        (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${inv.dueDate}T00:00:00Z`).getTime()) / 86_400_000
      );
      if (daysLate <= 0) buckets.current += bal;
      else if (daysLate <= 30) buckets.d30 += bal;
      else if (daysLate <= 60) buckets.d60 += bal;
      else buckets.d90 += bal;
    }
    // Top debtors (worst first) — names the owner can actually act on.
    const debtorTotals = new Map<string, number>();
    for (const inv of open) {
      const bal = balanceOf(inv);
      if (bal > 0) debtorTotals.set(inv.studentId, (debtorTotals.get(inv.studentId) ?? 0) + bal);
    }
    const topIds = [...debtorTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const debtorStudents = topIds.length
      ? await tdb.student.findMany({
          where: { id: { in: topIds.map(([id]) => id) } },
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
        })
      : [];
    const topDebtors = topIds.map(([id, bal]) => {
      const s = debtorStudents.find((x) => x.id === id);
      return {
        studentId: id,
        name: s ? `${s.firstName} ${s.lastName}` : "—",
        admissionNo: s?.admissionNo ?? "—",
        balanceKes: bal,
      };
    });

    // ---- 5) Staff costs (latest payroll run) -------------------------------
    const latestRun = await tdb.payrollRun.findFirst({
      orderBy: { period: "desc" },
      include: { payslips: true },
    });
    const staffCosts = latestRun
      ? {
          period: latestRun.period,
          status: latestRun.status,
          staff: latestRun.payslips.length,
          grossKes: latestRun.payslips.reduce((s, p) => s + p.grossKes, 0),
          netKes: latestRun.payslips.reduce((s, p) => s + p.netKes, 0),
          statutoryKes: latestRun.payslips.reduce(
            (s, p) => s + p.payeKes + p.shifKes + p.nssfKes + p.housingLevyKes,
            0
          ),
        }
      : null;

    // ---- 6) Profitability (term view) --------------------------------------
    // Honest school-level view: term fees collected − payroll gross for the
    // months elapsed this term (3 months/term assumed) − REAL approved
    // expenses recorded over the same window (B.25 Expenses).
    const monthlyPayroll = staffCosts ? staffCosts.grossKes : 0;
    const termMonths = 3;
    const termPayroll = monthlyPayroll * termMonths;
    // Approved expenses over the last `termMonths` months (Nairobi month grid).
    const expensesSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (termMonths - 1), 1));
    const expensesSinceKey = `${expensesSince.getUTCFullYear()}-${String(expensesSince.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const termExpenses = await approvedExpensesSinceKes(user.tenantId, expensesSinceKey);
    const profitability = {
      collectedTermKes: collectedTerm,
      estTermPayrollKes: termPayroll,
      termExpensesKes: termExpenses,
      estSurplusKes: collectedTerm - termPayroll - termExpenses,
      note: staffCosts
        ? `Fees collected this term minus payroll (${staffCosts.period} × ${termMonths} months) and KES ${termExpenses.toLocaleString()} of approved expenses (B.25, last ${termMonths} months).`
        : `Run payroll (B.8) to see staff costs against collections. Approved expenses so far: KES ${termExpenses.toLocaleString()}.`,
    };

    // ---- 7) Enrollment trend (last 6 months, by admittedOn) ----------------
    const months: { key: string; label: string; joined: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-KE", { month: "short", timeZone: "UTC" }),
        joined: 0,
      });
    }
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const recent = await tdb.student.findMany({
      where: { admittedOn: { gte: since } },
      select: { admittedOn: true },
    });
    for (const s of recent) {
      const key = s.admittedOn.toISOString().slice(0, 7);
      const m = months.find((x) => x.key === key);
      if (m) m.joined++;
    }

    // ---- 8) Academic performance trend (published exams this year) ---------
    const exams = await tdb.exam.findMany({
      where: { published: true, year },
      orderBy: [{ term: "asc" }, { createdAt: "asc" }],
      include: { results: { select: { marks: true } } },
      take: 8,
    });
    const examTrend = exams
      .filter((e) => e.results.length > 0)
      .map((e) => ({
        name: e.name,
        term: e.term,
        meanPct: Math.round(
          (e.results.reduce((s, r) => s + (r.marks ?? 0), 0) / e.results.length / e.maxMarks) * 100
        ),
        entries: e.results.length,
      }));

    // ---- 9) Ranking vs other NEYO schools (ANONYMIZED — no names leak) ------
    // Percentile of this school's collection rate among schools with bills.
    // Raw db on purpose (cross-tenant aggregate) but ONLY returns percentile +
    // cohort size — never another school's name or numbers.
    const allTenants = await db.tenant.findMany({ select: { id: true } });
    let better = 0;
    let cohort = 0;
    for (const t of allTenants) {
      const agg = await db.invoice.aggregate({
        _sum: { totalKes: true, paidKes: true, discountKes: true },
        where: { tenantId: t.id },
      });
      const billed = (agg._sum.totalKes ?? 0) - (agg._sum.discountKes ?? 0);
      if (billed <= 0) continue;
      cohort++;
      const pct = ((agg._sum.paidKes ?? 0) / billed) * 100;
      if (t.id === user.tenantId) continue;
      if (collectionPct >= pct) better++;
    }
    const ranking =
      cohort > 1
        ? {
            percentile: Math.round((better / (cohort - 1)) * 100),
            cohort,
            note: `Your collection rate beats ${Math.round((better / (cohort - 1)) * 100)}% of ${cohort} schools on NEYO. Other schools stay anonymous.`,
          }
        : { percentile: null, cohort, note: "Ranking appears when more schools join NEYO." };

    return {
      asOf: today,
      term: term ? { year: term.year, term: term.term } : null,
      students: { active, boys, girls, boarders },
      revenue: {
        todayKes: paidToday._sum.amount ?? 0,
        termCollectedKes: collectedTerm,
        termBilledKes: billedTerm,
      },
      collection: { pct: collectionPct, targetPct, onTrack: collectionPct >= targetPct },
      arrears: { outstandingKes: outstanding, buckets, topDebtors, openInvoices: open.length },
      staffCosts,
      profitability,
      enrollmentTrend: months,
      examTrend,
      ranking,
    };
  });
}

/** Owner sets the term collection target (B.24 "vs target"). */
export async function setCollectionTarget(user: SessionUser, pct: number) {
  const clamped = Math.max(10, Math.min(100, Math.round(pct)));
  await db.tenant.update({ where: { id: user.tenantId }, data: { collectionTargetPct: clamped } });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "owner.target_updated",
      entityType: "tenant",
      entityId: user.tenantId,
      metadata: JSON.stringify({ collectionTargetPct: clamped }),
    },
  });
  return clamped;
}
