"use client";

import * as React from "react";
import Image from "next/image";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "@/components/ui/otp-input";
import { useToast } from "@/components/ui/toast";

type Mode = "idle" | "setup" | "recovery" | "disable";

/** 2FA management card for /settings/security. Wired to the real 2FA APIs. */
export function TwoFactorCard({ initialEnabled }: { initialEnabled: boolean }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [loading, setLoading] = React.useState(false);
  const [qr, setQr] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);

  async function beginSetup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Could not start setup.");
        return;
      }
      setQr(json.data.qrDataUrl);
      setSecret(json.data.secret);
      setCode("");
      setMode("setup");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "That code is not correct.");
        setCode("");
        return;
      }
      setRecoveryCodes(json.data.recoveryCodes);
      setEnabled(true);
      setMode("recovery");
      toast({ title: "Two-factor authentication enabled", tone: "success" });
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "That code is not correct.");
        setCode("");
        return;
      }
      setEnabled(false);
      setMode("idle");
      setCode("");
      toast({ title: "Two-factor authentication turned off", tone: "info" });
    } finally {
      setLoading(false);
    }
  }

  function copyRecovery() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Two-factor authentication</CardTitle>
        {enabled ? (
          <Badge tone="green">
            <ShieldCheck className="h-3.5 w-3.5" /> On
          </Badge>
        ) : (
          <Badge tone="neutral">
            <ShieldOff className="h-3.5 w-3.5" /> Off
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {/* IDLE */}
        {mode === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-navy-500 dark:text-navy-400">
              Add a second step at sign-in using an authenticator app like Google
              Authenticator or Authy. Protects your account even if your password
              or phone is compromised.
            </p>
            {enabled ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setMode("disable");
                  setCode("");
                  setError(null);
                }}
              >
                <ShieldOff className="h-4 w-4" />
                Turn off 2FA
              </Button>
            ) : (
              <Button onClick={beginSetup} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Set up 2FA
              </Button>
            )}
          </div>
        )}

        {/* SETUP: scan QR + enter code */}
        {mode === "setup" && (
          <div className="space-y-5">
            <ol className="space-y-1 text-sm text-navy-600 dark:text-navy-300">
              <li>1. Open your authenticator app.</li>
              <li>2. Scan this QR code (or enter the key manually).</li>
              <li>3. Type the 6-digit code it shows.</li>
            </ol>
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-navy-100 bg-warm-50 p-5 dark:border-navy-800 dark:bg-navy-950">
              {qr && (
                <Image
                  src={qr}
                  alt="2FA QR code"
                  width={180}
                  height={180}
                  className="rounded-xl bg-white p-2"
                  unoptimized
                />
              )}
              <code className="select-all rounded-lg bg-navy-100 px-3 py-1 text-xs font-medium tracking-wider text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                {secret}
              </code>
            </div>
            <OtpInput
              length={6}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onComplete={confirmEnable}
              disabled={loading}
              error={Boolean(error)}
            />
            {error && (
              <p className="text-center text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={confirmEnable}
                className="flex-1"
                disabled={loading || code.length < 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode("idle");
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* RECOVERY: show backup codes once */}
        {mode === "recovery" && (
          <div className="space-y-4">
            <p className="text-sm text-navy-600 dark:text-navy-300">
              Save these recovery codes somewhere safe. Each works once if you
              lose your phone. They won&apos;t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-navy-100 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-950">
              {recoveryCodes.map((c) => (
                <code
                  key={c}
                  className="select-all text-center text-sm font-medium tracking-wider text-navy-800 dark:text-navy-100"
                >
                  {c}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={copyRecovery}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy codes"}
              </Button>
              <Button onClick={() => setMode("idle")}>I&apos;ve saved them</Button>
            </div>
          </div>
        )}

        {/* DISABLE: confirm with a code */}
        {mode === "disable" && (
          <div className="space-y-5">
            <p className="text-sm text-navy-600 dark:text-navy-300">
              Enter a current 6-digit code (or a recovery code) to turn off 2FA.
            </p>
            <OtpInput
              length={6}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onComplete={confirmDisable}
              disabled={loading}
              error={Boolean(error)}
            />
            {error && (
              <p className="text-center text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={confirmDisable}
                className="flex-1"
                disabled={loading || code.length < 6}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Turn off 2FA"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode("idle");
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
