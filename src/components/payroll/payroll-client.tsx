"use client";

/**
 * B.8 Payroll UI: Salaries (per-staff setup) · Runs (history + detail w/
 * payslip PDFs) · New run dialog (period + per-staff overtime, B.8.8).
 */
import * as React from "react";
import {
  Banknote, Plus, AlertCircle, Loader2, X, Check, FileText, Users, Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface SalaryRow { userId: string; name: string; role: string; basicKes: number; houseAllowanceKes: number; transportAllowanceKes: number; otherAllowanceKes: number; saccoKes: number; loanKes: number; grossKes: number; configured: boolean }
interface RunRow { id: string; period: string; status: string; staffCount: number; grossKes: number; netKes: number; payeKes: number; createdByName: string; approvedAt: string | null }
interface Slip { id: string; userName: string; role: string; basicKes: number; allowancesKes: number; overtimeKes: number; grossKes: number; payeKes: number; shifKes: number; nssfKes: number; housingLevyKes: number; saccoKes: number; loanKes: number; netKes: number }

export function PayrollClient() {
  const [tab, setTab] = React.useState<"runs" | "salaries">("runs");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        <button onClick={() => setTab("runs")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "runs" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Payroll runs</button>
        <button onClick={() => setTab("salaries")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "salaries" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Salaries</button>
      </div>
      {tab === "runs" ? <RunsTab /> : <SalariesTab />}
    </div>
  );
}

// ---- Salaries -------------------------------------------------------------------
function SalariesTab() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SalaryRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [edit, setEdit] = React.useState<SalaryRow | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/payroll?view=salaries");
      const json = await res.json();
      if (json.ok) setRows(json.data.salaries); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (rows === null) return <Skeletons />;

  return (
    <div className="space-y-3">
      <TableContainer>
        <Table>
          <THead><TR><TH>Staff</TH><TH align="right">Basic</TH><TH align="right">Allowances</TH><TH align="right">Gross</TH><TH align="right">SACCO</TH><TH align="right">Loan</TH><TH></TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.userId}>
                <TD>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-[10px] text-navy-400">{r.role.replaceAll("_", " ").toLowerCase()}</span>
                </TD>
                <TD align="right">{r.configured ? kes(r.basicKes) : <Badge tone="amber">not set</Badge>}</TD>
                <TD align="right">{r.configured ? kes(r.houseAllowanceKes + r.transportAllowanceKes + r.otherAllowanceKes) : "—"}</TD>
                <TD align="right" className="font-semibold">{r.configured ? kes(r.grossKes) : "—"}</TD>
                <TD align="right" className="text-navy-400">{r.saccoKes ? kes(r.saccoKes) : "—"}</TD>
                <TD align="right" className="text-navy-400">{r.loanKes ? kes(r.loanKes) : "—"}</TD>
                <TD><Button size="sm" variant="secondary" onClick={() => setEdit(r)}>Edit</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      {edit && <SalaryDialog row={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); toast({ title: "Salary saved", tone: "success" }); }} />}
    </div>
  );
}

function SalaryDialog({ row, onClose, onDone }: { row: SalaryRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({
    basicKes: String(row.basicKes || ""), houseAllowanceKes: String(row.houseAllowanceKes || ""),
    transportAllowanceKes: String(row.transportAllowanceKes || ""), otherAllowanceKes: String(row.otherAllowanceKes || ""),
    saccoKes: String(row.saccoKes || ""), loanKes: String(row.loanKes || ""),
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salary", userId: row.userId,
          basicKes: Number(f.basicKes) || 0, houseAllowanceKes: Number(f.houseAllowanceKes) || 0,
          transportAllowanceKes: Number(f.transportAllowanceKes) || 0, otherAllowanceKes: Number(f.otherAllowanceKes) || 0,
          saccoKes: Number(f.saccoKes) || 0, loanKes: Number(f.loanKes) || 0,
        }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`Salary — ${row.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Basic salary (KES/month)</Label><Input type="number" min={0} value={f.basicKes} onChange={set("basicKes")} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>House</Label><Input type="number" min={0} value={f.houseAllowanceKes} onChange={set("houseAllowanceKes")} /></div>
          <div><Label>Transport</Label><Input type="number" min={0} value={f.transportAllowanceKes} onChange={set("transportAllowanceKes")} /></div>
          <div><Label>Other</Label><Input type="number" min={0} value={f.otherAllowanceKes} onChange={set("otherAllowanceKes")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>SACCO /month</Label><Input type="number" min={0} value={f.saccoKes} onChange={set("saccoKes")} /></div>
          <div><Label>Loan repayment /month</Label><Input type="number" min={0} value={f.loanKes} onChange={set("loanKes")} /></div>
        </div>
        <Button onClick={save} disabled={saving || !f.basicKes} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save salary
        </Button>
      </div>
    </Modal>
  );
}

// ---- Runs ------------------------------------------------------------------------
function RunsTab() {
  const { toast } = useToast();
  const [runs, setRuns] = React.useState<RunRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<RunRow | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/payroll?view=runs");
      const json = await res.json();
      if (json.ok) setRuns(json.data.runs); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (detail) return <RunDetail run={detail} onBack={() => { setDetail(null); load(); }} />;
  if (error) return <LoadError onRetry={load} />;
  if (runs === null) return <Skeletons />;

  return (
    <div className="space-y-3">
      <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Run payroll</Button>
      {runs.length === 0 ? (
        <EmptyState icon={Banknote} title="No payroll runs yet" description="Set staff salaries first, then run a month — PAYE, SHIF, NSSF and the housing levy are computed automatically." />
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <button key={r.id} onClick={() => setDetail(r)} className="block w-full text-left">
              <Card className="transition-shadow duration-200 ease-apple hover:shadow-card">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{r.period}</p>
                    <p className="text-xs text-navy-400">{r.staffCount} staff · gross {kes(r.grossKes)} · PAYE {kes(r.payeKes)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">net {kes(r.netKes)}</span>
                    <Badge tone={r.status === "APPROVED" ? "green" : "amber"}>{r.status.toLowerCase()}</Badge>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
      {newOpen && <NewRunDialog onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); load(); toast({ title: "Payroll computed — review then approve", tone: "success" }); }} />}
    </div>
  );
}

function RunDetail({ run, onBack }: { run: RunRow; onBack: () => void }) {
  const { toast } = useToast();
  const [slips, setSlips] = React.useState<Slip[] | null>(null);
  const [status, setStatus] = React.useState(run.status);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/payroll?view=run&id=${run.id}`).then((r) => r.json()).then((j) => j.ok && setSlips(j.data.run.payslips));
  }, [run.id]);

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch("/api/payroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", runId: run.id }) });
      const json = await res.json();
      if (json.ok) { setStatus("APPROVED"); toast({ title: "Payroll approved & locked", tone: "success" }); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">← All runs</button>
        {status !== "APPROVED" ? (
          <Button size="sm" onClick={approve} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Approve & lock</Button>
        ) : (
          <Badge tone="green">approved</Badge>
        )}
      </div>
      <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Payroll {run.period}</h3>
      {slips === null ? <Skeletons /> : (
        <TableContainer>
          <Table>
            <THead><TR><TH>Staff</TH><TH align="right">Gross</TH><TH align="right">PAYE</TH><TH align="right">SHIF</TH><TH align="right">NSSF</TH><TH align="right">AHL</TH><TH align="right">Net</TH><TH></TH></TR></THead>
            <TBody>
              {slips.map((p) => (
                <TR key={p.id}>
                  <TD><span className="font-medium">{p.userName}</span>{p.overtimeKes > 0 && <span className="ml-1 text-[10px] text-amber-600">+OT {kes(p.overtimeKes)}</span>}</TD>
                  <TD align="right">{kes(p.grossKes)}</TD>
                  <TD align="right" className="text-navy-400">{kes(p.payeKes)}</TD>
                  <TD align="right" className="text-navy-400">{kes(p.shifKes)}</TD>
                  <TD align="right" className="text-navy-400">{kes(p.nssfKes)}</TD>
                  <TD align="right" className="text-navy-400">{kes(p.housingLevyKes)}</TD>
                  <TD align="right" className="font-semibold text-green-700 dark:text-green-400">{kes(p.netKes)}</TD>
                  <TD>
                    <a href={`/api/payroll/payslip/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400">
                      <FileText className="h-3.5 w-3.5" /> Payslip
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

function NewRunDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = React.useState(new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7));
  const [salaries, setSalaries] = React.useState<SalaryRow[]>([]);
  const [overtime, setOvertime] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/payroll?view=salaries").then((r) => r.json()).then((j) => j.ok && setSalaries(j.data.salaries.filter((s: SalaryRow) => s.configured)));
  }, []);

  async function run() {
    setSaving(true);
    try {
      const ot: Record<string, number> = {};
      for (const [k, v] of Object.entries(overtime)) if (Number(v) > 0) ot[k] = Number(v);
      const res = await fetch("/api/payroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", period, overtime: ot }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Run payroll" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Month</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        {salaries.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            No salaries configured — set them in the Salaries tab first.
          </p>
        ) : (
          <>
            <Label>Approved overtime (KES, optional — B.8.8)</Label>
            <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {salaries.map((s) => (
                <div key={s.userId} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-navy-700 dark:text-navy-200">{s.name}</span>
                  <Input type="number" min={0} className="w-28" placeholder="0" value={overtime[s.userId] ?? ""} onChange={(e) => setOvertime((p) => ({ ...p, [s.userId]: e.target.value }))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-navy-400"><Users className="mr-1 inline h-3 w-3" />{salaries.length} staff will be paid. PAYE, SHIF, NSSF & housing levy are computed automatically.</p>
          </>
        )}
        <Button onClick={run} disabled={saving || salaries.length === 0} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Compute payroll
        </Button>
      </div>
    </Modal>
  );
}

// ---- shared ------------------------------------------------------------------------
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}
function Skeletons() {
  return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
}
