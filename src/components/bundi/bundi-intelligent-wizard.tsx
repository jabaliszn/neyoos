"use client";

/**
 * N.1 — "Bundi Intelligent" wizard (shared across Student / Staff / Library).
 *
 * The founder's "third option" framing: this NEVER replaces the standard
 * CSV/Excel/paste import for a domain — it sits ALONGSIDE it as an
 * additional way in, specifically for messy/handwritten registers. It needs
 * NO unlock code (per the founder's explicit instruction) — that gate only
 * ever applies to the separate, older "legacy provider" whole-page path.
 *
 * Steps: describe your register's columns -> (optional) tell Bundi the
 * context, e.g. "this is Grade 1" -> upload the photo/scan -> Bundi reads it
 * locally first (OCR + deterministic rules + your own real school data) ->
 * review every cell (color-coded by how Bundi resolved it) -> commit
 * through the SAME real engine the standard import uses.
 */
import * as React from "react";
import {
  Sparkles, ArrowRight, ArrowLeft, Loader2, ScanLine,
  CheckCircle2, AlertCircle, Plus, Trash2, ShieldCheck, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export type BundiWizardDomain = "STUDENT" | "STAFF" | "LIBRARY";

interface FieldRow { label: string; description: string; mapsTo: string }
interface BundiCell { value: string; ocrConfidencePct?: number; source: "OCR" | "RULE_FIXED" | "TEMPLATE_KNOWN" | "AI_CORRECTED" | "MANUAL" }

const SOURCE_STYLE: Record<BundiCell["source"], { tone: "green" | "amber" | "blue" | "neutral"; label: string }> = {
  RULE_FIXED: { tone: "blue", label: "Auto-fixed" },
  TEMPLATE_KNOWN: { tone: "blue", label: "Remembered" },
  AI_CORRECTED: { tone: "green", label: "Bundi confirmed" },
  MANUAL: { tone: "neutral", label: "You edited" },
  OCR: { tone: "amber", label: "Please check" },
};

export function BundiIntelligentWizard({
  domain,
  fieldOptions,
  onClose,
  onDone,
}: {
  domain: BundiWizardDomain;
  fieldOptions: Record<string, string>; // mapsTo -> human label, must include "ignore"
  onClose: () => void;
  onDone: (result: { created: number; updated?: number; skipped: number }) => void;
}) {
  const { toast } = useToast();
  const FIELD_OPTIONS = Object.keys(fieldOptions);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [busy, setBusy] = React.useState(false);

  // Step 1: field template (school describes their own register's columns)
  const [templateLoading, setTemplateLoading] = React.useState(true);
  const [fields, setFields] = React.useState<FieldRow[]>([]);
  const [contextNote, setContextNote] = React.useState("");

  // Step 2: upload + session
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [session, setSession] = React.useState<any>(null);
  const [extractError, setExtractError] = React.useState<string | null>(null);

  // Step 3: review + commit
  const [reviewRows, setReviewRows] = React.useState<BundiCell[][]>([]);
  const [reviewLabels, setReviewLabels] = React.useState<string[]>([]);
  const [committing, setCommitting] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; updated?: number; skipped: number } | null>(null);

  React.useEffect(() => {
    setTemplateLoading(true);
    fetch(`/api/bundi-import/field-template?domain=${domain}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const loaded = j.data.fields as FieldRow[];
          setFields(loaded.length ? loaded : [{ label: "", description: "", mapsTo: "ignore" }]);
        } else setFields([{ label: "", description: "", mapsTo: "ignore" }]);
      })
      .catch(() => setFields([{ label: "", description: "", mapsTo: "ignore" }]))
      .finally(() => setTemplateLoading(false));
  }, [domain]);

  function addField() { setFields((p) => [...p, { label: "", description: "", mapsTo: "ignore" }]); }
  function removeField(i: number) { setFields((p) => p.filter((_, idx) => idx !== i)); }
  function updateField(i: number, patch: Partial<FieldRow>) {
    setFields((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function saveTemplateAndContinue() {
    const clean = fields.filter((f) => f.label.trim());
    if (clean.length === 0) { toast({ title: "Describe at least one column from your register.", tone: "error" }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/bundi-import/field-template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, fields: clean }),
      });
      const json = await res.json();
      if (json.ok) setStep(2);
      else toast({ title: json.error?.message || "Could not save your field description.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setExtractError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "bundi_import");
      const uploadRes = await fetch("/api/files/encrypted", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.ok) { toast({ title: uploadJson.error?.message ?? "Upload failed.", tone: "error" }); return; }

      // Bundi Intelligent — deliberately NO unlock code (open to every school).
      const startRes = await fetch("/api/bundi-import/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, storedFileId: uploadJson.data.id, fileName: file.name, pageCount: 1, contextNote: contextNote.trim() || undefined }),
      });
      const startJson = await startRes.json();
      if (!startJson.ok) { toast({ title: startJson.error?.message ?? "Could not start the import session.", tone: "error" }); return; }
      setSession(startJson.data.session);

      const extractRes = await fetch(`/api/bundi-import/sessions/${startJson.data.session.id}/extract`, { method: "POST" });
      const extractJson = await extractRes.json();
      if (!extractJson.ok) {
        setExtractError(extractJson.error?.message ?? "Bundi could not read this scan.");
        return;
      }
      const extracted = JSON.parse(extractJson.data.session.reviewedRowsJson ?? "[]") as { cells: Record<string, BundiCell> }[];
      const labels = fields.filter((f) => f.label.trim()).map((f) => f.label);
      setReviewLabels(labels);
      setReviewRows(extracted.map((r) => labels.map((l) => r.cells[l] ?? { value: "", source: "OCR" as const })));
      setSession(extractJson.data.session);
      setStep(3);
    } catch {
      toast({ title: "Network problem during upload.", tone: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setReviewRows((p) => p.map((r, i) => (i === rowIdx ? r.map((c, ci) => (ci === colIdx ? { ...c, value, source: "MANUAL" as const } : c)) : r)));
  }
  function removeRow(rowIdx: number) {
    setReviewRows((p) => p.filter((_, i) => i !== rowIdx));
  }

  async function saveReviewAndCommit() {
    if (!session) return;
    setCommitting(true);
    try {
      const rows = reviewRows.map((cells) => ({ cells: Object.fromEntries(reviewLabels.map((l, i) => [l, cells[i]])) }));
      const reviewRes = await fetch(`/api/bundi-import/sessions/${session.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const reviewJson = await reviewRes.json();
      if (!reviewJson.ok) { toast({ title: reviewJson.error?.message ?? "Could not save your edits.", tone: "error" }); return; }

      const commitRes = await fetch(`/api/bundi-import/sessions/${session.id}/commit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedRequirements: true, skipInvalid: true }),
      });
      const commitJson = await commitRes.json();
      if (!commitJson.ok) { toast({ title: commitJson.error?.message ?? "Import failed.", tone: "error" }); return; }
      setResult(commitJson.data);
      onDone(commitJson.data);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50/70 px-4 py-2.5 text-xs text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span><strong>Bundi Intelligent</strong> reads handwritten or messy registers — free to use, no unlock code needed. Bundi reads locally first, and only ever asks for help on the few words it genuinely isn&apos;t sure about.</span>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {["Describe columns", "Upload scan", "Review & import"].map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n; const done = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-green-600 text-white" : active ? "bg-navy-900 text-white dark:bg-navy-100 dark:text-navy-900" : "bg-navy-100 text-navy-500 dark:bg-navy-800 dark:text-navy-400"}`}>
                {done ? "✓" : n}
              </span>
              <span className={active ? "text-navy-900 dark:text-navy-50" : "text-navy-400"}>{label}</span>
              {n < 3 && <span className="mx-1 h-px w-6 bg-navy-200 dark:bg-navy-700" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-navy-500 dark:text-navy-400">
            Tell Bundi what each column in YOUR register means — Bundi maps around your description, never the other way round.
          </p>
          {templateLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-navy-100 p-3 dark:border-navy-800 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Column label, e.g. Kitabu (Title)" />
                  <Input value={f.description} onChange={(e) => updateField(i, { description: e.target.value })} placeholder="Where it appears in the register" />
                  <select value={f.mapsTo} onChange={(e) => updateField(i, { mapsTo: e.target.value })} className="rounded-xl border border-navy-200 bg-white px-2 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                    {FIELD_OPTIONS.map((opt) => <option key={opt} value={opt}>{fieldOptions[opt]}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => removeField(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addField}><Plus className="h-4 w-4" /> Add another column</Button>
            </div>
          )}
          <div>
            <Label>Context for Bundi (optional)</Label>
            <Input value={contextNote} onChange={(e) => setContextNote(e.target.value)} placeholder='e.g. "This is Grade 1" or "New books added this term"' className="mt-1" />
            <p className="mt-1 text-[11px] text-navy-400">A short hint like this helps Bundi read ambiguous entries correctly.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={saveTemplateAndContinue} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-warm-50 px-6 py-10 text-center transition-colors duration-200 ease-apple hover:border-green-500 hover:bg-green-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:hover:bg-navy-800"
          >
            {busy ? <Loader2 className="h-8 w-8 animate-spin text-navy-400" /> : <ScanLine className="h-8 w-8 text-navy-400" />}
            <span className="text-sm font-medium text-navy-700 dark:text-navy-200">{busy ? "Bundi is reading your scan…" : "Choose a photo or scanned page"}</span>
            <span className="text-xs text-navy-400">JPG or PNG — one page per upload</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {extractError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Bundi couldn&apos;t read that scan</p>
                <p className="mt-0.5">{extractError}</p>
              </div>
            </div>
          )}
          <Button variant="secondary" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        </div>
      )}

      {step === 3 && (
        result ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </span>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{result.created} imported via Bundi Intelligent</h2>
            {typeof result.updated === "number" && result.updated > 0 && <p className="text-sm text-navy-500 dark:text-navy-400">{result.updated} existing record(s) updated.</p>}
            {result.skipped > 0 && <p className="text-sm text-navy-500 dark:text-navy-400">{result.skipped} row(s) skipped.</p>}
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2 text-xs text-navy-600 dark:border-navy-800 dark:bg-navy-900/40 dark:text-navy-300">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <Badge tone="amber">Please check</Badge> = Bundi&apos;s best guess from the scan — review it. <Badge tone="blue">Auto-fixed / Remembered</Badge> = matched your school&apos;s own real data or a past correction, free. <Badge tone="green">Bundi confirmed</Badge> = double-checked. Edit any cell to correct it.
              </span>
            </div>
            {reviewRows.length === 0 ? (
              <p className="text-sm text-navy-400">No rows extracted.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-navy-100 dark:border-navy-800">
                      {reviewLabels.map((l) => <th key={l} className="p-2 text-left text-xs font-semibold text-navy-500">{l}</th>)}
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((row, ri) => (
                      <tr key={ri} className="border-b border-navy-50 dark:border-navy-900">
                        {row.map((cell, ci) => (
                          <td key={ci} className="p-1.5">
                            <div className="flex items-center gap-1">
                              <input
                                value={cell.value}
                                onChange={(e) => updateCell(ri, ci, e.target.value)}
                                className="w-full rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-900"
                              />
                            </div>
                            <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              SOURCE_STYLE[cell.source].tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : SOURCE_STYLE[cell.source].tone === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : SOURCE_STYLE[cell.source].tone === "green" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-navy-100 text-navy-600 dark:bg-navy-800 dark:text-navy-300"
                            }`}>{SOURCE_STYLE[cell.source].label}{cell.ocrConfidencePct !== undefined ? ` ${cell.ocrConfidencePct}%` : ""}</span>
                            {/* Badge import kept for the legend above; per-cell pill uses raw classes to avoid remounting cost on large tables. */}
                          </td>
                        ))}
                        <td className="p-1.5 align-top">
                          <button onClick={() => removeRow(ri)} className="mt-1 text-navy-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={saveReviewAndCommit} disabled={committing || reviewRows.length === 0}>
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Import {reviewRows.length} row{reviewRows.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
