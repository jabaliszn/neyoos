"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Database, HardDrive, Link2, Loader2, RefreshCw, Save, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Summary = any;

function fmtGb(value: number) {
  return `${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })} GB`;
}
function tone(status: string): "green" | "amber" | "red" | "neutral" | "blue" {
  if (status === "HEALTHY" || status === "CONNECTED") return "green";
  if (status === "WARNING" || status === "READY_TO_CONNECT" || status === "DESIGN_READY") return "amber";
  if (status === "ERROR") return "red";
  return "neutral";
}

export function StorageVaultClient() {
  const { toast } = useToast();
  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ provider: "NEYO_MANAGED_OBJECT_STORAGE", accountEmail: "", storageLimitGb: "15", notes: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/storage-vault");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not load storage vault");
      setData(json.data);
      setForm({ provider: json.data.provider.provider, accountEmail: json.data.provider.accountEmail || "", storageLimitGb: String(json.data.provider.storageLimitGb || 15), notes: json.data.provider.notes || "" });
    } catch (error: any) { toast({ title: error.message || "Could not load storage vault", tone: "error" }); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "configure", ...form, storageLimitGb: Number(form.storageLimitGb) }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not save storage vault");
      toast({ title: "Storage vault updated", tone: "success" });
      await load();
    } catch (error: any) { toast({ title: error.message || "Could not save", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function runHealthCheck() {
    setSaving(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "healthCheck" }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not run health check");
      toast({ title: "Storage health check complete", description: json.data.usage?.actionRequired || "No action required.", tone: json.data.usage?.healthStatus === "ERROR" ? "error" : json.data.usage?.healthStatus === "WARNING" ? "info" : "success" });
      await load();
    } catch (error: any) { toast({ title: error.message || "Could not run health check", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function upgrade(plan: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upgrade", plan }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not request upgrade");
      toast({ title: "Storage upgrade noted", description: "NEYO can connect this to central billing in the next billing batch.", tone: "success" });
      await load();
    } catch (error: any) { toast({ title: error.message || "Could not request upgrade", tone: "error" }); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="space-y-4">{[0,1,2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;
  if (!data) return <EmptyState icon={HardDrive} title="Storage vault unavailable" description="Reload the page to try again." />;
  const pct = data.usage.percentUsed;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-green-600" /> NEYO Storage Vault</CardTitle>
          <p className="text-sm text-navy-500 dark:text-navy-400">Encrypted school file storage with Google Workspace BYOS seams and NEYO managed storage fallback. No plaintext Google passwords are stored here.</p>
          <Button variant="secondary" size="sm" disabled={saving} onClick={runHealthCheck}><RefreshCw className="h-4 w-4" />Run health check</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-navy-400">Storage used</p>
              <p className="mt-1 text-2xl font-black text-navy-950 dark:text-white">{fmtGb(data.usage.usedGb)} / {fmtGb(data.usage.limitGb)}</p>
            </div>
            <div className="flex gap-2"><Badge tone={tone(data.provider.healthStatus)}>{data.provider.healthStatus}</Badge><Badge tone={tone(data.provider.status)}>{data.provider.status}</Badge></div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800"><div className={`h-full rounded-full ${pct >= 95 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.max(1, pct)}%` }} /></div>
          <div className="grid gap-3 md:grid-cols-3">
            <Info icon={ShieldCheck} label="Encryption" value={data.provider.encryptionMode} tone="green" />
            <Info icon={Database} label="Provider" value={data.provider.provider.replace(/_/g, " ")} tone="blue" />
            <Info icon={AlertTriangle} label="Action" value={data.usage.actionRequired || "No action required"} tone={data.usage.actionRequired ? "amber" : "green"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Configure storage provider</CardTitle><p className="text-xs text-navy-500">Google entries are a provisioning seam. Real Google Workspace/Admin SDK activation comes after company credentials and legal consent.</p></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Provider</Label><select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} className="mt-1 h-10 w-full rounded-full border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"><option value="NEYO_MANAGED_OBJECT_STORAGE">NEYO managed encrypted storage</option><option value="GOOGLE_WORKSPACE_MANAGED">NEYO-managed Google Workspace vault</option><option value="GOOGLE_WORKSPACE_BYOS">School-owned Google Workspace BYOS</option></select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Vault email / account</Label><Input value={form.accountEmail} onChange={(e) => setForm((f) => ({ ...f, accountEmail: e.target.value }))} placeholder="karibu-high.storage@storage.neyo.co.ke" /></div><div><Label>Storage limit (GB)</Label><Input type="number" value={form.storageLimitGb} onChange={(e) => setForm((f) => ({ ...f, storageLimitGb: e.target.value }))} /></div></div>
            <div><Label>Internal notes</Label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900" rows={3} /></div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save storage vault</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Upgrade paths</CardTitle><p className="text-xs text-navy-500">When storage fills up, NEYO can route the school into a paid provider upgrade or NEYO managed storage add-on.</p></CardHeader>
          <CardContent className="space-y-3">
            <button onClick={() => upgrade("GOOGLE_WORKSPACE_UPGRADE")} className="w-full rounded-2xl border border-navy-100 bg-white/70 p-4 text-left dark:border-navy-800 dark:bg-navy-950/40"><p className="font-black text-navy-950 dark:text-white">Google Workspace upgrade</p><p className="mt-1 text-xs text-navy-500">For managed Workspace vaults where storage/license is upgraded through Google.</p></button>
            <button onClick={() => upgrade("NEYO_STORAGE_ADDON_500_PLUS")} className="w-full rounded-2xl border border-green-200 bg-green-50/50 p-4 text-left dark:border-green-900/40 dark:bg-green-950/20"><p className="font-black text-navy-950 dark:text-white">NEYO managed add-on · KES 500+</p><p className="mt-1 text-xs text-navy-500">School pays NEYO, NEYO manages encrypted object storage capacity.</p></button>
            {data.provider.upgradePlan ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Current requested plan: {data.provider.upgradePlan}</div> : null}
          </CardContent>
        </Card>
      </div>

      <LinkedStorageCard linkedStorage={data.provider.linkedStorage} onChanged={load} />

      <Card>
        <CardHeader><CardTitle className="text-base">Recent stored files</CardTitle></CardHeader>
        <CardContent>{data.recentFiles.length === 0 ? <EmptyState icon={Database} title="No files recorded yet" description="Uploaded documents and media will appear here with encryption/provider metadata." /> : <div className="space-y-2">{data.recentFiles.map((file: any) => <div key={file.id} className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white/70 p-3 text-sm dark:border-navy-800 dark:bg-navy-950/40"><div><p className="font-bold text-navy-900 dark:text-white">{file.fileName}</p><p className="text-xs text-navy-400">{file.category} · {Math.round(file.size / 1024)} KB · {file.provider}</p></div><Badge tone={file.encrypted ? "green" : "amber"}>{file.encrypted ? "Encrypted" : "Legacy"}</Badge></div>)}</div>}</CardContent>
      </Card>
    </div>
  );
}

/**
 * R.7 — School-Linked External Storage. A REAL constraint disclosed
 * honestly in the copy itself: a pasted link can't receive automatic
 * uploads (Drive/Dropbox require a real account connection for that, a
 * much bigger separate project) — so this is a real, verified overflow
 * destination a school can point to instead of paying NEYO for more space,
 * with a genuine live reachability check before it's ever saved.
 */
function LinkedStorageCard({ linkedStorage, onChanged }: { linkedStorage: { url: string; label: string; provider: string; addedAt: string; verifiedAt: string | null; lastCheckOk: boolean } | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [rechecking, setRechecking] = React.useState(false);

  async function link() {
    setSaving(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "linkExternal", url, label }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not link that storage.");
      toast({ title: "External storage linked", description: "NEYO confirmed the link is reachable.", tone: "success" });
      setUrl(""); setLabel("");
      onChanged();
    } catch (error: any) {
      toast({ title: error.message || "Could not link that storage.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    setSaving(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlinkExternal" }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not remove the link.");
      toast({ title: "External storage link removed", tone: "success" });
      onChanged();
    } catch (error: any) {
      toast({ title: error.message || "Could not remove the link.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function recheck() {
    setRechecking(true);
    try {
      const res = await fetch("/api/storage-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recheckExternal" }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not re-check the link.");
      toast({ title: json.data.check.reachable ? "Still reachable ✓" : "Link is no longer reachable", description: json.data.check.error || undefined, tone: json.data.check.reachable ? "success" : "error" });
      onChanged();
    } catch (error: any) {
      toast({ title: error.message || "Could not re-check the link.", tone: "error" });
    } finally {
      setRechecking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-green-600" /> School-linked external storage</CardTitle>
        <p className="text-xs text-navy-500 dark:text-navy-400">
          Don&apos;t want to pay NEYO for extra storage? Paste a link to your own Google Drive, Dropbox or OneDrive folder as a real overflow destination.
          NEYO can&apos;t upload files into your Drive/Dropbox automatically just from a pasted link (that needs a real account connection) — but the moment NEYO&apos;s
          own storage starts filling up, this link is shown clearly as where you can move older files yourself instead of upgrading. Only the school owner or principal can set this.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedStorage ? (
          <div className="space-y-3 rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-navy-900 dark:text-white">{linkedStorage.label}</p>
                <a href={linkedStorage.url} target="_blank" rel="noreferrer" className="text-xs text-green-700 underline dark:text-green-400">{linkedStorage.url}</a>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={linkedStorage.provider === "OTHER" ? "neutral" : "blue"}>{linkedStorage.provider.replace(/_/g, " ")}</Badge>
                <Badge tone={linkedStorage.lastCheckOk ? "green" : "red"}>{linkedStorage.lastCheckOk ? "Reachable" : "Unreachable"}</Badge>
              </div>
            </div>
            <p className="text-[11px] text-navy-400">
              Last checked: {linkedStorage.verifiedAt ? new Date(linkedStorage.verifiedAt).toLocaleString("en-KE") : "never"}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={rechecking} onClick={recheck}>{rechecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-check link</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={unlink}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Folder link</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" /></div>
            <div><Label>What should we call it?</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. School Google Drive" /></div>
          </div>
        )}
        {!linkedStorage && (
          <Button onClick={link} disabled={saving || !url.trim() || !label.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Link this storage
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ icon: Icon, label, value, tone }: any) {
  return <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40"><div className="mb-2 flex items-center gap-2"><Icon className={`h-4 w-4 ${tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : "text-blue-600"}`} /><p className="text-[10px] font-black uppercase tracking-widest text-navy-400">{label}</p></div><p className="text-sm font-black text-navy-900 dark:text-white">{value}</p></div>;
}
