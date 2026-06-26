"use client";

import * as React from "react";
import { BookOpenCheck, Plus, Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Topic = { id: string; className: string; subjectName: string; topic: string; scopeRef: string | null; deadline: string; status: string; teacherName: string | null; notes: string | null };
type Board = { classes: { id: string; name: string }[]; subjects: { id: string; name: string; code: string }[]; terms: { id: string; label: string; current: boolean }[]; summary: { total: number; covered: number; late: number; inProgress: number; coveragePct: number }; topics: Topic[] };

const tone: Record<string, "green" | "amber" | "red" | "blue" | "neutral"> = { COVERED: "green", IN_PROGRESS: "blue", LATE: "red", PLANNED: "amber" };

export function SyllabusClient() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<Board | null>(null);
  const [classId, setClassId] = React.useState("");
  const [subjectId, setSubjectId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const p = new URLSearchParams();
    if (classId) p.set("classId", classId);
    if (subjectId) p.set("subjectId", subjectId);
    if (status) p.set("status", status);
    const res = await fetch(`/api/syllabus?${p}`);
    const json = await res.json();
    if (json.ok) setBoard(json.data);
  }, [classId, subjectId, status]);
  React.useEffect(() => { load(); }, [load]);

  async function update(id: string, nextStatus: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/syllabus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, status: nextStatus }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Coverage updated", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Could not update", tone: "error" });
    } finally { setBusy(false); }
  }

  if (!board) return <div className="space-y-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Coverage" value={`${board.summary.coveragePct}%`} icon={BookOpenCheck} />
        <Metric label="Topics" value={String(board.summary.total)} icon={Clock} />
        <Metric label="Covered" value={String(board.summary.covered)} icon={CheckCircle2} />
        <Metric label="Late" value={String(board.summary.late)} icon={AlertTriangle} danger={board.summary.late > 0} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Class"><select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 rounded-2xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"><option value="">All classes</option>{board.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Subject"><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-10 rounded-2xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"><option value="">All subjects</option>{board.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-2xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"><option value="">Any</option><option>PLANNED</option><option>IN_PROGRESS</option><option>COVERED</option><option>LATE</option></select></Field>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add scope topic</Button>
        </CardContent>
      </Card>

      {board.topics.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No syllabus scope yet" description="Add the required scope topics for a class and subject, then teachers can mark coverage as they teach." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {board.topics.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-950 dark:text-white">{t.topic}</p>
                    <p className="text-xs text-navy-400">{t.className} · {t.subjectName}{t.scopeRef ? ` · ${t.scopeRef}` : ""}</p>
                  </div>
                  <Badge tone={tone[t.status] ?? "neutral"}>{t.status.toLowerCase().replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-navy-500">Deadline: <strong>{t.deadline}</strong>{t.teacherName ? ` · ${t.teacherName}` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => update(t.id, "IN_PROGRESS")}>In progress</Button>
                  <Button size="sm" disabled={busy} onClick={() => update(t.id, "COVERED")}>Covered</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && <TopicDialog board={board} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function Metric({ label, value, icon: Icon, danger }: { label: string; value: string; icon: any; danger?: boolean }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-[11px] uppercase tracking-wide text-navy-400">{label}</p><p className={"text-2xl font-black " + (danger ? "text-red-600" : "text-navy-950 dark:text-white")}>{value}</p></div><Icon className={"h-5 w-5 " + (danger ? "text-red-500" : "text-green-600")} /></CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }

function TopicDialog({ board, onClose, onDone }: { board: Board; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ classId: board.classes[0]?.id ?? "", subjectId: board.subjects[0]?.id ?? "", termId: board.terms.find((t) => t.current)?.id ?? "", topic: "", scopeRef: "", deadline: "", notes: "" });
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/syllabus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...f }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Syllabus topic added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-base font-semibold text-navy-950 dark:text-white">Add syllabus scope topic</h3>
        <div className="space-y-3">
          <Field label="Class"><select value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })} className="w-full h-10 rounded-2xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900">{board.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Subject"><select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} className="w-full h-10 rounded-2xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900">{board.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Topic"><Input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. Linear equations" /></Field>
          <Field label="Scope reference"><Input value={f.scopeRef} onChange={(e) => setF({ ...f, scopeRef: e.target.value })} placeholder="e.g. KLB Bk 3 Ch. 4" /></Field>
          <Field label="Deadline"><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
          <Button onClick={save} disabled={saving || !f.topic || !f.deadline} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save topic</Button>
        </div>
      </div>
    </div>
  );
}
