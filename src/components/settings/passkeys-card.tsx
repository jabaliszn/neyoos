"use client";

import * as React from "react";
import {
  Fingerprint,
  Loader2,
  Trash2,
  Plus,
  KeyRound,
  Smartphone,
  Laptop,
  Sparkles,
} from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface Passkey {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeysCard({ initial }: { initial: Passkey[] }) {
  const { toast } = useToast();
  const [passkeys, setPasskeys] = React.useState<Passkey[]>(initial);
  const [adding, setAdding] = React.useState(false);
  const [deviceType, setDeviceType] = React.useState<"apple" | "android">("apple");
  const [label, setLabel] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [supported, setSupported] = React.useState(true);

  React.useEffect(() => {
    setSupported(
      typeof window !== "undefined" && Boolean(window.PublicKeyCredential)
    );
  }, []);

  async function addPasskey(type: "apple" | "android") {
    setLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const optJson = await optRes.json();
      if (!optJson.ok) {
        toast({ title: optJson.error?.message || "Could not start biometrics setup.", tone: "error" });
        return;
      }

      // Browser prompts for native Face ID (Apple) or Fingerprint (Android) here!
      const attResp = await startRegistration(optJson.data.options);

      const deviceLabel = label || (type === "apple" ? "Face ID / Touch ID" : "Android Fingerprint");

      const verRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceLabel }),
      });
      const verJson = await verRes.json();
      if (!verJson.ok) {
        toast({ title: verJson.error?.message || "Biometric verification failed.", tone: "error" });
        return;
      }

      toast({
        title: "Biometrics Linked Successfully!",
        description: `${deviceLabel} is now connected. You can now log into NEYO in 1 tap!`,
        tone: "success",
      });
      setAdding(false);
      setLabel("");
      await refresh();
    } catch (e) {
      // User cancelled the prompt
      toast({
        title: "Biometric setup cancelled",
        description: "No changes were made to your security profile.",
        tone: "info",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    // Reload the page state dynamically to refresh the connected lists
    window.location.reload();
  }

  async function remove(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setPasskeys((p) => p.filter((x) => x.id !== id));
        toast({ title: "Biometric link removed", tone: "info" });
      } else {
        toast({ title: json.error?.message || "Could not remove biometric profile.", tone: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-green-600 animate-pulse" />
            Biometric Sign-In (Face ID & Fingerprints)
          </CardTitle>
          <p className="text-xs text-navy-400 mt-1">
            Securely link your iPhone Face ID or Android Fingerprint to log into NEYO in 1 tap without passwords.
          </p>
        </div>
        {supported && !adding && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setDeviceType("apple");
                setLabel("Face ID — iPhone");
                setAdding(true);
              }}
              disabled={loading}
              className="h-8 text-xs font-semibold"
            >
              🍏 Pair Face ID
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDeviceType("android");
                setLabel("Fingerprint — Android");
                setAdding(true);
              }}
              disabled={loading}
              className="h-8 text-xs font-semibold"
            >
              🤖 Pair Fingerprint
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <p className="text-xs text-navy-500 dark:text-navy-400">
            This device or browser doesn&apos;t support biometric authentication. Try a recent version of Chrome, Safari, or Edge.
          </p>
        ) : (
          <>
            {adding && (
              <div className="mb-5 space-y-3.5 rounded-2xl border border-navy-100 bg-navy-50/30 p-4 dark:border-navy-800 dark:bg-navy-950/40 animate-fade-in text-left">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{deviceType === "apple" ? "🍏" : "🤖"}</span>
                  <span className="text-xs font-bold text-navy-900 dark:text-white">
                    Configure {deviceType === "apple" ? "Apple Face ID / Touch ID" : "Android Fingerprint & Face Unlock"}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <Label>Device Label (Optional)</Label>
                  <Input
                    placeholder={deviceType === "apple" ? "E.g. My iPhone 15" : "E.g. My Galaxy S24"}
                    value={label}
                    onChange={(e: any) => setLabel(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => addPasskey(deviceType)} disabled={loading} className="flex-1 h-9 text-xs">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    Launch Native Biometric Prompt
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAdding(false);
                      setLabel("");
                    }}
                    disabled={loading}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {passkeys.length === 0 ? (
              <EmptyState
                icon={Fingerprint}
                title="No biometrics linked yet"
                description="Pair your face or fingerprint scanner to unlock instant, passwordless logins!"
                action={
                  !adding ? (
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setDeviceType("apple");
                          setLabel("Face ID — iPhone");
                          setAdding(true);
                        }}
                      >
                        🍏 Connect Face ID
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDeviceType("android");
                          setLabel("Fingerprint — Android");
                          setAdding(true);
                        }}
                      >
                        🤖 Connect Fingerprint
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400 text-left">Connected Biometric Devices</p>
                <ul className="divide-y divide-navy-100 dark:divide-navy-800 border border-navy-100 rounded-2xl bg-white dark:bg-navy-900 overflow-hidden">
                  {passkeys.map((p) => {
                    const isApple = p.deviceLabel?.toLowerCase().includes("iphone") || p.deviceLabel?.toLowerCase().includes("face id") || p.deviceLabel?.toLowerCase().includes("apple");
                    return (
                      <li
                        key={p.id}
                        className="flex items-center justify-between p-3.5 text-left transition-colors hover:bg-navy-50/50 dark:hover:bg-navy-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
                            {isApple ? <Laptop className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-navy-900 dark:text-navy-50">
                                {p.deviceLabel || "Biometric Device"}
                              </p>
                              <span className="text-[8px] uppercase font-black bg-green-500/15 text-green-700 px-1.5 py-0.5 rounded">
                                {isApple ? "Apple" : "Android"}
                              </span>
                            </div>
                            <p className="text-[10px] text-navy-400 dark:text-navy-500 mt-0.5">
                              Connected{" "}
                              {new Date(p.createdAt).toLocaleDateString("en-KE", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {p.lastUsedAt
                                ? ` · Last active ${new Date(
                                    p.lastUsedAt
                                  ).toLocaleDateString("en-KE", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => remove(p.id)}
                          disabled={loading}
                          aria-label="Remove biometric profile"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            
            <div className="rounded-xl border border-navy-50 p-2.5 bg-navy-50/20 text-[10px] text-navy-500 flex items-start gap-1.5 dark:border-navy-800 text-left">
              <Sparkles className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span>
                NEYO uses native WebAuthn passkeys. Private keys stay on your device, and NEYO stores only the public key used to verify signed security challenges.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
