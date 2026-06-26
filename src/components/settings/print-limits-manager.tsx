"use client";

import * as React from "react";
import { Printer, Check, X, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface PendingReq {
  id: string;
  requestedByName: string;
  docKind: string;
  docRef: string | null;
  reason: string | null;
  createdAt: string;
}
interface Board {
  printLimitPerDay: number;
  canManage: boolean;
  pending: PendingReq[];
}

export function PrintLimitsManager() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<Board | null>(null);
  const [error, setError] = React.useState(false);
  const [limitInput, setLimitInput] = React.useState("0");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/print-limits");
      const json = await res.json();
      if (!json.ok) { setError(true); return; }
      setBoard(json.data);
      setLimitInput(String(json.data.printLimitPerDay ?? 0));
    } catch { setError(true); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function saveLimit() {
    setSaving(true);
    try {
      const res = await fetch("/api/print-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_limit", perDay: Number(limitInput) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Print limit updated", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Couldn't update limit", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function decide(id: string, approve: boolean) {
    try {
      const res = await fetch("/api/print-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", requestId: id, approve }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: approve ? "Approved" : "Rejected", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Couldn't decide", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
  }

  if (error) {
    return (
      <Card><CardContent className="flex items-center justify-between">
        <span className="text-sm text-red-600">Couldn&apos;t load printing limits.</span>
        <Button size="sm" variant="secondary" onClick={load}>Retry</Button>
      </CardContent></Card>
    );
  }
  if (!board) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>;
  }

  const limit = board.printLimitPerDay ?? 0;

  return (
    <div className="space-y-6">
      {/* Limit setting */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-green-600" /> Daily print limit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-navy-600 dark:text-navy-300">
            {limit > 0
              ? <>Staff (except leadership, parents and students) can print up to <strong>{limit}</strong> document{limit === 1 ? "" : "s"} per day. Over the limit, they must request approval.</>
              : <>No daily limit is set — staff can print freely. Set a number above 0 to start limiting.</>}
          </p>
          {board.canManage ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-navy-700 dark:text-navy-200">Documents per day (0 = unlimited)</span>
                <input
                  type="number" min={0} max={1000} value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-32 rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
                />
              </label>
              <Button onClick={saveLimit} disabled={saving}>{saving ? "Saving…" : "Save limit"}</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-navy-100 bg-warm-50/60 px-3 py-2 text-xs text-navy-500 dark:border-navy-800 dark:bg-navy-900/40">
              <ShieldCheck className="h-4 w-4" /> Only the Principal, Deputy or Academics HOD can change this.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending requests (privileged only) */}
      {board.canManage && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-600" /> Print approval requests</CardTitle></CardHeader>
          <CardContent>
            {board.pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy-400">No pending print requests.</p>
            ) : (
              <ul className="divide-y divide-navy-100 dark:divide-navy-800">
                {board.pending.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{r.requestedByName}</p>
                      <p className="text-xs text-navy-500">
                        <Badge tone="neutral">{r.docKind}</Badge>{" "}
                        {r.reason ? `· ${r.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => decide(r.id, true)}><Check className="h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => decide(r.id, false)}><X className="h-4 w-4" /> Reject</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
