"use client";

import * as React from "react";
import { Clock, Loader2, Mic, MicOff, Phone, PhoneOff, ShieldCheck, Users, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface VoiceRoom {
  id: string;
  roomKey: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  mode: "DISAPPEARING";
  createdByName: string;
  expiresAt: string;
}

interface VoiceParticipant {
  id: string;
  userId: string;
  userName: string;
  role: string;
  peerId: string;
  joinedAt: string;
  lastSeenAt: string;
  leftAt?: string | null;
}

interface VoiceSignal {
  id: string;
  fromPeerId: string;
  toPeerId?: string | null;
  type: "join" | "leave" | "offer" | "answer" | "ice" | "control";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ApiRoomPayload {
  room: VoiceRoom | null;
  participants: VoiceParticipant[];
  signals?: VoiceSignal[];
}

function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init)
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error?.message || "Request failed");
      return json.data as T;
    });
}

function newPeerId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `peer_${random}_${Date.now()}`;
}

function secondsLeft(expiresAt?: string | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function ClassVoiceRoom({
  conversationId,
  conversationTitle,
  className,
}: {
  conversationId: string;
  conversationTitle?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [peerId] = React.useState(() => newPeerId());
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [room, setRoom] = React.useState<VoiceRoom | null>(null);
  const [participants, setParticipants] = React.useState<VoiceParticipant[]>([]);
  const [joined, setJoined] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState(0);
  const [remoteStreams, setRemoteStreams] = React.useState<Record<string, MediaStream>>({});
  const [iceServers, setIceServers] = React.useState<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);

  const localStreamRef = React.useRef<MediaStream | null>(null);
  const pcsRef = React.useRef<Record<string, RTCPeerConnection>>({});
  const seenSignalsRef = React.useRef<Set<string>>(new Set());
  const lastSignalIdRef = React.useRef<string | null>(null);

  const clearConnections = React.useCallback(() => {
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setRemoteStreams({});
    setJoined(false);
    setMuted(false);
  }, []);

  React.useEffect(() => () => clearConnections(), [clearConnections]);

  React.useEffect(() => {
    fetch("/api/webrtc/ice").then((r) => r.json()).then((j) => {
      if (j.ok && Array.isArray(j.data?.iceServers) && j.data.iceServers.length) setIceServers(j.data.iceServers);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    jsonFetch<ApiRoomPayload>(`/api/class-voice?conversationId=${encodeURIComponent(conversationId)}`)
      .then((data) => {
        if (!alive) return;
        setRoom(data.room);
        setParticipants(data.participants ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setRoom(null);
        setParticipants([]);
        setError(err.message.includes("Class group") ? null : err.message);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [conversationId]);

  React.useEffect(() => {
    const timer = setInterval(() => setRemaining(secondsLeft(room?.expiresAt)), 1000);
    setRemaining(secondsLeft(room?.expiresAt));
    return () => clearInterval(timer);
  }, [room?.expiresAt]);

  async function ensureMic() {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot open the microphone. Try Chrome, Edge, or Safari on a recent phone/laptop.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }

  async function postSignal(signal: Omit<VoiceSignal, "id" | "createdAt" | "payload"> & { payload: Record<string, unknown> }) {
    if (!room) return;
    await jsonFetch<{ id: string }>("/api/class-voice/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomKey: room.roomKey, ...signal }),
    });
  }

  function ensurePeerConnection(remotePeerId: string) {
    if (pcsRef.current[remotePeerId]) return pcsRef.current[remotePeerId];
    const pc = new RTCPeerConnection({ iceServers });
    pcsRef.current[remotePeerId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void postSignal({
          fromPeerId: peerId,
          toPeerId: remotePeerId,
          type: "ice",
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams((prev) => ({ ...prev, [remotePeerId]: stream }));
      }
    };

    return pc;
  }

  async function connectToPeer(remotePeerId: string) {
    await ensureMic();
    const pc = ensurePeerConnection(remotePeerId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await postSignal({
      fromPeerId: peerId,
      toPeerId: remotePeerId,
      type: "offer",
      payload: { sdp: offer.sdp, type: offer.type },
    });
  }

  async function handleSignal(signal: VoiceSignal) {
    if (seenSignalsRef.current.has(signal.id)) return;
    seenSignalsRef.current.add(signal.id);

    if (signal.type === "join" && signal.fromPeerId !== peerId) {
      await connectToPeer(signal.fromPeerId);
      return;
    }

    if (signal.type === "offer") {
      await ensureMic();
      const pc = ensurePeerConnection(signal.fromPeerId);
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: "offer",
        sdp: String(signal.payload.sdp || ""),
      }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await postSignal({
        fromPeerId: peerId,
        toPeerId: signal.fromPeerId,
        type: "answer",
        payload: { sdp: answer.sdp, type: answer.type },
      });
      return;
    }

    if (signal.type === "answer") {
      const pc = pcsRef.current[signal.fromPeerId];
      if (pc && signal.payload.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: String(signal.payload.sdp) }));
      }
      return;
    }

    if (signal.type === "ice") {
      const pc = pcsRef.current[signal.fromPeerId];
      const candidate = signal.payload.candidate as RTCIceCandidateInit | undefined;
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      return;
    }

    if (signal.type === "control" && signal.payload.status === "ENDED") {
      clearConnections();
      setRoom((prev) => prev ? { ...prev, status: "ENDED" } : prev);
    }
  }

  async function refreshSignals() {
    if (!room || !joined) return;
    const qs = new URLSearchParams({ roomKey: room.roomKey, peerId });
    if (lastSignalIdRef.current) qs.set("sinceId", lastSignalIdRef.current);
    const data = await jsonFetch<ApiRoomPayload>(`/api/class-voice/signal?${qs.toString()}`);
    setParticipants(data.participants ?? []);
    const signals = data.signals ?? [];
    for (const signal of signals) await handleSignal(signal);
    if (signals.length) lastSignalIdRef.current = signals[signals.length - 1].id;
  }

  React.useEffect(() => {
    if (!joined || !room) return;
    const timer = setInterval(() => void refreshSignals().catch((err) => setError(err.message)), 1800);
    return () => clearInterval(timer);
  }, [joined, room?.roomKey]);

  async function startOrJoin(action: "start" | "join") {
    setBusy(true);
    setError(null);
    try {
      await ensureMic();
      const payload = action === "start"
        ? { action, conversationId, peerId }
        : { action, roomKey: room?.roomKey, peerId };
      const data = await jsonFetch<ApiRoomPayload>("/api/class-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRoom(data.room);
      setParticipants(data.participants ?? []);
      setJoined(true);
      toast({
        title: action === "start" ? "Class voice room started" : "Joined class voice room",
        description: "This room disappears shortly. No class voice is saved by NEYO.",
        tone: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open class voice.");
      toast({ title: "Class voice unavailable", description: err instanceof Error ? err.message : "Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function endRoom() {
    if (!room) return;
    setBusy(true);
    try {
      await jsonFetch("/api/class-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", roomKey: room.roomKey }),
      });
      clearConnections();
      setRoom({ ...room, status: "ENDED" });
      toast({ title: "Class voice room ended", tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end class voice room.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  const active = room?.status === "ACTIVE" && remaining > 0;
  const remoteCount = Object.keys(remoteStreams).length;

  if (loading) {
    return (
      <Card className={cn("border-green-200/70 bg-green-50/50 p-4 dark:border-green-900/40 dark:bg-green-950/20", className)}>
        <div className="flex items-center gap-3 text-sm text-navy-600 dark:text-navy-300">
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
          Checking class voice room…
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-green-200/70 bg-white/80 dark:border-green-900/40 dark:bg-navy-900/80", className)}>
      <div className="border-b border-green-100/70 bg-green-50/70 p-4 dark:border-green-900/40 dark:bg-green-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-green-600 text-white shadow-card">
                <Phone className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-navy-900 dark:text-white">Class voice</h3>
                <p className="text-xs text-navy-600 dark:text-navy-300">
                  {conversationTitle ? `${conversationTitle} · ` : ""}Disappears after 15 minutes.
                </p>
              </div>
              <Badge tone={active ? "green" : "neutral"}>{active ? "Live" : "No active room"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active && (
              <Badge tone="amber" className="gap-1.5">
                <Clock className="h-3 w-3" /> {formatCountdown(remaining)} left
              </Badge>
            )}
            <Badge tone="blue" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Not saved
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-navy-100 bg-white/70 p-3 text-xs text-navy-600 shadow-sm dark:border-navy-800 dark:bg-navy-950/40 dark:text-navy-300">
          No class voice is saved by NEYO. The room uses your microphone only while you are connected, then the room metadata disappears.
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {active ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
              <Users className="h-4 w-4 text-green-600" />
              <span className="font-semibold">{participants.length}</span> participant{participants.length === 1 ? "" : "s"}
              {remoteCount > 0 && (
                <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300">
                  <Volume2 className="h-4 w-4" /> {remoteCount} connected voice stream{remoteCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!joined ? (
                <Button size="sm" onClick={() => startOrJoin("join")} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  Join voice
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={toggleMute}>
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {muted ? "Unmute" : "Mute"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={endRoom} disabled={busy}>
                    <PhoneOff className="h-4 w-4" /> End
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy-600 dark:text-navy-300">
              Start a short class voice room for quick coordination with this class group.
            </p>
            <Button onClick={() => startOrJoin("start")} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Start class voice
            </Button>
          </div>
        )}

        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {participants.map((participant) => (
              <span key={participant.id} className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-950 dark:text-navy-200">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {participant.userName}
              </span>
            ))}
          </div>
        )}

        <div className="hidden">
          {Object.entries(remoteStreams).map(([id, stream]) => (
            <RemoteAudio key={id} stream={stream} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}
