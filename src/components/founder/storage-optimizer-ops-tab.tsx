"use client";

/**
 * W.1 — NEYO's Storage Intelligence Engine (founder-requested 2026-07-06).
 * The real NEYO Ops UI: live-editable lifecycle-cleanup config, a real
 * "potential savings" preview, a "Clean now" real trigger (dry-run or
 * committed), and a real history of every past run. Schools never see any
 * of this — it lives entirely inside NEYO Ops.
 */
import * as React from "react";
import { HardDrive, Sparkles, Trash2, Eye, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type StorageOptimizerConfig = {
  temporaryFileMaxAgeDays: number;
  generatedFileMaxAgeDays: number;
  unusedFileFlagAfterDays: number;
  autoDeleteTemporaryFiles: boolean;
};

type StorageOptimizerReport = {
  duplicateFilesFound: number;
  duplicateBytesFound: number;
  temporaryFilesDeleted: number;
  temporaryBytesFreed: number;
  unusedFilesFlagged: number;
  totalBytesFreed: number;
};

type StorageOptimizerRunRow = {
  id: string;
  tenantId: string | null;
  tenant: { name: string } | null;
  triggeredBy: string;
  triggeredByName: string;
  duplicateFilesFound: number;
  duplicateBytesFound: string; // BigInt serializes as string over JSON
  temporaryFilesDeleted: number;
  temporaryBytesFreed: string;
  unusedFilesFlagged: number;
  totalBytesFreed: string;
  dryRun: boolean;
  createdAt: string;
};

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = n;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}

export function StorageOptimizerOpsTab() {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<StorageOptimizerConfig | null>(null);
  const [preview, setPreview] = React.useState<StorageOptimizerReport | null>(null);
  const [runs, setRuns] = React.useState<StorageOptimizerRunRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ops/storage-optimizer");
      const json = await res.json();
      if (json.ok) {
        setConfig(json.data.config);
        setPreview(json.data.preview);
        setRuns(json.data.runs);
      } else {
        setError(json.error?.message || "Failed to load the Storage Intelligence Engine");
      }
    } catch {
      setError("Failed to load the Storage Intelligence Engine");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function saveConfig() {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/ops/storage-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", data: config }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Storage Intelligence Engine config saved", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to save", tone: "error" });
      }
    } finally {
      setSavingConfig(false);
    }
  }

  async function runNow(dryRun: boolean) {
    setRunning(true);
    try {
      const res = await fetch("/api/ops/storage-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", data: { dryRun } }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: dryRun ? "Preview complete" : "Cleanup complete",
          description: `Freed ${formatBytes(json.data.totalBytesFreed)} · ${json.data.temporaryFilesDeleted} temporary file(s) ${dryRun ? "would be" : "were"} deleted.`,
          tone: "success",
        });
        await load();
      } else {
        toast({ title: json.error?.message || "Run failed", tone: "error" });
      }
    } finally {
      setRunning(false);
    }
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/80 p-5 dark:border-red-900 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        <Button onClick={() => void load()} className="mt-3" variant="secondary"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </Card>
    );
  }

  if (!config || !preview) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-green-600" />Storage Intelligence Engine</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
            Real, behind-the-scenes storage management. Schools never see this. NEYO detects true duplicate files, safely deletes genuinely TEMPORARY working files (failed imports, OCR scratch images, draft exports) past their real age, and flags — never deletes — real long-unused files for a human to review. Permanent school records (students, fees, attendance, certificates, CBE evidence) are never touched by this engine.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Duplicate files</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.duplicateFilesFound}</p>
              <p className="text-xs text-navy-400">{formatBytes(preview.duplicateBytesFound)} potential</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Temporary files ready to clean</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.temporaryFilesDeleted}</p>
              <p className="text-xs text-navy-400">{formatBytes(preview.temporaryBytesFreed)} potential</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Unused files flagged</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.unusedFilesFlagged}</p>
              <p className="text-xs text-navy-400">never accessed, review manually</p>
            </div>
            <div className="rounded-2xl border border-green-200/70 bg-green-50/60 p-4 dark:border-green-900 dark:bg-green-900/10">
              <p className="text-xs text-navy-400">Potential savings</p>
              <p className="mt-1 text-lg font-bold text-green-700 dark:text-green-400">{formatBytes(preview.duplicateBytesFound + preview.temporaryBytesFreed)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={running} onClick={() => runNow(true)}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />Preview (dry run)
            </Button>
            <Button size="sm" variant="danger" disabled={running} onClick={() => runNow(false)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Clean now
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Lifecycle rules</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Temporary files: delete after (days)</Label>
                <Input type="number" value={config.temporaryFileMaxAgeDays} onChange={(e) => setConfig({ ...config, temporaryFileMaxAgeDays: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Generated files: prune after (days)</Label>
                <Input type="number" value={config.generatedFileMaxAgeDays} onChange={(e) => setConfig({ ...config, generatedFileMaxAgeDays: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Flag as unused after (days)</Label>
                <Input type="number" value={config.unusedFileFlagAfterDays} onChange={(e) => setConfig({ ...config, unusedFileFlagAfterDays: Number(e.target.value) })} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input
                type="checkbox"
                checked={config.autoDeleteTemporaryFiles}
                onChange={(e) => setConfig({ ...config, autoDeleteTemporaryFiles: e.target.checked })}
                className="h-4 w-4 rounded border-navy-300"
              />
              Let the nightly cron really delete temporary files (off = report-only, a safe default)
            </label>
            <Button className="mt-3" size="sm" onClick={saveConfig} disabled={savingConfig}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{savingConfig ? "Saving…" : "Save lifecycle rules"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cleanup history</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">Every real run, scheduled or manual — what it found and what it actually freed.</p>
        </CardHeader>
        <CardContent>
          {runs === null || runs.length === 0 ? (
            <p className="text-sm text-navy-400">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white/70 p-3.5 dark:border-navy-800 dark:bg-navy-900/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{r.tenant?.name ?? "All schools"}</p>
                      <Badge tone={r.dryRun ? "neutral" : "green"}>{r.dryRun ? "Preview" : "Committed"}</Badge>
                    </div>
                    <p className="text-xs text-navy-400">{r.triggeredByName} · {new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{formatBytes(r.totalBytesFreed)} freed</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
