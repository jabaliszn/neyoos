"use client";

import * as React from "react";
import { Loader2, ShieldCheck, Download, Lock, FileJson, Mail, CheckCircle2 } from "lucide-react";
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
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/passport?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setTransfers(json.data);
    } catch {
      toast({ title: "Failed to load transfer requests", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Digital Identity & Transfer Passport
          </h2>
          <p className="text-sm font-medium text-navy-500">Securely export or transfer the student's holistic learning record.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop bg-blue-600 hover:bg-blue-700 text-white">
          <Download className="mr-2 h-4 w-4" /> Export Passport
        </Button>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No Transfer Passports Generated"
          description="A digital identity snapshot complies with NEYO's data minimization principles. You select exactly which modules to share."
        />
      ) : (
        <div className="space-y-4">
          {transfers.map(t => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-start justify-between p-4 bg-white dark:bg-navy-950">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
                      {t.status === "PENDING" ? <Lock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-navy-950 dark:text-white">Passport Transfer Request</h4>
                      <p className="text-xs text-navy-600 dark:text-navy-400 mt-1">
                        Dest: {t.destinationEmail || t.destinationTenantId || "Unknown"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {JSON.parse(t.includedModules).map((m: string) => (
                          <Badge key={m} variant="secondary" className="text-[9px] uppercase">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={t.status === "PENDING" ? "outline" : "secondary"}>{t.status}</Badge>
                    <p className="text-[10px] text-navy-400 mt-2">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="bg-navy-50 dark:bg-navy-900 px-4 py-3 flex items-center justify-between border-t border-navy-100 dark:border-navy-800">
                  <span className="text-xs font-medium text-navy-600 dark:text-navy-300">
                    Consent by: <strong className="text-navy-950 dark:text-white">{t.consentBy}</strong>
                  </span>
                  {t.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-navy-500">Access Code:</span>
                      <code className="bg-white dark:bg-navy-950 border border-navy-200 dark:border-navy-700 px-2 py-1 rounded text-xs font-mono font-bold tracking-widest text-navy-950 dark:text-white select-all">
                        {t.accessCode}
                      </code>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && <GeneratePassportDialog studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function GeneratePassportDialog({ studentId, onClose, onDone }: any) {
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState("");
  const [modules, setModules] = React.useState<string[]>(["ACADEMIC", "ATTENDANCE"]);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  const MODULE_OPTS = ["ACADEMIC", "ATTENDANCE", "DISCIPLINE", "PORTFOLIO", "MEDICAL", "TALENT", "COMPETENCY"];

  function toggleModule(m: string) {
    if (modules.includes(m)) setModules(modules.filter(x => x !== m));
    else setModules([...modules, m]);
  }

  async function save() {
    if (modules.length === 0) return toast({ title: "Select at least one module", tone: "error" });
    if (!consent) return toast({ title: "Consent signature required", tone: "error" });

    setSaving(true);
    try {
      const res = await fetch("/api/students/passport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, destinationEmail: email || undefined, includedModules: modules, consentBy: consent })
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Passport generated", tone: "success" });
        onDone();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Export Transfer Passport</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-navy-500">
            Generate a secure, portable digital identity snapshot. You control exactly what data leaves the system.
          </p>

          <div className="space-y-2 border border-navy-100 dark:border-navy-800 rounded-xl p-3 bg-navy-50/50 dark:bg-navy-900/30">
            <Label className="text-xs font-bold uppercase tracking-widest text-navy-500">Data Minimization</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {MODULE_OPTS.map(m => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={modules.includes(m)} 
                    onChange={() => toggleModule(m)} 
                    className="rounded border-navy-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-xs font-medium text-navy-700 dark:text-navy-300">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Destination Email (Optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="receiving-school@example.com" />
          </div>

          <div className="space-y-1">
            <Label>Parent/Guardian Consent Signature</Label>
            <Input value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="Type parent's full name to confirm consent" className="border-amber-200 focus:border-amber-500 focus:ring-amber-500" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Passport"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
