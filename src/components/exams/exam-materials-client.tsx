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

/**
 * K.16 — KNEC Document Aggregation & Export.
 * Define a batch (target class + required document labels), aggregate which
 * candidates are complete from their approved StudentDocuments (K.10), and
 * export a structured manifest to hand to KNEC. Deterministic, no AI.
 */
export function KnecAggregationCard({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [batches, setBatches] = React.useState<any[] | null>(null);
  const [classes, setClasses] = React.useState<{ id: string; level: string; stream: string | null }[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [report, setReport] = React.useState<any | null>(null);
  const [name, setName] = React.useState("2026 KCSE Candidates Batch");
  const [classId, setClassId] = React.useState("");
  const [labels, setLabels] = React.useState("Birth Certificate\nKNEC Registration Form\nPassport Photo");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/exam-materials/knec-export");
    const json = await res.json();
    if (json.ok) setBatches(json.data.batches);
  }, []);
  React.useEffect(() => { load(); fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes)); }, [load]);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/exam-materials/knec-export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, targetClassId: classId || null, documentLabels: labels.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Batch created", tone: "success" }); setCreating(false); load(); }
      else toast({ title: json.error?.message || "Could not create batch", tone: "error" });
    } finally { setBusy(false); }
  }

  async function aggregate(batchId: string) {
    const res = await fetch(`/api/exam-materials/knec-export?batchId=${batchId}`);
    const json = await res.json();
    if (json.ok) setReport(json.data.report);
    else toast({ title: json.error?.message || "Could not aggregate", tone: "error" });
  }

  async function doExport(batchId: string, force: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/exam-materials/knec-export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", batchId, force }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "KNEC batch exported", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Could not export", tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> KNEC document aggregation</span>
          {canManage && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New batch</Button>}
        </CardTitle>
        <p className="text-xs text-navy-400">Collect required candidate documents per class, see who is complete, and export a single KNEC batch manifest.</p>
      </CardHeader>
      <CardContent>
        {batches === null ? (
          <div className="space-y-2">{[0, 1].map((x) => <Skeleton key={x} className="h-16 rounded-2xl" />)}</div>
        ) : batches.length === 0 ? (
          <EmptyState icon={FileText} title="No KNEC batches" description="Create a batch to aggregate candidate documents for KNEC registration." action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New batch</Button> : undefined} />
        ) : (
          <div className="space-y-2">
            {batches.map((b) => {
              const cls = classes.find((c) => c.id === b.targetClassId);
              return (
                <div key={b.id} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{b.name}</p>
                      <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">{cls ? `${cls.level} ${cls.stream ?? ""}`.trim() : "All active students"} · {b.documentLabels.length} required docs</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={b.status === "EXPORTED" ? "green" : "neutral"}>{b.status.toLowerCase()}</Badge>
                      <Button size="sm" variant="secondary" onClick={() => aggregate(b.id)}>Check completeness</Button>
                      {canManage && b.status !== "EXPORTED" && <Button size="sm" disabled={busy} onClick={() => doExport(b.id, false)}>Export</Button>}
                      {b.exportUrl && <a href={b.exportUrl} className="inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:underline"><FileText className="h-3.5 w-3.5" /> Manifest</a>}
                    </div>
                  </div>
                  {report && report.batchId === b.id && (
                    <div className="mt-3 rounded-xl bg-navy-50 p-3 text-xs dark:bg-navy-900">
                      <p className="font-semibold">{report.completeStudents}/{report.totalStudents} candidates complete</p>
                      <ul className="mt-2 space-y-1">
                        {report.students.map((s: any) => (
                          <li key={s.studentId} className="flex items-center justify-between gap-2">
                            <span>{s.name} <span className="text-navy-400">({s.admissionNo})</span></span>
                            {s.complete ? <Badge tone="green">complete</Badge> : <span className="text-red-600">missing: {s.missing.join(", ")}</span>}
                          </li>
                        ))}
                      </ul>
                      {canManage && report.incompleteStudents > 0 && b.status !== "EXPORTED" && (
                        <Button size="sm" variant="danger" className="mt-2" disabled={busy} onClick={() => doExport(b.id, true)}>Force export (partial)</Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-6 shadow-pop dark:border-navy-800 dark:bg-navy-950" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">New KNEC batch</h3><button onClick={() => setCreating(false)}><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <div><Label className="text-xs">Batch name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div>
                <Label className="text-xs">Target class</Label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                  <option value="">All active students</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.level} {c.stream ?? ""}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Required documents (one per line)</Label><textarea value={labels} onChange={(e) => setLabels(e.target.value)} rows={4} className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900" /></div>
              <Button className="w-full" disabled={busy} onClick={create}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create batch"}</Button>
            </div>
          </div>
        </div>
      )}
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/60 bg-white p-6 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
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
