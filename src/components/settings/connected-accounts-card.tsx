"use client";

import * as React from "react";
import { Link2, Unlink, Globe2, Chrome, Laptop, Loader2, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Provider = "google" | "apple" | "microsoft";
type ProviderStatus = { provider: Provider; configured: boolean; connected: boolean; email?: string | null; displayName?: string | null; linkedAt?: string | null };

const LABELS: Record<Provider, { title: string; copy: string; icon: typeof Chrome; tone: string }> = {
  google: { title: "Google Account Connection", copy: "Allow sign in with Google after OAuth credentials are saved in NEYO Ops.", icon: Chrome, tone: "text-red-600 bg-red-500/10" },
  apple: { title: "Apple ID Connection", copy: "Allow secure login via Apple Developer credentials saved in NEYO Ops.", icon: Laptop, tone: "text-white bg-navy-950" },
  microsoft: { title: "Microsoft Azure Connection", copy: "Allow enterprise login via Microsoft Entra/Azure credentials saved in NEYO Ops.", icon: Globe2, tone: "text-blue-600 bg-blue-500/10" },
};

export function ConnectedAccountsCard() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState<string | null>(null);
  const [providers, setProviders] = React.useState<ProviderStatus[]>([]);

  async function load() {
    const res = await fetch("/api/oauth/status").then((r) => r.json()).catch(() => null);
    if (res?.ok) setProviders(res.data.providers);
  }
  React.useEffect(() => { load(); }, []);

  async function connect(provider: Provider) {
    setLoading(provider);
    try {
      const res = await fetch(`/api/oauth/start/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirectTo: "/settings/security" }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not start OAuth.");
      window.location.assign(json.data.authUrl);
    } catch (error: any) {
      toast({ title: error.message || "Could not start OAuth", tone: "error" });
      setLoading(null);
    }
  }

  async function disconnect(provider: Provider) {
    setLoading(provider);
    try {
      const res = await fetch(`/api/oauth/disconnect/${provider}`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not disconnect account.");
      toast({ title: `${provider} disconnected`, tone: "success" });
      await load();
    } catch (error: any) {
      toast({ title: error.message || "Could not disconnect account", tone: "error" });
    } finally { setLoading(null); }
  }

  const byProvider = Object.fromEntries(providers.map((p) => [p.provider, p])) as Record<Provider, ProviderStatus>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-5 w-5 text-green-600" /> Connected Accounts (OAuth)</CardTitle>
        <p className="text-xs text-navy-400">Google, Apple and Microsoft credentials are managed in NEYO Ops. This screen starts the real provider redirect only when that provider is configured.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["google", "apple", "microsoft"] as Provider[]).map((provider) => {
          const meta = LABELS[provider];
          const status = byProvider[provider] || { provider, configured: false, connected: false };
          const Icon = meta.icon;
          return (
            <div key={provider} className="flex flex-col gap-4 rounded-2xl border border-navy-100 bg-white/70 p-4.5 dark:border-navy-800 dark:bg-navy-900/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${meta.tone}`}><Icon className="h-6 w-6" /></div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy-900 dark:text-navy-50">{meta.title}</span><Badge tone={status.connected ? "green" : status.configured ? "blue" : "amber"}>{status.connected ? "Linked" : status.configured ? "Ready" : "Needs NEYO Ops keys"}</Badge></div>
                  <p className="text-xs text-navy-400 dark:text-navy-500">{status.connected ? `Linked: ${status.email || status.displayName || "provider account"}` : meta.copy}</p>
                </div>
              </div>
              {status.connected ? <Button size="sm" variant="secondary" disabled={loading !== null} onClick={() => disconnect(provider)}>{loading === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlink className="h-4 w-4" />Disconnect</>}</Button> : <Button size="sm" disabled={loading !== null || !status.configured} onClick={() => connect(provider)}>{loading === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4" />Connect</>}</Button>}
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-xl border border-navy-50 bg-navy-50/20 p-3 text-[11px] text-navy-500"><KeyRound className="h-4 w-4 shrink-0 text-green-600" /><span><strong>Activation note:</strong> create OAuth apps in Google Cloud, Apple Developer and Microsoft Entra, then paste client IDs/secrets into NEYO Ops. Callback URLs use <span className="font-mono">/api/oauth/callback/google</span>, <span className="font-mono">/api/oauth/callback/apple</span>, and <span className="font-mono">/api/oauth/callback/microsoft</span>.</span></div>
      </CardContent>
    </Card>
  );
}
