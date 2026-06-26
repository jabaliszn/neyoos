"use client";

import * as React from "react";
import { ClipboardCheck, FileText, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";

interface RecordRow {
  id: string;
  examName: string;
  materialType: string;
  title: string;
  examDate: string | null;
  deadline: string | null;
  status: string;
  hardcopyLocation: string;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  createdByName: string;
  checklist: string[];
}

const STATUS_TONE: Record<string, "neutral" | "amber" | "green" | "blue"> = {
  PLANNED: "neutral",
  ASSEMBLING: "amber",
  READY: "green",
  SUBMITTED: "blue",
  COLLECTED: "green",
};

const MATERIAL_TYPES = [
  ["APPLICATION", "Exam application"],
  ["MATERIALS", "Assembled materials"],
  ["KNEC_REGISTRATION", "KNEC registration"],
  ["CENTER_LOGISTICS", "Centre logistics"],
  ["OTHER", "Other record"],
] as const;

export function ExamMaterialsClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<RecordRow[] | null>(null);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/exam-materials");
    const json = await res.json();
    if (json.ok) setRecords(json.data.records);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/exam-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id, status }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: "Exam material status updated", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not update status", tone: "error" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-green-600" /> Exam applications & materials</span>
          {canManage && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add record</Button>}
        </CardTitle>
        <p className="text-xs text-navy-400">Track KNEC/KCSE/KCPE applications, assembled exam papers, answer sheets, stationery and physical storage locations.</p>
      </CardHeader>
      <CardContent>
        {records === null ? (
          <div className="space-y-2">{[0, 1, 2].map((x) => <Skeleton key={x} className="h-16 rounded-2xl" />)}</div>
        ) : records.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No exam material records" description="Log exam applications, material packs and where the physical files are stored." action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add record</Button> : undefined} />
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{r.title}</p>
                    <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">{r.examName} · {r.materialType.replaceAll("_", " ").toLowerCase()} {r.deadline ? `· due ${r.deadline}` : ""}</p>
                    <p className="mt-1 text-xs font-semibold text-navy-700 dark:text-navy-200">Hardcopy: {r.hardcopyLocation}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Badge>
                    {canManage && (
                      <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs dark:border-navy-700 dark:bg-navy-900">
                        {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                {r.checklist.length > 0 && <p className="mt-2 text-xs text-navy-500 dark:text-navy-400">Checklist: {r.checklist.join(" · ")}</p>}
                {r.fileUrl && <a href={r.fileUrl} download={r.fileName ?? undefined} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:underline"><FileText className="h-3.5 w-3.5" /> {r.fileName ?? "Download soft copy"}</a>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {creating && <CreateExamMaterialDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </Card>
  );
}

function CreateExamMaterialDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ examName: "KCSE 2026", materialType: "APPLICATION", title: "KCSE candidate registration file", examDate: "", deadline: "", status: "PLANNED", checklist: "Candidate list\nBirth certificate copies\nPassport photos\nKNEC payment proof", hardcopyLocation: "Exam office cabinet, Shelf A", notes: "" });
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/exam-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...f, fileUrl: file?.url, fileName: file?.fileName }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Exam material record saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not save record", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/60 bg-white/90 p-6 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/92" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div><h3 className="text-base font-bold text-navy-900 dark:text-navy-50">Add exam material record</h3><p className="text-xs text-navy-400">Record applications, assembled papers and physical file locations.</p></div>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-100 dark:hover:bg-white/10" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Exam name</Label><Input value={f.examName} onChange={(e) => set("examName", e.target.value)} /></div><div><Label>Type</Label><select value={f.materialType} onChange={(e) => set("materialType", e.target.value)} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">{MATERIAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
          <div><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Exam date</Label><Input type="date" value={f.examDate} onChange={(e) => set("examDate", e.target.value)} /></div><div><Label>Deadline</Label><Input type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} /></div></div>
          <div><Label>Hardcopy / physical location</Label><Input value={f.hardcopyLocation} onChange={(e) => set("hardcopyLocation", e.target.value)} /></div>
          <div><Label>Checklist</Label><textarea value={f.checklist} onChange={(e) => set("checklist", e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" /></div>
          <div><Label>Upload soft copy / proof</Label><FileUpload category="exam-materials" accept="image/*,application/pdf,.doc,.docx" onUploaded={setFile} label="Upload exam material file" /></div>
          <Button onClick={save} disabled={saving || f.title.trim().length < 2 || f.hardcopyLocation.trim().length < 3} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save exam material record</Button>
        </div>
      </div>
    </div>
  );
}
