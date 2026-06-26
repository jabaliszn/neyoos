"use client";

import * as React from "react";
import { Users, ShieldCheck, Check, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface Owner { id: string; fullName: string; email: string | null; role: string; secondaryRole: string | null }
interface PendingReq { id: string; action: string; summary: string; requestedByName: string; createdAt: string }
interface Board {
  owners: Owner[];
  ownerCount: number;
  requireJointOwnerApproval: boolean;
  jointActive: boolean;
  canManage: boolean;
  pending: PendingReq[];
}

export function OwnersManager() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<Board | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/owner-approvals");
      const json = await res.json();
      if (json.ok) setBoard(json.data);
    } catch { /* ignore */ }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function togglePolicy(enabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/owner-approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPolicy", enabled }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: enabled ? "Joint approval ON" : "Joint approval OFF", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Couldn't update", tone: "error" });
    } finally { setBusy(false); }
  }

  async function decide(id: string, approve: boolean) {
    const res = await fetch("/api/owner-approvals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decide", requestId: id, approve }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: approve ? "Approved" : "Rejected", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Couldn't decide", tone: "error" });
  }

  if (!board) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
      {/* Owners list */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-green-600" /> School owners ({board.ownerCount})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {board.owners.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-navy-900 dark:text-navy-50">{o.fullName}</p>
                  <p className="text-xs text-navy-400">{o.email}</p>
                </div>
                <Badge tone="green">Owner{o.secondaryRole === "SCHOOL_OWNER" && o.role !== "SCHOOL_OWNER" ? " (secondary)" : ""}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-navy-400">
            Add more owners by setting a staff member&apos;s role (or secondary role) to <strong>School Owner</strong> in Staff / HR.
          </p>
        </CardContent>
      </Card>

      {/* Joint approval policy */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-navy-500" /> Joint approval (dual control)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy-600 dark:text-navy-300">
            When ON and the school has 2+ owners, critical actions need a <strong>second owner&apos;s</strong> approval. The initiator can never approve their own request.
          </p>
          {board.canManage ? (
            <div className="flex items-center gap-3">
              <Button onClick={() => togglePolicy(!board.requireJointOwnerApproval)} disabled={busy} variant={board.requireJointOwnerApproval ? "secondary" : "primary"}>
                {board.requireJointOwnerApproval ? "Turn OFF joint approval" : "Turn ON joint approval"}
              </Button>
              <Badge tone={board.jointActive ? "green" : board.requireJointOwnerApproval ? "amber" : "neutral"}>
                {board.jointActive ? "Active" : board.requireJointOwnerApproval ? "On (needs 2+ owners)" : "Off"}
              </Badge>
            </div>
          ) : (
            <p className="text-xs text-navy-400">Only a School Owner can change this policy.</p>
          )}
        </CardContent>
      </Card>

      {/* Pending joint-approval requests */}
      {board.canManage && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-600" /> Pending joint approvals</CardTitle></CardHeader>
          <CardContent>
            {board.pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy-400">No pending owner approvals.</p>
            ) : (
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {board.pending.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{r.summary}</p>
                      <p className="text-xs text-navy-500"><Badge tone="neutral">{r.action.replaceAll("_", " ").toLowerCase()}</Badge> · requested by {r.requestedByName}</p>
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
