"use client";

import * as React from "react";
import {
  Smartphone,
  UserPlus,
  Wallet,
  GraduationCap,
  PhoneCall,
  Search,
  Printer,
  LogOut,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  Plus,
  Users,
  BadgeCheck,
  Clock,
  Fingerprint,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TableContainer } from "@/components/ui/table";
import { useBiometricGate } from "@/components/auth/biometric-gate";

// ---- types -----------------------------------------------------------------
interface Visitor {
  id: string; name: string; phone: string | null; purpose: string;
  host: string | null; badgeNo: string; signedInAt: string; signedOutAt: string | null;
}
interface Inquiry {
  id: string; parentName: string; phone: string; studentName: string | null;
  gradeWanted: string | null; curriculum: string | null; createdAt: string;
}
interface Call {
  id: string; callerName: string; callerPhone: string | null; forUserName: string;
  message: string; createdAt: string;
}
interface Payment { id: string; amount: number; phone: string; mpesaRef: string | null; provider: string; }
interface Dash {
  visitors: Visitor[]; onSite: number; inquiries: Inquiry[]; calls: Call[];
  payments: Payment[]; collected: number;
}
type DialogKind = null | "visitor" | "payment" | "bank_import" | "inquiry" | "call" | "stkfees" | "report_day";

function fmtKes(n: number) {
  return "KES " + n.toLocaleString("en-KE");
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

export function ReceptionDesk({ schoolName }: { schoolName: string }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Dash | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [badge, setBadge] = React.useState<Visitor | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/reception");
      const json = await res.json();
      if (json.ok) setData(json.data);
      else setError(true);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function signOut(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/reception/visitors/${id}/signout`, { method: "POST" });
      const json = await res.json();
      if (json.ok) { toast({ title: "Visitor signed out", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      {/* search anyone */}
      <PersonSearch />

      {/* stats (action-oriented density) */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load the desk.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : data === null ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Visitors today" value={String(data.visitors.length)} hint={`${data.onSite} on site`} icon={Users} tone="navy" />
          <StatCard label="Collected today" value={fmtKes(data.collected)} hint={`${data.payments.length} payments`} icon={Wallet} tone="green" />
          <StatCard label="Admission inquiries" value={String(data.inquiries.length)} icon={GraduationCap} tone="amber" />
          <StatCard label="Calls relayed" value={String(data.calls.length)} icon={PhoneCall} tone="navy" />
        </div>
      )}

      {/* quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialog("visitor")}><UserPlus className="h-4 w-4" /> Sign in visitor</Button>
        <Button variant="secondary" onClick={() => setDialog("payment")}><Wallet className="h-4 w-4" /> Record payment</Button>
        <Button variant="secondary" onClick={() => setDialog("bank_import")}><Printer className="h-4 w-4" /> Import bank statement</Button>
        <Button variant="secondary" onClick={() => setDialog("stkfees")}><Smartphone className="h-4 w-4" /> M-Pesa fees</Button>
        <Button variant="secondary" onClick={() => setDialog("report_day")}><Sparkles className="h-4 w-4" /> Report-Card Day</Button>
        <Button variant="secondary" onClick={() => setDialog("inquiry")}><GraduationCap className="h-4 w-4" /> New inquiry</Button>
        <Button variant="secondary" onClick={() => setDialog("call")}><PhoneCall className="h-4 w-4" /> Relay call</Button>
        <a href="/api/reception/summary" target="_blank" rel="noopener" className="ml-auto">
          <Button variant="ghost"><Printer className="h-4 w-4" /> Day-end summary</Button>
        </a>
      </div>

      {/* lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* visitors */}
        <Card>
          <CardHeader><CardTitle>Today&apos;s visitors</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data === null ? (
              <div className="space-y-2 p-4">{[0,1].map((i)=><Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : data.visitors.length === 0 ? (
              <EmptyRow icon={Users} text="No visitors yet today." />
            ) : (
              <ul className="divide-y divide-navy-100 dark:divide-navy-800">
                {data.visitors.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-navy-900 dark:text-navy-50">{v.name}</span>
                        <Badge tone="neutral">{v.badgeNo}</Badge>
                        {v.signedOutAt ? <Badge tone="neutral">signed out</Badge> : <Badge tone="green">on site</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-400">
                        {v.purpose}{v.host ? ` · for ${v.host}` : ""} · in {fmtTime(v.signedInAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => setBadge(v)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-navy-800" aria-label="Print badge">
                        <Printer className="h-4 w-4" />
                      </button>
                      {!v.signedOutAt && (
                        <button onClick={() => signOut(v.id)} disabled={busy===v.id} className="rounded-full p-1.5 text-navy-400 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20" aria-label="Sign out">
                          {busy===v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* inquiries */}
        <Card>
          <CardHeader><CardTitle>Admission inquiries</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data === null ? (
              <div className="space-y-2 p-4">{[0,1].map((i)=><Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : data.inquiries.length === 0 ? (
              <EmptyRow icon={GraduationCap} text="No inquiries captured today." />
            ) : (
              <ul className="divide-y divide-navy-100 dark:divide-navy-800">
                {data.inquiries.map((q) => (
                  <li key={q.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900 dark:text-navy-50">{q.parentName}</span>
                      {q.gradeWanted && <Badge tone="amber">{q.gradeWanted}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">
                      {q.studentName ? `${q.studentName} · ` : ""}{q.phone}{q.curriculum ? ` · ${q.curriculum}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* calls */}
        <Card>
          <CardHeader><CardTitle>Relayed calls</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data === null ? (
              <div className="space-y-2 p-4">{[0,1].map((i)=><Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : data.calls.length === 0 ? (
              <EmptyRow icon={PhoneCall} text="No phone messages relayed today." />
            ) : (
              <ul className="divide-y divide-navy-100 dark:divide-navy-800">
                {data.calls.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-navy-900 dark:text-navy-50">{c.callerName}</span>
                      <span className="text-navy-400">→ {c.forUserName}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-navy-400"><Clock className="h-3 w-3" />{fmtTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-400">{c.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* payments */}
        <Card>
          <CardHeader><CardTitle>Payments today</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data === null ? (
              <div className="space-y-2 p-4">{[0,1].map((i)=><Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : data.payments.length === 0 ? (
              <EmptyRow icon={Wallet} text="No payments recorded today." />
            ) : (
              <ul className="divide-y divide-navy-100 dark:divide-navy-800">
                {data.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <span className="font-medium text-navy-900 dark:text-navy-50">{fmtKes(p.amount)}</span>
                      <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-400">
                        {p.phone} · {p.mpesaRef}
                      </p>
                    </div>
                    <Badge tone={p.provider === "cash" ? "neutral" : "green"}>
                      {p.provider === "cash" ? "Cash" : "M-Pesa"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* dialogs */}
      {dialog === "visitor" && (
        <VisitorDialog
          onClose={() => setDialog(null)}
          onSaved={(v) => { setDialog(null); load(); if (v) setBadge(v); }}
        />
      )}
      {dialog === "payment" && <PaymentDialog onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {dialog === "bank_import" && <BankImportDialog onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {dialog === "stkfees" && <StkFeesDialog onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {dialog === "report_day" && <ReportCardDayModal onClose={() => setDialog(null)} />}
      {dialog === "inquiry" && <InquiryDialog onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {dialog === "call" && <CallDialog onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}

      {badge && <BadgePrint visitor={badge} schoolName={schoolName} onClose={() => setBadge(null)} />}
    </div>
  );
}

function ReportCardDayModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ id: string; title: string; subtitle: string }[]>([]);
  const [student, setStudent] = React.useState<{ id: string; title: string; subtitle: string } | null>(null);
  const [guardianName, setGuardianName] = React.useState("");
  const [checkIns, setCheckIns] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/reception/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) setHits(json.data.hits.filter((h: { type: string }) => h.type === "student"));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadCheckIns = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reception/report-day");
      const json = await res.json();
      if (json.ok) setCheckIns(json.data.checkIns);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCheckIns();
  }, [loadCheckIns]);

  async function checkIn() {
    if (!student || !guardianName.trim()) {
      toast({ title: "Select a student and enter parent name", tone: "error" });
      return;
    }
    setBusy("checkin");
    try {
      const res = await fetch("/api/reception/report-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_in", studentId: student.id, guardianName }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Checked in successfully! Queue #${json.data.queueNo}`, tone: "success" });
        setStudent(null);
        setGuardianName("");
        setQ("");
        loadCheckIns();
      } else {
        toast({ title: json.error?.message || "Check-in failed", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleOneTapPrint(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/reception/report-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "print_one_tap", checkInId: id }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Report card and Invoice queued to Print Station!", tone: "success" });
        loadCheckIns();
      } else {
        toast({ title: json.error?.message || "Print action failed", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/reception/report-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", checkInId: id, status }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Status updated to ${status.toLowerCase()}`, tone: "success" });
        loadCheckIns();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between border-b border-navy-100 pb-3 dark:border-navy-800">
          <div>
            <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              Report-Card Day Mode
            </h3>
            <p className="text-xs text-navy-400">Reception Check-in, One-Tap Document Auto-Printing and Teacher Meeting Queue.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Panel: Check-In Form */}
          <div className="space-y-4 border-r border-navy-100 pr-6 dark:border-navy-800">
            <p className="text-xs font-bold text-navy-800 dark:text-navy-100">Parent Check-In</p>
            
            <div className="space-y-1 relative">
              <Label>Search Learner</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type name or adm no..." />
              {hits.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-navy-100 bg-white p-1 shadow-pop dark:border-navy-800 dark:bg-navy-950">
                  {hits.map((h) => (
                    <button key={h.id} onClick={() => { setStudent(h as any); setHits([]); setQ(""); }}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-navy-700 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-900">
                      <span className="font-semibold">{h.title}</span> · <span className="text-navy-400">{h.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {student && (
              <div className="rounded-xl bg-green-50/50 border border-green-100 p-2.5 text-xs text-navy-800">
                <span className="font-bold">Selected Learner:</span> {student.title} ({student.subtitle})
              </div>
            )}

            <div>
              <Label>Guardian Name</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="e.g. Otieno Brian" />
            </div>

            <Button onClick={checkIn} disabled={busy === "checkin" || !student || !guardianName.trim()} className="w-full">
              {busy === "checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Check In Parent
            </Button>
          </div>

          {/* Right Panel: Meeting & Print Queue List */}
          <div className="md:col-span-2 space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            <p className="text-xs font-bold text-navy-800 dark:text-navy-100">Today&apos;s Check-In &amp; Meeting Queue</p>
            
            {checkIns.length === 0 ? (
              <EmptyRow icon={Users} text="No parents checked in yet today." />
            ) : (
              <TableContainer>
                <table className="w-full min-w-full text-xs text-left bg-white dark:bg-navy-900">
                  <thead>
                    <tr className="bg-navy-50/60 dark:bg-navy-900/40 text-[10px] text-navy-400 font-semibold uppercase">
                      <th className="p-2">Q#</th>
                      <th className="p-2">Learner</th>
                      <th className="p-2">Guardian</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50 dark:divide-navy-800">
                    {checkIns.map((c) => (
                      <tr key={c.id} className="hover:bg-navy-50/30">
                        <td className="p-2 font-bold text-navy-900 dark:text-navy-50 text-sm">#{c.queueNo}</td>
                        <td className="p-2">
                          <div>
                            <p className="font-semibold text-navy-900 dark:text-navy-50">{c.studentName}</p>
                            <p className="text-[10px] text-navy-400">{c.admissionNo}</p>
                          </div>
                        </td>
                        <td className="p-2 font-medium">{c.guardianName}</td>
                        <td className="p-2 text-center">
                          <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} disabled={busy === c.id}
                            className="rounded-full border border-navy-200 bg-white px-2 py-1 text-[10px] dark:border-navy-700 dark:bg-navy-800 text-navy-800 dark:text-navy-100">
                            <option value="WAITING">Waiting</option>
                            <option value="MEETING">Meeting</option>
                            <option value="COMPLETE">Complete</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          {c.status === "WAITING" ? (
                            <Button size="sm" onClick={() => handleOneTapPrint(c.id)} disabled={busy === c.id} className="h-7 text-xs">
                              {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                              One-Tap Print
                            </Button>
                          ) : c.printedAt ? (
                            <span className="text-[10px] text-green-600 font-semibold">Docs Printed ✓</span>
                          ) : (
                            <span className="text-[10px] text-navy-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- person search (A.18.2) ------------------------------------------------
function PersonSearch() {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ title: string; subtitle: string; href: string; type: string }[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/reception/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) { setHits(json.data.hits); setOpen(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 dark:border-navy-700 dark:bg-navy-900">
        <Search className="h-4 w-4 text-navy-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search anyone — name, phone, admission no…"
          className="w-full bg-transparent text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none dark:text-navy-50"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card dark:border-navy-800 dark:bg-navy-900">
          <ul className="max-h-72 divide-y divide-navy-100 overflow-y-auto dark:divide-navy-800">
            {hits.map((h, i) => (
              <li key={i}>
                <a href={h.href} className="block px-4 py-2.5 text-sm hover:bg-navy-50 dark:hover:bg-navy-800">
                  <span className="font-medium text-navy-900 dark:text-navy-50">{h.title}</span>
                  <span className="ml-2 text-xs text-navy-400">{h.subtitle}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- dialog shell ----------------------------------------------------------
function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function useSaver() {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  async function run(url: string, body: unknown, onDone: (data: any) => void, okMsg: string) {
    setSaving(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: okMsg, tone: "success" }); onDone(json.data); }
      else {
        const msg = json.error?.fields ? Object.values(json.error.fields)[0] : json.error?.message;
        toast({ title: (msg as string) || "Could not save", tone: "error" });
      }
    } finally { setSaving(false); }
  }
  return { saving, run };
}

// ---- visitor dialog --------------------------------------------------------
function VisitorDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (v: Visitor | null) => void }) {
  const { saving, run } = useSaver();
  const [f, setF] = React.useState({ name: "", phone: "", idNumber: "", purpose: "", host: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Dialog title="Sign in visitor" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} onClick={() => run("/api/reception/visitors", f, (d) => {
          onSaved({ id: d.id, name: f.name, phone: f.phone || null, purpose: f.purpose, host: f.host || null, badgeNo: d.badgeNo, signedInAt: new Date().toISOString(), signedOutAt: null });
        }, `Signed in — badge ${""}`)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Sign in & print badge
        </Button>
      </>
    }>
      <Field label="Full name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Otieno James" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (optional)"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" /></Field>
        <Field label="ID No. (optional)"><Input value={f.idNumber} onChange={(e) => set("idNumber", e.target.value)} placeholder="National ID" /></Field>
      </div>
      <Field label="Purpose of visit"><Input value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. Fees enquiry" /></Field>
      <Field label="Who are they here to see? (optional)"><Input value={f.host} onChange={(e) => set("host", e.target.value)} placeholder="e.g. The Bursar" /></Field>
    </Dialog>
  );
}

// ---- payment dialog --------------------------------------------------------
function PaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { saving, run } = useSaver();
  const { requireBiometric } = useBiometricGate();
  const [f, setF] = React.useState({ amount: "", phone: "", method: "cash", accountRef: "", mpesaRef: "", description: "" });
  const [requiresBiometric, setRequiresBiometric] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  React.useEffect(() => {
    fetch("/api/finance/security").then((r) => r.json()).then((j) => {
      if (j.ok) setRequiresBiometric(j.data.requireBiometricForFinance);
    }).catch(() => {});
  }, []);

  function submit() {
    const doSave = (biometricTicket: string | null) =>
      run("/api/reception/payments", { ...f, amount: f.amount, biometricTicket: biometricTicket ?? undefined }, () => onSaved(), "Payment recorded");
    if (requiresBiometric) {
      // R.3 — this school requires a fresh fingerprint/Face ID/passkey check
      // before a payment (cash especially) can be recorded, to prevent
      // "clearing" fees that were never actually paid. The server itself
      // (not just this popup) verifies and consumes a real single-use
      // ticket bound to this exact amount + method + account reference.
      requireBiometric(
        `Record ${f.method === "cash" ? "cash" : f.method} payment of KES ${f.amount || "0"}`,
        (ticket) => doSave(ticket),
        `cash_payment:${f.method}:${f.amount}:${f.accountRef ?? ""}`
      );
      return;
    }
    doSave(null);
  }

  return (
    <Dialog title="Record walk-in payment" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !f.amount} onClick={submit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : requiresBiometric ? <Fingerprint className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
          {requiresBiometric ? "Verify & record payment" : "Record payment"}
        </Button>
      </>
    }>
      {requiresBiometric && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <Fingerprint className="h-4 w-4 shrink-0" /> This school requires a fingerprint/Face ID check before recording a payment.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (KES)"><Input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="5000" autoFocus /></Field>
        <Field label="Method">
          <select value={f.method} onChange={(e) => set("method", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900">
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa (already paid)</option>
            <option value="bank">Bank deposit slip</option>
          </select>
        </Field>
      </div>
      <Field label="Payer phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" /></Field>
      {(f.method === "mpesa" || f.method === "bank") && (
        <Field label={f.method === "bank" ? "Bank slip / transaction reference" : "M-Pesa reference"}><Input value={f.mpesaRef} onChange={(e) => set("mpesaRef", e.target.value)} placeholder={f.method === "bank" ? "e.g. BANKSLIP12345" : "e.g. SGH7XK9TQ2"} /></Field>
      )}
      <Field label="Account / Adm No. (optional)"><Input value={f.accountRef} onChange={(e) => set("accountRef", e.target.value)} placeholder="e.g. KH-S-000247" /></Field>
    </Dialog>
  );
}


function BankImportDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { saving, run } = useSaver();
  const [csv, setCsv] = React.useState("ref,amount,phone,accountRef,description\nBANKSLIP123,2500,0712345678,KHINV001,Equity bank deposit");
  async function submit() {
    await run("/api/reception/bank-import", { csv }, (data: any) => {
      toast({ title: `Bank import complete: ${data?.imported ?? 0} imported, ${data?.reconciled ?? 0} reconciled`, tone: "success" });
      onSaved();
    }, "Bank statement imported");
  }
  return (
    <Dialog title="Import bank statement" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !csv.trim()} onClick={submit}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Import & reconcile</Button></>}>
      <p className="mb-2 text-xs text-navy-500">Paste CSV columns: ref, amount, phone, accountRef, description. Account ref can be invoice number, NEYO admission number, or school admission number.</p>
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-xs font-mono dark:border-navy-700 dark:bg-navy-900" />
    </Dialog>
  );
}

// ---- STK fees dialog (B.7+ founder request) ---------------------------------
function StkFeesDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ id: string; title: string; subtitle: string }[]>([]);
  const [student, setStudent] = React.useState<{ id: string; title: string } | null>(null);
  const [invoices, setInvoices] = React.useState<{ id: string; invoiceNo: string; description: string; balanceKes: number; dueDate: string }[] | null>(null);
  const [hasFeeInvoices, setHasFeeInvoices] = React.useState(true);
  const [invoiceId, setInvoiceId] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/reception/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) setHits(json.data.hits.filter((h: { type: string }) => h.type === "student"));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function pickStudent(h: { id: string; title: string }) {
    setStudent(h); setHits([]); setQ(""); setInvoices(null); setInvoiceId("");
    const res = await fetch(`/api/reception/fees?studentId=${h.id}`);
    const json = await res.json();
    if (json.ok) {
      setInvoices(json.data.invoices);
      setHasFeeInvoices(json.data.hasFeeInvoices);
      if (json.data.invoices[0]) {
        setInvoiceId(json.data.invoices[0].id);
        setAmount(String(json.data.invoices[0].balanceKes));
      }
    }
  }

  async function send() {
    setSaving(true);
    try {
      const res = await fetch("/api/reception/fees", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, phone, amountKes: Number(amount) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "STK sent — ask the parent to enter their M-Pesa PIN", tone: "success" }); onSaved(); }
      else toast({ title: json.error?.message || "STK failed", tone: "error" });
    } finally { setSaving(false); }
  }

  const chosen = invoices?.find((i) => i.id === invoiceId);

  return (
    <Dialog title="Collect fees via M-Pesa" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !invoiceId || !phone || !amount} onClick={send}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Send STK push
        </Button>
      </>
    }>
      {student ? (
        <p className="flex items-center justify-between rounded-xl bg-warm-50 px-3 py-2 text-sm dark:bg-navy-800">
          <span className="font-medium">{student.title}</span>
          <button onClick={() => { setStudent(null); setInvoices(null); }} className="text-xs text-navy-400 underline">change</button>
        </p>
      ) : (
        <div className="relative">
          <Field label="Find the student">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or admission no…" autoFocus />
          </Field>
          {hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-2xl border border-navy-100 bg-white p-1 shadow-card dark:border-navy-700 dark:bg-navy-900">
              {hits.map((h) => (
                <button key={h.id} onClick={() => pickStudent(h)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-navy-50 dark:hover:bg-navy-800">
                  {h.title} <span className="text-xs text-navy-400">{h.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {invoices !== null && (
        invoices.length === 0 ? (
          hasFeeInvoices ? (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">No outstanding invoices — fully paid. 🎉</p>
          ) : (
            <p className="rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-500 dark:bg-navy-800 dark:text-navy-400">No fees have been billed to this learner yet — nothing to collect here.</p>
          )
        ) : (
          <>
            <Field label="Invoice">
              <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const inv = invoices.find((i) => i.id === e.target.value); if (inv) setAmount(String(inv.balanceKes)); }} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900">
                {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNo} — bal KES {i.balanceKes.toLocaleString("en-KE")} (due {i.dueDate})</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parent's M-Pesa phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></Field>
              <Field label="Amount (KES)"><Input type="number" min={1} max={chosen?.balanceKes} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            </div>
            <p className="text-xs text-navy-400">Works on ANY phone with an M-Pesa line — the prompt appears via the SIM toolkit, no smartphone or app needed. The parent just enters their PIN.</p>
          </>
        )
      )}
    </Dialog>
  );
}

// ---- inquiry dialog --------------------------------------------------------
function InquiryDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { saving, run } = useSaver();
  const [f, setF] = React.useState({ parentName: "", phone: "", studentName: "", gradeWanted: "", curriculum: "", notes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Dialog title="New admission inquiry" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} onClick={() => run("/api/reception/inquiries", { ...f, curriculum: f.curriculum || undefined }, () => onSaved(), "Inquiry saved")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} Save inquiry
        </Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Parent name"><Input value={f.parentName} onChange={(e) => set("parentName", e.target.value)} placeholder="e.g. Wanjiru Mary" autoFocus /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Student name (optional)"><Input value={f.studentName} onChange={(e) => set("studentName", e.target.value)} placeholder="e.g. Kamau Junior" /></Field>
        <Field label="Grade/Form wanted"><Input value={f.gradeWanted} onChange={(e) => set("gradeWanted", e.target.value)} placeholder="e.g. Grade 4" /></Field>
      </div>
      <Field label="Curriculum">
        <select value={f.curriculum} onChange={(e) => set("curriculum", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900">
          <option value="">Not specified</option>
          <option value="CBC">CBE</option>
          <option value="8-4-4">8-4-4</option>
        </select>
      </Field>
    </Dialog>
  );
}

// ---- call relay dialog -----------------------------------------------------
function CallDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { saving, run } = useSaver();
  const [f, setF] = React.useState({ callerName: "", callerPhone: "", forUserId: "", message: "" });
  const [staff, setStaff] = React.useState<{ id: string; fullName: string; role: string }[]>([]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  React.useEffect(() => {
    fetch("/api/reception/staff").then((r) => r.json()).then((j) => j.ok && setStaff(j.data.staff));
  }, []);
  return (
    <Dialog title="Relay a phone message" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} onClick={() => run("/api/reception/calls", f, () => onSaved(), "Message relayed to inbox")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />} Relay message
        </Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Caller name"><Input value={f.callerName} onChange={(e) => set("callerName", e.target.value)} placeholder="e.g. Achieng Mary" autoFocus /></Field>
        <Field label="Caller phone (optional)"><Input value={f.callerPhone} onChange={(e) => set("callerPhone", e.target.value)} placeholder="0712 345 678" /></Field>
      </div>
      <Field label="For (staff member)">
        <select value={f.forUserId} onChange={(e) => set("forUserId", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900">
          <option value="">Choose…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
      </Field>
      <Field label="Message">
        <textarea value={f.message} onChange={(e) => set("message", e.target.value)} rows={3} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900" placeholder="e.g. Please call back about the trip fees." />
      </Field>
    </Dialog>
  );
}

// ---- printable badge (A.18.5) ----------------------------------------------
function BadgePrint({ visitor, schoolName, onClose }: { visitor: Visitor; schoolName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm print:bg-white print:p-0" onClick={onClose}>
      <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <div id="visitor-badge" className="rounded-2xl border-2 border-navy-900 bg-white p-5 text-center text-navy-900 print:border print:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">Visitor</p>
          <p className="mt-1 text-sm font-medium">{schoolName}</p>
          <div className="my-4 border-y border-dashed border-navy-300 py-4">
            <p className="text-2xl font-bold">{visitor.name}</p>
            <p className="mt-1 text-3xl font-mono font-bold tracking-wider">{visitor.badgeNo}</p>
          </div>
          <p className="text-sm">{visitor.purpose}</p>
          {visitor.host && <p className="text-xs text-navy-500">To see: {visitor.host}</p>}
          <p className="mt-2 text-xs text-navy-400">In: {fmtTime(visitor.signedInAt)}</p>
        </div>
        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print badge</Button>
        </div>
      </div>
    </div>
  );
}

// ---- bits ------------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><Label>{label}</Label>{children}</div>);
}
function EmptyRow({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon className="h-8 w-8 text-navy-300 dark:text-navy-600" />
      <p className="text-sm text-navy-400">{text}</p>
    </div>
  );
}
