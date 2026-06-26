"use client";

/**
 * B.3 staff attendance + analytics tabs (Chunks 5/6/7).
 * StaffTab: my clock in/out card + leadership day-sheet.
 * InsightsTab: trend bars, per-class today, chronic absentees, anomalies.
 */
import * as React from "react";
import {
  Clock, MapPin, LogIn, LogOut, AlertCircle, Loader2, TrendingUp,
  AlertTriangle, UserX, Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
}

interface SheetRow { userId: string; name: string; role: string; clockInAt: string | null; clockOutAt: string | null; present: boolean; gpsVerified: boolean; gpsDistanceM: number | null }
interface StaffData { date: string; mine: { clockInAt: string; clockOutAt: string | null; gpsVerified?: boolean } | null; canClock: boolean; geofenceOn: boolean; gpsRadiusM: number; sheet: SheetRow[]; presentCount: number; expected: number }

/** Get device GPS (G.17). Resolves null when unavailable/denied. */
function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

export function StaffAttendanceTab() {
  const { toast } = useToast();
  const [data, setData] = React.useState<StaffData | null>(null);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/attendance/staff");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function clock(action: "in" | "out") {
    setBusy(true);
    try {
      // G.17: when the school geofence is on, attach device GPS to clock-in.
      let gps: { lat: number; lng: number } | null = null;
      if (action === "in" && data?.geofenceOn) {
        gps = await getGps();
        if (!gps) {
          toast({ title: "Your school requires location for clock-in. Allow location access and try again.", tone: "error" });
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/attendance/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(gps ?? {}) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: action === "in" ? (json.data.gpsVerified ? "Clocked in — location verified ✓" : "Clocked in — karibu!") : "Clocked out — see you tomorrow", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  if (error) return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={load} className="font-medium underline">Retry</button>
    </div>
  );
  if (data === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-4">
      {/* my clock card */}
      {data.canClock && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-100 dark:bg-navy-800">
                <Clock className="h-5 w-5 text-navy-500 dark:text-navy-300" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                  {data.mine
                    ? data.mine.clockOutAt
                      ? `Done for today · in ${fmtTime(data.mine.clockInAt)} — out ${fmtTime(data.mine.clockOutAt)}`
                      : `Clocked in at ${fmtTime(data.mine.clockInAt)}`
                    : "Not clocked in yet"}
                </p>
                <p className="text-xs text-navy-400">
                  {data.date} · Nairobi time
                  {data.geofenceOn && <span className="ml-1 inline-flex items-center gap-0.5 text-green-600"><MapPin className="h-3 w-3" /> GPS required ({data.gpsRadiusM} m)</span>}
                  {data.mine?.gpsVerified && <span className="ml-1 text-green-600">· location verified</span>}
                </p>
              </div>
            </div>
            {!data.mine ? (
              <Button onClick={() => clock("in")} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Clock in
              </Button>
            ) : !data.mine.clockOutAt ? (
              <Button variant="secondary" onClick={() => clock("out")} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock out
              </Button>
            ) : (
              <Badge tone="green">Day complete</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* day sheet (leadership) */}
      {data.sheet.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-navy-400" /> Staff today</span>
              <Badge tone={data.presentCount === data.expected ? "green" : "amber"}>{data.presentCount}/{data.expected} in</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.sheet.map((s) => (
                <li key={s.userId} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                    <p className="text-xs text-navy-400">{s.role.replaceAll("_", " ").toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-2 text-right text-xs">
                    {s.present ? (
                      <>
                        {s.gpsVerified && (
                          <span className="inline-flex items-center gap-0.5 text-green-600" title={s.gpsDistanceM !== null ? `${s.gpsDistanceM} m from the gate` : "Location verified"}>
                            <MapPin className="h-3 w-3" /> verified
                          </span>
                        )}
                        <span className="text-navy-600 dark:text-navy-300">{fmtTime(s.clockInAt)} → {fmtTime(s.clockOutAt)}</span>
                      </>
                    ) : (
                      <Badge tone="neutral">not in</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- insights tab -------------------------------------------------------------
interface Analytics {
  from: string; to: string;
  trend: { date: string; pct: number; marked: number }[];
  classesToday: { classId: string; label: string; pct: number; marked: number }[];
  chronic: { studentId: string; name: string; admissionNo: string; className: string | null; absences: number }[];
  anomalies: { date: string; label: string; pct: number; usual: number }[];
}

export function InsightsTab() {
  const [data, setData] = React.useState<Analytics | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/attendance/analytics?days=14");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load insights. <button onClick={load} className="font-medium underline">Retry</button>
    </div>
  );
  if (data === null) return <div className="grid gap-3 lg:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>;

  const hasAny = data.trend.length > 0;

  return !hasAny ? (
    <EmptyState icon={TrendingUp} title="No attendance data yet" description="Mark a few daily registers and trends will appear here." />
  ) : (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* trend */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Attendance trend (last 14 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-36 items-end gap-1.5">
            {data.trend.map((t) => (
              <div key={t.date} className="group relative flex-1">
                <div
                  className={`w-full rounded-t-md transition-colors ${t.pct >= 90 ? "bg-green-500" : t.pct >= 75 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ height: `${Math.max(t.pct, 4) * 1.3}px` }}
                  title={`${t.date}: ${t.pct}% (${t.marked} marked)`}
                />
                <p className="mt-1 rotate-0 text-center text-[9px] text-navy-400">{t.date.slice(8)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-navy-400">% of marked students present or late · bar = one school day</p>
        </CardContent>
      </Card>

      {/* per-class today */}
      <Card>
        <CardHeader><CardTitle>Today by class</CardTitle></CardHeader>
        <CardContent>
          {data.classesToday.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">No registers marked yet today.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.classesToday.map((c) => (
                <li key={c.classId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-navy-800 dark:text-navy-100">{c.label}</span>
                    <span className="text-navy-500">{c.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                    <div className={`h-full rounded-full ${c.pct >= 90 ? "bg-green-500" : c.pct >= 75 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* chronic absentees */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-4 w-4 text-red-500" /> Needs follow-up (3+ absences)</CardTitle></CardHeader>
        <CardContent>
          {data.chronic.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">No student has 3+ absences in this window. 🎉</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.chronic.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between py-2 text-sm">
                  <a href={`/students/${s.studentId}`} className="min-w-0">
                    <p className="truncate font-medium text-navy-900 hover:underline dark:text-navy-50">{s.name}</p>
                    <p className="text-xs text-navy-400">{s.admissionNo}{s.className ? ` · ${s.className}` : ""}</p>
                  </a>
                  <Badge tone="red">{s.absences} absent</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* anomalies */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Unusual days</CardTitle></CardHeader>
        <CardContent>
          {data.anomalies.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">No anomalies — class attendance is steady.</p>
          ) : (
            <ul className="space-y-2">
              {data.anomalies.map((a, i) => (
                <li key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <span className="font-semibold">{a.label}</span> dropped to {a.pct}% on {a.date} (usually ~{a.usual}%). Worth a phone call?
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
