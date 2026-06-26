"use client";

/**
 * B.3 Attendance — daily register (Chunks 5/6/7).
 * Overview: per-class cards with today's marking state.
 * Register: one-tap roll — everyone starts Present, tap to cycle P→A→L→E.
 * OFFLINE-FIRST (G.2): saving uses queuedPost; on slow 3G the register queues
 * in IndexedDB and syncs when back online (server upserts are idempotent).
 * All 4 UX states; mobile-first 360px.
 */
import * as React from "react";
import {
  CalendarCheck, ChevronLeft, ChevronRight, Check, AlertCircle,
  Loader2, ArrowLeft, MessageSquareWarning, Users, WifiOff, Crown, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/auth/permissions-provider";
import { queuedPost } from "@/lib/offline/queue";
import { useOnline } from "@/lib/offline/use-online";

type Status = "P" | "A" | "L" | "E";
const CYCLE: Record<Status, Status> = { P: "A", A: "L", L: "E", E: "P" };
const STATUS_STYLE: Record<Status, string> = {
  P: "bg-green-600 text-white",
  A: "bg-red-500 text-white",
  L: "bg-amber-500 text-white",
  E: "bg-navy-400 text-white",
};
const STATUS_LABEL: Record<Status, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

interface OverviewClass { id: string; label: string; total: number; classTeacherId: string | null; marked: number; present: number; absent: number; done: boolean }
interface RegStudent { id: string; name: string; admissionNo: string; photoUrl: string | null; gender: string; status: Status | null; note: string | null }
interface RegisterData { class: { id: string; label: string }; date: string; students: RegStudent[]; markedCount: number; markedByName: string | null }

function todayNairobi(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}
function shiftDate(d: string, days: number): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function AttendanceClient({ canRecord: initialCanRecord, currentUserId }: { canRecord: boolean; currentUserId: string }) {
  const { role, secondaryRole } = usePermissions();
  const isMaster = role === "PRINCIPAL" || role === "SCHOOL_OWNER" || secondaryRole === "PRINCIPAL" || secondaryRole === "SCHOOL_OWNER";
  const [masterOverride, setMasterOverride] = React.useState(false);

  const canRecordClass = React.useCallback((classTeacherId: string | null) => {
    const isOwnClassTeacher = classTeacherId === currentUserId;
    if (isMaster) return initialCanRecord && (masterOverride || isOwnClassTeacher);
    return initialCanRecord;
  }, [currentUserId, initialCanRecord, isMaster, masterOverride]);

  const [date, setDate] = React.useState(todayNairobi());
  const [classes, setClasses] = React.useState<OverviewClass[] | null>(null);
  const [error, setError] = React.useState(false);
  const [openClass, setOpenClass] = React.useState<{ id: string; canRecord: boolean } | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      const json = await res.json();
      if (json.ok) setClasses(json.data.classes);
      else setError(true);
    } catch { setError(true); }
  }, [date]);

  React.useEffect(() => { setClasses(null); load(); }, [load]);

  if (openClass) {
    return (
      <Register
        classId={openClass.id}
        date={date}
        canRecord={openClass.canRecord}
        masterOverride={isMaster && masterOverride && openClass.canRecord}
        onBack={() => { setOpenClass(null); load(); }}
      />
    );
  }

  const isToday = date === todayNairobi();

  return (
    <div className="space-y-6">
      {/* date strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-navy-200 p-1 dark:border-navy-700">
          <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-1.5 text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2 text-sm font-medium text-navy-900 dark:text-navy-50">
            {isToday ? "Today" : new Date(date + "T12:00:00Z").toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={isToday} className="rounded-full p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30 dark:hover:bg-navy-800" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && (
            <label className="inline-flex items-center gap-2 rounded-full border border-green-200/50 bg-green-500/10 px-3.5 py-1.5 text-xs font-semibold text-green-700 dark:border-green-500/25 dark:text-green-300 cursor-pointer hover:bg-green-500/20 transition-all select-none">
              <input
                type="checkbox"
                checked={masterOverride}
                onChange={(e) => setMasterOverride(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-green-300 text-green-600 focus:ring-green-500 cursor-pointer"
              />
<Crown className="h-3.5 w-3.5" /> Master Override: {masterOverride ? "ON" : "OFF"}
            </label>
          )}
          {!isToday && <Button size="sm" variant="secondary" onClick={() => setDate(todayNairobi())}>Jump to today</Button>}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load attendance.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : classes === null ? (
        <div className="grid gap-3 sm:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes to mark"
          description="You are not assigned as class teacher to any class. Ask the office to assign you, or create classes under Students → Manage classes."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => {
            const writable = canRecordClass(c.classTeacherId);
            const masterViewOnly = isMaster && !writable && c.classTeacherId !== currentUserId;
            return (
            <button key={c.id} onClick={() => setOpenClass({ id: c.id, canRecord: writable })} className="text-left">
              <Card className="transition-shadow duration-200 ease-apple hover:shadow-card">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{c.label}</p>
                    <p className="mt-0.5 text-xs text-navy-400">
                      {c.total} student{c.total === 1 ? "" : "s"}
                      {c.marked > 0 && !c.done ? ` · ${c.marked} marked` : ""}
                    </p>
                  </div>
                  {masterViewOnly ? (
                    <div className="text-right">
                      <Badge tone="neutral"><Eye className="mr-1 h-3 w-3" />View only</Badge>
                      <p className="mt-1 text-[10px] font-medium text-navy-400">Use Master Override to mark</p>
                    </div>
                  ) : c.done ? (
                    <div className="text-right">
                      <Badge tone="green"><Check className="mr-1 h-3 w-3" />{c.present} present</Badge>
                      {c.absent > 0 && <p className="mt-1 text-xs font-medium text-red-600">{c.absent} absent</p>}
                    </div>
                  ) : (
                    <Badge tone={c.marked > 0 ? "amber" : "neutral"}>{c.marked > 0 ? "In progress" : "Not marked"}</Badge>
                  )}
                </CardContent>
              </Card>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- the one-tap register ---------------------------------------------------
function Register({ classId, date, canRecord, masterOverride, onBack }: {
  classId: string; date: string; canRecord: boolean; masterOverride?: boolean; onBack: () => void;
}) {
  const { toast } = useToast();
  const online = useOnline();
  const [data, setData] = React.useState<RegisterData | null>(null);
  const [error, setError] = React.useState(false);
  const [marks, setMarks] = React.useState<Map<string, Status>>(new Map());
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notifyAbsent, setNotifyAbsent] = React.useState(true);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      const json = await res.json();
      if (!json.ok) { setError(true); return; }
      const d: RegisterData = json.data;
      setData(d);
      // One-tap default: everyone Present unless already marked otherwise.
      const m = new Map<string, Status>();
      for (const s of d.students) m.set(s.id, s.status ?? "P");
      setMarks(m);
      setDirty(d.markedCount === 0 && d.students.length > 0); // fresh register = savable immediately
    } catch { setError(true); }
  }, [classId, date]);

  React.useEffect(() => { load(); }, [load]);

  function tap(studentId: string) {
    if (!canRecord) return;
    setMarks((prev) => {
      const next = new Map(prev);
      next.set(studentId, CYCLE[prev.get(studentId) ?? "P"]);
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const payload = {
        classId,
        date,
        marks: data.students.map((s) => ({ studentId: s.id, status: marks.get(s.id) ?? "P" })),
        notifyAbsent,
        masterOverride: !!masterOverride,
      };
      const result = await queuedPost("/api/attendance", payload, `Attendance · ${data.class.label} · ${date}`);
      if (result.queued) {
        toast({ title: "Saved offline — will sync when you're back online", tone: "success" });
        setDirty(false);
      } else if (result.ok) {
        toast({ title: "Register saved", tone: "success" });
        setDirty(false);
        load();
      } else {
        toast({ title: "Could not save the register", tone: "error" });
      }
    } finally { setSaving(false); }
  }

  const counts = { P: 0, A: 0, L: 0, E: 0 };
  if (data) for (const s of data.students) counts[marks.get(s.id) ?? "P"]++;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100">
          <ArrowLeft className="h-4 w-4" /> All classes
        </button>
        {data && (
          <div className="flex items-center gap-2 text-xs">
            <Badge tone="green">{counts.P} present</Badge>
            {counts.A > 0 && <Badge tone="red">{counts.A} absent</Badge>}
            {counts.L > 0 && <Badge tone="amber">{counts.L} late</Badge>}
            {counts.E > 0 && <Badge tone="neutral">{counts.E} excused</Badge>}
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load the register.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : data === null ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : data.students.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No active students in this class" description="Add students to this class first, then mark the register." />
      ) : (
        <>
          <div className="rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900">
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3 dark:border-navy-800">
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{data.class.label} · {date}</p>
              <p className="text-xs text-navy-400">Tap a pill to cycle P → A → L → E</p>
            </div>
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.students.map((s) => {
                const st = marks.get(s.id) ?? "P";
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={s.name} photoUrl={s.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                      <p className="font-mono text-[11px] text-navy-400">{s.admissionNo}</p>
                    </div>
                    <button
                      onClick={() => tap(s.id)}
                      disabled={!canRecord}
                      className={`w-24 shrink-0 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-colors duration-200 ease-apple disabled:opacity-60 ${STATUS_STYLE[st]}`}
                      aria-label={`${s.name}: ${STATUS_LABEL[st]} — tap to change`}
                    >
                      {STATUS_LABEL[st]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {canRecord && (
            <div className="sticky bottom-4 flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white/95 p-3 shadow-card backdrop-blur dark:border-navy-800 dark:bg-navy-900/95 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-xs text-navy-600 dark:text-navy-300">
                <input type="checkbox" checked={notifyAbsent} onChange={(e) => setNotifyAbsent(e.target.checked)} className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                <MessageSquareWarning className="h-3.5 w-3.5 text-amber-500" />
                SMS guardians of absentees
              </label>
              <div className="flex items-center gap-2">
                {!online && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <WifiOff className="h-3.5 w-3.5" /> Offline — will queue
                  </span>
                )}
                <Button onClick={save} disabled={saving || !dirty}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save register ({data.students.length})
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  if (photoUrl) return <img src={photoUrl} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-200">{initials}</span>;
}
