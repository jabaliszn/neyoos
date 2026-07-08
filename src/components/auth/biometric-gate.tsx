"use client";

import * as React from "react";
import { Fingerprint, X, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { startAuthentication } from "@simplewebauthn/browser";
import { useToast } from "@/components/ui/toast";

/**
 * R.3 — `onSuccess` receives the real ticket ID minted by the server ONLY
 * when a real `actionKey` was supplied (money-moving actions). Existing
 * callers (Library, Recycle Bin) that don't pass `actionKey` keep working
 * unchanged — `ticket` is simply `null` for them, matching the pre-existing
 * client-trusted-popup behavior for those lower-stakes actions.
 */
interface BiometricGateContextType {
  requireBiometric: (actionLabel: string, onSuccess: (ticket: string | null) => void, actionKey?: string) => void;
}

const BiometricGateContext = React.createContext<BiometricGateContextType | null>(null);

export function useBiometricGate() {
  const ctx = React.useContext(BiometricGateContext);
  if (!ctx) throw new Error("useBiometricGate must be used within <BiometricGateProvider>");
  return ctx;
}

export function BiometricGateProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [actionLabel, setActionLabel] = React.useState("");
  const [actionKey, setActionKey] = React.useState<string | undefined>(undefined);
  const [onSuccessCallback, setOnSuccessCallback] = React.useState<((ticket: string | null) => void) | null>(null);
  const [status, setStatus] = React.useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [appUnlockMode, setAppUnlockMode] = React.useState(false);

  const requireBiometric = React.useCallback((label: string, onSuccess: (ticket: string | null) => void, key?: string) => {
    setAppUnlockMode(false);
    setActionLabel(label);
    setActionKey(key);
    setOnSuccessCallback(() => onSuccess);
    setStatus("idle");
    setErrorMessage("");
    setOpen(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/login")) return;
    if (localStorage.getItem("neyo-app-unlock-enabled") !== "true") return;
    if (sessionStorage.getItem("neyo-app-unlocked") === "true") return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setAppUnlockMode(true);
        setActionLabel("Open NEYO on this device");
        setActionKey(undefined);
        setOnSuccessCallback(() => () => {
          sessionStorage.setItem("neyo-app-unlocked", "true");
        });
        setStatus("idle");
        setErrorMessage("");
        setOpen(true);
      })
      .catch(() => {});
  }, []);

  async function handleVerify() {
    setStatus("verifying");
    
    try {
      // 1) Ask the server for a one-time passkey challenge for the CURRENT signed-in user.
      // This is not a login shortcut and it never uses a hard-coded account.
      const optRes = await fetch("/api/auth/passkey/action/options", { method: "POST" });
      const optJson = await optRes.json();
      if (!optRes.ok || !optJson.ok || !optJson.data?.options) {
        throw new Error(optJson.error?.message || "Set up Face ID, fingerprint, or a passkey in Settings → Security first.");
      }

      // 2) Open the browser/OS Face ID / fingerprint / passkey prompt.
      const assertResp = await startAuthentication(optJson.data.options);

      // 3) Verify the signed assertion against the current user's stored public
      // key. R.3 — when this gate protects a real money-moving action, pass
      // the same actionKey the server route will require, so a REAL,
      // server-enforced single-use ticket is minted for THIS exact action.
      const verRes = await fetch("/api/auth/passkey/action/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertResp, actionKey })
      });
      const verJson = await verRes.json();

      if (verJson.ok) {
        setStatus("success");
        toast({
          title: "Device security verified",
          description: "You can continue with this protected action.",
          tone: "success"
        });
        const ticket: string | null = verJson.data?.ticket ?? null;
        setTimeout(() => {
          setOpen(false);
          if (onSuccessCallback) onSuccessCallback(ticket);
        }, 1000);
      } else {
        throw new Error(verJson.error?.message || "Device security check failed.");
      }
    } catch (err: any) {
      // Handle fallback or error
      setStatus("error");
      setErrorMessage(err.message || "Device cancelled or failed biometric match.");
      toast({
        title: "Security Verification Failed",
        description: err.message || "Please try again.",
        tone: "error"
      });
    }
  }

  function handleClose() {
    if (appUnlockMode) return;
    if (status !== "verifying" && status !== "success") {
      setOpen(false);
    }
  }

  return (
    <BiometricGateContext.Provider value={{ requireBiometric }}>
      {children}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Frosted backing scrim */}
          <div 
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md" 
            onClick={handleClose}
          />
          
          {/* Dynamic Island style physical security capsule modal */}
          <div className="relative w-full max-w-sm transform overflow-hidden rounded-3xl bg-navy-950 border border-white/10 p-6 text-center text-white shadow-pop transition-all animate-island md:max-w-md">
            
            {/* Top Close */}
            {!appUnlockMode && status !== "verifying" && status !== "success" && (
              <button 
                onClick={handleClose}
                className="absolute right-4 top-4 text-white/40 hover:text-white rounded-full p-1 hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="flex flex-col items-center space-y-4">
              {/* Security Badge */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                <Fingerprint className="h-7 w-7 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold tracking-tight text-white">
                  {appUnlockMode ? "Unlock NEYO" : "Biometric Verification Required"}
                </h3>
                <p className="text-xs text-navy-400">
                  Confirm your fingerprint or Face ID to authorize:
                </p>
                <p className="inline-block rounded-full bg-white/5 px-3.5 py-1 text-xs font-semibold text-green-400 border border-white/5">
                  {actionLabel}
                </p>
              </div>

              {/* Status Display Area */}
              <div className="w-full py-4 min-h-[4.5rem] flex items-center justify-center">
                {status === "idle" && (
                  <button
                    onClick={handleVerify}
                    className="flex items-center gap-2 rounded-full bg-green-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-600 active:scale-95 transition-all"
                  >
                    <Fingerprint className="h-4 w-4" />
                    Scan Fingerprint / Face ID
                  </button>
                )}

                {status === "verifying" && (
                  <div className="flex flex-col items-center gap-2 text-xs text-navy-400">
                    <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                    <span>Matching with device hardware security...</span>
                  </div>
                )}

                {status === "success" && (
                  <div className="flex flex-col items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                    <span className="font-semibold uppercase tracking-wider">Access Granted</span>
                  </div>
                )}

                {status === "error" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-xs text-red-400">
                      <ShieldAlert className="h-5 w-5 shrink-0" />
                      <span className="text-left font-medium">{errorMessage}</span>
                    </div>
                    <button
                      onClick={handleVerify}
                      className="text-xs text-white/60 hover:text-white underline font-semibold"
                    >
                      Try scanning again
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-navy-500">
                Authorized by NEYO Secure Shield · No password can bypass this check.
              </p>
            </div>

          </div>
        </div>
      )}
    </BiometricGateContext.Provider>
  );
}
