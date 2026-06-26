"use client";
import * as React from "react";
import { MonitorPlay, Video, VideoOff, Mic, MicOff, PhoneOff, Users, ScreenShare, Shield, Hand, MessageCircle, Check, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NeyoLogo } from "@/components/brand/neyo-logo";

type RemoteStream = { peerId: string; stream: MediaStream; label: string };

function RemoteVideo({ item }: { item: RemoteStream }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.srcObject = item.stream; }, [item.stream]);
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video ref={ref} autoPlay playsInline className="min-h-[9rem] w-full object-cover" />
      <p className="bg-navy-950 px-2 py-1 text-[10px] font-bold text-white/70">{item.label}</p>
    </div>
  );
}

export function OnlineClassRoomClient({ roomId }: { roomId: string }) {
  const { toast } = useToast();
  const [peerId, setPeerId] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const [role, setRole] = React.useState<"TEACHER" | "STUDENT" | "TV" | null>(null);
  const [micOn, setMicOn] = React.useState(true);
  const [videoOn, setVideoOn] = React.useState(true);
  const [peers, setPeers] = React.useState<any[]>([]);
  const [signals, setSignals] = React.useState<any[]>([]);
  const [remoteStreams, setRemoteStreams] = React.useState<RemoteStream[]>([]);
  const [muteAllStudents, setMuteAllStudents] = React.useState(false);
  const [studentVideoDisabled, setStudentVideoDisabled] = React.useState(false);
  const [recordingAllowed, setRecordingAllowed] = React.useState(false);
  const [screenSharing, setScreenSharing] = React.useState(false);
  const [handText, setHandText] = React.useState("");
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [approvedToSpeak, setApprovedToSpeak] = React.useState(false);
  const [iceServers, setIceServers] = React.useState<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const pcRef = React.useRef<Record<string, RTCPeerConnection>>({});
  const seenSignalsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    setPeerId(`peer_${Math.random().toString(36).slice(2)}_${Date.now()}`);
    fetch("/api/webrtc/ice").then((r) => r.json()).then((j) => {
      if (j.ok && Array.isArray(j.data?.iceServers) && j.data.iceServers.length) setIceServers(j.data.iceServers);
    }).catch(() => {});
  }, []);

  async function join(nextRole?: "TEACHER" | "STUDENT" | "TV") {
    if (!peerId) return;
    const res = await fetch(`/api/online-classes/${roomId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", peerId, ...(nextRole ? { role: nextRole } : {}) }) });
    const json = await res.json();
    if (!json.ok) { toast({ title: json.error?.message || "Could not join room", tone: "error" }); return; }
    const joinedRole = json.data.participant.role as "TEACHER" | "STUDENT" | "TV";
    setPeers(json.data.peers || []);
    setRole(joinedRole);
    setJoined(true);
    if (joinedRole !== "TV" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        toast({ title: "Joined without camera/microphone", description: "Your browser blocked device media. You can still listen, ask questions, or join from another device.", tone: "info" });
      }
    }
    toast({ title: joinedRole === "TV" ? "Classroom TV joined" : "Joined online class room", tone: "success" });
  }

  async function sendSignal(toPeerId: string | null, type: "offer" | "answer" | "ice" | "leave" | "screen-share", payload: unknown) {
    await fetch(`/api/online-classes/${roomId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signal", fromPeerId: peerId, toPeerId, type, payload }) });
  }

  async function createPeerConnection(remotePeerId: string, remoteLabel?: string) {
    if (pcRef.current[remotePeerId]) return pcRef.current[remotePeerId];
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current[remotePeerId] = pc;
    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      setRemoteStreams((old) => old.some((x) => x.peerId === remotePeerId) ? old : [...old, { peerId: remotePeerId, stream, label: remoteLabel || remotePeerId.slice(0, 12) }]);
    };
    pc.onicecandidate = (e) => { if (e.candidate) void sendSignal(remotePeerId, "ice", e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setRemoteStreams((old) => old.filter((x) => x.peerId !== remotePeerId));
      }
    };
    return pc;
  }

  async function callPeer(remotePeerId: string, remoteLabel?: string) {
    const pc = await createPeerConnection(remotePeerId, remoteLabel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(remotePeerId, "offer", offer);
  }

  async function connectAllPeers() {
    for (const p of peers.filter((p) => p.peerId !== peerId)) await callPeer(p.peerId, p.displayName);
  }

  async function updateControls(next: Partial<{ muteAllStudents: boolean; studentVideoDisabled: boolean; recordingAllowed: boolean; screenSharePeerId: string | null }>) {
    const res = await fetch(`/api/online-classes/${roomId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "controls", fromPeerId: peerId, ...next }) });
    const json = await res.json();
    if (!json.ok) { toast({ title: json.error?.message || "Could not update class controls", tone: "error" }); return; }
    setMuteAllStudents(json.data.muteAllStudents);
    setStudentVideoDisabled(json.data.studentVideoDisabled);
    setRecordingAllowed(json.data.recordingAllowed);
  }

  async function enterFullScreen() {
    try {
      await stageRef.current?.requestFullscreen?.();
    } catch {
      toast({ title: "Full screen is not available in this browser.", tone: "error" });
    }
  }

  async function startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) { toast({ title: "Screen sharing is not supported on this device.", tone: "error" }); return; }
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = display.getVideoTracks()[0];
    for (const pc of Object.values(pcRef.current)) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
    }
    setScreenSharing(true);
    await updateControls({ screenSharePeerId: peerId });
    await sendSignal(null, "screen-share", { peerId, active: true });
    screenTrack.onended = async () => {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      for (const pc of Object.values(pcRef.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(cameraTrack);
      }
      setScreenSharing(false);
      await updateControls({ screenSharePeerId: null });
      await sendSignal(null, "screen-share", { peerId, active: false });
    };
  }

  async function leaveRoom() {
    await sendSignal(null, "leave", { peerId });
    Object.values(pcRef.current).forEach((pc) => pc.close());
    pcRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setRemoteStreams([]);
    setJoined(false);
    setRole(null);
  }

  React.useEffect(() => {
    if (!joined) return;
    const t = window.setInterval(async () => {
      const j = await fetch(`/api/online-classes/${roomId}/signal?peerId=${peerId}`).then((r) => r.json()).catch(() => null);
      if (!j?.ok) return;
      setPeers(j.data.peers || []);
      setQuestions(j.data.questions || []);
      for (const sig of j.data.signals || []) {
        if (seenSignalsRef.current.has(sig.id)) continue;
        seenSignalsRef.current.add(sig.id);
        setSignals((s) => [...s.slice(-10), sig]);
        const from = (j.data.peers || []).find((p: any) => p.peerId === sig.fromPeerId);
        if (sig.type === "offer") {
          const pc = await createPeerConnection(sig.fromPeerId, from?.displayName);
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(sig.fromPeerId, "answer", answer);
        } else if (sig.type === "answer" && pcRef.current[sig.fromPeerId]) {
          await pcRef.current[sig.fromPeerId].setRemoteDescription(new RTCSessionDescription(sig.payload));
        } else if (sig.type === "ice" && pcRef.current[sig.fromPeerId]) {
          await pcRef.current[sig.fromPeerId].addIceCandidate(new RTCIceCandidate(sig.payload));
        } else if (sig.type === "control") {
          setMuteAllStudents(Boolean(sig.payload.muteAllStudents));
          setStudentVideoDisabled(Boolean(sig.payload.studentVideoDisabled));
          setRecordingAllowed(Boolean(sig.payload.recordingAllowed));
          if (role === "STUDENT" && sig.payload.approvedSpeakerPeerId === peerId) { setApprovedToSpeak(true); localStreamRef.current?.getAudioTracks().forEach((t) => t.enabled = true); setMicOn(true); }
          if (role === "STUDENT" && sig.payload.muteAllStudents && sig.payload.approvedSpeakerPeerId !== peerId) localStreamRef.current?.getAudioTracks().forEach((t) => t.enabled = false);
          if (role === "STUDENT" && sig.payload.studentVideoDisabled) localStreamRef.current?.getVideoTracks().forEach((t) => t.enabled = false);
        } else if (sig.type === "question-decision") {
          if (sig.payload.approvedSpeakerPeerId === peerId) { setApprovedToSpeak(true); localStreamRef.current?.getAudioTracks().forEach((t) => t.enabled = true); setMicOn(true); toast({ title: "Teacher approved your question — you can speak now", tone: "success" }); }
        } else if (sig.type === "screen-share") {
          setSignals((s) => [...s.slice(-10), { ...sig, type: sig.payload.active ? "screen-share-on" : "screen-share-off" }]);
        } else if (sig.type === "leave") {
          pcRef.current[sig.fromPeerId]?.close();
          delete pcRef.current[sig.fromPeerId];
          setRemoteStreams((old) => old.filter((x) => x.peerId !== sig.fromPeerId));
        }
      }
    }, 1500);
    return () => window.clearInterval(t);
  }, [joined, peerId, roomId]);

  React.useEffect(() => () => { Object.values(pcRef.current).forEach((pc) => pc.close()); localStreamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  function toggleMic() { if (role === "STUDENT" && muteAllStudents && !approvedToSpeak) return; localStreamRef.current?.getAudioTracks().forEach((t) => t.enabled = !micOn); setMicOn((v) => !v); }
  function toggleVideo() { if (role === "STUDENT" && studentVideoDisabled) return; localStreamRef.current?.getVideoTracks().forEach((t) => t.enabled = !videoOn); setVideoOn((v) => !v); }

  async function raiseHand() {
    if (!handText.trim()) return;
    const res = await fetch(`/api/online-classes/${roomId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "question", peerId, question: handText }) });
    const json = await res.json();
    if (!json.ok) { toast({ title: json.error?.message || "Could not raise hand", tone: "error" }); return; }
    setHandText("");
    setQuestions((q) => [json.data, ...q]);
    toast({ title: "Hand raised — waiting for teacher", tone: "success" });
  }

  async function decideQuestion(questionId: string, status: "APPROVED" | "DISMISSED") {
    const res = await fetch(`/api/online-classes/${roomId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "questionDecision", fromPeerId: peerId, questionId, status }) });
    const json = await res.json();
    if (!json.ok) { toast({ title: json.error?.message || "Could not update question", tone: "error" }); return; }
    setQuestions((qs) => qs.map((q) => q.id === questionId ? json.data : q));
  }

  return <div className="space-y-4">
    <div className="rounded-3xl border border-navy-100 bg-white p-5 shadow-card dark:border-navy-800 dark:bg-navy-900">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">NEYO live class room</h2><p className="text-xs text-navy-400">Room {roomId} · Peer {peerId.slice(0, 12)} {role ? `· ${role}` : ""}</p></div>{!joined ? <div className="flex gap-2"><Button onClick={()=>join()}><Video className="h-4 w-4"/> Join mobile</Button><Button variant="secondary" onClick={()=>join("TV")}><MonitorPlay className="h-4 w-4"/> Join TV</Button></div> : <div className="flex gap-2"><Button variant="secondary" onClick={toggleMic} disabled={role === "TV" || (role === "STUDENT" && muteAllStudents)}>{micOn?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}</Button><Button variant="secondary" onClick={toggleVideo} disabled={role === "TV" || (role === "STUDENT" && studentVideoDisabled)}>{videoOn?<Video className="h-4 w-4"/>:<VideoOff className="h-4 w-4"/>}</Button>{role === "TEACHER" && <Button variant="secondary" onClick={startScreenShare}><ScreenShare className="h-4 w-4"/> {screenSharing ? "Sharing" : "Share screen"}</Button>}<Button variant="secondary" onClick={enterFullScreen}><Maximize2 className="h-4 w-4"/> Full screen</Button><Button variant="secondary" onClick={connectAllPeers}><Users className="h-4 w-4"/> Connect all</Button><Button variant="danger" onClick={leaveRoom}><PhoneOff className="h-4 w-4"/> Leave</Button></div>}</div>
      {joined && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50/70 p-3 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/20 dark:text-green-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold"><Shield className="h-4 w-4" /> Recording policy: NEYO does not save class video. Users may save only to their own device/external drive if the school allows it.</span>
            {role === "TEACHER" && <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={recordingAllowed} onChange={(e)=>updateControls({ recordingAllowed: e.target.checked })} /> Allow local saving notice</label>}
          </div>
          {role === "TEACHER" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant={muteAllStudents ? "primary" : "secondary"} onClick={() => updateControls({ muteAllStudents: !muteAllStudents })}>Mute all students</Button>
              <Button size="sm" variant={studentVideoDisabled ? "primary" : "secondary"} onClick={() => updateControls({ studentVideoDisabled: !studentVideoDisabled })}>Disable student video</Button>
            </div>
          )}
          {role === "STUDENT" && (muteAllStudents || studentVideoDisabled) && <p className="mt-2 font-semibold">Teacher controls active: {muteAllStudents ? "microphones muted" : ""} {studentVideoDisabled ? "student video disabled" : ""}</p>}
        </div>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div ref={stageRef} className="relative rounded-3xl bg-navy-950 p-3">
            <div className="absolute left-5 top-5 z-10 rounded-2xl bg-white/85 px-2 py-1 shadow-card backdrop-blur-md dark:bg-navy-950/75">
              <NeyoLogo variant="mark" className="h-6" title="NEYO live class" />
            </div>
            <video ref={localVideoRef} autoPlay muted playsInline className="min-h-[18rem] w-full rounded-2xl bg-black object-cover" />
            <p className="mt-2 text-center text-xs font-bold text-white/60">Local camera preview / TV stage</p>
          </div>
          {remoteStreams.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{remoteStreams.map((item)=><RemoteVideo key={item.peerId} item={item} />)}</div>}
        </div>
        <div className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
          <p className="text-xs font-black uppercase text-navy-400">Connected peers</p>
          <ul className="mt-2 space-y-2 text-sm">{peers.filter((p)=>p.peerId!==peerId).map((p)=><li key={p.peerId} className="rounded-xl bg-navy-50 p-2 dark:bg-navy-800"><span className="font-bold">{p.displayName}</span><span className="ml-2 text-xs text-navy-400">{p.role}</span><button onClick={()=>callPeer(p.peerId, p.displayName)} className="ml-2 text-xs font-bold text-green-700">connect</button></li>)}</ul>
          <p className="mt-4 text-xs font-black uppercase text-navy-400">Remote video tiles</p>
          <p className="mt-1 text-[10px] text-navy-400">{remoteStreams.length} active remote stream{remoteStreams.length === 1 ? "" : "s"}</p>

          {role === "STUDENT" && joined && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="flex items-center gap-1 text-xs font-black uppercase text-amber-800 dark:text-amber-200"><Hand className="h-3.5 w-3.5" /> Raise hand / ask</p>
              <textarea value={handText} onChange={(e)=>setHandText(e.target.value)} rows={2} placeholder="Type your question for the teacher…" className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-2 text-xs dark:border-amber-900 dark:bg-navy-900" />
              <Button size="sm" onClick={raiseHand} disabled={!handText.trim()} className="mt-2 w-full"><MessageCircle className="h-4 w-4" /> Ask teacher</Button>
              {approvedToSpeak && <p className="mt-2 text-[10px] font-bold text-green-700">Teacher approved you — you can unmute and speak.</p>}
            </div>
          )}

          {role === "TEACHER" && joined && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/20">
              <p className="flex items-center gap-1 text-xs font-black uppercase text-blue-800 dark:text-blue-200"><Hand className="h-3.5 w-3.5" /> Raised hands</p>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {questions.length === 0 ? <p className="text-[10px] text-navy-400">No questions yet.</p> : questions.map((q:any)=>(
                  <div key={q.id} className="rounded-xl bg-white p-2 text-xs dark:bg-navy-900">
                    <p className="font-bold">{q.studentName} <span className="text-[9px] text-navy-400">{q.status}</span></p>
                    <p className="mt-0.5 text-navy-500 dark:text-navy-300">{q.question}</p>
                    {q.status === "PENDING" && <div className="mt-2 flex gap-1"><Button size="sm" onClick={()=>decideQuestion(q.id,"APPROVED")}><Check className="h-3.5 w-3.5" /> Let speak</Button><Button size="sm" variant="secondary" onClick={()=>decideQuestion(q.id,"DISMISSED")}>Dismiss</Button></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs font-black uppercase text-navy-400">Signals</p>
          <p className="mt-1 text-[10px] text-navy-400">{signals.slice(-4).map((s)=>s.type).join(" · ") || "Waiting for peers…"}</p>
        </div>
      </div>
    </div>
  </div>;
}
