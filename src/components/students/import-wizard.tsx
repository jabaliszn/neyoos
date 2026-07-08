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
  guardianPhone: "Guardian phone", notes: "Notes",
  openingBalanceKes: "Opening balance (KES)",
  custom: "Custom field (school-defined)…", ignore: "— Skip column —",
};
const FIELD_OPTIONS = Object.keys(FIELD_LABELS);

interface ClassOption { id: string; level: string; stream: string | null; name: string; archived: boolean; }

interface MatchedRow {
  row: number;
  matchedOn: "admissionNo" | "upiNumber" | "birthCertNo" | "name+dob" | "name+guardianPhone";
  studentId: string;
  studentLabel: string;
  fillable: string[];
  conflicts: { field: string; existingValue: string; newValue: string }[];
}

interface PreviewData {
  source: "csv" | "xlsx" | "paste";
  fileName?: string;
  hasHeader: boolean;
  rows: string[][];
  header: string[];
  mapping: { column: number; field: string; customLabel?: string }[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sample: Record<string, unknown>[];
  issues: { row: number; message: string }[];
  unknownClasses: string[];
  duplicateInFileRows: number[];
  possibleExistingRows: number[];
  matchedRows: MatchedRow[];
  targetClass: { id: string; label: string } | null;
}

interface CommitResult { importId: string; totalRows: number; created: number; updated: number; failed: { row: number; message: string }[]; }
interface ImportHistoryRow {
  id: string; fileName: string | null; source: string; totalRows: number;
  createdRows: number; updatedRows: number; failedRows: number; createdByName: string; createdAt: string;
  errorRows: { row: number; message: string }[];
}

const MATCH_LABELS: Record<MatchedRow["matchedOn"], string> = {
  admissionNo: "admission number",
  upiNumber: "UPI/NEMIS number",
  birthCertNo: "birth certificate number",
  "name+dob": "name + date of birth",
  "name+guardianPhone": "name + guardian's phone",
};

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

  // M.4 — "single class only" mode: every row lands in one chosen class,
  // ignoring any Class column in the file and never auto-creating classes.
  const [classes, setClasses] = React.useState<ClassOption[] | null>(null);
  const [importMode, setImportMode] = React.useState<"auto" | "single">("auto");
  const [targetClassId, setTargetClassId] = React.useState<string>("");

  // R.1 — smart create-or-update: on by default (re-importing a register
  // enriches existing students instead of always failing as a duplicate).
  const [updateExisting, setUpdateExisting] = React.useState(true);
  // Rows where the school has explicitly reviewed a real conflict (e.g. two
  // different birth dates) and confirmed the NEW value should win.
  const [confirmedConflictRows, setConfirmedConflictRows] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => { if (j.ok) setClasses(j.data.classes); });
  }, []);

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

  const activeTargetClassId = importMode === "single" && targetClassId ? targetClassId : undefined;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (activeTargetClassId) fd.append("targetClassId", activeTargetClassId);
      fd.append("updateExisting", String(updateExisting));
      const res = await fetch("/api/students/import/preview", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Could not read that file.", tone: "error" }); return; }
      setPreview(json.data); setConfirmedConflictRows(new Set()); setStep(2);
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
        body: JSON.stringify({ source: "paste", text: pasteText, hasHeader: true, targetClassId: activeTargetClassId, updateExisting }),
      });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Could not read the pasted rows.", tone: "error" }); return; }
      setPreview(json.data); setConfirmedConflictRows(new Set()); setStep(2);
    } catch {
      toast({ title: "Preview failed. Check your connection and try again.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function remap(column: number, field: string, customLabel?: string) {
    if (!preview) return;
    const mapping = preview.mapping.map((m) => (m.column === column ? { ...m, field, customLabel } : m));
    setBusy(true);
    try {
      const res = await fetch("/api/students/import/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: preview.source, fileName: preview.fileName, rows: preview.rows, hasHeader: preview.hasHeader,
          mapping, targetClassId: preview.targetClass?.id ?? activeTargetClassId, updateExisting,
        }),
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
          targetClassId: preview.targetClass?.id ?? activeTargetClassId,
          updateExisting, confirmedConflictRows: [...confirmedConflictRows],
        }),
      });
      const json = await res.json();
      if (!json.ok) { toast({ title: json.error?.message ?? "Import failed.", tone: "error" }); return; }
      setResult(json.data); setStep(3); loadHistory();
      const parts = [`${json.data.created} created`];
      if (json.data.updated > 0) parts.push(`${json.data.updated} updated`);
      toast({ title: `Import complete: ${parts.join(", ")}`, tone: "success" });
    } catch {
      toast({ title: "Import failed. Nothing was saved — try again.", tone: "error" });
    } finally { setBusy(false); }
  }

  function toggleConflictConfirm(row: number) {
    setConfirmedConflictRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row); else next.add(row);
      return next;
    });
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
        <div className="space-y-4">
          {/* M.5 — separate premium path for handwritten/messy paper registers */}
          <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-warm-50 px-4 py-3 text-xs dark:border-navy-800 dark:bg-navy-900">
            <span className="text-navy-500 dark:text-navy-400">Got a handwritten or messy paper register instead of a spreadsheet?</span>
            <Link href="/students/import/bundi" className="font-semibold text-green-700 hover:underline dark:text-green-400">Try Bundi import →</Link>
          </div>
          {/* M.4 — single-class-only import mode */}
          <Card>
            <CardHeader><CardTitle>Where should these students go?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode("auto")}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors duration-200 ease-apple ${importMode === "auto" ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300" : "border-navy-200 bg-white text-navy-600 hover:border-navy-300 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300"}`}
                >
                  <span className="block font-semibold">Use the Class column in my file</span>
                  <span className="block text-navy-400">NEYO reads each row&apos;s class and creates any new classes automatically.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("single")}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors duration-200 ease-apple ${importMode === "single" ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300" : "border-navy-200 bg-white text-navy-600 hover:border-navy-300 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300"}`}
                >
                  <span className="block font-semibold">Put everyone in one class</span>
                  <span className="block text-navy-400">Ignore any Class column — every student in this file goes into one class you pick.</span>
                </button>
              </div>
              {importMode === "single" && (
                classes === null ? (
                  <Skeleton className="h-9 w-full max-w-xs" />
                ) : classes.length === 0 ? (
                  <p className="text-xs text-red-600">No classes exist yet. Create a class first, or switch to the &ldquo;Use the Class column&rdquo; option.</p>
                ) : (
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100"
                  >
                    <option value="">Choose a class…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )
              )}
            </CardContent>
          </Card>

          {/* R.1 — smart create-or-update toggle */}
          <Card>
            <CardHeader><CardTitle>Re-importing an updated register?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-warm-50 px-3 py-2.5 dark:border-navy-800 dark:bg-navy-900">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-navy-600 dark:text-navy-300">
                  <span className="block font-semibold text-navy-900 dark:text-navy-50">Update matching students instead of rejecting them as duplicates (recommended)</span>
                  A row that matches an existing learner (by admission number, UPI, birth certificate, or name + guardian phone) fills in any missing information — it never creates a second record for the same child. Genuine conflicts (e.g. two different birth dates) are always shown to you before anything is changed.
                </span>
              </label>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
          {/* upload */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-green-600" /> Upload a file</CardTitle></CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || (importMode === "single" && !targetClassId)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-warm-50 px-6 py-10 text-center transition-colors duration-200 ease-apple hover:border-green-500 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:hover:bg-navy-800"
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
              <Button onClick={handlePaste} disabled={busy || pasteText.trim().length === 0 || (importMode === "single" && !targetClassId)} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Preview pasted rows
              </Button>
            </CardContent>
          </Card>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          {/* summary strip */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{preview.totalRows} rows</Badge>
            <Badge tone="green">{preview.validRows} ready</Badge>
            {preview.invalidRows > 0 && <Badge tone="red">{preview.invalidRows} with problems</Badge>}
            {preview.targetClass ? (
              <Badge tone="blue">All students → {preview.targetClass.label}</Badge>
            ) : (
              preview.unknownClasses.length > 0 && <Badge tone="blue">{preview.unknownClasses.length} new class{preview.unknownClasses.length > 1 ? "es" : ""} will be created</Badge>
            )}
            {preview.duplicateInFileRows.length > 0 && <Badge tone="amber">{preview.duplicateInFileRows.length} duplicate rows in file</Badge>}
            {preview.matchedRows.length > 0 && <Badge tone="blue">{preview.matchedRows.length} row{preview.matchedRows.length > 1 ? "s" : ""} will update an existing learner</Badge>}
          </div>

          {/* R.1 — matched rows: what will be updated, and any real conflicts */}
          {preview.matchedRows.length > 0 && (
            <Card>
              <CardHeader><CardTitle>These rows match learners already in NEYO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-navy-500 dark:text-navy-400">
                  NEYO will fill in any new information on the SAME real student — never create a second record. Review any conflicts below before importing.
                </p>
                {preview.matchedRows.map((m) => (
                  <div key={m.row} className="rounded-xl border border-navy-100 bg-warm-50 p-3 text-xs dark:border-navy-800 dark:bg-navy-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-navy-800 dark:text-navy-100">Row {m.row} → {m.studentLabel}</span>
                      <Badge tone="blue">matched by {MATCH_LABELS[m.matchedOn]}</Badge>
                    </div>
                    {m.fillable.length > 0 && (
                      <p className="mt-1.5 text-green-700 dark:text-green-400">Will add: {m.fillable.join(", ")}</p>
                    )}
                    {m.conflicts.length > 0 && (
                      <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                        {m.conflicts.map((c) => (
                          <p key={c.field} className="text-amber-800 dark:text-amber-300">
                            <span className="font-semibold">{c.field}</span> differs — on file: &ldquo;{c.existingValue}&rdquo;, in this file: &ldquo;{c.newValue}&rdquo;.
                          </p>
                        ))}
                        <label className="flex items-center gap-2 pt-1 text-amber-900 dark:text-amber-200">
                          <input
                            type="checkbox"
                            checked={confirmedConflictRows.has(m.row)}
                            onChange={() => toggleConflictConfirm(m.row)}
                            className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          Yes, use the NEW value(s) from this file for row {m.row}
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* column mapping */}
          <Card>
            <CardHeader><CardTitle>Column mapping</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-navy-500 dark:text-navy-400">
                NEYO guessed what each column contains. Fix any that are wrong — set columns you don&apos;t need to &ldquo;Skip&rdquo;.
                Pick &ldquo;Custom field&rdquo; for anything school-specific (like House or Sponsor) and type your own label.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.mapping.map((m) => (
                  <div key={m.column} className="flex flex-col gap-1.5 rounded-xl border border-navy-100 bg-warm-50 px-3 py-2 dark:border-navy-800 dark:bg-navy-900">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-navy-600 dark:text-navy-300" title={preview.header[m.column]}>
                        {preview.header[m.column] || `Column ${m.column + 1}`}
                      </span>
                      <span className="text-navy-300">→</span>
                      <select
                        value={m.field}
                        disabled={busy}
                        onChange={(e) => remap(m.column, e.target.value, e.target.value === "custom" ? (m.customLabel || "") : undefined)}
                        className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100"
                      >
                        {FIELD_OPTIONS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                      </select>
                    </div>
                    {m.field === "custom" && (
                      <input
                        type="text"
                        defaultValue={m.customLabel ?? ""}
                        placeholder="Label, e.g. House, Sponsor"
                        disabled={busy}
                        onBlur={(e) => { if (e.target.value.trim() !== (m.customLabel ?? "")) remap(m.column, "custom", e.target.value.trim()); }}
                        className="w-full rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-900 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100"
                      />
                    )}
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
                    <THead>
                      <TR>
                        <TH>Row</TH><TH>Name</TH><TH>Gender</TH><TH>Class</TH><TH>Guardian</TH>
                        {preview.mapping.some((m) => m.field === "custom") && <TH>Custom fields</TH>}
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {preview.sample.map((s) => {
                        const issues = (s._issues as string[]) ?? [];
                        const customFields = (s._customFields as { label: string; value: string }[] | undefined) ?? [];
                        return (
                          <TR key={s._row as number}>
                            <TD className="text-navy-400">{s._row as number}</TD>
                            <TD className="font-medium">{[s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ")}</TD>
                            <TD>{s.gender as string}</TD>
                            <TD>{preview.targetClass ? preview.targetClass.label : ((s.className as string) ?? <span className="text-navy-300">—</span>)}</TD>
                            <TD className="text-xs">{(s.guardianName as string) ?? ""} {(s.guardianPhone as string) ?? ""}</TD>
                            {preview.mapping.some((m) => m.field === "custom") && (
                              <TD className="text-xs">
                                {customFields.length === 0
                                  ? <span className="text-navy-300">—</span>
                                  : customFields.map((f) => `${f.label}: ${f.value}`).join(", ")}
                              </TD>
                            )}
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
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">
              {result.created} student{result.created === 1 ? "" : "s"} imported{result.updated > 0 ? ` · ${result.updated} updated` : ""}
            </h2>
            <p className="text-sm text-navy-500 dark:text-navy-400">
              {result.failed.length > 0
                ? `${result.failed.length} row(s) need review — some may be conflicts that need your confirmation, others may just need fixing in your sheet.`
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
                <THead><TR><TH>When</TH><TH>File</TH><TH>By</TH><TH align="right">Rows</TH><TH align="right">Created</TH><TH align="right">Updated</TH><TH align="right">Failed</TH></TR></THead>
                <TBody>
                  {history.map((h) => (
                    <TR key={h.id}>
                      <TD className="text-xs text-navy-500">{new Date(h.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</TD>
                      <TD className="text-xs">{h.fileName ?? <span className="text-navy-400">pasted rows</span>} <Badge tone="neutral">{h.source}</Badge></TD>
                      <TD className="text-xs">{h.createdByName}</TD>
                      <TD align="right">{h.totalRows}</TD>
                      <TD align="right" className="font-medium text-green-700 dark:text-green-400">{h.createdRows}</TD>
                      <TD align="right" className={h.updatedRows > 0 ? "font-medium text-blue-700 dark:text-blue-400" : "text-navy-300"}>{h.updatedRows}</TD>
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
