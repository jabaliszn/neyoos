/**
 * B.3 Teacher + support-staff attendance (clock in/out) and the
 * student-attendance analytics (trends + anomalies).
 *
 * Clocking: any ACTIVE staff user can clock THEMSELVES in/out once per
 * Nairobi day. Leadership sees the whole staff day-sheet.
 *
 * Analytics: real aggregates over AttendanceRecord — daily % trend,
 * per-class today, chronic absentees (3+ absences in window), and
 * anomaly flags (class day-rate far below its own average).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nairobiToday } from "@/lib/services/attendance.service";
import type { SessionUser } from "@/lib/core/session";

export class StaffAttendanceError extends Error {
  constructor(public code: "ALREADY" | "NOT_CLOCKED_IN" | "GPS_REQUIRED" | "OUT_OF_RANGE", message: string) {
    super(message);
    this.name = "StaffAttendanceError";
  }
}

// ---------------------------------------------------------------------------
// G.17 geofence helpers
// ---------------------------------------------------------------------------

/** Haversine distance between two coordinates, in metres. */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** Staff roles that clock in (teachers + support; leadership optional). */
const CLOCKING_ROLES = new Set([
  "TEACHER", "CLASS_TEACHER", "DEPUTY_PRINCIPAL", "PRINCIPAL", "HOD",
  "DEAN_OF_STUDIES", "BURSAR", "ACCOUNTANT", "RECEPTIONIST", "LIBRARIAN",
  "HOSTEL_MASTER", "SUPPORT_STAFF", "SCHOOL_OWNER",
]);

export async function clockIn(user: SessionUser, gps?: { lat: number; lng: number }) {
  return withTenant(user.tenantId, async () => {
    const date = nairobiToday();
    const existing = await tenantDb().staffAttendance.findFirst({ where: { userId: user.id, date } });
    if (existing) throw new StaffAttendanceError("ALREADY", "You already clocked in today.");

    // G.17 geofence: when the school has a saved location, GPS is MANDATORY
    // and verified SERVER-SIDE (Haversine vs gpsRadiusM).
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { gpsLat: true, gpsLng: true, gpsRadiusM: true },
    });
    const fenceOn = tenant.gpsLat !== null && tenant.gpsLng !== null;
    let gpsVerified = false;
    let gpsDistanceM: number | null = null;

    if (fenceOn) {
      if (!gps)
        throw new StaffAttendanceError(
          "GPS_REQUIRED",
          "This school requires your location to clock in. Allow location access and try again."
        );
      gpsDistanceM = distanceMetres(gps.lat, gps.lng, tenant.gpsLat!, tenant.gpsLng!);
      const radius = tenant.gpsRadiusM ?? 300;
      if (gpsDistanceM > radius)
        throw new StaffAttendanceError(
          "OUT_OF_RANGE",
          `You are ${formatDistance(gpsDistanceM)} from school — clock-in only works within ${formatDistance(radius)} of the gate.`
        );
      gpsVerified = true;
    }

    const row = await tenantDb().staffAttendance.create({
      data: {
        userId: user.id, userName: user.fullName, role: user.role, date,
        clockInAt: new Date(),
        gpsVerified,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        gpsDistanceM,
      } as never,
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "staff.clock_in", entityType: "staffAttendance", entityId: row.id,
        metadata: JSON.stringify({ date, gpsVerified, gpsDistanceM }),
      },
    });
    return { id: row.id, clockInAt: row.clockInAt, gpsVerified, gpsDistanceM };
  });
}

export async function clockOut(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const date = nairobiToday();
    const row = await tenantDb().staffAttendance.findFirst({ where: { userId: user.id, date } });
    if (!row) throw new StaffAttendanceError("NOT_CLOCKED_IN", "Clock in first.");
    if (row.clockOutAt) throw new StaffAttendanceError("ALREADY", "You already clocked out today.");
    await tenantDb().staffAttendance.update({ where: { id: row.id }, data: { clockOutAt: new Date() } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "staff.clock_out", entityType: "staffAttendance", entityId: row.id,
        metadata: JSON.stringify({ date }),
      },
    });
    return { id: row.id };
  });
}

/** My own clock state + the staff day-sheet (sheet only for staff.view). */
export async function staffDaySheet(user: SessionUser, date?: string, includeSheet = true) {
  return withTenant(user.tenantId, async () => {
    const d = date ?? nairobiToday();
    const mine = await tenantDb().staffAttendance.findFirst({ where: { userId: user.id, date: d } });

    let sheet: unknown[] = [];
    let expected = 0;
    if (includeSheet) {
      const staff = await tenantDb().user.findMany({
        where: { isActive: true, role: { in: [...CLOCKING_ROLES] } },
        select: { id: true, fullName: true, role: true },
        orderBy: { fullName: "asc" },
      });
      expected = staff.length;
      const rows = await tenantDb().staffAttendance.findMany({ where: { date: d } });
      const byUser = new Map(rows.map((r) => [r.userId, r]));
      sheet = staff.map((s) => {
        const r = byUser.get(s.id);
        return {
          userId: s.id, name: s.fullName, role: s.role,
          clockInAt: r?.clockInAt ?? null, clockOutAt: r?.clockOutAt ?? null,
          present: Boolean(r),
          gpsVerified: r?.gpsVerified ?? false,
          gpsDistanceM: r?.gpsDistanceM ?? null,
        };
      });
    }
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { gpsLat: true, gpsLng: true, gpsRadiusM: true },
    });
    return {
      date: d,
      mine: mine ? { clockInAt: mine.clockInAt, clockOutAt: mine.clockOutAt, gpsVerified: mine.gpsVerified } : null,
      canClock: CLOCKING_ROLES.has(user.role),
      geofenceOn: tenant.gpsLat !== null && tenant.gpsLng !== null,
      gpsRadiusM: tenant.gpsRadiusM ?? 300,
      sheet,
      presentCount: (sheet as { present: boolean }[]).filter((s) => s.present).length,
      expected,
    };
  });
}

// ---------------------------------------------------------------------------
// Student attendance analytics (B.3.8)
// ---------------------------------------------------------------------------

function shiftDays(ymd: string, days: number): string {
  const t = new Date(ymd + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export async function attendanceAnalytics(user: SessionUser, windowDays = 14) {
  return withTenant(user.tenantId, async () => {
    const today = nairobiToday();
    const from = shiftDays(today, -(windowDays - 1));

    const records = await tenantDb().attendanceRecord.findMany({
      where: { date: { gte: from, lte: today } },
      select: { date: true, status: true, classId: true, studentId: true },
    });

    // Daily trend: % present (P+L count as in-school).
    const byDate = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const d = byDate.get(r.date) ?? { present: 0, total: 0 };
      d.total++;
      if (r.status === "P" || r.status === "L") d.present++;
      byDate.set(r.date, d);
    }
    const trend = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, pct: v.total ? Math.round((v.present / v.total) * 100) : 0, marked: v.total }));

    // Per-class today.
    const classes = await tenantDb().schoolClass.findMany({ where: { archived: false } });
    const classLabel = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    const todayRecs = records.filter((r) => r.date === today);
    const byClassToday = new Map<string, { present: number; total: number }>();
    for (const r of todayRecs) {
      if (!r.classId) continue;
      const c = byClassToday.get(r.classId) ?? { present: 0, total: 0 };
      c.total++;
      if (r.status === "P" || r.status === "L") c.present++;
      byClassToday.set(r.classId, c);
    }
    const classesToday = [...byClassToday.entries()].map(([classId, v]) => ({
      classId, label: classLabel.get(classId) ?? "—",
      pct: v.total ? Math.round((v.present / v.total) * 100) : 0, marked: v.total,
    }));

    // Chronic absentees: 3+ absences in the window.
    const absences = new Map<string, number>();
    for (const r of records) if (r.status === "A") absences.set(r.studentId, (absences.get(r.studentId) ?? 0) + 1);
    const chronicIds = [...absences.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const chronicStudents = chronicIds.length
      ? await tenantDb().student.findMany({
          where: { id: { in: chronicIds.map(([id]) => id) } },
          select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, classId: true },
        })
      : [];
    const chronic = chronicIds.flatMap(([id, n]) => {
      const s = chronicStudents.find((x) => x.id === id);
      if (!s) return [];
      return [{
        studentId: id,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        admissionNo: s.admissionNo,
        className: s.classId ? classLabel.get(s.classId) ?? null : null,
        absences: n,
      }];
    });

    // Anomalies: a class-day rate 25+ points below that class's window average.
    const byClassDay = new Map<string, { present: number; total: number }>();
    const classTotals = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      if (!r.classId) continue;
      const k = `${r.classId}|${r.date}`;
      const cd = byClassDay.get(k) ?? { present: 0, total: 0 };
      cd.total++; if (r.status === "P" || r.status === "L") cd.present++;
      byClassDay.set(k, cd);
      const ct = classTotals.get(r.classId) ?? { present: 0, total: 0 };
      ct.total++; if (r.status === "P" || r.status === "L") ct.present++;
      classTotals.set(r.classId, ct);
    }
    const anomalies: { date: string; label: string; pct: number; usual: number }[] = [];
    for (const [k, v] of byClassDay) {
      const [classId, date] = k.split("|");
      const avg = classTotals.get(classId);
      if (!avg || avg.total < 6) continue; // not enough history
      const dayPct = v.total ? (v.present / v.total) * 100 : 0;
      const avgPct = (avg.present / avg.total) * 100;
      if (avgPct - dayPct >= 25 && v.total >= 3) {
        anomalies.push({ date, label: classLabel.get(classId) ?? "—", pct: Math.round(dayPct), usual: Math.round(avgPct) });
      }
    }
    anomalies.sort((a, b) => b.date.localeCompare(a.date));

    return { from, to: today, trend, classesToday, chronic, anomalies: anomalies.slice(0, 10) };
  });
}
