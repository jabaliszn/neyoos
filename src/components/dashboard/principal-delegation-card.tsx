"use client";

import * as React from "react";
import { ClipboardCheck, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DELEGATION_CATEGORIES } from "@/lib/validations/delegation";

type Teacher = { id: string; fullName: string; role: string; email: string | null };
type Task = {
  id: string;
  title: string;
  details: string | null;
  category: string;
  categoryLabel: string;
  assignedToName: string;
  assignedByName: string;
  dueDate: string | null;
  status: string;
  isMine: boolean;
};
type Board = { canAssign: boolean; teachers: Teacher[]; tasks: Task[] };

function categoryLabel(category: string) {
  return category.replaceAll("_", " ").toLowerCase();
}

export function PrincipalDelegationCard() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<Board | null>(null);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", details: "", category: "GENERAL", assignedToId: "", dueDate: "" });

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/delegations");
      const json = await res.json();
      if (json.ok) setBoard(json.data);
      else setError(true);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function assign() {
    setBusy(true);
    try {
      const res = await fetch("/api/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Task assigned to teacher", tone: "success" });
        setForm({ title: "", details: "", category: "GENERAL", assignedToId: "", dueDate: "" });
        load();
      } else {
        toast({ title: json.error?.message || "Could not assign task", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "complete" | "cancel", taskId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskId }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: action === "complete" ? "Task marked done" : "Task cancelled", tone: "success" });
        load();
      } else {
        toast({ title: json.error?.message || "Could not update task", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-red-700 dark:text-red-300">
          <span>Could not load delegated tasks.</span>
          <button onClick={load} className="font-semibold underline">Retry</button>
        </CardContent>
      </Card>
    );
  }
  if (!board) return <Skeleton className="h-48 rounded-3xl" />;
  if (!board.canAssign && board.tasks.length === 0) return null;

  const openTasks = board.tasks.filter((t) => t.status === "OPEN");
  const recentDone = board.tasks.filter((t) => t.status !== "OPEN").slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="inline-flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
            Principal delegation
          </span>
          <Badge tone={openTasks.length > 0 ? "amber" : "green"}>{openTasks.length} open</Badge>
        </CardTitle>
        <p className="text-xs text-navy-400">
          Non-sensitive follow-up tasks for teachers. Teachers see their assigned work here and mark it done.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {board.canAssign && (
          <div className="rounded-3xl border border-navy-100 bg-white/55 p-4 dark:border-navy-800 dark:bg-navy-900/50">
            <p className="mb-3 text-sm font-semibold text-navy-900 dark:text-navy-50">Assign a teacher task</p>
            <div className="space-y-3">
              <div>
                <Label>Teacher</Label>
                <select
                  value={form.assignedToId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800"
                >
                  <option value="">Choose teacher…</option>
                  {board.teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.fullName} · {t.role.replaceAll("_", " ").toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Task</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Confirm Form 2 East trip consent slips" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Category</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800"
                  >
                    {DELEGATION_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Details</Label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800"
                  placeholder="Keep it operational and non-sensitive."
                />
              </div>
              <Button onClick={assign} disabled={busy || form.title.trim().length < 3 || !form.assignedToId} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Assign task
              </Button>
            </div>
          </div>
        )}

        <div className={board.canAssign ? "space-y-3" : "lg:col-span-2 space-y-3"}>
          <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
            {board.canAssign ? "Open delegated tasks" : "My assigned tasks"}
          </p>
          {openTasks.length === 0 ? (
            <div className="rounded-3xl border border-green-100 bg-green-500/5 p-4 text-sm text-green-700 dark:border-green-900/30 dark:text-green-300">
              No open delegated tasks.
            </div>
          ) : (
            <ul className="space-y-2">
              {openTasks.slice(0, 8).map((task) => (
                <li key={task.id} className="rounded-3xl border border-navy-100 bg-white/55 p-3 dark:border-navy-800 dark:bg-navy-900/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{task.title}</p>
                      <p className="mt-0.5 text-[11px] text-navy-400">
                        {task.categoryLabel} · to {task.assignedToName} · by {task.assignedByName}{task.dueDate ? ` · due ${task.dueDate}` : ""}
                      </p>
                      {task.details && <p className="mt-1 text-xs text-navy-500 dark:text-navy-300">{task.details}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {(task.isMine || board.canAssign) && (
                        <Button size="sm" variant="secondary" onClick={() => act("complete", task.id)} disabled={busy}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done
                        </Button>
                      )}
                      {board.canAssign && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act("cancel", task.id)} disabled={busy}>
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {recentDone.length > 0 && (
            <div className="rounded-3xl border border-navy-100 bg-white/35 p-3 text-xs text-navy-500 dark:border-navy-800 dark:bg-navy-900/35 dark:text-navy-400">
              Recent closed: {recentDone.map((t) => t.title).join(" · ")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
