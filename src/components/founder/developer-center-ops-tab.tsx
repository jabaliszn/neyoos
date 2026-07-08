"use client";

/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06). The real
 * NEYO Ops monitoring console: total requests, active integrations, failed
 * calls, slow endpoints, top developers, usage by school, and security
 * alerts — every figure computed live from real `ApiUsageLog` rows. Also
 * where NEYO issues its own real NEYO_PARTNER keys for future first-party
 * accessories, and controls whether the public developer docs are live.
 */
import * as React from "react";
import { Code2, ShieldAlert, Zap, Users, Building2, Plus, RefreshCw, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Config = { docsPublished: boolean; defaultRateLimitPerMinute: number; slowRequestThresholdMs: number };
type Dashboard = {
  windowDays: number; totalRequests: number; failedRequests: number; successRate: number;
  activeIntegrations: number;
  slowEndpoints: { path: string; avgDurationMs: number; count: number }[];
  topDevelopers: { apiKeyId: string; keyName: string | null; tenantName: string | null; requests: number }[];
  usageBySchool: { tenantId: string; tenantName: string; requests: number }[];
  securityAlerts: { type: string; message: string; count: number }[];
  recentFailures: { path: string; method: string; statusCode: number; outcome: string; createdAt: string; tenantName: string | null }[];
};
type PartnerKey = {
  id: string; name: string; keyPrefix: string; scopes: string[]; status: string;
  createdAt: string; lastUsedAt: string | null; tenantName: string;
};

export function DeveloperCenterOpsTab() {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<Config | null>(null);
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null);
  const [partnerKeys, setPartnerKeys] = React.useState<PartnerKey[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [issueTenantId, setIssueTenantId] = React.useState("");
  const [issueName, setIssueName] = React.useState("");
  const [newToken, setNewToken] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ops/developer-center?days=7");
      const json = await res.json();
      if (json.ok) {
        setConfig(json.data.config);
        setDashboard(json.data.dashboard);
        setPartnerKeys(json.data.partnerKeys);
      } else {
        setError(json.error?.message || "Failed to load the Developer Center");
      }
    } catch {
      setError("Failed to load the Developer Center");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function saveConfig() {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/ops/developer-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Developer Center config saved", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to save", tone: "error" });
      }
    } finally {
      setSavingConfig(false);
    }
  }

  async function issuePartnerKey() {
    if (!issueTenantId.trim() || !issueName.trim()) {
      toast({ title: "Enter a real tenant ID and a name for the key", tone: "error" });
      return;
    }
    setBusy("issue");
    try {
      const res = await fetch("/api/ops/partner-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: issueTenantId.trim(), name: issueName.trim(), scopes: ["*"] }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewToken(json.data.token);
        setIssueName("");
        toast({ title: "NEYO Partner key issued", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to issue key", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/ops/partner-keys/${id}/revoke`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Key revoked", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } finally {
      setBusy(null);
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

  if (!config || !dashboard) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5 text-green-600" />Developer Center — real API usage (last {dashboard.windowDays} days)</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
            NEYO becomes the platform other education software connects to. Every figure below is computed live from real API requests — never a mock.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Total requests</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{dashboard.totalRequests}</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Active integrations</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{dashboard.activeIntegrations}</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Failed calls</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{dashboard.failedRequests}</p>
            </div>
            <div className="rounded-2xl border border-green-200/70 bg-green-50/60 p-4 dark:border-green-900 dark:bg-green-900/10">
              <p className="text-xs text-navy-400">Success rate</p>
              <p className="mt-1 text-lg font-bold text-green-700 dark:text-green-400">{dashboard.successRate}%</p>
            </div>
          </div>

          {dashboard.securityAlerts.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-500"><ShieldAlert className="h-3.5 w-3.5" />Security alerts</p>
              <div className="space-y-2">
                {dashboard.securityAlerts.map((a) => (
                  <div key={a.type} className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 text-sm dark:border-red-900 dark:bg-red-900/10">
                    <span className="font-bold text-red-700 dark:text-red-400">{a.count}× </span>
                    <span className="text-navy-700 dark:text-navy-200">{a.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.slowEndpoints.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-400"><Zap className="h-3.5 w-3.5" />Slow endpoints</p>
              <div className="space-y-1.5">
                {dashboard.slowEndpoints.map((e) => (
                  <div key={e.path} className="flex items-center justify-between rounded-xl border border-navy-100 bg-white/60 px-3 py-2 text-xs dark:border-navy-800 dark:bg-navy-900/50">
                    <span className="font-mono text-navy-600 dark:text-navy-300">{e.path}</span>
                    <span className="text-navy-400">{e.avgDurationMs}ms avg · {e.count} calls</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-400"><Users className="h-3.5 w-3.5" />Top developers</p>
              {dashboard.topDevelopers.length === 0 ? (
                <p className="text-xs text-navy-400">No real API activity yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {dashboard.topDevelopers.map((d) => (
                    <div key={d.apiKeyId} className="flex items-center justify-between rounded-xl border border-navy-100 bg-white/60 px-3 py-2 text-xs dark:border-navy-800 dark:bg-navy-900/50">
                      <span className="text-navy-700 dark:text-navy-200">{d.keyName ?? "Unnamed key"} · {d.tenantName}</span>
                      <span className="font-bold text-navy-900 dark:text-navy-50">{d.requests}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-400"><Building2 className="h-3.5 w-3.5" />Usage by school</p>
              {dashboard.usageBySchool.length === 0 ? (
                <p className="text-xs text-navy-400">No real API activity yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {dashboard.usageBySchool.map((s) => (
                    <div key={s.tenantId} className="flex items-center justify-between rounded-xl border border-navy-100 bg-white/60 px-3 py-2 text-xs dark:border-navy-800 dark:bg-navy-900/50">
                      <span className="text-navy-700 dark:text-navy-200">{s.tenantName}</span>
                      <span className="font-bold text-navy-900 dark:text-navy-50">{s.requests}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Platform config</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Default rate limit (req/min)</Label>
                <Input type="number" value={config.defaultRateLimitPerMinute} onChange={(e) => setConfig({ ...config, defaultRateLimitPerMinute: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Slow-request threshold (ms)</Label>
                <Input type="number" value={config.slowRequestThresholdMs} onChange={(e) => setConfig({ ...config, slowRequestThresholdMs: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Public docs</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([false, true] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setConfig({ ...config, docsPublished: v })}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${config.docsPublished === v ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"}`}
                    >
                      {v ? "Published" : "Hidden"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button className="mt-3" size="sm" onClick={saveConfig} disabled={savingConfig}>{savingConfig ? "Saving…" : "Save config"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NEYO Partner keys — for NEYO&apos;s own first-party accessories</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
            The same real API-key mechanism a school uses for its own integrations, issued by NEYO itself for a future NEYO-built accessory (a fingerprint device, ID-card printer, etc.) — a genuinely more privileged, NEYO-vetted tier, scoped to one real school.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>School (real tenant ID)</Label>
              <Input value={issueTenantId} onChange={(e) => setIssueTenantId(e.target.value)} placeholder="cmr3bogzp..." />
            </div>
            <div className="flex-1">
              <Label>Accessory name</Label>
              <Input value={issueName} onChange={(e) => setIssueName(e.target.value)} placeholder="e.g. NEYO Fingerprint Reader v1" />
            </div>
            <Button onClick={issuePartnerKey} disabled={busy === "issue"}><Plus className="mr-1.5 h-3.5 w-3.5" />Issue key</Button>
          </div>

          {newToken && (
            <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-900/20">
              <p className="font-semibold text-green-800 dark:text-green-300">Copy this key now — it won&apos;t be shown again:</p>
              <code className="mt-2 block overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-xs text-navy-800 dark:bg-navy-900 dark:text-navy-100">{newToken}</code>
              <button type="button" onClick={() => setNewToken(null)} className="mt-2 text-xs font-medium text-green-700 underline-offset-2 hover:underline dark:text-green-400">I&apos;ve saved it — dismiss</button>
            </div>
          )}

          {partnerKeys === null || partnerKeys.length === 0 ? (
            <EmptyState icon={Code2} title="No NEYO Partner keys yet" description="Issue one above when NEYO's own first-party accessories are ready to connect." />
          ) : (
            <div className="space-y-2">
              {partnerKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white/70 p-3.5 dark:border-navy-800 dark:bg-navy-900/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{k.name}</p>
                      <Badge tone={k.status === "active" ? "green" : "neutral"}>{k.status}</Badge>
                    </div>
                    <p className="text-xs text-navy-400">{k.tenantName} · <code className="font-mono">{k.keyPrefix}…</code></p>
                  </div>
                  {k.status === "active" && (
                    <Button size="sm" variant="ghost" disabled={busy === k.id} onClick={() => revokeKey(k.id)} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
                      <Ban className="mr-1.5 h-3.5 w-3.5" />Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
