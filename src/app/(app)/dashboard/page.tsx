import {
  Wallet,
  Coins,
  TrendingUp,
  UserCheck,
  ArrowRight,
  Users,
  CalendarDays,
  Bell,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/utils";
import { effectivePermissionsForUser, getCurrentUser } from "@/lib/core/session";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { tenantDb } from "@/lib/core/tenant-db";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/services/academics.service";
import { withTenant } from "@/lib/core/tenant-context";
import { DashboardIntercomClient } from "@/components/dashboard/dashboard-intercom-client";
import { PwaDataSaverCard } from "@/components/dashboard/pwa-data-saver";
import { BundiAudioButton } from "@/components/dashboard/bundi-audio-button";
import { PrincipalDelegationCard } from "@/components/dashboard/principal-delegation-card";
import { createInApp } from "@/lib/services/notification.service";

// Read fresh DB counts on every request (not at build time).
export const dynamic = "force-dynamic";

function getHolidayGreeting(): { greeting: string; icon: string } | null {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-indexed
  const day = now.getUTCDate();
  
  // Madaraka Day (June 1st)
  if (month === 6 && day === 1) {
    return { greeting: "Happy Madaraka Day!", icon: "🇰🇪" };
  }
  // Mashujaa Day (October 20th)
  if (month === 10 && day === 20) {
    return { greeting: "Happy Mashujaa Day!", icon: "🛡️" };
  }
  // Jamhuri Day (December 12th)
  if (month === 12 && day === 12) {
    return { greeting: "Happy Jamhuri Day!", icon: "🇰🇪" };
  }
  // Christmas Festive (December 15th to December 26th)
  if (month === 12 && day >= 15 && day <= 26) {
    return { greeting: "Merry Christmas & Happy Holidays!", icon: "🎄" };
  }
  
  return null;
}

function nairobiNow(): Date {
  return new Date(Date.now() + 3 * 3600_000);
}
function nairobiToday(): string {
  return nairobiNow().toISOString().slice(0, 10);
}

function getTimeOfDayGreeting(): string {
  const hour = (new Date().getUTCHours() + 3) % 24;
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

type MoneyPoint = { label: string; expected: number; actual: number };

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-KE", { month: "short" });
}

function chartPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function MiniSparkline({ data, stroke = "#1f9d5f", label }: { data: number[]; stroke?: string; label: string }) {
  const values = data.length ? data : [0, 0, 0];
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((v, i) => ({
    x: values.length <= 1 ? 0 : (i / (values.length - 1)) * 96,
    y: 30 - ((v - min) / spread) * 24,
  }));
  const d = chartPath(points);
  return (
    <svg className="mt-3 h-9 w-full overflow-visible" viewBox="0 0 96 36" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${d} L 96 36 L 0 36 Z`} fill={stroke} opacity="0.08" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.9" fill={stroke} />)}
    </svg>
  );
}

function moneyShort(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1000)}K`;
  return `KES ${n.toLocaleString("en-KE")}`;
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const firstName = currentUser.fullName.split(" ")[0] ?? "there";
  const greeting = getTimeOfDayGreeting();
  const permissions = await effectivePermissionsForUser(currentUser);
  const has = (permission: string) => permissions.includes(permission as any);
  // I.5: school-wide money / My School metrics belong only to School Owner + Principal.
  // Bursar/accountant still use the Finance module, but dashboard money cards stay hidden.
  const canSeeFinanceCards = has("owner.dashboard");
  const canSeeAttendanceCard = has("attendance.view") || has("attendance.record");
  const canSeeStudentsCard = has("student.view");
  const canSeeStaffCard = has("staff.view") || has("staff.manage");
  const canSeeBillingCard = has("owner.dashboard");
  const isMasterAttendanceUser = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].includes(currentUser.role) ||
    (!!currentUser.secondaryRole && ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].includes(currentUser.secondaryRole));

  const stats = await withTenant(currentUser.tenantId, async () => {
    const tdb = tenantDb();
    const today = nairobiToday();
    const now = nairobiNow();
    const term = await currentTerm(currentUser.tenantId);
    const year = term?.year ?? now.getUTCFullYear();

    const tenant = await db.tenant.findUnique({
      where: { id: currentUser.tenantId },
      include: { subscription: true },
    });
    const targetPct = tenant?.collectionTargetPct ?? 85;
    const planEndsAt = tenant?.subscription?.currentPeriodEnd ?? null;
    const daysToPlanEnd = planEndsAt ? Math.ceil((planEndsAt.getTime() - now.getTime()) / (24 * 3600_000)) : null;
    if (tenant?.subscription && daysToPlanEnd !== null && daysToPlanEnd >= 0 && daysToPlanEnd <= 14) {
      const todayKey = `subscription-expiring:${tenant.id}:${today}`;
      const admins = await db.user.findMany({
        where: {
          tenantId: currentUser.tenantId,
          isActive: true,
          OR: [
            { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
            { secondaryRole: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
          ],
        },
        select: { id: true },
      });
      for (const admin of admins) {
        const existing = await db.notification.findFirst({ where: { tenantId: currentUser.tenantId, recipientId: admin.id, category: "billing", body: { contains: todayKey } } });
        if (!existing) {
          await createInApp({
            tenantId: currentUser.tenantId,
            recipientId: admin.id,
            title: "Subscription plan needs attention",
            body: `Your NEYO plan ends in ${daysToPlanEnd} day${daysToPlanEnd === 1 ? "" : "s"}. Open billing to review. ${todayKey}`,
            category: "billing",
            href: "/settings/billing",
          });
        }
      }
    }

    // ---- 1) Enrolled students & counts ----
    const activeStudentsCount = await tdb.student.count({ where: { status: "ACTIVE" } });
    const ownClassCount = await tdb.schoolClass.count({ where: { archived: false, classTeacherId: currentUser.id } });
    const totalStaffCount = await tdb.user.count({
      where: { isActive: true, role: { notIn: ["PARENT", "STUDENT", "SUPER_ADMIN"] } },
    });

    // ---- 2) Revenue today ----
    const todayStartUtc = new Date(`${today}T00:00:00.000Z`);
    const dayStart = new Date(todayStartUtc.getTime() - 3 * 3600_000);
    const paidToday = await tdb.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: dayStart } },
    });
    const revenueToday = paidToday._sum.amount ?? 0;

    // ---- 3) Attendance today ----
    const attendanceRecords = await tdb.attendanceRecord.findMany({
      where: { date: today },
      select: { status: true },
    });
    const markedCount = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === "P" || r.status === "L").length;
    let attendancePct: number | null = null;
    if (markedCount > 0) {
      attendancePct = Math.round((presentCount / markedCount) * 100);
    }

    // ---- 4) Fees outstanding & collection rate ----
    const termInvoices = term
      ? await tdb.invoice.findMany({ where: { year: term.year, term: term.term } })
      : await tdb.invoice.findMany({ where: { year } });
    
    const billedTerm = termInvoices.reduce((s, i) => s + i.totalKes - i.discountKes, 0);
    const collectedTerm = termInvoices.reduce((s, i) => s + Math.min(i.paidKes, i.totalKes - i.discountKes), 0);
    const outstandingTerm = termInvoices.reduce((s, i) => s + (i.totalKes - i.discountKes - i.paidKes), 0);
    
    const collectionPct = billedTerm > 0 ? Math.round((collectedTerm / billedTerm) * 100) : 0;

    // ---- 5) Calendar events + reminders ----
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
    const upcomingEventsCount = await tdb.calendarEvent.count({
      where: { date: { gte: today, lte: in30Days } },
    });
    const remindersCount = await tdb.notification.count({
      where: { recipientId: currentUser.id, readAt: null },
    });

    // ---- 6) Real payments-vs-expected graph ----
    const termStart = term?.startDate ? new Date(`${term.startDate}T00:00:00.000Z`) : new Date(now.getTime() - 90 * 24 * 3600_000);
    const termEnd = term?.endDate ? new Date(`${term.endDate}T00:00:00.000Z`) : now;
    const totalDays = Math.max(1, Math.ceil((termEnd.getTime() - termStart.getTime()) / (24 * 3600_000)));
    const graphPoints: MoneyPoint[] = [];
    const paidPayments = await tdb.payment.findMany({
      where: { status: "PAID", paidAt: { gte: termStart, lte: now } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    });
    for (let i = 0; i < 4; i++) {
      const ratio = i / 3;
      const pointDate = new Date(termStart.getTime() + totalDays * ratio * 24 * 3600_000);
      const expected = Math.round(billedTerm * ratio);
      const actual = paidPayments
        .filter((p) => p.paidAt && p.paidAt <= pointDate)
        .reduce((sum, p) => sum + p.amount, 0);
      graphPoints.push({ label: monthLabel(pointDate), expected, actual });
    }
    if (graphPoints.length) {
      graphPoints[graphPoints.length - 1].actual = collectedTerm;
      graphPoints[graphPoints.length - 1].expected = billedTerm;
    }
    const maxGraphKes = Math.max(1, ...graphPoints.flatMap((p) => [p.expected, p.actual]));
    const toSvgPoint = (value: number, index: number) => ({
      x: graphPoints.length <= 1 ? 0 : (index / (graphPoints.length - 1)) * 500,
      y: 170 - (value / maxGraphKes) * 145,
    });
    const expectedPath = chartPath(graphPoints.map((p, i) => toSvgPoint(p.expected, i)));
    const actualPath = chartPath(graphPoints.map((p, i) => toSvgPoint(p.actual, i)));
    const actualDots = graphPoints.map((p, i) => ({ ...toSvgPoint(p.actual, i), label: p.label, actual: p.actual, expected: p.expected }));
    const graphLabels = [1, 0.75, 0.5, 0.25].map((r) => moneyShort(Math.round(maxGraphKes * r)));

    const feeCollectionTrend = graphPoints.map((p) => p.actual);

    const attendanceTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600_000).toISOString().slice(0, 10);
      const rows = await tdb.attendanceRecord.findMany({ where: { date: d }, select: { status: true } });
      const present = rows.filter((r) => r.status === "P" || r.status === "L").length;
      attendanceTrend.push(rows.length ? Math.round((present / rows.length) * 100) : 0);
    }

    const enrollmentTrend: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      enrollmentTrend.push(await tdb.student.count({ where: { admittedOn: { lte: monthEnd }, deletedAt: null } }));
    }

    return {
      activeStudentsCount,
      ownClassCount,
      totalStaffCount,
      revenueToday,
      markedCount,
      presentCount,
      attendancePct,
      collectionPct,
      targetPct,
      billedTerm,
      outstandingTerm,
      upcomingEventsCount,
      remindersCount,
      graphPoints,
      maxGraphKes,
      expectedPath,
      actualPath,
      actualDots,
      graphLabels,
      feeCollectionTrend,
      attendanceTrend,
      enrollmentTrend,
      planName: tenant?.subscription?.planKey || "pro",
      planStatus: tenant?.subscription?.status || "ACTIVE",
      daysToPlanEnd,
    };
  });

  const holiday = getHolidayGreeting();

  return (
    <div className="space-y-6 text-left">
      {holiday && (
        <div className="rounded-3xl border border-green-200 bg-green-500/10 p-5 text-left flex items-center justify-between gap-4 animate-fade-in">
          <div>
            <h2 className="text-sm font-bold text-green-800 dark:text-green-300">{holiday.icon} {holiday.greeting}</h2>
            <p className="text-[11px] text-navy-500 dark:text-navy-400 mt-1">NEYO is celebrating this special moment with your school, staff, and families!</p>
          </div>
          <span className="text-2xl animate-bounce">🎁</span>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-navy-50">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
            Term 2 · Week 6 · {new Date().toLocaleDateString("en-KE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        {canSeeAttendanceCard && <Link href="/attendance">
          <Button>
            {has("attendance.record") && (!isMasterAttendanceUser || stats.ownClassCount > 0) ? "Mark today&apos;s attendance" : "View attendance"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>}
      </div>

      {/* 💳 Primary Financial Metric Cards (Directly Links to Modules!) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeFinanceCards && <Link href="/finance">
          <div className="dashboard-metric-card group rounded-3xl border border-navy-100 bg-white/75 p-5 shadow-card transition-all duration-300 ease-apple hover:-translate-y-0.5 hover:border-red-200 hover:shadow-card-hover cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/70">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Outstanding Fees</span>
              <div className="flex items-center gap-1.5">
                <BundiAudioButton text={`Bundi says: Outstanding term balance is ${stats.outstandingTerm.toLocaleString('en-KE')} shillings.`} />
                <Coins className="h-5 w-5 text-red-500 group-hover:scale-110 transition" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-navy-950 dark:text-white">{formatKES(stats.outstandingTerm)}</p>
            <p className="mt-1 text-[10px] text-navy-500">uncollected term dues</p>
          </div>
        </Link>}

        {canSeeFinanceCards && <Link href="/finance">
          <div className="dashboard-metric-card group rounded-3xl border border-navy-100 bg-white/75 p-5 shadow-card transition-all duration-300 ease-apple hover:-translate-y-0.5 hover:border-green-200 hover:shadow-card-hover cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/70">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Fees Collected Today</span>
              <div className="flex items-center gap-1.5">
                <BundiAudioButton text={`Bundi says: Fees collected today is ${stats.revenueToday.toLocaleString('en-KE')} shillings. M-Pesa automatic ledger sync is active.`} />
                <Wallet className="h-5 w-5 text-green-600 group-hover:scale-110 transition" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-navy-950 dark:text-white">{formatKES(stats.revenueToday)}</p>
            <p className="mt-1 text-[10px] text-green-600 font-semibold">M-Pesa sync active</p>
            <MiniSparkline data={stats.feeCollectionTrend} stroke="#1f9d5f" label="Fee collection trend" />
          </div>
        </Link>}

        {canSeeFinanceCards && <Link href="/finance">
          <div className="dashboard-metric-card group rounded-3xl border border-navy-100 bg-white/75 p-5 shadow-card transition-all duration-300 ease-apple hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card-hover cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/70">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Collection Rate</span>
              <TrendingUp className="h-5 w-5 text-blue-500 group-hover:scale-110 transition" />
            </div>
            <p className="mt-2 text-2xl font-black text-navy-950 dark:text-white">{stats.collectionPct}%</p>
            <p className="mt-1 text-[10px] text-navy-500">Target is {stats.targetPct}%</p>
          </div>
        </Link>}

        {canSeeAttendanceCard && <Link href="/attendance">
          <div className="dashboard-metric-card group rounded-3xl border border-navy-100 bg-white/75 p-5 shadow-card transition-all duration-300 ease-apple hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-card-hover cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/70">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Students Present</span>
              <UserCheck className="h-5 w-5 text-amber-500 group-hover:scale-110 transition" />
            </div>
            <p className="mt-2 text-2xl font-black text-navy-950 dark:text-white">
              {stats.markedCount > 0 ? `${stats.presentCount} present` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-navy-500">
              {stats.markedCount > 0 ? `${stats.markedCount} marked today` : `${stats.activeStudentsCount} enrolled`}
            </p>
            <MiniSparkline data={stats.attendanceTrend} stroke="#f59e0b" label="Attendance trend" />
          </div>
        </Link>}
      </div>

      {/* 🏫 New Count Metric Cards (Directly Links to Modules!) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeStudentsCard && <Link href="/students">
          <div className="rounded-3xl border border-navy-100 bg-white/70 p-5 shadow-sm hover:shadow-md transition cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Total Enrolled</span>
              <p className="text-2xl font-black text-navy-950 dark:text-white">{stats.activeStudentsCount}</p>
              <p className="text-[9px] text-navy-400">Active Learners</p>
              <MiniSparkline data={stats.enrollmentTrend} stroke="#2563eb" label="Enrollment trend" />
            </div>
            <div className="p-3 bg-green-500/10 text-green-600 rounded-2xl"><Users className="h-5 w-5" /></div>
          </div>
        </Link>}

        {canSeeStaffCard && <Link href="/staff">
          <div className="rounded-3xl border border-navy-100 bg-white/70 p-5 shadow-sm hover:shadow-md transition cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Total Staff</span>
              <p className="text-2xl font-black text-navy-950 dark:text-white">{stats.totalStaffCount}</p>
              <p className="text-[9px] text-navy-400">Active Teachers & HODs</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl"><Users className="h-5 w-5" /></div>
          </div>
        </Link>}

        <Link href="/calendar">
          <div className="rounded-3xl border border-navy-100 bg-white/70 p-5 shadow-sm hover:shadow-md transition cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Events & Reminders</span>
              <p className="text-2xl font-black text-navy-950 dark:text-white">{stats.upcomingEventsCount + stats.remindersCount}</p>
              <p className="text-[9px] text-navy-400">{stats.upcomingEventsCount} calendar · {stats.remindersCount} reminders</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">{stats.remindersCount > 0 ? <Bell className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}</div>
          </div>
        </Link>

        {canSeeBillingCard && <Link href="/settings/billing">
          <div className="rounded-3xl border border-navy-100 bg-white/70 p-5 shadow-sm hover:shadow-md transition cursor-pointer text-left dark:border-navy-800 dark:bg-navy-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Subscription Plan</span>
              <p className="text-2xl font-black text-green-700 dark:text-green-400 capitalize">{stats.planName.replace(/_/g, " ")}</p>
              <p className="text-[9px] text-navy-400">Status: <strong className="text-green-600">{stats.planStatus}</strong></p>
            </div>
            <div className="p-3 bg-green-500/10 text-green-600 rounded-2xl"><CreditCard className="h-5 w-5" /></div>
          </div>
        </Link>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Animated Custom Line Graph (Expected vs Paid Tuition Fees) */}
        {canSeeFinanceCards && <div className="lg:col-span-2">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Tuition Collections vs Expected Target (Term Trend)
              </CardTitle>
              <p className="text-xs text-navy-400">
                Real payment ledger against expected term billing. Green is actual paid; dashed navy is expected by this point in the term.
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-6">
              {/* Responsive SVG Line Graph (0kb external library overhead, instant page loads!) */}
              <div className="w-full h-[220px] relative">
                <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none" role="img" aria-label="Payments versus expected fees line graph">
                  {[20, 70, 120, 170].map((y, i) => (
                    <line key={y} x1="0" y1={y} x2="500" y2={y} stroke={i === 3 ? "#cbd5e1" : "#f1f5f9"} strokeWidth={i === 3 ? "1.5" : "1"} />
                  ))}
                  <path d={stats.expectedPath} fill="none" stroke="#121a2e" strokeWidth="2" strokeDasharray="6 6" />
                  <path d={stats.actualPath} fill="none" stroke="#1f9d5f" strokeWidth="3.5" className="animate-[pulse_3s_infinite]" />
                  {stats.actualDots.map((dot, index) => (
                    <g key={`${dot.label}-${index}`}>
                      <circle cx={dot.x} cy={dot.y} r="5.5" fill="#1f9d5f" stroke="#ffffff" strokeWidth="1.5" />
                      <title>{dot.label}: paid {formatKES(dot.actual)} / expected {formatKES(dot.expected)}</title>
                    </g>
                  ))}
                </svg>

                <div className="absolute top-1 left-2 text-[8px] font-bold text-navy-400 font-mono">{stats.graphLabels[0]}</div>
                <div className="absolute top-14 left-2 text-[8px] font-bold text-navy-400 font-mono">{stats.graphLabels[1]}</div>
                <div className="absolute top-28 left-2 text-[8px] font-bold text-navy-400 font-mono">{stats.graphLabels[2]}</div>
                <div className="absolute top-40 left-2 text-[8px] font-bold text-navy-400 font-mono">{stats.graphLabels[3]}</div>
                <div className="absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-green-700 shadow-sm dark:bg-navy-900/80">
                  Paid {formatKES(stats.collectionPct ? Math.round((stats.collectionPct / 100) * stats.billedTerm) : 0)} of {formatKES(stats.billedTerm)}
                </div>
              </div>

              {/* Month Labels */}
              <div className="flex justify-between items-center text-[10px] font-bold text-navy-400 px-4 mt-2 border-t border-navy-50 pt-2">
                {stats.graphPoints.map((p) => (
                  <span key={p.label}>{p.label}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>}

        {/* 🧬 WebRTC Peer-to-Peer Intercom Voice Calling Module */}
        <div className="lg:col-span-1">
          <DashboardIntercomClient />
        </div>
      </div>

      <PrincipalDelegationCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 🧬 PWA Internet Bundle & Data Saver Card */}
        <div className="lg:col-span-1">
          <PwaDataSaverCard />
        </div>

        {/* Recent Activity Log - Compact Styling */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col justify-between p-1">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm uppercase tracking-wider text-navy-400">Recent activity logs</CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 overflow-y-auto max-h-[300px]">
              <ActivityFeed title="" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
