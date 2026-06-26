"use client";

/**
 * B.7 Finance hub (Part 1): Overview (aging + collection) · Invoices ·
 * Fee structures (+ batch invoicing). Payments tab links to A.6 payments page.
 * All 4 UX states; KES formatting everywhere.
 */
import * as React from "react";
import {
  Wallet, Plus, AlertCircle, Loader2, X, Layers3, FileText, Banknote,
  TrendingUp, Check, Search, Smartphone, Printer, Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface Structure { id: string; name: string; level: string; classId?: string | null; year: number; term: number; totalKes: number; items: { id: string; label: string; amountKes: number }[]; invoiceCount: number }
interface InvoiceRow { id: string; invoiceNo: string; description: string; totalKes: number; paidKes: number; discountKes: number; balanceKes: number; status: string; dueDate: string; studentName: string; admissionNo: string; className: string | null; printCount: number }
interface Aging { totalOutstanding: number; collectedKes: number; billedKes: number; collectionRate: number; buckets: { current: number; d30: number; d60: number; d90: number }; openCount: number }
interface LeaderboardRow { classId: string; className: string; classTeacherName: string; learnerCount: number; billedKes: number; collectedKes: number; outstandingKes: number; collectionRate: number }

const STATUS_TONE: Record<string, "green" | "amber" | "red"> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };

export function FinanceClient({ canStructure, canInvoice, canRecord }: { canStructure: boolean; canInvoice: boolean; canRecord: boolean }) {
  const [tab, setTab] = React.useState<"overview" | "invoices" | "structures" | "promises">("overview");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        {([["overview", "Overview"], ["invoices", "Invoices"], ["structures", "Fee structures"], ["promises", "Promises Calendar"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
            {label}
          </button>
        ))}
        <a href="/finance/payments" className="rounded-full px-4 py-1.5 text-sm font-medium text-navy-500">M-Pesa payments ↗</a>
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "invoices" && <InvoicesTab canInvoice={canInvoice} canRecord={canRecord} />}
      {tab === "structures" && <StructuresTab canStructure={canStructure} canInvoice={canInvoice} />}
      {tab === "promises" && <PromisesTab />}
    </div>
  );
}

// ---- Overview -------------------------------------------------------------------
function OverviewTab() {
  const { toast } = useToast();
  const [aging, setAging] = React.useState<Aging | null>(null);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardRow[]>([]);
  const [reminding, setReminding] = React.useState(false);
  const [digesting, setDigesting] = React.useState(false);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(async () => {
    setError(false);
    try {
      const [agingRes, leaderboardRes] = await Promise.all([
        fetch("/api/finance/invoices?aging=1").then((r) => r.json()),
        fetch("/api/finance/leaderboard").then((r) => r.json()).catch(() => ({ ok: false })),
      ]);
      if (agingRes.ok) setAging(agingRes.data); else setError(true);
      if (leaderboardRes.ok) setLeaderboard(leaderboardRes.data.leaderboard ?? []);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function sendReminders() {
    setReminding(true);
    try {
      const res = await fetch("/api/finance/reminders", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not send reminders.");
      toast({ title: `Fee reminders sent to ${json.data.families} families`, description: `${json.data.sentSms} SMS · ${json.data.sentInApp} in-app · ${kes(json.data.totalBalanceKes)} total balance`, tone: "success" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not send reminders.", tone: "error" });
    } finally {
      setReminding(false);
    }
  }

  async function sendDigest(cadence: "daily" | "weekly") {
    setDigesting(true);
    try {
      const res = await fetch("/api/finance/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cadence }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not send digest.");
      toast({ title: `${cadence === "daily" ? "Daily" : "Weekly"} digest sent`, description: `${json.data.sentSms} SMS · ${json.data.sentInApp} in-app`, tone: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not send digest.", tone: "error" });
    } finally {
      setDigesting(false);
    }
  }

  if (error) return <LoadError onRetry={load} />;
  if (aging === null) return <div className="grid gap-3 sm:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;

  const b = aging.buckets;
  const maxBucket = Math.max(b.current, b.d30, b.d60, b.d90, 1);
  const rows: [string, number, string][] = [
    ["Not yet due", b.current, "bg-navy-300"],
    ["1–30 days late", b.d30, "bg-amber-400"],
    ["31–60 days late", b.d60, "bg-orange-500"],
    ["Over 60 days late", b.d90, "bg-red-500"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Outstanding fees" value={kes(aging.totalOutstanding)} icon={Wallet} tone="navy" />
        <StatCard label="Collected (invoiced)" value={kes(aging.collectedKes)} icon={Banknote} tone="green" />
        <StatCard label="Collection rate" value={`${aging.collectionRate}%`} icon={TrendingUp} tone={aging.collectionRate >= 70 ? "green" : "navy"} />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-navy-900 dark:text-navy-50">One-tap fee reminders to all who owe</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Smart SMS + parent in-app reminders include balance, M-Pesa account number and parent portal/Mzazi prompt.</p>
          </div>
          <Button onClick={sendReminders} disabled={reminding || aging.openCount === 0}>
            {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Send reminders now
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-navy-900 dark:text-navy-50">Automated fee digest to bursar & principal</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Daily/weekly summary: collected, outstanding, open invoices and top balances. Scheduled automatically; buttons let you send now.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => sendDigest("daily")} disabled={digesting}>{digesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Daily</Button>
            <Button variant="secondary" onClick={() => sendDigest("weekly")} disabled={digesting}>{digesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />} Weekly</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fee collection leaderboard by class/stream</CardTitle></CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="py-4 text-center text-sm text-navy-400">No class fee data yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {leaderboard.slice(0, 6).map((row, idx) => (
                <li key={row.classId} className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-navy-900 dark:text-navy-50">#{idx + 1} {row.className}</p>
                      <p className="text-[10px] text-navy-400">{row.classTeacherName} · {row.learnerCount} learner{row.learnerCount === 1 ? "" : "s"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-green-700 dark:text-green-400">{row.collectionRate}%</p>
                      <p className="text-[10px] text-navy-400">{kes(row.collectedKes)} / {kes(row.billedKes)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, row.collectionRate)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Arrears aging — {aging.openCount} open invoice{aging.openCount === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {aging.totalOutstanding === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">Nothing outstanding. 🎉</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map(([label, amount, color]) => (
                <li key={label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-navy-700 dark:text-navy-200">{label}</span>
                    <span className="font-medium text-navy-900 dark:text-navy-50">{kes(amount)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(amount / maxBucket) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Invoices --------------------------------------------------------------------
function InvoicesTab({ canInvoice, canRecord }: { canInvoice: boolean; canRecord: boolean }) {
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<InvoiceRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [q, setQ] = React.useState("");
  const [manualOpen, setManualOpen] = React.useState(false);
  const [payInvoice, setPayInvoice] = React.useState<InvoiceRow | null>(null);
  const [stkInvoice, setStkInvoice] = React.useState<InvoiceRow | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (q) p.set("q", q);
      const res = await fetch(`/api/finance/invoices?${p}`);
      const json = await res.json();
      if (json.ok) setInvoices(json.data.invoices); else setError(true);
    } catch { setError(true); }
  }, [status, q]);
  React.useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-navy-200 bg-white px-3.5 py-2 dark:border-navy-700 dark:bg-navy-900">
          <Search className="h-4 w-4 text-navy-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice no, student, adm no…" className="w-full bg-transparent text-sm outline-none placeholder:text-navy-400 dark:text-navy-50" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option>
        </select>
        {canInvoice && <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" /> Manual invoice</Button>}
      </div>

      {error ? <LoadError onRetry={load} /> : invoices === null ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices" description="Create a fee structure and batch-invoice a whole class level in one click, or raise a manual invoice." />
      ) : (
        <TableContainer>
          <Table>
            <THead><TR><TH>Invoice</TH><TH>Student</TH><TH align="right">Total</TH><TH align="right">Paid</TH><TH align="right">Balance</TH><TH>Due</TH><TH>Status</TH>{canRecord && <TH></TH>}</TR></THead>
            <TBody>
              {invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <span className="font-mono text-xs">{inv.invoiceNo}</span>
                    <span className="block text-[11px] text-navy-400">{inv.description}</span>
                  </TD>
                  <TD>
                    <span className="font-medium">{inv.studentName}</span>
                    <span className="block font-mono text-[10px] text-navy-400">{inv.admissionNo}{inv.className ? ` · ${inv.className}` : ""}</span>
                  </TD>
                  <TD align="right">{kes(inv.totalKes)}</TD>
                  <TD align="right" className="text-green-700 dark:text-green-400">{kes(inv.paidKes)}</TD>
                  <TD align="right" className={inv.balanceKes > 0 ? "font-semibold text-red-600" : "text-navy-300"}>{kes(inv.balanceKes)}</TD>
                  <TD className="text-xs text-navy-400">{inv.dueDate}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[inv.status] ?? "amber"}>{inv.status.toLowerCase()}</Badge>
                    {inv.printCount > 0 && <span className="ml-1 align-middle text-[10px] text-navy-400" title="Times printed">🖨 {inv.printCount}</span>}
                  </TD>
                  {canRecord && (
                    <TD>
                      <div className="flex gap-1">
                        {inv.balanceKes > 0 && (
                          <>
                            <Button size="sm" onClick={() => setStkInvoice(inv)}><Smartphone className="h-3.5 w-3.5" /> M-Pesa</Button>
                            <Button size="sm" variant="secondary" onClick={() => setPayInvoice(inv)}><Banknote className="h-3.5 w-3.5" /> Cash</Button>
                          </>
                        )}
                        <a href={`/api/finance/invoices/${inv.id}/pdf`}>
                          <Button size="sm" variant="ghost"><Printer className="h-3.5 w-3.5" /> Print</Button>
                        </a>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {manualOpen && <ManualInvoiceDialog onClose={() => setManualOpen(false)} onDone={() => { setManualOpen(false); load(); toast({ title: "Invoice created", tone: "success" }); }} />}
      {payInvoice && <PayDialog invoice={payInvoice} onClose={() => setPayInvoice(null)} onDone={() => { setPayInvoice(null); load(); toast({ title: "Payment recorded", tone: "success" }); }} />}
      {stkInvoice && <StkDialog invoice={stkInvoice} onClose={() => setStkInvoice(null)} onDone={() => { setStkInvoice(null); load(); toast({ title: "STK push sent — parent's phone will prompt for the PIN", tone: "success" }); }} />}
    </div>
  );
}

function PayDialog({ invoice, onClose, onDone }: { invoice: InvoiceRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = React.useState(String(invoice.balanceKes));
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/invoices?id=${invoice.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountKes: Number(amount) }) });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title={`Record payment — ${invoice.invoiceNo}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">
          {invoice.studentName} · balance <span className="font-semibold text-red-600">{kes(invoice.balanceKes)}</span>
        </p>
        <div><Label>Amount received (KES)</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <p className="text-xs text-navy-400">Cash/offline entry. M-Pesa STK push arrives with Finance Part 2.</p>
        <Button onClick={save} disabled={saving || !amount || Number(amount) < 1} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Record {amount ? kes(Number(amount)) : ""}
        </Button>
      </div>
    </Modal>
  );
}

function StkDialog({ invoice, onClose, onDone }: { invoice: InvoiceRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState(String(invoice.balanceKes));
  const [saving, setSaving] = React.useState(false);
  async function send() {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/invoices/${invoice.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stk", phone, amountKes: Number(amount) }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "STK push failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title={`M-Pesa STK — ${invoice.invoiceNo}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">
          {invoice.studentName} · balance <span className="font-semibold text-red-600">{kes(invoice.balanceKes)}</span>
        </p>
        <div><Label>Parent&apos;s M-Pesa phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></div>
        <div><Label>Amount (KES)</Label><Input type="number" min={1} max={invoice.balanceKes} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <p className="text-xs text-navy-400">The parent gets an M-Pesa prompt on their phone. When they enter their PIN, the invoice updates automatically and they receive a confirmation SMS.</p>
        <Button onClick={send} disabled={saving || !phone || !amount} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Send STK push
        </Button>
      </div>
    </Modal>
  );
}

function ManualInvoiceDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ id: string; title: string; subtitle: string }[]>([]);
  const [student, setStudent] = React.useState<{ id: string; title: string } | null>(null);
  const [f, setF] = React.useState({ description: "", totalKes: "", dueDate: "", year: new Date().getFullYear(), term: 2 });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) setHits(json.data.hits.filter((h: { type: string }) => h.type === "student"));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function save() {
    if (!student) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, description: f.description, totalKes: Number(f.totalKes), dueDate: f.dueDate, year: f.year, term: f.term }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Manual invoice" onClose={onClose}>
      <div className="space-y-3">
        {student ? (
          <p className="flex items-center justify-between rounded-xl bg-warm-50 px-3 py-2 text-sm dark:bg-navy-800">
            <span className="font-medium">{student.title}</span>
            <button onClick={() => setStudent(null)} className="text-xs text-navy-400 underline">change</button>
          </p>
        ) : (
          <div className="relative">
            <Label>Student</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or adm no…" />
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-2xl border border-navy-100 bg-white p-1 shadow-card dark:border-navy-700 dark:bg-navy-900">
                {hits.map((h) => (
                  <button key={h.id} onClick={() => { setStudent({ id: h.id, title: h.title }); setHits([]); setQ(""); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-navy-50 dark:hover:bg-navy-800">
                    {h.title} <span className="text-xs text-navy-400">{h.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Damaged library book" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Amount (KES)</Label><Input type="number" min={1} value={f.totalKes} onChange={(e) => setF({ ...f, totalKes: e.target.value })} /></div>
          <div><Label>Due date</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        </div>
        <Button onClick={save} disabled={saving || !student || f.description.length < 3 || !f.totalKes || !f.dueDate} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create invoice
        </Button>
      </div>
    </Modal>
  );
}

// ---- Structures ------------------------------------------------------------------
function StructuresTab({ canStructure, canInvoice }: { canStructure: boolean; canInvoice: boolean }) {
  const { toast } = useToast();
  const [structures, setStructures] = React.useState<Structure[] | null>(null);
  const [error, setError] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [batchFor, setBatchFor] = React.useState<Structure | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/finance/structures");
      const json = await res.json();
      if (json.ok) setStructures(json.data.structures); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (structures === null) return <div className="grid gap-3 sm:grid-cols-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-4">
      {canStructure && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New fee structure</Button>}
      {structures.length === 0 ? (
        <EmptyState icon={Layers3} title="No fee structures" description="Define what each class level pays per term (tuition, boarding, activity…), then invoice everyone in one click." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {structures.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <Badge tone={s.classId ? "blue" : "neutral"}>{s.classId ? "exact class" : kes(s.totalKes)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1">
                  {s.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-sm">
                      <span className="text-navy-600 dark:text-navy-300">{i.label}</span>
                      <span className="font-medium text-navy-900 dark:text-navy-50">{kes(i.amountKes)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-navy-50 pt-3 dark:border-navy-800">
                  <p className="text-xs text-navy-400">{s.invoiceCount} invoice{s.invoiceCount === 1 ? "" : "s"} issued</p>
                  {canInvoice && (
                    <Button size="sm" onClick={() => setBatchFor(s)}><FileText className="h-3.5 w-3.5" /> Invoice the level</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {createOpen && <StructureDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); toast({ title: "Fee structure saved", tone: "success" }); }} />}
      {batchFor && <BatchDialog structure={batchFor} onClose={() => setBatchFor(null)} onDone={(msg) => { setBatchFor(null); load(); toast({ title: msg, tone: "success" }); }} />}
    </div>
  );
}

function StructureDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [level, setLevel] = React.useState("");
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [term, setTerm] = React.useState(2);
  const [items, setItems] = React.useState<{ label: string; amountKes: string }[]>([{ label: "Tuition", amountKes: "" }]);
  const [classId, setClassId] = React.useState("");
  const [classes, setClasses] = React.useState<{ id: string; name: string; level: string }[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => {
      if (j.ok) setClasses(j.data.classes);
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/structures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, classId: classId || undefined, year, term, items: items.filter((i) => i.label && i.amountKes).map((i) => ({ label: i.label, amountKes: Number(i.amountKes) })) }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  const total = items.reduce((a, i) => a + (Number(i.amountKes) || 0), 0);

  return (
    <Modal title="New fee structure" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1"><Label>Level</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Form 2" /></div>
          <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
          <div>
            <Label>Term</Label>
            <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Exact class / stream override (optional)</Label>
          <select value={classId} onChange={(e) => {
            const id = e.target.value;
            setClassId(id);
            const cls = classes.find((c) => c.id === id);
            if (cls) setLevel(cls.level);
          }} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
            <option value="">All streams at this level</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-navy-400">Use this when Form 2 East and Form 2 West pay different amounts.</p>
        </div>
        <Label>Fee items</Label>
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <Input value={it.label} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} placeholder="e.g. Boarding" />
            <Input type="number" min={1} className="w-32" value={it.amountKes} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, amountKes: e.target.value } : x))} placeholder="KES" />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button onClick={() => setItems((p) => [...p, { label: "", amountKes: "" }])} className="text-xs font-medium text-green-700 underline dark:text-green-400">+ Add item</button>
          <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Total {kes(total)}</p>
        </div>
        <Button onClick={save} disabled={saving || !level || total < 1} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save structure
        </Button>
      </div>
    </Modal>
  );
}

function BatchDialog({ structure, onClose, onDone }: { structure: Structure; onClose: () => void; onDone: (msg: string) => void }) {
  const { toast } = useToast();
  const [dueDate, setDueDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function run() {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/structures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: true, structureId: structure.id, dueDate }),
      });
      const json = await res.json();
      if (json.ok) onDone(`${json.data.created} invoices created (${json.data.skipped} already invoiced)`);
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title={`Invoice all of ${structure.level}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">
          Every active {structure.name} student gets a <span className="font-semibold">{kes(structure.totalKes)}</span> invoice for {structure.name}. Students already invoiced are skipped.
        </p>
        <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <Button onClick={run} disabled={saving || !dueDate} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate invoices
        </Button>
      </div>
    </Modal>
  );
}

interface PromiseItem {
  id: string;
  promiseDate: string;
  amountKes: number;
  status: string;
  studentName: string;
  admissionNo: string;
  invoiceNo: string;
  guardianName: string;
  guardianPhone: string;
  invoiceBalance: number;
  planGroupId?: string | null;
  installmentNo?: number | null;
  reminderSentAt?: string | null;
}

function PromisesTab() {
  const { toast } = useToast();
  const [promises, setPromises] = React.useState<PromiseItem[] | null>(null);
  const [error, setError] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/finance/promises");
      const json = await res.json();
      if (json.ok) setPromises(json.data.promises); else setError(true);
    } catch { setError(true); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (promises === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

  const PROMISE_TONE: Record<string, "amber" | "green" | "red"> = {
    ACTIVE: "amber",
    KEPT: "green",
    BROKEN: "red",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-600" />
          Fee Promises Calendar Directory
        </CardTitle>
        <Button size="sm" onClick={() => setPlanOpen(true)}>Create installment plan</Button>
      </CardHeader>
      <CardContent>
        {promises.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No payment promises yet"
            description="Parents can commit to a future payment date directly from their portal."
          />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Learner</TH>
                  <TH>Invoice No</TH>
                  <TH align="right">Promised Amount</TH>
                  <TH>Commitment Date</TH>
                  <TH>Parent / Contact</TH>
                  <TH align="center">Status</TH>
                </TR>
              </THead>
              <TBody>
                {promises.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div>
                        <p className="font-semibold text-navy-900 dark:text-navy-50">{p.studentName}</p>
                        <p className="text-xs text-navy-400 font-mono">{p.admissionNo}</p>
                      </div>
                    </TD>
                    <TD>
                      <div>
                        <p className="font-medium text-navy-800 dark:text-navy-100">{p.invoiceNo}</p>
                        <p className="text-xs text-navy-400">Balance: KES {p.invoiceBalance.toLocaleString("en-KE")}</p>
                      </div>
                    </TD>
                    <TD align="right" className="font-semibold text-navy-900 dark:text-navy-50">
                      KES {p.amountKes.toLocaleString("en-KE")}
                    </TD>
                    <TD className="font-mono text-navy-700 dark:text-navy-300">
                      {p.promiseDate}
                      {p.installmentNo && <span className="ml-1 text-[10px] text-navy-400">#{p.installmentNo}</span>}
                    </TD>
                    <TD>
                      <div>
                        <p className="font-medium text-navy-800 dark:text-navy-100">{p.guardianName}</p>
                        <p className="text-xs text-navy-400">{p.guardianPhone}</p>
                      </div>
                    </TD>
                    <TD align="center">
                      <Badge tone={PROMISE_TONE[p.status] || "neutral"}>{p.status.toLowerCase()}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
      {planOpen && <InstallmentPlanDialog onClose={() => setPlanOpen(false)} onDone={() => { setPlanOpen(false); load(); toast({ title: "Installment plan saved", tone: "success" }); }} />}
    </Card>
  );
}

function InstallmentPlanDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = React.useState("");
  const [lines, setLines] = React.useState("2099-08-01,1000\n2099-09-01,1000");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    const installments = lines.split(/\n+/).map((line) => {
      const [promiseDate, amountKes] = line.split(",").map((x) => x.trim());
      return { promiseDate, amountKes: Number(amountKes) };
    }).filter((x) => x.promiseDate && x.amountKes > 0);
    setSaving(true);
    try {
      const res = await fetch("/api/finance/promises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId, installments }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not save plan.");
      onDone();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not save plan.", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title="Create parent installment plan" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-navy-500">Enter the invoice ID and one installment per line as date,amount. Each due date gets an automatic reminder.</p>
        <div><Label>Invoice ID</Label><Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Invoice database ID" /></div>
        <div><Label>Installments</Label><textarea value={lines} onChange={(e) => setLines(e.target.value)} rows={5} className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-xs font-mono dark:border-navy-700 dark:bg-navy-900" /></div>
        <Button onClick={save} disabled={saving || !invoiceId || !lines.trim()} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />} Save plan</Button>
      </div>
    </Modal>
  );
}

// ---- shared ---------------------------------------------------------------------------
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
