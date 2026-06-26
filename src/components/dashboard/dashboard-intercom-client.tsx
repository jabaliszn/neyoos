"use client";

import * as React from "react";
import { Phone, PhoneOff, Mic, MicOff, Sparkles, HelpCircle, UserCheck, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type StaffTarget = { id: string; name: string; role: string; online: boolean };
type CallRow = {
  id: string;
  callerId: string;
  callerName: string;
  targetId: string;
  targetName: string;
  status: "RINGING" | "ACCEPTED" | "DECLINED" | "ENDED" | "MISSED" | "QUEUED";
  acceptedAt: string | null;
  createdAt: string;
};

export function DashboardIntercomClient() {
  const { toast } = useToast();
  const [directory, setDirectory] = React.useState<StaffTarget[]>([]);
  const [activeCalls, setActiveCalls] = React.useState<CallRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);

  const activeCall = activeCalls[0] ?? null;
  const connected = activeCall?.status === "ACCEPTED";
  const ringing = activeCall?.status === "RINGING";
  const queued = activeCall?.status === "QUEUED";

  function raiseLiveActivity(title: string, body: string) {
    window.dispatchEvent(new CustomEvent("neyo:live-activity", {
      detail: { title, body, category: "message", href: "/dashboard" },
    }));
  }

  async function loadBoard(silent = false) {
    if (!silent) setBusy(true);
    try {
      const res = await fetch("/api/intercom");
      const json = await res.json();
      if (json.ok) {
        setDirectory(json.data.directory);
        setActiveCalls(json.data.activeCalls);
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  React.useEffect(() => { loadBoard(); }, []);
  React.useEffect(() => {
    const t = setInterval(() => loadBoard(true), 3000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!connected || !activeCall?.acceptedAt) {
      setCallDuration(0);
      return;
    }
    const tick = () => setCallDuration(Math.max(0, Math.floor((Date.now() - new Date(activeCall.acceptedAt!).getTime()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [connected, activeCall?.acceptedAt]);

  function playRingtone() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(480, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  async function post(body: unknown) {
    const res = await fetch("/api/intercom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message || "Intercom action failed.");
    await loadBoard(true);
    return json.data as CallRow;
  }

  async function startCall(target: StaffTarget) {
    if (!target.online) {
      toast({ title: "Staff member offline", description: `${target.name} is not online right now.`, tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const call = await post({ action: "start", targetId: target.id });
      playRingtone();
      raiseLiveActivity(call.status === "QUEUED" ? "Call queued" : `Calling ${target.name}`, call.status === "QUEUED" ? "They are busy. NEYO will notify you when to call back." : "Waiting for them to accept the call");
      toast({ title: call.status === "QUEUED" ? "Call queued" : "Call request sent", description: call.status === "QUEUED" ? `${target.name} is busy. You will be notified when to call back.` : `Waiting for ${target.name} to accept.`, tone: "info" });
      setActiveCalls([call]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not start call", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function acceptCall(call: CallRow) {
    setBusy(true);
    try {
      const accepted = await post({ action: "accept", callId: call.id });
      setActiveCalls([accepted]);
      raiseLiveActivity("Call accepted", `Connected with ${call.callerName}`);
      toast({ title: "Call connected", description: "The other person accepted the call.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not accept call", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function endOrDecline(action: "decline" | "end", call: CallRow) {
    setBusy(true);
    try {
      await post({ action, callId: call.id });
      raiseLiveActivity(action === "end" ? "Call ended" : "Call declined", "The school intercom call is no longer active");
      setActiveCalls([]);
      setIsMuted(false);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not update call", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const currentUserIsTarget = activeCall && directory.every((d) => d.id !== activeCall.targetId);

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-5 w-5 text-green-600 animate-pulse" />
          NEYO Intercom
        </CardTitle>
        <p className="text-xs text-navy-400">
          Call online contacts. The timer starts only after the other person accepts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        {!activeCall ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Call directory</p>
              <button onClick={() => loadBoard()} className="text-[10px] font-bold text-green-700">Refresh</button>
            </div>
            <div className="space-y-2">
              {directory.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl border border-navy-50 bg-white dark:border-navy-800 dark:bg-navy-950">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.online ? "bg-green-500 animate-pulse" : "bg-navy-300"}`} />
                      <span className="font-bold text-xs text-navy-800 dark:text-white">{s.name}</span>
                    </div>
                    <span className="block text-[10px] text-navy-400 font-medium pl-4">{s.role.replace(/_/g, " ")} · {s.online ? "Online" : "Offline"}</span>
                  </div>
                  <Button size="sm" variant={s.online ? "secondary" : "ghost"} disabled={!s.online || busy} onClick={() => startCall(s)} className="h-8 text-xs font-semibold">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />} Call
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-green-200 bg-green-50/20 p-5 text-center space-y-4 animate-fade-in flex-1 flex flex-col justify-center">
            <div>
              <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                {queued ? "Queued — waiting" : ringing ? "Waiting for acceptance" : "Call active"}
              </p>
              <h4 className="text-base font-extrabold text-navy-950 dark:text-white mt-2">
                {currentUserIsTarget ? activeCall.callerName : activeCall.targetName}
              </h4>
              <p className="text-[10px] text-navy-400 mt-0.5">
                {queued ? "They are busy. NEYO will notify you when they are free." : ringing ? "The other person must accept before the call timer starts." : `Accepted at ${new Date(activeCall.acceptedAt!).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>

            {connected && (
              <div className="flex justify-center items-center gap-1 h-8">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="w-1 rounded-full bg-green-600 animate-[bounce_0.8s_infinite_alternate]" style={{ height: `${(i % 3) * 6 + 10}px`, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-lg font-mono font-bold text-navy-900 dark:text-white">
                {connected ? formatTime(callDuration) : queued ? "Queued" : "Not connected yet"}
              </p>
              <p className="text-[9px] text-navy-400">Connected in the system</p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              {ringing && currentUserIsTarget && (
                <Button size="sm" onClick={() => acceptCall(activeCall)} disabled={busy} className="h-9 px-4 text-xs rounded-full">
                  <UserCheck className="h-4 w-4" /> Accept
                </Button>
              )}
              {connected && (
                <Button variant="secondary" size="sm" onClick={() => setIsMuted(!isMuted)} className="h-9 w-9 p-0 rounded-full flex items-center justify-center">
                  {isMuted ? <MicOff className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => endOrDecline(ringing && currentUserIsTarget ? "decline" : "end", activeCall)} disabled={busy} className="h-9 px-4 text-xs font-bold rounded-full flex items-center gap-1.5">
                {ringing && currentUserIsTarget ? <X className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />} {ringing && currentUserIsTarget ? "Decline" : "End"}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-navy-50 p-2.5 bg-navy-50/20 text-[10px] text-navy-500 flex items-start gap-1.5 dark:border-navy-800">
          <HelpCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
          <span>
            A contact must be online and must accept before the call timer starts. If they are busy, NEYO queues your request and notifies you when to call back.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
