"use client";

/**
 * B.14 Communication UI.
 * Compose: pick audience (school / class / role) -> channel -> message ->
 * ALWAYS preview first (recipients + KES cost + quota state) -> confirm send.
 * History: the send ledger with delivery counts.
 * One SMS per FAMILY (deduped by guardian phone) — shown in the helper text.
 */
import * as React from "react";
import {
  Megaphone, AlertCircle, Loader2, Send, Users, Smartphone, Bell,
  CheckCircle2, History, Wallet,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface Audiences {
  teacherScoped: boolean;
  requiresApproval?: boolean;
  schoolFamilies: number;
  classes: { id: string; label: string; families: number }[];
  roles: { role: string; users: number }[];
}
interface HistoryRow {
  id: string; audienceLabel: string; channel: string; body: string;
  recipientCount: number; sentCount: number; skippedCount: number;
  costKes: number; senderName: string; createdAt: string;
}
interface Preview { allowed: boolean; recipientCount: number; audienceLabel: string; costKes: number; message?: string }
interface ApprovalRow {
  id: string;
  audienceLabel: string;
  channel: string;
  body: string;
  recipientCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByName: string;
  decidedByName?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

const kes = (n: number) => `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export function CommsClient() {
  const { toast } = useToast();
  const [audiences, setAudiences] = React.useState<Audiences | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[] | null>(null);
  const [approvals, setApprovals] = React.useState<ApprovalRow[]>([]);
  const [error, setError] = React.useState(false);

  const [audienceType, setAudienceType] = React.useState<"SCHOOL_GUARDIANS" | "CLASS_GUARDIANS" | "ROLE">("SCHOOL_GUARDIANS");
  const [classId, setClassId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [channel, setChannel] = React.useState<"sms" | "in_app">("sms");
  const [body, setBody] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/comms");
      const json = await res.json();
      if (json.ok) {
        setAudiences(json.data.audiences);
        setHistory(json.data.history);
        setApprovals(json.data.approvals ?? []);
        if (json.data.audiences.teacherScoped) { setAudienceType("CLASS_GUARDIANS"); setChannel("in_app"); }
        if (json.data.audiences.classes.length) setClassId((p: string) => p || json.data.audiences.classes[0].id);
        if (json.data.audiences.roles.length) setRole((p: string) => p || json.data.audiences.roles[0].role);
      } else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Any change invalidates the preview — must re-check before sending.
  React.useEffect(() => { setPreview(null); }, [audienceType, classId, role, channel, body]);
  React.useEffect(() => { if (audiences?.teacherScoped && channel !== "in_app") setChannel("in_app"); }, [audiences?.teacherScoped, channel]);

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/comms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audiences?.teacherScoped && !dryRun ? {
          action: "request_teacher_approval",
          classId,
          channel: "in_app",
          body,
        } : {
          audienceType,
          classId: audienceType === "CLASS_GUARDIANS" ? classId : undefined,
          role: audienceType === "ROLE" ? role : undefined,
          channel, body, dryRun,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Failed", tone: "error" });
        return;
      }
      if (dryRun) {
        setPreview(json.data);
        if (json.data.allowed === false) toast({ title: json.data.message || "Quota exceeded", tone: "error" });
      } else {
        if (audiences?.teacherScoped) {
          toast({ title: "Sent for approval", description: "A Principal or Deputy will approve it before parents receive it.", tone: "success" });
        } else {
          toast({ title: `Sent to ${json.data.sent} of ${json.data.recipientCount} — ${json.data.skipped} skipped`, tone: "success" });
        }
        setBody(""); setPreview(null); load();
      }
    } finally { setBusy(false); }
  }

  async function decideApproval(requestId: string, action: "approve_teacher_message" | "reject_teacher_message") {
    setBusy(true);
    try {
      const res = await fetch("/api/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not decide this request", tone: "error" });
        return;
      }
      toast({ title: action === "approve_teacher_message" ? "Approved and sent" : "Rejected", tone: action === "approve_teacher_message" ? "success" : "info" });
      load();
    } finally { setBusy(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (audiences === null) return <div className="space-y-3"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>;

  const segments = Math.max(1, Math.ceil(body.length / 160));
  const select = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

  const audienceBtn = (key: typeof audienceType, label: string, sub: string) => (
    <button
      onClick={() => setAudienceType(key)}
      className={`flex-1 rounded-2xl border px-4 py-3 text-left transition-colors duration-200 ease-apple ${
        audienceType === key
          ? "border-green-600 bg-green-50 dark:bg-green-900/20"
          : "border-navy-100 bg-white hover:bg-warm-50 dark:border-navy-800 dark:bg-navy-900"
      }`}
    >
      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{label}</p>
      <p className="text-xs text-navy-400">{sub}</p>
    </button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Compose */}
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-green-600" /> New message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Who gets it?</Label>
            {audiences.teacherScoped ? (
              <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">
                You can prepare an <span className="font-medium">in-app</span> message for parents of your own classes. It is sent only after Principal or Deputy approval. Teachers cannot send SMS.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                {audienceBtn("SCHOOL_GUARDIANS", "Whole school", `${audiences.schoolFamilies} families`)}
                {audienceBtn("CLASS_GUARDIANS", "One class", "parents of a class")}
                {audienceBtn("ROLE", "Staff role", "e.g. all teachers")}
              </div>
            )}
          </div>

          {audienceType === "CLASS_GUARDIANS" && (
            <div>
              <Label>Class</Label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={select}>
                {audiences.classes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.families} famil{c.families === 1 ? "y" : "ies"}</option>)}
              </select>
            </div>
          )}
          {audienceType === "ROLE" && (
            <div>
              <Label>Role</Label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={select}>
                {audiences.roles.map((r) => <option key={r.role} value={r.role}>{r.role.replace(/_/g, " ")} — {r.users} user{r.users === 1 ? "" : "s"}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label>Channel</Label>
            <div className="flex gap-2">
              {!audiences.teacherScoped && (
                <button onClick={() => setChannel("sms")} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${channel === "sms" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "border border-navy-100 bg-white text-navy-600 dark:border-navy-800 dark:bg-navy-900 dark:text-navy-300"}`}>
                  <Smartphone className="h-3.5 w-3.5" /> SMS
                </button>
              )}
              <button onClick={() => setChannel("in_app")} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${channel === "in_app" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "border border-navy-100 bg-white text-navy-600 dark:border-navy-800 dark:bg-navy-900 dark:text-navy-300"}`}>
                <Bell className="h-3.5 w-3.5" /> In-app
              </button>
            </div>
            <p className="mt-1 text-xs text-navy-400">
              {channel === "sms"
                ? "One SMS per family — siblings share a guardian, so you pay once."
                : "Free — lands in the NEYO inbox of recipients with accounts."}
            </p>
          </div>

          <div>
            <Label>Message</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={480}
              placeholder="e.g. School closes for half-term on Friday 19th June at noon. Buses leave 1pm."
              className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900"
            />
            <p className="text-right text-xs text-navy-400">{body.length}/480 · {segments} SMS segment{segments > 1 ? "s" : ""}</p>
          </div>

          {/* Preview / send — preview is MANDATORY before send */}
          {preview ? (
            <div className={`space-y-2 rounded-2xl border p-4 ${preview.allowed === false ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20" : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"}`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-navy-50">
                <Users className="h-4 w-4" /> {preview.recipientCount} recipient{preview.recipientCount === 1 ? "" : "s"} — {preview.audienceLabel}
              </p>
              {channel === "sms" && (
                <p className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
                  <Wallet className="h-4 w-4" /> Estimated cost: <span className="font-semibold">{kes(preview.costKes * segments)}</span> ({segments} segment{segments > 1 ? "s" : ""} × {preview.recipientCount})
                </p>
              )}
              {preview.message && <p className="text-xs text-amber-700 dark:text-amber-300">{preview.message}</p>}
              {preview.allowed !== false ? (
                <Button onClick={() => run(false)} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {audiences.teacherScoped ? `Request approval for ${preview.recipientCount}` : `Confirm & send to ${preview.recipientCount}`}
                </Button>
              ) : (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Sending blocked by your SMS quota — top up on the Billing page.</p>
              )}
            </div>
          ) : (
            <Button onClick={() => run(true)} disabled={busy || body.trim().length < 5} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Check recipients &amp; cost
            </Button>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-navy-400" /> Sent messages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {approvals.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-900/20">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Teacher message approvals</p>
              <ul className="space-y-2">
                {approvals.slice(0, 6).map((a) => (
                  <li key={a.id} className="rounded-xl bg-white/70 p-2.5 text-xs dark:bg-navy-900/70">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-navy-900 dark:text-white">{a.audienceLabel}</span>
                      <Badge tone={a.status === "PENDING" ? "amber" : a.status === "APPROVED" ? "green" : "red"}>{a.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-navy-500 dark:text-navy-400">{a.body}</p>
                    <p className="mt-1 text-navy-400">{a.recipientCount} recipients · by {a.requestedByName}</p>
                    {a.status === "PENDING" && !audiences.teacherScoped && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => decideApproval(a.id, "approve_teacher_message")} disabled={busy} className="rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold text-white">Approve & send</button>
                        <button onClick={() => decideApproval(a.id, "reject_teacher_message")} disabled={busy} className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-700">Reject</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history === null ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : history.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nothing sent yet" description="Your bulk messages and their delivery counts appear here." />
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {history.map((h) => (
                <li key={h.id} className="space-y-1 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-navy-900 dark:text-navy-50">{h.audienceLabel}</p>
                    <Badge tone={h.channel === "sms" ? "green" : "blue"}>{h.channel === "sms" ? "SMS" : "In-app"}</Badge>
                  </div>
                  <p className="line-clamp-2 text-xs text-navy-500 dark:text-navy-400">{h.body}</p>
                  <p className="text-xs text-navy-400">
                    {h.sentCount}/{h.recipientCount} delivered{h.skippedCount ? ` · ${h.skippedCount} skipped` : ""}
                    {h.costKes > 0 ? ` · ${kes(h.costKes)}` : ""} · by {h.senderName} · {new Date(h.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}
