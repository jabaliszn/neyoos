"use client";

import * as React from "react";
import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useBiometricGate } from "@/components/auth/biometric-gate";

export function DeviceAppUnlockCard({ hasPasskey }: { hasPasskey: boolean }) {
  const { toast } = useToast();
  const { requireBiometric } = useBiometricGate();
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(localStorage.getItem("neyo-app-unlock-enabled") === "true");
  }, []);

  function enable() {
    if (!hasPasskey) {
      toast({ title: "Connect Face ID or fingerprint first", description: "Pair a biometric passkey above, then turn on app-open unlock for this device.", tone: "error" });
      return;
    }
    requireBiometric("Enable app-open unlock on this device", () => {
      localStorage.setItem("neyo-app-unlock-enabled", "true");
      sessionStorage.setItem("neyo-app-unlocked", "true");
      setEnabled(true);
      toast({ title: "App-open unlock enabled", description: "Next time NEYO opens on this device, it will ask for Face ID or fingerprint.", tone: "success" });
    });
  }

  function disable() {
    localStorage.removeItem("neyo-app-unlock-enabled");
    sessionStorage.removeItem("neyo-app-unlocked");
    setEnabled(false);
    toast({ title: "App-open unlock disabled for this device", tone: "info" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-green-600" />
            Device App Unlock
          </CardTitle>
          <p className="mt-1 text-xs text-navy-400">
            Use your iPhone Face ID or Android fingerprint to unlock NEYO when opening the app on this device.
          </p>
        </div>
        <Badge tone={enabled ? "green" : "neutral"}>{enabled ? "ON for this device" : "OFF"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-green-200/70 bg-green-50/50 p-4 text-sm text-navy-700 dark:border-green-900 dark:bg-green-950/10 dark:text-navy-200">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-bold">This is app-open unlock, not only critical-action approval.</p>
              <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                Once enabled, NEYO asks for your device biometric when the app opens. The biometric key remains on your phone/computer.
              </p>
            </div>
          </div>
        </div>

        {!hasPasskey && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Pair Face ID, Touch ID, Android fingerprint, or another passkey above before enabling app-open unlock.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <Button variant="secondary" onClick={disable}>
              Disable on this device
            </Button>
          ) : (
            <Button onClick={enable} disabled={!hasPasskey}>
              <Fingerprint className="h-4 w-4" /> Enable Face ID / Fingerprint unlock
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
