"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  CalendarDays,
  Loader2,
  AlertCircle,
  X,
  MapPin,
  Clock,
  Users,
  Trash2,
  Repeat,
  Smartphone,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/core/roles";

// ---- types -----------------------------------------------------------------
interface Occurrence {
  id: string;
  source: "event" | "holiday";
  title: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  type: string;
  description: string | null;
  audienceRole: string | null;
  readonly: boolean;
  recurring?: "WEEKLY" | "MONTHLY" | null;
}

type ViewMode = "month" | "week" | "day";

const TYPE_TONE: Record<string, "neutral" | "green" | "red" | "amber" | "blue"> = {
  holiday: "red",
  exam: "amber",
  meeting: "blue",
  sports: "green",
  deadline: "amber",
  event: "neutral",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- date helpers (local, no TZ surprises for all-day) ----------------------
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function todayIso() {
  return iso(new Date());
}
/** Monday-based weekday index 0..6. */
function dow(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function CalendarView({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState(() => new Date());
  const [occ, setOcc] = React.useState<Occurrence[] | null>(null);
  const [error, setError] = React.useState(false);
  const [showReligious, setShowReligious] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [presetDate, setPresetDate] = React.useState<string>(todayIso());

  // visible range for the current view
  const range = React.useMemo(() => rangeFor(view, cursor), [view, cursor]);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(
        `/api/calendar/events?from=${range.from}&to=${range.to}`
      );
      const json = await res.json();
      if (json.ok) {
        setOcc(json.data.occurrences);
        setShowReligious(json.data.showReligiousHolidays);
      } else setError(true);
    } catch {
      setError(true);
    }
  }, [range.from, range.to]);

  React.useEffect(() => {
    setOcc(null);
    load();
  }, [load]);

  // keyboard nav: ← → to move, t = today
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (dialogOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") setCursor((c) => step(view, c, -1));
      else if (e.key === "ArrowRight") setCursor((c) => step(view, c, 1));
      else if (e.key.toLowerCase() === "t") setCursor(new Date());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, dialogOpen]);

  function occForDate(dateIso: string): Occurrence[] {
    if (!occ) return [];
    return occ.filter((o) => {
      const end = o.endDate ?? o.date;
      return dateIso >= o.date && dateIso <= end;
    });
  }

  async function remove(id: string) {
    // Recurring occurrences carry a "<seriesId>:<date>" id — deleting any one
    // removes the whole series (its stored row id is the part before the colon).
    const seriesId = id.includes(":") ? id.slice(0, id.indexOf(":")) : id;
    const res = await fetch(`/api/calendar/events/${seriesId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      toast({ title: "Event deleted", tone: "success" });
      load();
    } else {
      toast({ title: json.error?.message || "Could not delete", tone: "error" });
    }
  }

  const heading =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === "week"
      ? weekLabel(cursor)
      : `${DOW[dow(cursor)]}, ${cursor.getDate()} ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCursor((c) => step(view, c, -1))} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[12rem] text-center text-lg font-semibold text-navy-900 dark:text-navy-50">
            {heading}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setCursor((c) => step(view, c, 1))} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  "rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors duration-200 ease-apple " +
                  (view === v
                    ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900"
                    : "text-navy-500 hover:text-navy-800 dark:text-navy-400")
                }
              >
                {v}
              </button>
            ))}
          </div>
          <a href="/api/calendar/ics" download>
            <Button size="sm" variant="ghost">
              <Download className="h-4 w-4" /> iCal
            </Button>
          </a>
          <SyncToPhoneButton />
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setPresetDate(view === "day" ? iso(cursor) : todayIso());
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New event
            </Button>
          )}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-navy-500 dark:text-navy-400">
        <LegendDot tone="red" label="Public holiday" />
        <LegendDot tone="amber" label="Exam / deadline" />
        <LegendDot tone="blue" label="Meeting" />
        <LegendDot tone="green" label="Sports" />
        <LegendDot tone="neutral" label="Event" />
        {!showReligious && <span className="italic">Religious holidays hidden</span>}
      </div>

      {/* body / states */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load the calendar.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : occ === null ? (
        <Skeleton className="h-[28rem] rounded-2xl" />
      ) : view === "month" ? (
        <MonthGrid cursor={cursor} occForDate={occForDate} />
      ) : view === "week" ? (
        <AgendaList cursor={cursor} days={7} occForDate={occForDate} onRemove={canManage ? remove : undefined} />
      ) : (
        <AgendaList cursor={cursor} days={1} occForDate={occForDate} onRemove={canManage ? remove : undefined} />
      )}

      {dialogOpen && (
        <EventDialog
          defaultDate={presetDate}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * M.3 — "Sync with native mobile calendar". Unlike the old "iCal" button
 * (a one-shot download, never updates again), this gives the user a personal
 * webcal:// link their phone's Calendar app SUBSCRIBES to — every event
 * added/edited/removed on NEYO shows up automatically on their phone with no
 * further action, because the phone polls the live feed on its own schedule.
 */
function SyncToPhoneButton() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [feed, setFeed] = React.useState<{ https: string; webcal: string; lastPolledAt: string | null; rotatedAt: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/calendar/feed");
      const json = await res.json();
      if (json.ok) setFeed(json.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open && !feed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function rotate() {
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/feed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeed(json.data);
        toast({ title: "New sync link generated", description: "Old links on other devices will stop working.", tone: "success" });
      } else {
        toast({ title: json.error?.message ?? "Could not generate a new link.", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!feed) return;
    navigator.clipboard?.writeText(feed.https).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Smartphone className="h-4 w-4" /> Sync to phone
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg overflow-y-auto rounded-3xl border border-white/60 bg-white p-0 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-navy-100 p-5 dark:border-navy-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900 dark:text-navy-50">
                <Smartphone className="h-5 w-5 text-green-600" /> Sync with your phone
              </h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-navy-600 dark:text-navy-300">
                Add this link once as a subscribed calendar in your phone&apos;s Calendar app (iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar. Android/Google: Google Calendar → Settings → Add calendar → From URL). New and changed events will keep appearing automatically — you never need to download anything again.
              </p>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : error ? (
                <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  Could not load your sync link.
                  <Button size="sm" variant="secondary" onClick={load}>Retry</Button>
                </div>
              ) : feed ? (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-warm-50 px-3 py-2.5 dark:border-navy-700 dark:bg-navy-900">
                    <code className="min-w-0 flex-1 truncate text-xs text-navy-600 dark:text-navy-300">{feed.https}</code>
                    <Button size="sm" variant="ghost" onClick={copy} className="shrink-0">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <a href={feed.webcal}>
                    <Button className="w-full">
                      <Smartphone className="h-4 w-4" /> Open in Calendar app
                    </Button>
                  </a>
                  <div className="flex items-center justify-between text-xs text-navy-400">
                    <span>
                      {feed.lastPolledAt
                        ? `Last synced ${new Date(feed.lastPolledAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`
                        : "Not synced by a device yet."}
                    </span>
                    <Button size="sm" variant="ghost" onClick={rotate} disabled={busy} title="Generate a new link — old links stop working">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} New link
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- month grid ------------------------------------------------------------
const TYPE_BG: Record<string, string> = {
  holiday: "bg-red-50/60 hover:bg-red-100/50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
  exam: "bg-amber-50/60 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
  meeting: "bg-blue-50/60 hover:bg-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30",
  sports: "bg-green-50/60 hover:bg-green-100/50 dark:bg-green-950/20 dark:hover:bg-green-950/30",
  deadline: "bg-amber-50/60 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
  event: "bg-navy-50/40 hover:bg-navy-100/40 dark:bg-navy-950/10 dark:hover:bg-navy-950/20",
};

function MonthGrid({
  cursor,
  occForDate,
}: {
  cursor: Date;
  occForDate: (d: string) => Occurrence[];
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = dow(first);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const today = todayIso();

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 dark:border-navy-800">
      <div className="grid grid-cols-7 border-b border-navy-100 bg-navy-50/60 text-center text-xs font-semibold uppercase tracking-wide text-navy-400 dark:border-navy-800 dark:bg-navy-900/40">
        {DOW.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const di = iso(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const items = occForDate(di);
          const isToday = di === today;

          // Color fill the entire day box based on the first occurrence's type
          const firstType = items[0]?.type;
          let cellBgClass = "bg-white hover:bg-navy-50/50 dark:bg-navy-900 dark:hover:bg-navy-850/50";
          if (!inMonth) {
            cellBgClass = "bg-navy-50/20 dark:bg-navy-900/20 opacity-65";
          } else if (firstType) {
            cellBgClass = TYPE_BG[firstType] ?? cellBgClass;
          }

          return (
            <div
              key={i}
              className={
                "min-h-[8.5rem] border-b border-r border-navy-100 p-2.5 transition-all duration-200 ease-apple dark:border-navy-800 relative " +
                cellBgClass
              }
            >
              {/* Enlarged and distinct date header to prevent drifting or hiding */}
              <div className="mb-2 flex items-center justify-between border-b border-navy-100/30 pb-1">
                <span className="text-[10px] uppercase font-bold text-navy-400 tracking-wider">
                  {items.length > 0 ? `${items.length} Event${items.length === 1 ? "" : "s"}` : ""}
                </span>
                <span
                  className={
                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold shadow-sm leading-none " +
                    (isToday
                      ? "bg-green-600 font-bold text-white ring-2 ring-green-500/20"
                      : inMonth
                      ? "text-navy-800 font-bold dark:text-navy-100 bg-navy-50/50 dark:bg-navy-800/40"
                      : "text-navy-300 dark:text-navy-600 font-medium")
                  }
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((o) => (
                  <div
                    key={o.id + di}
                    title={o.title}
                    className="flex items-center gap-1.5 truncate rounded-lg bg-white/75 dark:bg-navy-850/75 border border-navy-100/40 dark:border-navy-700/30 px-2 py-1 text-xs font-semibold shadow-sm hover:scale-[1.02] transition-transform duration-150 text-navy-800 dark:text-navy-100"
                  >
                    <span className={"h-2 w-2 shrink-0 rounded-full " + dotClass(o.type)} />
                    <span className="truncate">
                      {o.startTime ? `${o.startTime} ` : ""}{o.title}
                    </span>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="px-2 text-xs font-semibold text-green-600 dark:text-green-400">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- week/day agenda -------------------------------------------------------
function AgendaList({
  cursor,
  days,
  occForDate,
  onRemove,
}: {
  cursor: Date;
  days: number;
  occForDate: (d: string) => Occurrence[];
  onRemove?: (id: string) => void;
}) {
  const start = new Date(cursor);
  if (days === 7) start.setDate(cursor.getDate() - dow(cursor)); // Monday
  const dayList = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = todayIso();
  const totalItems = dayList.reduce((n, d) => n + occForDate(iso(d)).length, 0);

  if (totalItems === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        description={
          days === 1
            ? "No events or holidays on this day."
            : "No events or holidays this week."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {dayList.map((d) => {
        const di = iso(d);
        const items = occForDate(di);
        return (
          <div key={di}>
            {/* H.2 Big Date Calendar — large, fixed-height date header that stays put */}
            <div className="mb-3 flex items-center gap-3">
              <span
                className={
                  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold leading-none shadow-sm " +
                  (di === today
                    ? "bg-green-600 text-white ring-2 ring-green-500/20"
                    : "bg-navy-50 text-navy-800 dark:bg-navy-800/60 dark:text-navy-100")
                }
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col">
                <span className={"text-base font-semibold " + (di === today ? "text-green-700 dark:text-green-400" : "text-navy-700 dark:text-navy-200")}>
                  {DOW[dow(d)]}
                </span>
                <span className="text-xs font-medium text-navy-400 dark:text-navy-500">
                  {MONTHS[d.getMonth()]} {d.getFullYear()}
                </span>
              </div>
              {di === today && <Badge tone="green">Today</Badge>}
            </div>
            {items.length === 0 ? (
              <p className="pl-1 text-sm text-navy-400">—</p>
            ) : (
              <ul className="space-y-2">
                {items.map((o) => (
                  <li
                    key={o.id + di}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-navy-100 p-3 dark:border-navy-800"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={"h-2 w-2 shrink-0 rounded-full " + dotClass(o.type)} />
                        <span className="font-medium text-navy-900 dark:text-navy-50">{o.title}</span>
                        <Badge tone={TYPE_TONE[o.type] ?? "neutral"}>{o.type}</Badge>
                        {o.readonly && <Badge tone="neutral">holiday</Badge>}
                        {o.recurring && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            <Repeat className="h-3 w-3" /> {o.recurring === "WEEKLY" ? "weekly" : "monthly"}
                          </span>
                        )}
                        {o.audienceRole && (
                          <span className="inline-flex items-center gap-1 text-xs text-navy-400">
                            <Users className="h-3 w-3" />
                            {ROLE_LABELS[o.audienceRole as keyof typeof ROLE_LABELS] ?? o.audienceRole}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-navy-500 dark:text-navy-400">
                        {o.startTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {o.startTime}{o.endTime ? `–${o.endTime}` : ""}
                          </span>
                        )}
                        {o.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {o.location}
                          </span>
                        )}
                      </div>
                      {o.description && (
                        <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">{o.description}</p>
                      )}
                    </div>
                    {onRemove && !o.readonly && (
                      <button
                        onClick={() => onRemove(o.id)}
                        className="shrink-0 rounded-full p-1.5 text-navy-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- create dialog ---------------------------------------------------------
const EVENT_TYPES = ["event", "meeting", "exam", "sports", "deadline"];
const AUDIENCES: { value: string; label: string }[] = [
  { value: "all", label: "Whole school" },
  { value: "TEACHER", label: "Teachers" },
  { value: "PARENT", label: "Parents" },
  { value: "STUDENT", label: "Students" },
  { value: "CLASS_TEACHER", label: "Class teachers" },
];

function EventDialog({
  defaultDate,
  onClose,
  onSaved,
}: {
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    date: defaultDate,
    startTime: "",
    endTime: "",
    location: "",
    type: "event",
    audience: "all",
    description: "",
    notify: false,
    recurrence: "" as "" | "WEEKLY" | "MONTHLY",
    recurUntil: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (form.title.trim().length < 2) {
      toast({ title: "Add a title.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        date: form.date,
        type: form.type,
        audience: form.audience,
        notify: form.notify,
      };
      if (form.startTime) body.startTime = form.startTime;
      if (form.endTime) body.endTime = form.endTime;
      if (form.location.trim()) body.location = form.location.trim();
      if (form.description.trim()) body.description = form.description.trim();
      if (form.recurrence) {
        body.recurrence = form.recurrence;
        if (form.recurUntil) body.recurUntil = form.recurUntil;
      }

      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: json.data.invited
            ? `Event added · ${json.data.invited} invited`
            : "Event added",
          tone: "success",
        });
        onSaved();
      } else {
        const msg =
          json.error?.fields
            ? Object.values(json.error.fields)[0]
            : json.error?.message;
        toast({ title: (msg as string) || "Could not save", tone: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">New event</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Form 2 Parents' Meeting"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-type">Type</Label>
              <select
                id="ev-type"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm capitalize transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-start">Start time (optional)</Label>
              <Input id="ev-start" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-end">End time (optional)</Label>
              <Input id="ev-end" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="ev-loc">Location (optional)</Label>
            <Input id="ev-loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. School Hall" />
          </div>
          <div>
            <Label htmlFor="ev-aud">Who is this for?</Label>
            <select
              id="ev-aud"
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
              className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ev-desc">Notes (optional)</Label>
            <textarea
              id="ev-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-recur">Repeats</Label>
              <select
                id="ev-recur"
                value={form.recurrence}
                onChange={(e) => set("recurrence", e.target.value as "" | "WEEKLY" | "MONTHLY")}
                className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
              >
                <option value="">Does not repeat</option>
                <option value="WEEKLY">Every week (same day)</option>
                <option value="MONTHLY">Every month (same date)</option>
              </select>
            </div>
            {form.recurrence && (
              <div>
                <Label htmlFor="ev-until">Repeat until (optional)</Label>
                <Input id="ev-until" type="date" value={form.recurUntil} onChange={(e) => set("recurUntil", e.target.value)} />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
            <input
              type="checkbox"
              checked={form.notify}
              onChange={(e) => set("notify", e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            Send an invite notification to the audience
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add event
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- bits ------------------------------------------------------------------
function LegendDot({ tone, label }: { tone: string; label: string }) {
  const map: Record<string, string> = {
    red: "bg-red-500", amber: "bg-amber-500", blue: "bg-blue-500",
    green: "bg-green-500", neutral: "bg-navy-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-2 w-2 rounded-full " + (map[tone] ?? "bg-navy-400")} />
      {label}
    </span>
  );
}
function dotClass(type: string) {
  const tone = TYPE_TONE[type] ?? "neutral";
  return { red: "bg-red-500", amber: "bg-amber-500", blue: "bg-blue-500", green: "bg-green-500", neutral: "bg-navy-400" }[tone];
}

// ---- range + stepping ------------------------------------------------------
function rangeFor(view: ViewMode, cursor: Date): { from: string; to: string } {
  if (view === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - dow(first));
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: iso(start), to: iso(end) };
  }
  if (view === "week") {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - dow(cursor));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: iso(start), to: iso(end) };
  }
  return { from: iso(cursor), to: iso(cursor) };
}
function step(view: ViewMode, cursor: Date, dir: number): Date {
  const d = new Date(cursor);
  if (view === "month") d.setMonth(d.getMonth() + dir);
  else if (view === "week") d.setDate(d.getDate() + 7 * dir);
  else d.setDate(d.getDate() + dir);
  return d;
}
function weekLabel(cursor: Date): string {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - dow(cursor));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const m = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  return `${start.getDate()} ${m(start)} – ${end.getDate()} ${m(end)} ${end.getFullYear()}`;
}
