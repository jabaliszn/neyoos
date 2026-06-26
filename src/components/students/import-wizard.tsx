"use client";

/**
 * B.1 Bulk Student Import — 3-step wizard (Chunks 5+6+7).
 * Step 1: Upload CSV/XLSX or paste rows copied from Google Sheets/Excel.
 * Step 2: Check the column mapping + preview + per-row issues.
 * Step 3: Commit -> result summary (created / failed with reasons).
 * All 4 UX states; mobile-first; ONE primary CTA per step.
 */
import * as React from "react";
import Link from "next/link";
import {
  UploadCloud, ClipboardPaste, FileSpreadsheet, ArrowLeft, ArrowRight,
  CheckCircle2, AlertCircle, Loader2, Users, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name", middleName: "Middle name", lastName: "Last name",
  fullName: "Full name", gender: "Gender (M/F)", dateOfBirth: "Date of birth",
  className: "Class", admissionNo: "Admission no", upiNumber: "UPI (NEMIS)",
  birthCertNo: "Birth cert no", guardianName: "Guardian name",
  guardianPhone: "Guardian phone", notes: "Notes", ignore: "— Skip column —",
};
const FIELD_OPTIONS = Object.keys(FIELD_LABELS);

interface PreviewData {
  source: "csv" | "xlsx" | "paste";
  fileName?: string;
  hasHeader: boolean;
  rows: string[][];
  header: string[];
  mapping: { column: number; field: string }[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sample: Record<string, unknown>[];
  issues: { row: number; message: string }[];
  unknownClasses: string[];
  duplicateInFileRows: number[];
  possibleExistingRows: number[];
}

interface CommitResult { importId: string; totalRows: number; created: number; failed: { row: number; message: string }[]; }
interface ImportHistoryRow {
  id: string; fileName: string | null; source: string; totalRows: number;
  createdRows: number; failedRows: number; createdByName: string; createdAt: string;
  errorRows: { row: number; message: string }[];
}

export function ImportWizard() {
  const { toast } = useToast();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [busy, setBusy] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [result, setResult] = React.useState<CommitResult | null>(null);
  const [skipInvalid, setSkipInvalid] = React.useState(true);
  const [history, setHistory] = React.useState<ImportHistoryRow[] | null>(null);
  const [historyError, setHistoryError] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadHistory = React.useCallback(async () => {
    setHistoryError(false);
    try {
      const res = await fetch("/api/students/import");
      const json = await res.json();
      if (json.ok) setHistory(json.data.imports);
      else setHistoryError(true);
    } catch { setHistoryError(true); }
  }, []);
  React.useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/students/import/preview", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Could not read that file.", tone: "error" }); return; }
      setPreview(json.data); setStep(2);
    } catch {
      toast({ title: "Upload failed. Check your connection and try again.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function handlePaste() {
    if (pasteText.trim().length < 10) { toast({ title: "Paste at least a header row and one student.", tone: "error" }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/students/import/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "paste", text: pasteText, hasHeader: true }),
      });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Could not read the pasted rows.", tone: "error" }); return; }
      setPreview(json.data); setStep(2);
    } catch {
      toast({ title: "Preview failed. Check your connection and try again.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function remap(column: number, field: string) {
    if (!preview) return;
    const mapping = preview.mapping.map((m) => (m.column === column ? { ...m, field } : m));
    setBusy(true);
    try {
      const res = await fetch("/api/students/import/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: preview.source, fileName: preview.fileName, rows: preview.rows, hasHeader: preview.hasHeader, mapping }),
      });
      const json = await res.json();
      if (json.ok) setPreview(json.data);
      else toast({ title: json.error?.message ?? "Mapping failed.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/students/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: preview.source, fileName: preview.fileName, rows: preview.rows,
          hasHeader: preview.hasHeader, mapping: preview.mapping,
          seedRequirements: true, skipInvalid,
        }),
      });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Import failed.", tone: "error" }); return; }
      setResult(json.data); setStep(3); loadHistory();
      toast({ title: `${json.data.created} students imported`, tone: "success" });
    } catch {
      toast({ title: "Import failed. Nothing was saved — try again.", tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* step indicator */}
      <ol className="flex items-center gap-2 text-xs font-medium">
        {["Upload or paste", "Check & preview", "Done"].map((label, i) => {
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
        <div className="grid gap-4 lg:grid-cols-2">
          {/* upload */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-green-600" /> Upload a file</CardTitle></CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-warm-50 px-6 py-10 text-center transition-colors duration-200 ease-apple hover:border-green-500 hover:bg-green-50 dark:border-navy-700 dark:bg-navy-900 dark:hover:bg-navy-800"
              >
                {busy ? <Loader2 className="h-8 w-8 animate-spin text-navy-400" /> : <UploadCloud className="h-8 w-8 text-navy-400" />}
                <span className="text-sm font-medium text-navy-700 dark:text-navy-200">Choose a CSV or Excel (.xlsx) file</span>
                <span className="text-xs text-navy-400">Max 1,000 students per file</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </CardContent>
          </Card>
          {/* paste */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardPaste className="h-4 w-4 text-green-600" /> Paste from Google Sheets</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-navy-500 dark:text-navy-400">
                In Google Sheets or Excel: select the rows (including the header row), copy, then paste below.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder={"Name\tAdm No\tClass\tSex\tParent Phone\nAchieng Mary Otieno\t\tForm 2 East\tF\t0712 345 678"}
                className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 font-mono text-xs text-navy-900 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-100"
              />
              <Button onClick={handlePaste} disabled={busy || pasteText.trim().length === 0} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Preview pasted rows
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          {/* summary strip */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{preview.totalRows} rows</Badge>
            <Badge tone="green">{preview.validRows} ready</Badge>
            {preview.invalidRows > 0 && <Badge tone="red">{preview.invalidRows} with problems</Badge>}
            {preview.unknownClasses.length > 0 && <Badge tone="blue">{preview.unknownClasses.length} new class{preview.unknownClasses.length > 1 ? "es" : ""} will be created</Badge>}
            {preview.duplicateInFileRows.length > 0 && <Badge tone="amber">{preview.duplicateInFileRows.length} duplicate rows in file</Badge>}
            {preview.possibleExistingRows.length > 0 && <Badge tone="amber">{preview.possibleExistingRows.length} may already exist</Badge>}
          </div>

          {/* column mapping */}
          <Card>
            <CardHeader><CardTitle>Column mapping</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-navy-500 dark:text-navy-400">
                NEYO guessed what each column contains. Fix any that are wrong — set columns you don&apos;t need to &ldquo;Skip&rdquo;.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.mapping.map((m) => (
                  <div key={m.column} className="flex items-center gap-2 rounded-xl border border-navy-100 bg-warm-50 px-3 py-2 dark:border-navy-800 dark:bg-navy-900">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-navy-600 dark:text-navy-300" title={preview.header[m.column]}>
                      {preview.header[m.column] || `Column ${m.column + 1}`}
                    </span>
                    <span className="text-navy-300">→</span>
                    <select
                      value={m.field}
                      disabled={busy}
                      onChange={(e) => remap(m.column, e.target.value)}
                      className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100"
                    >
                      {FIELD_OPTIONS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* sample preview */}
          <Card>
            <CardHeader><CardTitle>Preview (first {preview.sample.length} students)</CardTitle></CardHeader>
            <CardContent>
              {busy ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <TableContainer>
                  <Table>
                    <THead><TR><TH>Row</TH><TH>Name</TH><TH>Gender</TH><TH>Class</TH><TH>Guardian</TH><TH>Status</TH></TR></THead>
                    <TBody>
                      {preview.sample.map((s) => {
                        const issues = (s._issues as string[]) ?? [];
                        return (
                          <TR key={s._row as number}>
                            <TD className="text-navy-400">{s._row as number}</TD>
                            <TD className="font-medium">{[s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ")}</TD>
                            <TD>{s.gender as string}</TD>
                            <TD>{(s.className as string) ?? <span className="text-navy-300">—</span>}</TD>
                            <TD className="text-xs">{(s.guardianName as string) ?? ""} {(s.guardianPhone as string) ?? ""}</TD>
                            <TD>
                              {issues.length === 0
                                ? <Badge tone="green">ready</Badge>
                                : <span className="text-xs text-red-600" title={issues.join(" ")}>{issues[0]}</span>}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableContainer>
              )}
              {preview.issues.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300"><AlertCircle className="h-3.5 w-3.5" /> {preview.issues.length} row(s) need fixing</p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                    {preview.issues.map((iss) => <li key={iss.row}>Row {iss.row}: {iss.message}</li>)}
                  </ul>
                  <label className="mt-2 flex items-center gap-2 text-xs text-navy-700 dark:text-navy-200">
                    <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                    Skip rows with problems and import the rest
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => { setPreview(null); setStep(1); }} disabled={busy}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={commit} disabled={busy || preview.validRows === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Import {preview.validRows} student{preview.validRows === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </span>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{result.created} students imported</h2>
            <p className="text-sm text-navy-500 dark:text-navy-400">
              {result.failed.length > 0
                ? `${result.failed.length} row(s) were skipped — fix them in your sheet and import just those rows again.`
                : "Every row was imported successfully."}
            </p>
            {result.failed.length > 0 && (
              <ul className="max-h-32 w-full max-w-md space-y-0.5 overflow-y-auto rounded-xl bg-warm-50 p-3 text-left text-xs text-red-600 dark:bg-navy-900 dark:text-red-400">
                {result.failed.map((f) => <li key={f.row}>Row {f.row}: {f.message}</li>)}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => { setStep(1); setPreview(null); setResult(null); setPasteText(""); }}>Import more</Button>
              <Link href="/students"><Button><Users className="h-4 w-4" /> View students</Button></Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* import history */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-navy-400" /> Recent imports</CardTitle></CardHeader>
        <CardContent>
          {historyError ? (
            <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              Could not load import history.
              <Button size="sm" variant="secondary" onClick={loadHistory}>Retry</Button>
            </div>
          ) : history === null ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No imports yet"
              description="When you import a student list, a record of it appears here."
            />
          ) : (
            <TableContainer>
              <Table>
                <THead><TR><TH>When</TH><TH>File</TH><TH>By</TH><TH align="right">Rows</TH><TH align="right">Created</TH><TH align="right">Failed</TH></TR></THead>
                <TBody>
                  {history.map((h) => (
                    <TR key={h.id}>
                      <TD className="text-xs text-navy-500">{new Date(h.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</TD>
                      <TD className="text-xs">{h.fileName ?? <span className="text-navy-400">pasted rows</span>} <Badge tone="neutral">{h.source}</Badge></TD>
                      <TD className="text-xs">{h.createdByName}</TD>
                      <TD align="right">{h.totalRows}</TD>
                      <TD align="right" className="font-medium text-green-700 dark:text-green-400">{h.createdRows}</TD>
                      <TD align="right" className={h.failedRows > 0 ? "font-medium text-red-600" : "text-navy-300"}>{h.failedRows}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
