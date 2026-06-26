"use client";

import * as React from "react";
import {
  KeyRound,
  Webhook,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  RotateCw,
  ShieldCheck,
  Send,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

// ---- types -----------------------------------------------------------------
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired";
}
interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description: string | null;
  lastDeliveryAt: string | null;
  signingSecret: string;
  lastDeliveryStatus: string | null;
}

const WEBHOOK_EVENTS = [
  "payment.recorded",
  "payment.failed",
  "subscription.updated",
  "user.created",
  "notification.sent",
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---- small helper: copy-to-clipboard button --------------------------------
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1 text-xs font-medium text-navy-600 transition-colors duration-200 ease-apple hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}

export function DeveloperPanel() {
  return (
    <div className="space-y-8">
      <DeveloperClarityCard />
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}


function DeveloperClarityCard() {
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 dark:border-green-900/50 dark:bg-green-950/20">
          <p className="text-sm font-bold text-green-900 dark:text-green-100">What API keys are for</p>
          <p className="mt-1 text-xs leading-relaxed text-green-800/80 dark:text-green-100/75">
            Give a trusted external system controlled access to this school&apos;s NEYO data. Copy the key once, keep it secret, and revoke it when unused.
          </p>
        </div>
        <div className="rounded-2xl border border-navy-200 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40">
          <p className="text-sm font-bold text-navy-900 dark:text-navy-50">What webhooks are for</p>
          <p className="mt-1 text-xs leading-relaxed text-navy-500 dark:text-navy-400">
            Let NEYO notify another system when events happen, such as payment.recorded or subscription.updated. Each delivery is signed and retried.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// API KEYS
// =============================================================================
function ApiKeysSection() {
  const { toast } = useToast();
  const [keys, setKeys] = React.useState<ApiKey[] | null>(null);
  const [error, setError] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newToken, setNewToken] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/api-keys");
      const json = await res.json();
      if (json.ok) setKeys(json.data.keys);
      else setError(true);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (name.trim().length < 2) {
      toast({ title: "Give the key a name first.", tone: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: ["*"] }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewToken(json.data.token);
        setName("");
        toast({ title: "API key created", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Could not create key", tone: "error" });
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Key revoked", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Could not revoke", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-navy-400" strokeWidth={1.75} />
          <CardTitle>API keys</CardTitle>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RotateCw className="h-4 w-4" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-navy-500 dark:text-navy-400">
          Use a key as a Bearer token to call the NEYO API. Example:
          <code className="ml-1 rounded-md bg-navy-50 px-1.5 py-0.5 text-xs text-navy-700 dark:bg-navy-800 dark:text-navy-200">
            curl -H &quot;Authorization: Bearer neyo_sk_…&quot; /api/v1/me
          </code>
        </p>

        {/* one-time secret reveal */}
        {newToken && (
          <div className="rounded-2xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-300">
              <ShieldCheck className="h-4 w-4" />
              Copy your key now — it won&apos;t be shown again
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-xs text-navy-800 dark:bg-navy-900 dark:text-navy-100">
                {newToken}
              </code>
              <CopyButton value={newToken} />
            </div>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="mt-3 text-xs font-medium text-green-700 underline-offset-2 hover:underline dark:text-green-400"
            >
              I&apos;ve saved it — dismiss
            </button>
          </div>
        )}

        {/* create form */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="keyName">New key name</Label>
            <Input
              id="keyName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SIS integration"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <Button onClick={create} disabled={creating} className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create key
          </Button>
        </div>

        {/* list / states */}
        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4" /> Couldn&apos;t load keys.
            <button onClick={load} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : keys === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a key above to start calling the NEYO API from your own systems."
          />
        ) : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                      {k.name}
                    </span>
                    <Badge
                      tone={
                        k.status === "active"
                          ? "green"
                          : k.status === "expired"
                          ? "amber"
                          : "neutral"
                      }
                    >
                      {k.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-navy-500 dark:text-navy-400">
                    <code className="font-mono">{k.keyPrefix}…</code>
                    <span>Created {fmtDate(k.createdAt)}</span>
                    <span>Last used {fmtDate(k.lastUsedAt)}</span>
                    {k.expiresAt && <span>Expires {fmtDate(k.expiresAt)}</span>}
                  </div>
                </div>
                {k.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke(k.id)}
                    disabled={busy === k.id}
                    className="shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {busy === k.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// WEBHOOKS
// =============================================================================
function WebhooksSection() {
  const { toast } = useToast();
  const [hooks, setHooks] = React.useState<WebhookRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/webhooks");
      const json = await res.json();
      if (json.ok) setHooks(json.data.webhooks);
      else setError(true);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!url.trim()) {
      toast({ title: "Enter an endpoint URL.", tone: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: ["*"] }),
      });
      const json = await res.json();
      if (json.ok) {
        setUrl("");
        toast({ title: "Webhook registered", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Could not register", tone: "error" });
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggle(h: WebhookRow) {
    setBusy(h.id);
    try {
      const res = await fetch(`/api/webhooks/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !h.active }),
      });
      const json = await res.json();
      if (json.ok) await load();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Webhook removed", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function sendTest(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Test event sent", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Webhook className="h-5 w-5 text-navy-400" strokeWidth={1.75} />
          <CardTitle>Webhooks</CardTitle>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RotateCw className="h-4 w-4" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-navy-500 dark:text-navy-400">
          We POST events to your URL with an{" "}
          <code className="rounded-md bg-navy-50 px-1.5 py-0.5 text-xs text-navy-700 dark:bg-navy-800 dark:text-navy-200">
            X-NEYO-Signature
          </code>{" "}
          header (HMAC-SHA256). Failed deliveries retry with exponential backoff.
          Available events: {WEBHOOK_EVENTS.join(", ")}.
        </p>

        {/* create */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="hookUrl">Endpoint URL</Label>
            <Input
              id="hookUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.ac.ke/neyo/webhook"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <Button onClick={create} disabled={creating} className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add webhook
          </Button>
        </div>

        {/* list / states */}
        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4" /> Couldn&apos;t load webhooks.
            <button onClick={load} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : hooks === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : hooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks yet"
            description="Add an endpoint above to receive real-time events from NEYO."
          />
        ) : (
          <ul className="space-y-3">
            {hooks.map((h) => (
              <li
                key={h.id}
                className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                        {h.url}
                      </code>
                      <Badge tone={h.active ? "green" : "neutral"}>
                        {h.active ? "active" : "paused"}
                      </Badge>
                      {h.lastDeliveryStatus && (
                        <Badge
                          tone={
                            h.lastDeliveryStatus === "DELIVERED"
                              ? "green"
                              : h.lastDeliveryStatus === "FAILED"
                              ? "red"
                              : "amber"
                          }
                        >
                          last: {h.lastDeliveryStatus.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500 dark:text-navy-400">
                      <span>Events: {h.events.join(", ")}</span>
                      <span>Last delivery {fmtDate(h.lastDeliveryAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-navy-400">Signing secret</span>
                      <code className="rounded-md bg-navy-50 px-1.5 py-0.5 font-mono text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                        {h.signingSecret.slice(0, 14)}…
                      </code>
                      <CopyButton value={h.signingSecret} label="Copy secret" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => sendTest(h.id)}
                    disabled={busy === h.id}
                  >
                    {busy === h.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send test
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle(h)}
                    disabled={busy === h.id}
                  >
                    {h.active ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(h.id)}
                    disabled={busy === h.id}
                    className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
