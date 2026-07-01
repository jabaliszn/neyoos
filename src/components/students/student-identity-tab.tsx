"use client";

import * as React from "react";
import { Loader2, ShieldCheck, Download, Lock, CheckCircle2, UserCheck, FileText, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function StudentIdentityTab({ studentId }: { studentId: string }) {
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [redeemOpen, setRedeemOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/passport?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setTransfers(json.data || []);
      else toast({ title: json.error?.message || "Failed to load transfer requests", tone: "error" });
    } catch {
      toast({ title: "Failed to load transfer requests", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <IdentityOverviewCard studentId={studentId} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-navy-950 dark:text-white">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Transfer actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-navy-600 dark:text-navy-300">Create a controlled passport for another NEYO school or a non-NEYO school, or redeem one received by your team.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={`/api/students/passport/export?studentId=${studentId}`}>
                <Button variant="secondary" className="w-full"><FileText className="h-4 w-4" /> Export PDF</Button>
              </a>
              <Button onClick={() => setOpen(true)}><Download className="h-4 w-4" /> Generate passport</Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setRedeemOpen(true)}><UserCheck className="h-4 w-4" /> Redeem received passport</Button>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
              Data minimization is enforced: only checked modules are shared, and every generation or import is audit-logged.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Outgoing transfer passports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>
          ) : transfers.length === 0 ? (
            <EmptyState icon={Lock} title="No transfer passports yet" description="Generate one when the learner is moving to another school or when a receiving school requests a verified record." />
          ) : (
            <div className="space-y-4">
              {transfers.map((t) => {
                const modules = Array.isArray(t.includedModules) ? t.includedModules : JSON.parse(t.includedModules || "[]");
                const tone = t.status === "COMPLETED" ? "green" : t.status === "EXPIRED" ? "amber" : t.status === "CANCELLED" ? "red" : "blue";
                return (
                  <Card key={t.id} className="overflow-hidden border border-navy-100 dark:border-navy-800">
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between gap-4 p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-navy-950 dark:text-white">Passport transfer request</h4>
                            <Badge tone={tone}>{t.status}</Badge>
                          </div>
                          <p className="text-xs text-navy-600 dark:text-navy-300">Destination: {t.destinationEmail || t.destinationTenantId || "Receiving school not yet specified"}</p>
                          <div className="flex flex-wrap gap-1">{modules.map((m: string) => <Badge key={m} tone="neutral">{m}</Badge>)}</div>
                        </div>
                        <div className="text-right text-xs text-navy-500 dark:text-navy-400">
                          <p>{new Date(t.createdAt).toLocaleDateString()}</p>
                          <p>Expires {new Date(t.expiresAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 bg-navy-50 px-4 py-3 text-xs dark:border-navy-800 dark:bg-navy-900">
                        <span>Consent by <strong className="text-navy-950 dark:text-white">{t.consentBy}</strong></span>
                        <span className="font-mono tracking-widest text-navy-950 dark:text-white">{t.accessCode}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {open ? <GeneratePassportDialog studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} /> : null}
      {redeemOpen ? <RedeemPassportDialog onClose={() => setRedeemOpen(false)} /> : null}
    </div>
  );
}

function IdentityOverviewCard({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/students/${studentId}`);
        const json = await res.json();
        if (active && json.ok) setData(json.data.student);
      } catch {
        toast({ title: "Failed to load learner identity view", tone: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [studentId, toast]);

  if (loading) return <Card><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin text-navy-400" /></CardContent></Card>;
  if (!data) return <Card><CardContent className="p-6"><EmptyState icon={AlertTriangle} title="Identity view unavailable" description="We could not load this learner right now." /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portable learner identity view</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        <Info label="Learner" value={`${data.firstName} ${data.lastName}`} />
        <Info label="Admission no." value={data.admissionNo} />
        <Info label="UPI / NEMIS" value={data.upiNumber || "—"} />
        <Info label="Class" value={data.schoolClass ? `${data.schoolClass.level}${data.schoolClass.stream ? ` ${data.schoolClass.stream}` : ""}` : "Unassigned"} />
        <Info label="Gender" value={data.gender === "M" ? "Boy" : data.gender === "F" ? "Girl" : data.gender} />
        <Info label="Date of birth" value={data.dateOfBirth || "—"} />
        <div className="sm:col-span-2 rounded-2xl border border-navy-100 bg-navy-50 p-3 dark:border-navy-800 dark:bg-navy-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Guardian contacts</p>
          <div className="mt-2 space-y-1">
            {(data.guardians || []).length === 0 ? <p className="text-sm text-navy-500">No guardians linked.</p> : data.guardians.map((g: any) => <p key={g.id} className="text-sm text-navy-700 dark:text-navy-200">{g.guardian.fullName} · {g.guardian.phone}</p>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800"><p className="text-xs uppercase tracking-wide text-navy-500">{label}</p><p className="mt-1 font-semibold text-navy-950 dark:text-white">{value}</p></div>;
}

function GeneratePassportDialog({ studentId, onClose, onDone }: any) {
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState("");
  const [modules, setModules] = React.useState<string[]>(["ACADEMIC", "ATTENDANCE", "COMPETENCY"]);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();
  const moduleOpts = ["ACADEMIC", "ATTENDANCE", "DISCIPLINE", "PORTFOLIO", "MEDICAL", "TALENT", "COMPETENCY"];

  function toggleModule(m: string) { setModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]); }

  async function save() {
    if (modules.length === 0) return toast({ title: "Select at least one module", tone: "error" });
    if (!consent.trim()) return toast({ title: "Consent signature required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/students/passport", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, destinationEmail: email || undefined, includedModules: modules, consentBy: consent.trim() }) });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Passport generated", tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Generate transfer passport</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-navy-100 bg-navy-50 p-3 dark:border-navy-800 dark:bg-navy-900">
            <Label className="text-xs font-bold uppercase tracking-widest text-navy-500">Choose modules to share</Label>
            <div className="mt-3 grid grid-cols-2 gap-2">{moduleOpts.map((m) => <label key={m} className="flex items-center gap-2 text-xs font-medium text-navy-700 dark:text-navy-300"><input type="checkbox" checked={modules.includes(m)} onChange={() => toggleModule(m)} className="rounded border-navy-300 text-blue-600 focus:ring-blue-500" />{m}</label>)}</div>
          </div>
          <div className="space-y-1"><Label>Destination email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="receiving-school@example.com" /></div>
          <div className="space-y-1"><Label>Parent/guardian consent</Label><Input value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="Type full name to confirm consent" /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate passport"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedeemPassportDialog({ onClose }: { onClose: () => void }) {
  const [accessCode, setAccessCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<any | null>(null);
  const { toast } = useToast();

  async function redeem() {
    if (!accessCode.trim()) return toast({ title: "Access code required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/students/passport", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", accessCode: accessCode.trim() }) });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        toast({ title: "Passport redeemed", tone: "success" });
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Redeem received passport</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Access code</Label><Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter shared access code" /></div>
          {result ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-700/40 dark:bg-green-900/20 dark:text-green-100">
              <p className="font-semibold">Import completed</p>
              <p className="mt-1">Learner: {result.snapshot?.profile?.fullName || result.request?.studentName}</p>
              <p>Source school: {result.sourceSchool || "NEYO school"}</p>
              <p>Status: {result.request?.status}</p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button>
          <Button onClick={redeem} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem passport"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
