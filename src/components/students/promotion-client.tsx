"use client";

/**
 * G.16 Promotion wizard + stream reshuffle (Chunks 5/6/7).
 * Tab 1 — New academic year: mapping preview table -> confirm -> result.
 * Tab 2 — Reshuffle streams: pick level + strategy -> preview balance -> commit.
 * History card with one-click Undo. All 4 UX states.
 */
import * as React from "react";
import {
  ArrowUpRight, GraduationCap, Shuffle, AlertCircle, Loader2,
  Undo2, History, Check, Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

interface PlanStep { classId: string; from: string; to: string | null; graduate: boolean; students: number; toExists: boolean }
interface RunRow { id: string; kind: string; summary: string; undoneAt: string | null; createdByName: string; createdAt: string; moves: number }
interface ReshuffleStream { classId: string; label: string; count: number; boys: number; girls: number; students: { id: string; name: string; gender: string; moved: boolean }[] }
interface ReshuffleData { level: string; strategy: string; streams: ReshuffleStream[]; movedCount: number; total: number }
interface ClassOpt { id: string; level: string; stream: string | null; name: string }

export function PromotionClient() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"promote" | "reshuffle">("promote");
  const [plan, setPlan] = React.useState<PlanStep[] | null>(null);
  const [unmapped, setUnmapped] = React.useState<string[]>([]);
  const [history, setHistory] = React.useState<RunRow[]>([]);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [year, setYear] = React.useState(new Date().getFullYear());

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/promotion");
      const json = await res.json();
      if (json.ok) { setPlan(json.data.plan); setUnmapped(json.data.unmapped); setHistory(json.data.history); }
      else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function commit() {
    setBusy(true);
    try {
      const res = await fetch("/api/promotion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year }) });
      const json = await res.json();
      if (json.ok) { toast({ title: json.data.summary, tone: "success" }); setConfirming(false); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  async function undo(runId: string) {
    if (!window.confirm("Undo this run? Every student goes back to where they were.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/promotion/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
      const json = await res.json();
      if (json.ok) { toast({ title: `${json.data.reversed} students restored`, tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  const graduating = plan?.filter((p) => p.graduate) ?? [];
  const promoting = plan?.filter((p) => !p.graduate) ?? [];
  const totalGrad = graduating.reduce((a, p) => a + p.students, 0);
  const totalProm = promoting.reduce((a, p) => a + p.students, 0);

  return (
    <div className="space-y-6">
      {/* tabs */}
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        <button onClick={() => setTab("promote")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "promote" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
          New academic year
        </button>
        <button onClick={() => setTab("reshuffle")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "reshuffle" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
          Reshuffle streams
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : plan === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : tab === "promote" ? (
        <>
          {plan.length === 0 ? (
            <EmptyState icon={ArrowUpRight} title="No classes yet" description="Create classes under Students → Manage classes first." />
          ) : (
            <Card>
              <CardHeader><CardTitle>Promotion plan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <TableContainer>
                  <Table>
                    <THead><TR><TH>Current class</TH><TH>Students</TH><TH>Moves to</TH></TR></THead>
                    <TBody>
                      {plan.map((p) => (
                        <TR key={p.classId}>
                          <TD className="font-medium">{p.from}</TD>
                          <TD>{p.students}</TD>
                          <TD>
                            {p.graduate ? (
                              <Badge tone="blue"><GraduationCap className="mr-1 h-3 w-3" /> Graduates — Class of {year}</Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {p.to}
                                {!p.toExists && <Badge tone="neutral">will be created</Badge>}
                              </span>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>

                {unmapped.length > 0 && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    Skipped (level name not understood): {unmapped.join(", ")}. Rename them like &ldquo;Form 2&rdquo; or &ldquo;Grade 4&rdquo; to include them.
                  </p>
                )}

                <div className="flex flex-col gap-3 rounded-2xl bg-warm-50 p-4 dark:bg-navy-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-navy-700 dark:text-navy-200">
                    <span className="font-semibold">{totalProm}</span> students move up · <span className="font-semibold">{totalGrad}</span> graduate
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-navy-500">Class of</label>
                    <input type="number" value={year} min={1990} max={2100} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900" />
                    {confirming ? (
                      <>
                        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
                        <Button onClick={commit} disabled={busy}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Yes, start the year
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setConfirming(true)} disabled={busy || (totalProm + totalGrad === 0)}>
                        <ArrowUpRight className="h-4 w-4" /> Start new academic year
                      </Button>
                    )}
                  </div>
                </div>
                {confirming && (
                  <p className="text-xs text-amber-600">This moves every active student. You can undo it from the history below.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <ReshufflePanel onDone={load} />
      )}

      {/* history */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-navy-400" /> Run history</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={History} title="No runs yet" description="Promotions and reshuffles appear here with one-click undo." />
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-navy-800 dark:text-navy-100">
                      {r.kind === "promotion" ? <ArrowUpRight className="mr-1 inline h-3.5 w-3.5 text-green-600" /> : <Shuffle className="mr-1 inline h-3.5 w-3.5 text-navy-400" />}
                      {r.summary}
                    </p>
                    <p className="text-xs text-navy-400">
                      {new Date(r.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} · {r.createdByName}
                      {r.undoneAt && <Badge tone="neutral" className="ml-2">undone</Badge>}
                    </p>
                  </div>
                  {!r.undoneAt && (
                    <Button size="sm" variant="secondary" onClick={() => undo(r.id)} disabled={busy}>
                      <Undo2 className="h-3.5 w-3.5" /> Undo
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- reshuffle panel ---------------------------------------------------------
const STRATEGIES = [
  { value: "size", label: "Balance class sizes", hint: "Deal students evenly across streams (A→Z)." },
  { value: "gender", label: "Balance boys & girls", hint: "Alternate boys/girls so each stream is mixed." },
  { value: "alpha", label: "Alphabetical", hint: "Surname A→Z dealt across streams." },
];

function ReshufflePanel({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [level, setLevel] = React.useState("");
  const [strategy, setStrategy] = React.useState("size");
  const [preview, setPreview] = React.useState<ReshuffleData | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes));
  }, []);

  // Levels that have 2+ streams.
  const levels = React.useMemo(() => {
    const byLevel = new Map<string, number>();
    for (const c of classes) byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + 1);
    return [...byLevel.entries()].filter(([, n]) => n >= 2).map(([l]) => l);
  }, [classes]);

  async function run(commit: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/promotion/reshuffle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, strategy, commit }),
      });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message || "Failed", tone: "error" }); return; }
      if (commit) { toast({ title: json.data.summary, tone: "success" }); setPreview(null); onDone(); }
      else setPreview(json.data);
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shuffle className="h-4 w-4 text-navy-400" /> Reshuffle a level&apos;s streams</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {levels.length === 0 ? (
          <EmptyState icon={Shuffle} title="No multi-stream levels" description="Reshuffling needs a level with two or more streams (e.g. Form 2 East and Form 2 West)." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-navy-600 dark:text-navy-300">Level</label>
                <select value={level} onChange={(e) => { setLevel(e.target.value); setPreview(null); }} className="mt-1 block rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                  <option value="">Choose…</option>
                  {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-navy-600 dark:text-navy-300">Strategy</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {STRATEGIES.map((s) => (
                    <button key={s.value} onClick={() => { setStrategy(s.value); setPreview(null); }} title={s.hint}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${strategy === s.value ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "border border-navy-200 text-navy-600 dark:border-navy-700 dark:text-navy-300"}`}>
                      {s.label}
                    </button>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-200 px-3 py-1.5 text-xs text-navy-400 dark:border-navy-700" title="Activates when exams (B.5) provide mean scores.">
                    <Sparkles className="h-3 w-3" /> By performance — coming with Exams
                  </span>
                </div>
              </div>
              <Button variant="secondary" onClick={() => run(false)} disabled={busy || !level}>
                {busy && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Preview
              </Button>
            </div>

            {preview && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {preview.streams.map((st) => (
                    <div key={st.classId} className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{st.label}</p>
                        <Badge tone="neutral">{st.count} · {st.boys}B/{st.girls}G</Badge>
                      </div>
                      <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                        {st.students.map((s) => (
                          <li key={s.id} className={s.moved ? "font-medium text-green-700 dark:text-green-400" : "text-navy-500 dark:text-navy-400"}>
                            {s.name} {s.moved && "← moves here"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-warm-50 p-4 dark:bg-navy-800">
                  <p className="text-sm text-navy-700 dark:text-navy-200">
                    <span className="font-semibold">{preview.movedCount}</span> of {preview.total} students change stream
                  </p>
                  <Button onClick={() => run(true)} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />} Apply reshuffle
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
