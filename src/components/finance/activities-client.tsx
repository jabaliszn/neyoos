"use client";

/**
 * R.6 — Trips & Activities client. Founder's real "Form 4 trip" scenario:
 * a school runs an activity for one or more classes; every real student in
 * those classes is on the roster automatically; a student owes NOTHING
 * unless a real payment is collected (instantly cleared, zero balance) or
 * staff explicitly records a real waiver ("going, will pay later") — which
 * is the ONLY thing that ever creates a real open balance.
 */
import * as React from "react";
import {
  Plane, Plus, X, Loader2, Check, Percent, Printer, Fingerprint,
  Banknote, Smartphone, Landmark, ArrowLeft, AlertTriangle, Undo2,
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
import { useBiometricGate } from "@/components/auth/biometric-gate";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface ActivityRow {
  id: string; name: string; description: string | null; amountKes: number;
  year: number; term: number; eventDate: string | null; classNames: string[];
  rosterCount: number; paidCount: number; waivedCount: number; notPaidCount: number;
  collectedKes: number; outstandingKes: number;
}
interface RosterRow {
  id: string; studentId: string; studentName: string; admissionNo: string; className: string;
  status: "NOT_PAID" | "PAID" | "WAIVED"; waivedReason: string | null; waivedAt: string | null;
  balanceKes: number; invoiceNo: string | null;
}
interface ClassOption { id: string; level: string; stream: string | null }

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-sm text-navy-400">Could not load.</p>
        <Button variant="secondary" onClick={onRetry} className="mt-3">Retry</Button>
      </CardContent>
    </Card>
  );
}

export function ActivitiesClient({ canManage, canRecord }: { canManage: boolean; canRecord: boolean }) {
  const { toast } = useToast();
  const [activities, setActivities] = React.useState<ActivityRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [openActivity, setOpenActivity] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/finance/activities");
      const json = await res.json();
      if (json.ok) setActivities(json.data.activities); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (openActivity) {
    return <RosterView activityId={openActivity} canManage={canManage} canRecord={canRecord} onBack={() => { setOpenActivity(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            <Plane className="h-6 w-6 text-green-600" /> Trips &amp; activities
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
            Optional fee collection for trips and activities — never a compulsory fee balance unless a student is confirmed going without paying yet.
          </p>
        </div>
        {canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New activity</Button>}
      </div>

      {error ? <LoadError onRetry={load} /> : activities === null ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : activities.length === 0 ? (
        <EmptyState icon={Plane} title="No trips or activities yet" description="Create one for a class or a whole grade — every real student in those classes is added to the roster automatically. Nobody owes anything until they actually pay or a waiver is recorded." />
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <button key={a.id} onClick={() => setOpenActivity(a.id)} className="block w-full text-left">
              <Card className="transition-shadow duration-200 ease-apple hover:shadow-card">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{a.name}</p>
                      <p className="text-xs text-navy-400">{a.classNames.join(", ")} · Term {a.term} {a.year}{a.eventDate ? ` · ${a.eventDate}` : ""} · {kes(a.amountKes)}/student</p>
                    </div>
                    <Badge tone="blue">{a.rosterCount} on roster</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-[11px] text-navy-400">Paid</p>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">{a.paidCount}</p>
                    </div>
                    <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-[11px] text-navy-400">Going, owes</p>
                      <p className="text-sm font-semibold text-amber-600">{a.waivedCount}</p>
                    </div>
                    <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-[11px] text-navy-400">Not going</p>
                      <p className="text-sm font-semibold text-navy-400">{a.notPaidCount}</p>
                    </div>
                    <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-[11px] text-navy-400">Collected</p>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">{kes(a.collectedKes)}</p>
                    </div>
                    <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-[11px] text-navy-400">Outstanding</p>
                      <p className={"text-sm font-semibold " + (a.outstandingKes > 0 ? "text-red-600" : "text-navy-400")}>{kes(a.outstandingKes)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {createOpen && <CreateActivityDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); toast({ title: "Activity created", tone: "success" }); }} />}
    </div>
  );
}

function CreateActivityDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [classes, setClasses] = React.useState<ClassOption[] | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amountKes, setAmountKes] = React.useState("");
  const [year, setYear] = React.useState(String(new Date().getFullYear()));
  const [term, setTerm] = React.useState("2");
  const [eventDate, setEventDate] = React.useState("");
  const [classIds, setClassIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => { if (j.ok) setClasses(j.data.classes); });
  }, []);

  function toggleClass(id: string) {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/activities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: description || undefined, amountKes: Number(amountKes),
          year: Number(year), term: Number(term), eventDate: eventDate || undefined, classIds,
        }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not create activity.", tone: "error" });
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[min(92dvh,42rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-navy-100 bg-white p-6 shadow-card dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900 dark:text-navy-50"><Plane className="h-5 w-5 text-green-600" /> New trip / activity</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 4 Mombasa Trip" /></div>
          <div><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Includes bus, meals, entry fees" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Amount per student (KES)</Label><Input type="number" min={1} value={amountKes} onChange={(e) => setAmountKes(e.target.value)} placeholder="3500" /></div>
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
            <div><Label>Term</Label><Input type="number" min={1} max={3} value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          </div>
          <div><Label>Event date (optional)</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
          <div>
            <Label>Classes going (every real student in these classes is added to the roster)</Label>
            {classes === null ? (
              <div className="mt-2 h-20 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" />
            ) : (
              <div className="mt-2 grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-navy-100 p-2 dark:border-navy-800">
                {classes.map((c) => {
                  const label = [c.level, c.stream].filter(Boolean).join(" ");
                  const checked = classIds.includes(c.id);
                  return (
                    <label key={c.id} className={"flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm " + (checked ? "bg-green-50 dark:bg-green-900/20" : "hover:bg-navy-50 dark:hover:bg-navy-800")}>
                      <input type="checkbox" checked={checked} onChange={() => toggleClass(c.id)} />
                      {label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <Button onClick={save} disabled={saving || !name.trim() || !amountKes || classIds.length === 0} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create activity &amp; build roster
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "neutral" }> = {
  PAID: { label: "Paid — cleared to go", tone: "green" },
  WAIVED: { label: "Going — balance owed", tone: "amber" },
  NOT_PAID: { label: "Not going (unpaid)", tone: "neutral" },
};

function RosterView({ activityId, canManage, canRecord, onBack }: { activityId: string; canManage: boolean; canRecord: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<{ activity: ActivityRow & { description: string | null }; rows: RosterRow[] } | null>(null);
  const [error, setError] = React.useState(false);
  const [payRow, setPayRow] = React.useState<RosterRow | null>(null);
  const [waiveRow, setWaiveRow] = React.useState<RosterRow | null>(null);
  const [requiresBiometric, setRequiresBiometric] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/finance/activities/${activityId}`);
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, [activityId]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    fetch("/api/finance/security").then((r) => r.json()).then((j) => { if (j.ok) setRequiresBiometric(j.data.requireBiometricForFinance); }).catch(() => {});
  }, []);

  async function unwaive(row: RosterRow) {
    try {
      const res = await fetch(`/api/finance/activities/${activityId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unwaive", participantId: row.id }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Waiver undone", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Could not undo.", tone: "error" });
    } catch { toast({ title: "Network problem", tone: "error" }); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;

  const { activity, rows } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800 dark:text-navy-400"><ArrowLeft className="h-4 w-4" /> All activities</button>
        <a href={`/api/finance/activities/${activityId}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="secondary"><Printer className="h-4 w-4" /> Print roster</Button>
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">{activity.name}</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">{kes(activity.amountKes)} per student · Term {activity.term} {activity.year}{activity.eventDate ? ` · ${activity.eventDate}` : ""}</p>
      </div>

      {requiresBiometric && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <Fingerprint className="h-4 w-4 shrink-0" /> This school requires a fingerprint/Face ID check before recording an activity payment.
        </p>
      )}

      <TableContainer>
        <Table>
          <THead><TR><TH>Learner</TH><TH>Status</TH><TH align="right">Balance</TH>{(canRecord || canManage) && <TH></TH>}</TR></THead>
          <TBody>
            {rows.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <TR key={r.id}>
                  <TD>
                    <span className="font-medium">{r.studentName}</span>
                    <span className="block font-mono text-[10px] text-navy-400">{r.admissionNo} · {r.className}</span>
                  </TD>
                  <TD>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {r.waivedReason && <span className="mt-0.5 block text-[10px] text-navy-400">{r.waivedReason}</span>}
                  </TD>
                  <TD align="right" className={r.balanceKes > 0 ? "font-semibold text-red-600" : "text-navy-300"}>{r.balanceKes > 0 ? kes(r.balanceKes) : "—"}</TD>
                  {(canRecord || canManage) && (
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {r.status !== "PAID" && canRecord && (
                          <Button size="sm" onClick={() => setPayRow(r)}><Banknote className="h-3.5 w-3.5" /> Record payment</Button>
                        )}
                        {r.status === "NOT_PAID" && canManage && (
                          <Button size="sm" variant="secondary" onClick={() => setWaiveRow(r)}><AlertTriangle className="h-3.5 w-3.5" /> Going, pay later</Button>
                        )}
                        {r.status === "WAIVED" && canManage && r.balanceKes === activity.amountKes && (
                          <Button size="sm" variant="ghost" onClick={() => unwaive(r)}><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
                        )}
                      </div>
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>

      {payRow && (
        <PayActivityDialog
          row={payRow} activity={activity} requiresBiometric={requiresBiometric}
          onClose={() => setPayRow(null)}
          onDone={() => { setPayRow(null); load(); toast({ title: "Payment recorded", tone: "success" }); }}
        />
      )}
      {waiveRow && (
        <WaiveActivityDialog
          row={waiveRow} activityId={activityId}
          onClose={() => setWaiveRow(null)}
          onDone={() => { setWaiveRow(null); load(); toast({ title: "Recorded — real balance now owed", tone: "success" }); }}
        />
      )}
    </div>
  );
}

function PayActivityDialog({ row, activity, requiresBiometric, onClose, onDone }: {
  row: RosterRow; activity: ActivityRow; requiresBiometric: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const { requireBiometric } = useBiometricGate();
  const [method, setMethod] = React.useState<"cash" | "mpesa" | "bank">("cash");
  const [amount, setAmount] = React.useState(String(row.balanceKes > 0 ? row.balanceKes : activity.amountKes));
  const [mpesaRef, setMpesaRef] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function doSave(biometricTicket: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/activities/${activity.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", participantId: row.id, amountKes: Number(amount), method, mpesaRef: mpesaRef || undefined, biometricTicket: biometricTicket ?? undefined }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not record payment.", tone: "error" });
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    if (requiresBiometric) {
      // R.3 — activity payments go through the exact same recordWalkInPayment()
      // machinery as every other cash payment, so they're gated identically.
      // The action key MUST match cashPaymentActionKey({amount, method,
      // accountRef: student.admissionNo}) — accountRef here is the real
      // student's admission number, exactly what the server will check.
      requireBiometric(
        `Record ${method} payment of KES ${amount} for ${row.studentName}`,
        (ticket) => doSave(ticket),
        `cash_payment:${method}:${amount}:${row.admissionNo}`
      );
      return;
    }
    doSave(null);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-card dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Record payment</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">{row.studentName} · {row.admissionNo}</p>
          {requiresBiometric && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <Fingerprint className="h-4 w-4 shrink-0" /> Fingerprint/Face ID check required.
            </p>
          )}
          <div><Label>Amount (KES)</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>Method</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "mpesa" | "bank")} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900">
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa (already paid)</option>
              <option value="bank">Bank deposit slip</option>
            </select>
          </div>
          {(method === "mpesa" || method === "bank") && (
            <div><Label>Reference</Label><Input value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="e.g. SGH7XK9TQ2" /></div>
          )}
          <Button onClick={submit} disabled={saving || !amount || Number(amount) < 1} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : requiresBiometric ? <Fingerprint className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {requiresBiometric ? "Verify & record" : "Record"} {amount ? kes(Number(amount)) : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WaiveActivityDialog({ row, activityId, onClose, onDone }: { row: RosterRow; activityId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/activities/${activityId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waive", participantId: row.id, reason }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not record this.", tone: "error" });
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-card dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900 dark:text-navy-50"><AlertTriangle className="h-5 w-5 text-amber-600" /> Going, pay later</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">{row.studentName} · {row.admissionNo}</p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            This creates a REAL fee balance for this learner — it will show up in Finance arrears and get fee reminders, exactly like any other unpaid invoice, until it is paid.
          </p>
          <div><Label>Reason (required — e.g. what the parent asked for)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Parent asked to pay after half-term" /></div>
          <Button onClick={save} disabled={saving || reason.trim().length < 3} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm — create real balance
          </Button>
        </div>
      </div>
    </div>
  );
}
