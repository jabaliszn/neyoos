"use client";

/**
 * M.5 — Bundi Handwritten Import wizard.
 * A SEPARATE premium/manual-assist path from the standard import wizard
 * (import-wizard.tsx) — never replaces or weakens it. Steps:
 *  1. Redeem a NEYO-issued unlock code.
 *  2. Describe the register's own columns (before any AI mapping happens).
 *  3. Upload the scan/photo (encrypted, same vault as every other file).
 *  4. Run extraction (honest "not configured" state if Bundi isn't live yet).
 *  5. Review/correct every row.
 *  6. Commit through the SAME engine the standard CSV/Excel import uses.
 * All 4 UX states throughout; mobile-first; Kenyan-context copy.
 */
import * as React from "react";
import Link from "next/link";
import {
  KeyRound, ArrowRight, ArrowLeft, Loader2, UploadCloud, ScanLine,
  CheckCircle2, AlertCircle, Plus, Trash2, Users, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const IMPORT_FIELD_LABELS: Record<string, string> = {
  firstName: "First name", middleName: "Middle name", lastName: "Last name",
  fullName: "Full name", gender: "Gender (M/F)", dateOfBirth: "Date of birth",
  className: "Class", legacyAdmissionNo: "School admission no", admissionNo: "Admission no",
  upiNumber: "UPI (NEMIS)", birthCertNo: "Birth cert no", guardianName: "Guardian name",
  guardianPhone: "Guardian phone", notes: "Notes", custom: "Custom field…", ignore: "— Skip —",
};
const FIELD_OPTIONS = Object.keys(IMPORT_FIELD_LABELS);

interface FieldRow { label: string; description: string; mapsTo: string; customLabel?: string }

export function BundiImportWizard() {
  const { toast } = useToast();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = React.useState(false);

  // Step 1: unlock code
  const [code, setCode] = React.useState("");
  const [unlockOk, setUnlockOk] = React.useState<{ remainingUses: number | null } | null>(null);
  const [unlockError, setUnlockError] = React.useState<string | null>(null);

  // Step 2: field template
  const [templateLoading, setTemplateLoading] = React.useState(true);
  const [fields, setFields] = React.useState<FieldRow[]>([]);
  const [templateError, setTemplateError] = React.useState(false);

  // Step 3: upload + session
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [session, setSession] = React.useState<any>(null);
  const [extractError, setExtractError] = React.useState<string | null>(null);

  // Step 4: review rows
  const [reviewRows, setReviewRows] = React.useState<Record<string, string>[]>([]);
  const [committing, setCommitting] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; failed: { row: number; message: string }[] } | null>(null);

  React.useEffect(() => {
    setTemplateLoading(true);
    fetch("/api/bundi-import/field-template")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const loaded = j.data.fields as FieldRow[];
          setFields(loaded.length ? loaded : [{ label: "", description: "", mapsTo: "ignore" }]);
        } else setTemplateError(true);
      })
      .catch(() => setTemplateError(true))
      .finally(() => setTemplateLoading(false));
  }, []);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/bundi-import/unlock-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (json.ok) { setUnlockOk(json.data); setStep(2); }
      else setUnlockError(json.error?.message || "That code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  function addField() { setFields((p) => [...p, { label: "", description: "", mapsTo: "ignore" }]); }
  function removeField(i: number) { setFields((p) => p.filter((_, idx) => idx !== i)); }
  function updateField(i: number, patch: Partial<FieldRow>) {
    setFields((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function saveTemplate() {
    const clean = fields.filter((f) => f.label.trim());
    if (clean.length === 0) { toast({ title: "Describe at least one column from your register.", tone: "error" }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/bundi-import/field-template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: clean }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Register fields saved", tone: "success" }); setStep(3); }
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

      const startRes = await fetch("/api/bundi-import/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlockCode: code, storedFileId: uploadJson.data.id, fileName: file.name, pageCount: 1 }),
      });
      const startJson = await startRes.json();
      if (!startJson.ok) { toast({ title: startJson.error?.message ?? "Could not start the import session.", tone: "error" }); return; }
      setSession(startJson.data.session);

      const extractRes = await fetch(`/api/bundi-import/sessions/${startJson.data.session.id}/extract`, { method: "POST" });
      const extractJson = await extractRes.json();
      if (!extractJson.ok) {
        setExtractError(extractJson.error?.message ?? "Bundi could not read this scan.");
        setSession(extractJson.data?.session ?? startJson.data.session);
        return;
      }
      const extracted = JSON.parse(extractJson.data.session.reviewedRowsJson ?? "[]") as { cells: Record<string, string> }[];
      setReviewRows(extracted.map((r) => r.cells));
      setSession(extractJson.data.session);
      setStep(4);
    } catch {
      toast({ title: "Network problem during upload.", tone: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateCell(rowIdx: number, label: string, value: string) {
    setReviewRows((p) => p.map((r, i) => (i === rowIdx ? { ...r, [label]: value } : r)));
  }
  function removeRow(rowIdx: number) {
    setReviewRows((p) => p.filter((_, i) => i !== rowIdx));
  }

  async function saveReviewAndCommit() {
    if (!session) return;
    setCommitting(true);
    try {
      const reviewRes = await fetch(`/api/bundi-import/sessions/${session.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: reviewRows.map((cells) => ({ cells })) }),
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
      toast({ title: `${commitJson.data.created} students imported via Bundi`, tone: "success" });
    } finally {
      setCommitting(false);
    }
  }

  const fieldLabels = fields.filter((f) => f.label.trim()).map((f) => f.label);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {["Unlock code", "Describe fields", "Upload scan", "Review & import"].map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const active = step === n; const done = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-green-600 text-white" : active ? "bg-navy-900 text-white dark:bg-navy-100 dark:text-navy-900" : "bg-navy-100 text-navy-500 dark:bg-navy-800 dark:text-navy-400"}`}>
                {done ? "✓" : n}
              </span>
              <span className={active ? "text-navy-900 dark:text-navy-50" : "text-navy-400"}>{label}</span>
              {n < 4 && <span className="mx-1 h-px w-6 bg-navy-200 dark:bg-navy-700" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-green-600" /> Enter your Bundi unlock code</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-navy-500 dark:text-navy-400">
              Bundi handwritten import is a premium, founder-approved path. NEYO Ops issues your school a code — enter it below to continue.
            </p>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BUNDI-7F3A9C" className="max-w-xs font-mono" />
            {unlockError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="h-4 w-4" /> {unlockError}</p>
            )}
            <Button onClick={redeem} disabled={busy || !code.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Continue
            </Button>
            <p className="text-xs text-navy-400">
              Don&apos;t have a code? This isn&apos;t required for normal imports — go back and use the <Link href="/students/import" className="underline">standard import</Link> instead.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Describe your register&apos;s columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-navy-500 dark:text-navy-400">
              Before Bundi reads a single row, tell it what each column in YOUR register means — Bundi maps around your description, never the other way round.
            </p>
            {templateLoading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : templateError ? (
              <p className="text-sm text-red-600">Could not load your saved field description. You can still describe it fresh below.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border border-navy-100 p-3 dark:border-navy-800 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Column label, e.g. Adm No (old book)" />
                    <Input value={f.description} onChange={(e) => updateField(i, { description: e.target.value })} placeholder="Where it appears, e.g. top-left of each row" />
                    <select value={f.mapsTo} onChange={(e) => updateField(i, { mapsTo: e.target.value })} className="rounded-xl border border-navy-200 bg-white px-2 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                      {FIELD_OPTIONS.map((opt) => <option key={opt} value={opt}>{IMPORT_FIELD_LABELS[opt]}</option>)}
                    </select>
                    {f.mapsTo === "custom" ? (
                      <Input value={f.customLabel ?? ""} onChange={(e) => updateField(i, { customLabel: e.target.value })} placeholder="Custom label" />
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => removeField(i)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={addField}><Plus className="h-4 w-4" /> Add another column</Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={saveTemplate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Save & continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-4 w-4 text-green-600" /> Upload the scan or photo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-warm-50 px-6 py-10 text-center transition-colors duration-200 ease-apple hover:border-green-500 hover:bg-green-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:hover:bg-navy-800"
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-navy-400" /> : <UploadCloud className="h-8 w-8 text-navy-400" />}
              <span className="text-sm font-medium text-navy-700 dark:text-navy-200">Choose a photo or scanned page</span>
              <span className="text-xs text-navy-400">JPG, PNG or PDF — one page per upload</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {extractError && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Bundi can&apos;t read scans yet</p>
                  <p className="mt-0.5">{extractError}</p>
                </div>
              </div>
            )}
            <Button variant="secondary" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        result ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </span>
              <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{result.created} students imported</h2>
              {result.failed.length > 0 && (
                <p className="text-sm text-navy-500 dark:text-navy-400">{result.failed.length} row(s) were skipped — you can fix them and re-run a Bundi or standard import.</p>
              )}
              <Link href="/students"><Button><Users className="h-4 w-4" /> View students</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Review Bundi&apos;s reading — fix anything wrong before importing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {reviewRows.length === 0 ? (
                <p className="text-sm text-navy-400">No rows extracted.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 dark:border-navy-800">
                        {fieldLabels.map((l) => <th key={l} className="p-2 text-left text-xs font-semibold text-navy-500">{l}</th>)}
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {reviewRows.map((row, i) => (
                        <tr key={i} className="border-b border-navy-50 dark:border-navy-900">
                          {fieldLabels.map((l) => (
                            <td key={l} className="p-1.5">
                              <input
                                value={row[l] ?? ""}
                                onChange={(e) => updateCell(i, l, e.target.value)}
                                className="w-full rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-900"
                              />
                            </td>
                          ))}
                          <td className="p-1.5">
                            <button onClick={() => removeRow(i)} className="text-navy-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={saveReviewAndCommit} disabled={committing || reviewRows.length === 0}>
                  {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Import {reviewRows.length} student{reviewRows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
