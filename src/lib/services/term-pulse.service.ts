/**
 * G.15 — Term Trends Pulse (founder-requested 2026-06-13).
 *
 * A weekly leadership digest. Every Monday 07:00 EAT (A.12 cron) we compute,
 * per school, the week that just ended (Mon→Sun) from rows the other modules
 * already write:
 *   - enrolment + new students this week (B.1)
 *   - attendance % vs the previous week (B.3)
 *   - fees collected this week vs a pro-rated weekly target (B.7 + B.24)
 * then push it in-app to every leader who holds `owner.dashboard`, with the
 * A.7 SMS/WhatsApp cascade attached (flips on with founder creds; quota-gated).
 *
 * The one-line `summary` is RULE-BASED and never says "AI". The richer
 * narrative is the Bundi swap point (B.23, platform-paused) — NO feature
 * depends on it; everything here works fully without Bundi.
 *
 * Idempotent: one TermPulse row per tenant per ISO-week (@@unique), so a
 * re-run on the same Monday updates-in-place and never double-notifies.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { currentTerm } from "@/lib/services/academics.service";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { notify } from "@/lib/services/notification.service";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";

const NAIROBI_OFFSET_MS = 3 * 3600_000;
/** Weeks in a Kenyan school term (≈13) — used to pro-rate the term target. */
const TERM_WEEKS = 13;

function nairobiNow(): Date {
  return new Date(Date.now() + NAIROBI_OFFSET_MS);
}

/** Add days to a YYYY-MM-DD string (UTC-safe). */
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing `ref` (Nairobi). */
function mondayOf(ref = nairobiNow()): string {
  const ymd = ref.toISOString().slice(0, 10);
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  return addDays(ymd, -back);
}

/** ISO week key like "2026-W24" for a Monday date. */
function isoWeekKey(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  // ISO: Thursday of this week decides the year + week number.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Effective balance honouring discounts (same rule as finance/owner). */
function appliedKes(inv: { totalKes: number; discountKes: number; paidKes: number }) {
  return Math.min(inv.paidKes, inv.totalKes - inv.discountKes);
}

export interface PulseData {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  activeStudents: number;
  joinedThisWeek: number;
  attendancePct: number;
  attendancePrevPct: number;
  attendanceMarked: number;
  collectedWeekKes: number;
  weeklyTargetKes: number;
  collectionTermPct: number;
  summary: string;
}

/** Attendance % (present+late ÷ marked) over an inclusive YYYY-MM-DD range. */
async function attendancePctForRange(from: string, to: string) {
  const tdb = tenantDb();
  const rows = await tdb.attendanceRecord.findMany({
    where: { date: { gte: from, lte: to } },
    select: { status: true },
  });
  const marked = rows.length;
  if (marked === 0) return { pct: 0, marked: 0 };
  const inSchool = rows.filter((r) => r.status === "P" || r.status === "L").length;
  return { pct: Math.round((inSchool / marked) * 100), marked };
}

/**
 * Compute (but DON'T persist) the pulse for the week that just ended relative
 * to `ref`. Pure read — safe to call for previews/tests. Must run inside a
 * withTenant scope (we wrap it in computeAndStorePulse / the API).
 */
export async function computePulse(tenantId: string, ref = nairobiNow()): Promise<PulseData> {
  const tdb = tenantDb();

  // The week that JUST ended = the Monday→Sunday before the current Monday.
  const thisMonday = mondayOf(ref);
  const weekStart = addDays(thisMonday, -7); // last week's Monday
  const weekEnd = addDays(thisMonday, -1); // last week's Sunday
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);
  const weekKey = isoWeekKey(weekStart);

  // --- Enrolment -----------------------------------------------------------
  const activeStudents = await tdb.student.count({ where: { status: "ACTIVE" } });
  // New this week by admittedOn (DateTime). Compare against UTC instants for
  // the Nairobi week boundaries.
  const weekStartUtc = new Date(`${weekStart}T00:00:00Z`).getTime() - NAIROBI_OFFSET_MS;
  const weekEndUtc = new Date(`${addDays(weekEnd, 1)}T00:00:00Z`).getTime() - NAIROBI_OFFSET_MS;
  const joinedThisWeek = await tdb.student.count({
    where: { admittedOn: { gte: new Date(weekStartUtc), lt: new Date(weekEndUtc) } },
  });

  // --- Attendance (this week vs previous) ----------------------------------
  const cur = await attendancePctForRange(weekStart, weekEnd);
  const prev = await attendancePctForRange(prevStart, prevEnd);

  // --- Fees collected this week vs pro-rated weekly target -----------------
  const payments = await tdb.payment.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: new Date(weekStartUtc), lt: new Date(weekEndUtc) },
    },
    select: { amount: true },
  });
  const collectedWeekKes = payments.reduce((s, p) => s + p.amount, 0);

  // Term context for the target: billed × targetPct ÷ weeks-in-term.
  const term = await currentTerm(tenantId);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { collectionTargetPct: true },
  });
  const targetPct = tenant?.collectionTargetPct ?? 85;
  const termInvoices = term
    ? await tdb.invoice.findMany({ where: { year: term.year, term: term.term } })
    : [];
  const billedTerm = termInvoices.reduce((s, i) => s + i.totalKes - i.discountKes, 0);
  const collectedTerm = termInvoices.reduce((s, i) => s + appliedKes(i), 0);
  const collectionTermPct = billedTerm > 0 ? Math.round((collectedTerm / billedTerm) * 100) : 0;
  const weeklyTargetKes = Math.round((billedTerm * (targetPct / 100)) / TERM_WEEKS);

  const summary = buildPulseSummary({
    attendancePct: cur.pct,
    attendancePrevPct: prev.pct,
    attendanceMarked: cur.marked,
    joinedThisWeek,
    collectedWeekKes,
    weeklyTargetKes,
    openDebtors: await tdb.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
  });

  return {
    weekKey,
    weekStart,
    weekEnd,
    activeStudents,
    joinedThisWeek,
    attendancePct: cur.pct,
    attendancePrevPct: prev.pct,
    attendanceMarked: cur.marked,
    collectedWeekKes,
    weeklyTargetKes,
    collectionTermPct,
    summary,
  };
}

/**
 * Rule-based one-line digest. Plain Kenyan-school English, specific numbers,
 * never marketing fluff and NEVER the word "AI". This is the line Bundi will
 * one day enrich — but the rule version ships and works forever.
 */
export function buildPulseSummary(d: {
  attendancePct: number;
  attendancePrevPct: number;
  attendanceMarked: number;
  joinedThisWeek: number;
  collectedWeekKes: number;
  weeklyTargetKes: number;
  openDebtors: number;
}): string {
  const parts: string[] = [];

  // Attendance
  if (d.attendanceMarked === 0) {
    parts.push("No attendance was marked last week");
  } else {
    const delta = d.attendancePct - d.attendancePrevPct;
    if (delta >= 2) parts.push(`Attendance up ${delta} points to ${d.attendancePct}%`);
    else if (delta <= -2) parts.push(`Attendance down ${Math.abs(delta)} points to ${d.attendancePct}%`);
    else parts.push(`Attendance steady at ${d.attendancePct}%`);
  }

  // Fees vs target
  const fmt = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
  if (d.weeklyTargetKes > 0) {
    if (d.collectedWeekKes >= d.weeklyTargetKes) {
      parts.push(`fees on target (${fmt(d.collectedWeekKes)} collected)`);
    } else {
      const gap = d.weeklyTargetKes - d.collectedWeekKes;
      parts.push(`fees behind target by ${fmt(gap)} (${fmt(d.collectedWeekKes)} collected)`);
    }
  } else {
    parts.push(`${fmt(d.collectedWeekKes)} collected`);
  }

  // Enrolment / debtors tail
  if (d.joinedThisWeek > 0) {
    parts.push(`${d.joinedThisWeek} new learner${d.joinedThisWeek === 1 ? "" : "s"} joined`);
  }
  if (d.openDebtors > 0) {
    parts.push(`${d.openDebtors} famil${d.openDebtors === 1 ? "y" : "ies"} still owe fees`);
  }

  // Capitalise + join.
  const line = parts.join("; ");
  return line.charAt(0).toUpperCase() + line.slice(1) + ".";
}

/** Compute + UPSERT the week's pulse row for one tenant (idempotent). */
export async function computeAndStorePulse(tenantId: string, ref = nairobiNow()) {
  return withTenant(tenantId, async () => {
    const data = await computePulse(tenantId, ref);
    const tdb = tenantDb();
    const existing = await tdb.termPulse.findFirst({
      where: { weekKey: data.weekKey },
    });
    if (existing) {
      await tdb.termPulse.update({
        where: { id: existing.id },
        data: {
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          activeStudents: data.activeStudents,
          joinedThisWeek: data.joinedThisWeek,
          attendancePct: data.attendancePct,
          attendancePrevPct: data.attendancePrevPct,
          attendanceMarked: data.attendanceMarked,
          collectedWeekKes: data.collectedWeekKes,
          weeklyTargetKes: data.weeklyTargetKes,
          collectionTermPct: data.collectionTermPct,
          summary: data.summary,
        },
      });
      return { id: existing.id, data, created: false };
    }
    const row = await tdb.termPulse.create({
      data: {
        tenantId,
        weekKey: data.weekKey,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        activeStudents: data.activeStudents,
        joinedThisWeek: data.joinedThisWeek,
        attendancePct: data.attendancePct,
        attendancePrevPct: data.attendancePrevPct,
        attendanceMarked: data.attendanceMarked,
        collectedWeekKes: data.collectedWeekKes,
        weeklyTargetKes: data.weeklyTargetKes,
        collectionTermPct: data.collectionTermPct,
        summary: data.summary,
      },
    });
    return { id: row.id, data, created: true };
  });
}

/** Leadership recipients = active users whose role holds `owner.dashboard`. */
async function leadershipRecipients() {
  const tdb = tenantDb();
  const users = await tdb.user.findMany({
    where: { isActive: true, role: { notIn: ["PARENT", "STUDENT"] } },
    select: { id: true, role: true },
  });
  return users.filter((u) => can(u.role as Role, "owner.dashboard"));
}

/**
 * Notify all leaders of one tenant about this week's pulse (in-app + SMS
 * cascade). Quota-checked once for the batch; SMS flips on with founder creds.
 * Returns how many leaders were notified.
 */
export async function notifyTenantPulse(tenantId: string, ref = nairobiNow()) {
  return withTenant(tenantId, async () => {
    const stored = await computeAndStorePulse(tenantId, ref);
    const recipients = await leadershipRecipients();
    if (recipients.length === 0) {
      await tenantDb().termPulse.update({ where: { id: stored.id }, data: { sentCount: 0 } });
      return { tenantId, notified: 0, weekKey: stored.data.weekKey };
    }

    // SMS quota: external channels only fire when configured, but we still
    // honour the term SMS budget so a school is never over-charged.
    const quota = await checkSmsQuota(tenantId, recipients.length);
    const channels = quota.allowed
      ? (["in_app", "sms"] as const)
      : (["in_app"] as const);

    const title = "Weekly Term Pulse";
    const body = stored.data.summary;
    for (const r of recipients) {
      await notify({
        tenantId,
        recipientId: r.id,
        title,
        body,
        category: "report",
        href: "/owner",
        channels: [...channels],
        cascade: true,
      });
    }
    if (quota.allowed) {
      await recordUsage(tenantId, "smsPerTerm", recipients.length);
    }

    await tenantDb().termPulse.update({
      where: { id: stored.id },
      data: { sentCount: recipients.length },
    });
    return { tenantId, notified: recipients.length, weekKey: stored.data.weekKey };
  });
}

/** Cron entrypoint: send the weekly pulse to every tenant. */
export async function sendWeeklyPulse(ref = nairobiNow()) {
  const tenants = await db.tenant.findMany({
    where: { isDemo: false },
    select: { id: true },
  });
  let notified = 0;
  let tenantsDone = 0;
  for (const t of tenants) {
    try {
      const r = await notifyTenantPulse(t.id, ref);
      notified += r.notified;
      tenantsDone++;
    } catch {
      // Never let one tenant's failure stop the rest.
    }
  }
  return { tenants: tenantsDone, notified };
}

/** The most recent stored pulse for a tenant (for the /owner card + API). */
export async function latestPulse(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const row = await tdb.termPulse.findFirst({ orderBy: { createdAt: "desc" } });
    return row;
  });
}

/** Run-now (manual) — recompute + notify this tenant immediately. */
export async function runPulseNow(user: SessionUser) {
  return notifyTenantPulse(user.tenantId);
}
