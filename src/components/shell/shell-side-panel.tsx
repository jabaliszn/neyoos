"use client";

/**
 * Shell V2 — the left-hand side panel, freed up now that the module list
 * moved into the floating bottom bar (founder-requested "NEYO 2.0",
 * 2026-07-04). Founder's own explicit ask: "since now the area remains free
 * ... i would suggest we have a recent activity log there and the neyo
 * intercom" — stacked, Activity on top, Intercom below, each scrolling
 * independently (the founder's own pick between the two layout options
 * offered). Founder's later correction: this panel sits on the LEFT, not
 * the right, and must fill the real available screen height, not a small
 * boxed widget.
 *
 * Reuses the REAL, already-built services directly — never a parallel
 * re-implementation:
 *  - Recent Activity  -> GET /api/activity (tenantActivity() + describeAction(),
 *    reads the real, immutable AuditLog — the exact same source the G.1
 *    Activity Feed component uses on entity detail pages).
 *  - NEYO Intercom    -> GET/POST /api/intercom (the exact same real
 *    presence + call state machine already live on the Dashboard's
 *    DashboardIntercomClient), just re-skinned into a narrower rail.
 */
import * as React from "react";
import { Activity as ActivityIcon, Phone, PhoneOff, Mic, MicOff, UserCheck, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { describeAction } from "@/lib/services/activity.service";
import { cn } from "@/lib/utils";

interface ActivityRow { id: string; action: string; actorName: string | null; createdAt: string; metadata: string | null }
type StaffTarget = { id: string; name: string; role: string; online: boolean };
type CallRow = {
  id: string; callerId: string; callerName: string; targetId: string; targetName: string;
  status: "RINGING" | "ACCEPTED" | "DECLINED" | "ENDED" | "MISSED" | "QUEUED";
  acceptedAt: string | null; createdAt: string;
};

function initials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---- Recent Activity section -----------------------------------------------
function ActivitySection() {
  const [items, setItems] = React.useState<ActivityRow[] | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setError(false);
    try {
      const res = await fetch("/api/activity");
      const json = await res.json();
      if (json.ok) setItems(json.data.items);
      else if (!silent) setError(true);
    } catch {
      if (!silent) setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between px-4 pb-2.5 pt-3.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Recent activity
        </span>
        <span className="text-[10px] font-semibold text-navy-300">Live</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {error && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-5 w-5 text-navy-300" />
            <p className="text-xs text-navy-400">Could not load activity.</p>
            <Button variant="secondary" size="sm" onClick={() => load()}>Retry</Button>
          </div>
        )}
        {!error && items === null && (
          <div className="space-y-2 pt-1">
            {[...Array(5)].map((_, i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" />)}
          </div>
        )}
        {!error && items !== null && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ActivityIcon className="h-6 w-6 text-navy-200" />
            <p className="text-xs text-navy-400">Nothing has happened yet today — actions across the school will appear here as they happen.</p>
          </div>
        )}
        {!error && items !== null && items.length > 0 && (
          <ul className="space-y-0">
            {items.map((row) => (
              <li key={row.id} className="flex gap-2.5 border-b border-dashed border-navy-100 py-2.5 last:border-0 dark:border-navy-800">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-green-100 text-[10.5px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {initials(row.actorName)}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug text-navy-700 dark:text-navy-200">
                    <span className="font-semibold text-navy-900 dark:text-white">{row.actorName ?? "Someone"}</span>{" "}
                    {describeAction(row.action)}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-navy-300">{timeAgo(row.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- NEYO Intercom section (re-skinned from DashboardIntercomClient) ------
function IntercomSection() {
  const { toast } = useToast();
  const [directory, setDirectory] = React.useState<StaffTarget[] | null>(null);
  const [error, setError] = React.useState(false);
  const [activeCalls, setActiveCalls] = React.useState<CallRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);

  const activeCall = activeCalls[0] ?? null;
  const connected = activeCall?.status === "ACCEPTED";
  const ringing = activeCall?.status === "RINGING";
  const queued = activeCall?.status === "QUEUED";

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setError(false);
    try {
      const res = await fetch("/api/intercom");
      const json = await res.json();
      if (json.ok) {
        setDirectory(json.data.directory);
        setActiveCalls(json.data.activeCalls);
      } else if (!silent) setError(true);
    } catch {
      if (!silent) setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const t = setInterval(() => load(true), 3000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    if (!connected || !activeCall?.acceptedAt) { setCallDuration(0); return; }
    const tick = () => setCallDuration(Math.max(0, Math.floor((Date.now() - new Date(activeCall.acceptedAt!).getTime()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [connected, activeCall?.acceptedAt]);

  async function post(body: unknown) {
    const res = await fetch("/api/intercom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message || "Intercom action failed.");
    await load(true);
    return json.data as CallRow;
  }

  async function startCall(target: StaffTarget) {
    if (!target.online) { toast({ title: "Offline", description: `${target.name} is not online right now.`, tone: "error" }); return; }
    setBusy(true);
    try {
      const call = await post({ action: "start", targetId: target.id });
      setActiveCalls([call]);
      toast({ title: call.status === "QUEUED" ? "Call queued" : "Call request sent", tone: "info" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not start call", tone: "error" });
    } finally { setBusy(false); }
  }
  async function acceptCall(call: CallRow) {
    setBusy(true);
    try { setActiveCalls([await post({ action: "accept", callId: call.id })]); }
    catch (err) { toast({ title: err instanceof Error ? err.message : "Could not accept call", tone: "error" }); }
    finally { setBusy(false); }
  }
  async function endOrDecline(action: "decline" | "end", call: CallRow) {
    setBusy(true);
    try { await post({ action, callId: call.id }); setActiveCalls([]); setIsMuted(false); }
    catch (err) { toast({ title: err instanceof Error ? err.message : "Could not update call", tone: "error" }); }
    finally { setBusy(false); }
  }
  function formatTime(secs: number) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const currentUserIsTarget = activeCall && (directory ?? []).every((d) => d.id !== activeCall.targetId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between px-4 pb-2.5 pt-3.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">🦉 NEYO Intercom</span>
        {directory !== null && (
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400">{directory.filter((d) => d.online).length} online</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-5 w-5 text-navy-300" />
            <p className="text-xs text-navy-400">Could not load the intercom.</p>
            <Button variant="secondary" size="sm" onClick={() => load()}>Retry</Button>
          </div>
        )}
        {!error && directory === null && (
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" />)}
          </div>
        )}
        {!error && directory !== null && !activeCall && directory.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Phone className="h-6 w-6 text-navy-200" />
            <p className="text-xs text-navy-400">No one else is set up for the intercom yet.</p>
          </div>
        )}
        {!error && directory !== null && !activeCall && directory.length > 0 && (
          <ul className="space-y-1.5">
            {directory.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 py-1">
                <span className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-navy-100 text-[11px] font-bold text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                  {initials(s.name)}
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-navy-900", s.online ? "bg-green-500" : "bg-navy-300 dark:bg-navy-600")} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-navy-900 dark:text-white">{s.name}</p>
                  <p className="truncate text-[10.5px] text-navy-400">{s.role.replace(/_/g, " ")}</p>
                </div>
                <button
                  onClick={() => startCall(s)}
                  disabled={!s.online || busy}
                  aria-label={`Call ${s.name}`}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-green-50 text-green-600 transition-colors disabled:opacity-40 dark:bg-green-900/20 dark:text-green-400"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {activeCall && (
          <div className="mt-1 rounded-2xl border border-green-200 bg-green-50/40 p-4 text-center dark:border-green-900 dark:bg-green-900/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400">
              {queued ? "Queued" : ringing ? "Waiting" : "Connected"}
            </p>
            <p className="mt-1 text-sm font-bold text-navy-900 dark:text-white">
              {currentUserIsTarget ? activeCall.callerName : activeCall.targetName}
            </p>
            <p className="mt-1 font-mono text-base font-bold text-navy-900 dark:text-white">
              {connected ? formatTime(callDuration) : queued ? "Queued" : "Ringing"}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {ringing && currentUserIsTarget && (
                <Button size="sm" onClick={() => acceptCall(activeCall)} disabled={busy}><UserCheck className="h-4 w-4" /> Accept</Button>
              )}
              {connected && (
                <Button variant="secondary" size="sm" onClick={() => setIsMuted(!isMuted)} className="h-8 w-8 rounded-full p-0">
                  {isMuted ? <MicOff className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => endOrDecline(ringing && currentUserIsTarget ? "decline" : "end", activeCall)} disabled={busy}>
                {ringing && currentUserIsTarget ? <X className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                {ringing && currentUserIsTarget ? "Decline" : "End"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The panel itself — a real, full-height rail (not a small boxed widget),
 * sitting on the LEFT of the content well per the founder's correction.
 */
export function ShellSidePanel() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 flex-col border-r border-navy-200/70 bg-warm-50 shadow-[6px_0_24px_-18px_rgba(28,39,64,0.35)] dark:border-navy-800 dark:bg-navy-900/60 lg:flex">
      <div className="flex min-h-0 flex-1 flex-col">
        <ActivitySection />
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-navy-200/70 dark:border-navy-800">
        <IntercomSection />
      </div>
    </aside>
  );
}
