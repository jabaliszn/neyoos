"use client";
import * as React from "react";
import { MonitorPlay, Play, Square, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function OnlineClassesClient() {
  const { toast } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [classId, setClassId] = React.useState("");
  const [title, setTitle] = React.useState("Live revision class");
  const [scheduledAt, setScheduledAt] = React.useState(new Date(Date.now() + 3600_000).toISOString().slice(0, 16));
  const [saving, setSaving] = React.useState(false);
  const load = React.useCallback(async () => { const j = await fetch("/api/online-classes").then((r) => r.json()); if (j.ok) { setData(j.data); if (!classId && j.data.classes[0]) setClassId(j.data.classes[0].id); } }, [classId]);
  React.useEffect(() => { load(); }, [load]);
  async function act(body: any, msg: string) { setSaving(true); try { const j = await fetch("/api/online-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()); if (!j.ok) throw new Error(j.error?.message || "Failed"); toast({ title: msg, tone: "success" }); await load(); } catch(e:any) { toast({ title: e.message, tone: "error" }); } finally { setSaving(false); } }
  if (!data) return <div className="skeleton h-40 rounded-3xl" />;
  return <div className="grid gap-4 lg:grid-cols-3">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-green-600" />Request live class</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Class</Label><select value={classId} onChange={(e)=>setClassId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900">{data.classes.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><Label>Title</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} /></div>
        <div><Label>Time</Label><Input type="datetime-local" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} /></div>
        <Button disabled={saving || !classId || !title} onClick={()=>act({action:"request", classId, title, scheduledAt}, "Online class requested and class notified")}>Request class + notify</Button>
      </CardContent>
    </Card>
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>Class live room board</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.runningByClass.length > 0 && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">Online class running in this class: {data.runningByClass.map((r:any)=>r.className).join(", ")}</div>}
        {data.sessions.map((s:any)=><div key={s.id} className="rounded-2xl border border-navy-100 bg-white p-3 dark:border-navy-800 dark:bg-navy-900">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{s.title}</p><p className="text-xs text-navy-500">{s.className} · {s.teacherName} · {s.scheduledAt}</p></div><Badge tone={s.status === "RUNNING" ? "green" : s.status === "ENDED" ? "neutral" : "blue"}>{s.status}</Badge></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-navy-50 px-2 py-1 font-bold dark:bg-navy-800">TV code: {s.tvAccessCode}</span><a className="font-semibold text-green-700" href={s.joinUrl}>Join mobile/TV →</a></div>
          <div className="mt-3 flex gap-2"><Button size="sm" disabled={saving || s.status === "RUNNING"} onClick={()=>act({action:"running", id:s.id}, "Online class running in this class") }><Play className="h-4 w-4" /> Start</Button><Button size="sm" variant="secondary" disabled={saving || s.status !== "RUNNING"} onClick={()=>act({action:"ended", id:s.id}, "Online class ended") }><Square className="h-4 w-4" /> End</Button></div>
        </div>)}
        {data.sessions.length===0 && <div className="rounded-3xl border border-dashed border-navy-200 p-8 text-center text-sm text-navy-400"><MonitorPlay className="mx-auto mb-2 h-8 w-8" />No online classes requested yet.</div>}
      </CardContent>
    </Card>
  </div>;
}
