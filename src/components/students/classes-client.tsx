"use client";

import * as React from "react";
import { Plus, Loader2, AlertCircle, Users, X, CreditCard, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { curriculumLabel } from "@/lib/utils";

interface ClassRow {
  id: string; level: string; stream: string | null; curriculum: string;
  capacity: number | null; archived: boolean; studentCount: number; name: string;
}

export function ClassesClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ClassRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [bulkDialog, setBulkDialog] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/classes");
      const json = await res.json();
      if (json.ok) setRows(json.data.classes);
      else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(()=>{ load(); }, [load]);

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={()=>setBulkDialog(true)}><Layers className="h-4 w-4" /> Bulk create streams</Button>
          <Button onClick={()=>setDialog(true)}><Plus className="h-4 w-4" /> New class</Button>
        </div>
      )}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load classes. <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : rows === null ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No classes yet" description="Create your first class or stream, e.g. Grade 4 Blue or Form 2 East."
          action={canManage ? <Button onClick={()=>setDialog(true)}><Plus className="h-4 w-4" /> New class</Button> : undefined} />
      ) : (
        <TableContainer>
          <Table>
            <THead><TR><TH>Class</TH><TH>Curriculum</TH><TH align="center">Students</TH><TH align="center">Capacity</TH><TH align="right">Mzazi cards</TH></TR></THead>
            <TBody>
              {rows.map((c)=>(
                <TR key={c.id}>
                  <TD><span className="font-medium text-navy-900 dark:text-navy-50">{c.name}</span></TD>
                  <TD><Badge tone={c.curriculum==="CBC"?"green":"blue"}>{curriculumLabel(c.curriculum)}</Badge></TD>
                  <TD align="center">{c.studentCount}</TD>
                  <TD align="center">{c.capacity ?? "—"}</TD>
                  <TD align="right">
                    {c.studentCount > 0 ? (
                      <a href={`/api/finance/mzazi-batch?classId=${c.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400">
                        <CreditCard className="h-3.5 w-3.5" /> Print {c.studentCount}
                      </a>
                    ) : <span className="text-xs text-navy-300">—</span>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {dialog && <NewClassDialog onClose={()=>setDialog(false)} onSaved={()=>{ setDialog(false); toast({title:"Class created",tone:"success"}); load(); }} />}
      {bulkDialog && <BulkStreamsDialog onClose={()=>setBulkDialog(false)} onSaved={(msg)=>{ setBulkDialog(false); toast({title: msg, tone:"success"}); load(); }} />}
    </div>
  );
}

// P.5 — bulk-create every stream a level needs in one action (e.g. "Form 1
// has 4 streams: East, West, North, South"), instead of creating each
// class/stream one at a time. Each new stream is immediately wired with a
// default Timetable Engine config, ready-to-configure without an extra step.
function BulkStreamsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const { toast } = useToast();
  const [level, setLevel] = React.useState("");
  const [curriculum, setCurriculum] = React.useState("CBC");
  const [streamCount, setStreamCount] = React.useState("4");
  const [namingStyle, setNamingStyle] = React.useState<"LETTERS" | "NUMBERS" | "CUSTOM">("LETTERS");
  const [customNames, setCustomNames] = React.useState("East, West, North, South");
  const [capacity, setCapacity] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function computedStreamNames(): string[] {
    const n = Math.max(1, Math.min(26, Number(streamCount) || 0));
    if (namingStyle === "LETTERS") return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    if (namingStyle === "NUMBERS") return Array.from({ length: n }, (_, i) => String(i + 1));
    return customNames.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function save() {
    if (!level.trim()) return toast({ title: "Enter a level, e.g. Form 1.", tone: "error" });
    const streamNames = computedStreamNames();
    if (streamNames.length === 0) return toast({ title: "Provide at least one stream name.", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/classes/bulk-streams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: level.trim(), curriculum, streamNames, capacity: capacity ? Number(capacity) : undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        const { createdCount, skippedCount } = json.data;
        onSaved(
          skippedCount > 0
            ? `Created ${createdCount} new stream${createdCount === 1 ? "" : "s"} (${skippedCount} already existed and were skipped).`
            : `Created ${createdCount} new stream${createdCount === 1 ? "" : "s"} for ${level.trim()}, ready in the Timetable Engine.`
        );
      } else {
        toast({ title: json.error?.message || "Could not create streams.", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const preview = computedStreamNames();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Bulk create streams</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-navy-500 dark:text-navy-400">
          Tell NEYO how many streams a level has and it creates every class in one go — each is
          instantly ready-to-configure in the Timetable Engine.
        </p>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Level</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Form 1 / Grade 9" autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Curriculum</Label>
              <select value={curriculum} onChange={(e) => setCurriculum(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                <option value="CBC">CBE</option><option value="8-4-4">8-4-4</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Number of streams</Label><Input type="number" min={1} max={26} value={streamCount} onChange={(e) => setStreamCount(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Naming style</Label>
            <select value={namingStyle} onChange={(e) => setNamingStyle(e.target.value as any)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
              <option value="LETTERS">Letters (A, B, C…)</option>
              <option value="NUMBERS">Numbers (1, 2, 3…)</option>
              <option value="CUSTOM">Custom names</option>
            </select>
          </div>
          {namingStyle === "CUSTOM" && (
            <div className="space-y-1"><Label>Stream names (comma-separated)</Label>
              <Input value={customNames} onChange={(e) => setCustomNames(e.target.value)} placeholder="East, West, North, South" />
            </div>
          )}
          <div className="space-y-1"><Label>Capacity per stream (optional)</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="45" /></div>
          <div className="rounded-2xl border border-navy-100 bg-navy-50/60 p-3 text-xs text-navy-600 dark:border-navy-800 dark:bg-navy-800/40 dark:text-navy-300">
            Will create: {preview.length === 0 ? <span className="italic text-navy-400">nothing yet</span> : preview.map((s) => `${level.trim() || "Level"} ${s}`).join(", ")}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} Create streams</Button>
        </div>
      </div>
    </div>
  );
}

function NewClassDialog({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ level:"", stream:"", curriculum:"CBC", capacity:"" });
  const [saving, setSaving] = React.useState(false);
  const set = (k:string,v:string)=>setF((p)=>({...p,[k]:v}));
  async function save() {
    if (!f.level.trim()) { toast({title:"Enter a level, e.g. Grade 4.",tone:"error"}); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/classes", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ level:f.level.trim(), stream:f.stream.trim()||undefined, curriculum:f.curriculum, capacity:f.capacity?Number(f.capacity):undefined }) });
      const json = await res.json();
      if (json.ok) onSaved();
      else toast({ title: json.error?.message || "Could not save", tone:"error" });
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">New class</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Level</Label><Input value={f.level} onChange={(e)=>set("level",e.target.value)} placeholder="Grade 4 / Form 2" autoFocus /></div>
            <div className="space-y-1"><Label>Stream (optional)</Label><Input value={f.stream} onChange={(e)=>set("stream",e.target.value)} placeholder="Blue / East" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Curriculum</Label>
              <select value={f.curriculum} onChange={(e)=>set("curriculum",e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                <option value="CBC">CBE</option><option value="8-4-4">8-4-4</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Capacity (optional)</Label><Input type="number" value={f.capacity} onChange={(e)=>set("capacity",e.target.value)} placeholder="45" /></div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving?<Loader2 className="h-4 w-4 animate-spin" />:<Plus className="h-4 w-4" />} Create class</Button>
        </div>
      </div>
    </div>
  );
}
