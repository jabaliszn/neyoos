"use client";

import * as React from "react";
import { CheckCircle, Loader2, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function PublicContractSignClient({ contract }: { contract: any }) {
  const { toast } = useToast();
  const [signed, setSigned] = React.useState(contract.status === "SIGNED");
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ signedByName: contract.contactName || "", signedByRole: contract.contactRole || "", signatureText: "", accepted: false });

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/sign/${contract.publicToken}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not sign contract");
      setSigned(true);
      toast({ title: "Contract signed", description: "NEYO has recorded the signed agreement.", tone: "success" });
    } catch (error: any) {
      toast({ title: error.message || "Could not sign contract", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{contract.title}</CardTitle>
              <p className="mt-1 text-sm text-navy-500">{contract.schoolName} · {contract.contactName}</p>
            </div>
            <Badge tone={signed ? "green" : "amber"}>{signed ? "SIGNED" : "READY TO SIGN"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-navy-100 bg-white/80 p-4 text-sm leading-7 text-navy-800 shadow-inner dark:border-navy-800 dark:bg-navy-950/50 dark:text-navy-100">
            <pre className="whitespace-pre-wrap font-sans">{contract.body}</pre>
          </div>

          {signed ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-100">
              <div className="flex items-center gap-2 font-bold"><CheckCircle className="h-5 w-5" /> Signed contract recorded</div>
              <p className="mt-1 text-sm">Signed by {contract.signedByName || form.signedByName}.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-navy-100 bg-navy-50/60 p-4 dark:border-navy-800 dark:bg-navy-900/35">
              <p className="mb-3 text-sm font-black text-navy-950 dark:text-white">Sign agreement</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Your full name</Label><Input value={form.signedByName} onChange={(e) => setForm((f) => ({ ...f, signedByName: e.target.value }))} /></div>
                <div><Label>Your role</Label><Input value={form.signedByRole} onChange={(e) => setForm((f) => ({ ...f, signedByRole: e.target.value }))} placeholder="Director / Principal / Owner" /></div>
              </div>
              <div className="mt-3"><Label>Typed signature</Label><Input value={form.signatureText} onChange={(e) => setForm((f) => ({ ...f, signatureText: e.target.value }))} placeholder="Type your name again as signature" /></div>
              <label className="mt-3 flex items-start gap-2 text-sm text-navy-600 dark:text-navy-300"><input type="checkbox" className="mt-1" checked={form.accepted} onChange={(e) => setForm((f) => ({ ...f, accepted: e.target.checked }))} /> I confirm I am authorized to sign this agreement for the school.</label>
              <Button className="mt-4 w-full" disabled={saving || !form.accepted || !form.signatureText} onClick={submit}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />} Sign contract</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
