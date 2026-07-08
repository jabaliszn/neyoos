"use client";

import * as React from "react";
import { Cast, Clock3, Loader2, Play, Plus, Search, ShieldCheck, Tv, X, Youtube } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Video = { id?: string; youtubeId: string; title: string; description?: string | null; channelTitle?: string | null; thumbnailUrl?: string | null; embedUrl?: string; saved?: boolean };
type Session = { id: string; title: string; youtubeId: string; embedUrl: string; castUrl?: string; classLabel?: string | null; startedByName?: string; startedAt?: string; videoId?: string };

const IDEAS = ["algebra basics", "photosynthesis", "KCSE English set books", "fractions Grade 6", "CBE creative arts", "electricity Form 2"];
function embed(id: string) { return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`; }

export function LearningVideosClient() {
  const { toast } = useToast();
  const [q, setQ] = React.useState("algebra basics");
  const [saved, setSaved] = React.useState<Video[]>([]);
  const [external, setExternal] = React.useState<Video[]>([]);
  const [shown, setShown] = React.useState<Session[]>([]);
  const [watching, setWatching] = React.useState<Video | Session | null>(null);
  const [shownOpen, setShownOpen] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [manualUrl, setManualUrl] = React.useState("");

  const load = React.useCallback(async (query = q) => {
    setLoading(true);
    try {
      const url = query.trim() ? `/api/learning-videos?q=${encodeURIComponent(query.trim())}` : "/api/learning-videos";
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setSaved(json.data.saved ?? []);
        setExternal(json.data.external ?? []);
        setNote(json.data.note ?? null);
        if (query.trim()) {
          const old = JSON.parse(localStorage.getItem("neyo-learning-searches") || "[]") as string[];
          localStorage.setItem("neyo-learning-searches", JSON.stringify([query.trim(), ...old.filter((x) => x !== query.trim())].slice(0, 8)));
        }
      }
      const shownRes = await fetch("/api/learning-videos?shown=1").then((r) => r.json());
      if (shownRes.ok) setShown(shownRes.data.sessions ?? []);
    } finally { setLoading(false); }
  }, [q]);
  React.useEffect(() => { load(); }, []); // initial only

  async function save(video: Video) {
    const res = await fetch("/api/learning-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", youtubeUrlOrId: video.youtubeId, title: video.title, description: video.description, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl }) });
    const json = await res.json();
    if (json.ok) { toast({ title: "Learning video saved", tone: "success" }); await load(); setWatching(json.data); }
    else toast({ title: json.error?.message || "Could not save video", tone: "error" });
  }

  async function saveManual() {
    if (!manualUrl.trim()) return;
    await save({ youtubeId: manualUrl, title: "Saved YouTube learning video" });
    setManualUrl("");
  }

  async function cast(video: Video | Session) {
    const videoId = (video as any).id || (video as any).videoId;
    if (!videoId) { toast({ title: "Save the video before casting", tone: "error" }); return; }
    const res = await fetch("/api/learning-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cast", videoId }) });
    const json = await res.json();
    if (json.ok) { toast({ title: "Class screen link ready", description: json.data.castUrl, tone: "success" }); await load(); window.open(json.data.castUrl, "_blank"); }
    else toast({ title: json.error?.message || "Could not start class screen", tone: "error" });
  }

  function applyIdea(idea: string) { setQ(idea); void load(idea); }
  const results = [...saved, ...external.filter((v) => !saved.some((s) => s.youtubeId === v.youtubeId))];
  const currentEmbed = watching ? ("embedUrl" in watching && watching.embedUrl ? watching.embedUrl : embed((watching as any).youtubeId)) : null;

  return <div className="space-y-5">
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" /><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search educational videos inside NEYO…" className="pl-9" /></div>
          <Button onClick={() => load()} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {IDEAS.map((idea) => <button key={idea} onClick={() => applyIdea(idea)} className="rounded-full border border-navy-100 bg-white/70 px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-green-50 hover:text-green-800 dark:border-navy-800 dark:bg-navy-950/40 dark:text-navy-300">{idea}</button>)}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-3 text-xs text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-100"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Distraction guard: videos play inside NEYO using privacy-enhanced embeds; comments/recommendations stay outside the NEYO screen. YouTube may still enforce its own adverts. For zero-ad classes, use school-owned videos in NEYO storage when available.</div>
          <div className="flex gap-2"><Input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="Paste YouTube link/ID if search key is not connected" /><Button variant="secondary" onClick={saveManual}><Plus className="h-4 w-4" /> Save link</Button></div>
        </div>
        {note && <p className="text-xs text-amber-700 dark:text-amber-300">{note}</p>}
      </CardContent>
    </Card>

    {currentEmbed && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-green-600" /> Watch inside NEYO</CardTitle></CardHeader><CardContent className="space-y-3"><div className="aspect-video overflow-hidden rounded-3xl border border-navy-100 bg-navy-950 shadow-card dark:border-navy-800"><iframe src={currentEmbed} title={(watching as any).title} className="h-full w-full" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-navy-900 dark:text-navy-50">{(watching as any).title}</p><Button onClick={() => watching && cast(watching)}><Cast className="h-4 w-4" /> Cast to class screen</Button></div></CardContent></Card>}

    <div className="flex justify-end"><Button variant="secondary" onClick={() => setShownOpen(true)}><Clock3 className="h-4 w-4" /> Videos shown in class ({shown.length})</Button></div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Youtube className="h-5 w-5 text-red-600" /> Search results & saved videos</CardTitle></CardHeader>
      <CardContent>{results.length === 0 ? <div className="space-y-4"><EmptyState icon={Youtube} title="Choose a learning search idea" description="Start with one of the recommended topics above, or paste a YouTube learning link. This screen never leaves NEYO." /><div className="grid gap-2 sm:grid-cols-3">{IDEAS.slice(0, 6).map((idea) => <button key={idea} onClick={() => applyIdea(idea)} className="rounded-2xl border border-navy-100 bg-white/70 p-3 text-left text-sm font-bold text-navy-800 hover:bg-green-50 dark:border-navy-800 dark:bg-navy-950/40 dark:text-navy-200">{idea}</button>)}</div></div> : <div className="grid gap-3 xl:grid-cols-2">{results.map((v) => <VideoRow key={v.youtubeId} video={v} onWatch={() => setWatching(v)} onSave={() => save(v)} onCast={() => cast(v)} />)}</div>}</CardContent>
    </Card>

    {shownOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setShownOpen(false)}><div className="max-h-[88dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/60 bg-white p-5 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-black text-navy-950 dark:text-white">Videos shown in class</h3><p className="text-xs text-navy-500 dark:text-navy-400">Students can re-open what was shown by the teacher.</p></div><button onClick={() => setShownOpen(false)} className="rounded-full p-2 text-navy-400 hover:bg-navy-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>{shown.length === 0 ? <EmptyState icon={Tv} title="No class videos yet" description="When a teacher casts a video, it appears here." /> : <div className="space-y-2">{shown.map((s) => <button key={s.id} onClick={() => { setWatching(s); setShownOpen(false); }} className="w-full rounded-2xl border border-navy-100 bg-white/70 p-3 text-left text-sm dark:border-navy-800 dark:bg-navy-950/40"><span className="font-bold text-navy-900 dark:text-white">{s.title}</span><span className="block text-xs text-navy-400">Shown by {s.startedByName}{s.classLabel ? ` · ${s.classLabel}` : ""}</span></button>)}</div>}</div></div>}
  </div>;
}

function VideoRow({ video, onWatch, onSave, onCast }: { video: Video; onWatch: () => void; onSave: () => void; onCast: () => void }) {
  return <div className="flex gap-3 rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-950/40"><img src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} alt="" className="h-24 w-36 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold text-navy-900 dark:text-white">{video.title}</p><p className="mt-0.5 text-xs text-navy-400">{video.channelTitle || "Saved learning video"}</p><div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" variant="secondary" onClick={onWatch}><Play className="h-3.5 w-3.5" /> Watch</Button>{!video.saved && <Button size="sm" variant="secondary" onClick={onSave}><Plus className="h-3.5 w-3.5" /> Save</Button>}<Button size="sm" onClick={onCast}><Cast className="h-3.5 w-3.5" /> Cast</Button></div></div>{video.saved && <Badge tone="green">saved</Badge>}</div>;
}
