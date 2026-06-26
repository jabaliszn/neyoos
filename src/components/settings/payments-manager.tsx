"use client";

import * as React from "react";
import { Loader2, CheckCircle2, Smartphone, Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface ConfigStatus {
  configured: boolean;
  shortcode: string | null;
  environment: string;
}

export function PaymentsManager({ initial }: { initial: ConfigStatus }) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    shortcode: initial.shortcode ?? "",
    environment: initial.environment ?? "sandbox",
    consumerKey: "",
    consumerSecret: "",
    passkey: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/payments/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({
          title: json.error?.fields
            ? Object.values(json.error.fields)[0] as string
            : json.error?.message || "Could not save.",
          tone: "error",
        });
        return;
      }
      setStatus({
        configured: true,
        shortcode: form.shortcode,
        environment: form.environment,
      });
      // Clear secrets from the form after saving (they're encrypted server-side).
      setForm((f) => ({ ...f, consumerKey: "", consumerSecret: "", passkey: "" }));
      toast({ title: "M-Pesa credentials saved (encrypted)", tone: "success" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>M-Pesa (Daraja)</CardTitle>
        {status.configured ? (
          <Badge tone="green">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </Badge>
        ) : (
          <Badge tone="amber">Not set up</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-navy-100 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-950">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-300">
            <Smartphone className="h-5 w-5" />
          </div>
          <p className="text-sm text-navy-600 dark:text-navy-300">
            Connect your school&apos;s own M-Pesa Paybill so fees are paid
            straight to you. Your Daraja keys are encrypted with your school&apos;s
            private key and never shown again.
          </p>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-100">
            <p className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4" /> School fee credentials go here</p>
            <p className="mt-1 text-xs leading-relaxed text-green-800/80 dark:text-green-100/75">
              This page is for this school&apos;s own Paybill/Till. Parent fee payments, meal cards, transport and Mzazi QR payments go straight to the school.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> NEYO company credentials are not entered here</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-100/75">
              NEYO subscription collection uses the company billing seam and belongs in NEYO Ops / central billing, not inside a school&apos;s payment settings.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="shortcode">Paybill / Till number</Label>
              <Input
                id="shortcode"
                placeholder="174379"
                value={form.shortcode}
                onChange={(e) => set("shortcode", e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="env">Environment</Label>
              <select
                id="env"
                value={form.environment}
                onChange={(e) => set("environment", e.target.value)}
                disabled={loading}
                className="h-12 w-full rounded-2xl border border-navy-200 bg-white px-3.5 text-[15px] text-navy-900 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-50"
              >
                <option value="sandbox">Sandbox (testing)</option>
                <option value="production">Production (live)</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="ck">Consumer key</Label>
            <PasswordInput
              id="ck"
              placeholder={status.configured ? "•••••••• (saved)" : "From Daraja portal"}
              value={form.consumerKey}
              onChange={(e) => set("consumerKey", e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="cs">Consumer secret</Label>
            <PasswordInput
              id="cs"
              placeholder={status.configured ? "•••••••• (saved)" : "From Daraja portal"}
              value={form.consumerSecret}
              onChange={(e) => set("consumerSecret", e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="pk">Passkey</Label>
            <PasswordInput
              id="pk"
              placeholder={status.configured ? "•••••••• (saved)" : "Lipa na M-Pesa passkey"}
              value={form.passkey}
              onChange={(e) => set("passkey", e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status.configured ? "Update credentials" : "Save & connect"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
