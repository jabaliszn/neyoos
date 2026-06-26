"use client";

import * as React from "react";
import {
  Smartphone,
  CheckCircle,
  XCircle,
  Cpu,
  RefreshCw,
  Fingerprint,
  CreditCard,
  Printer,
  Barcode,
  Loader2,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { hardware, HardwareDevice } from "@/lib/services/hardware.service";
import { useToast } from "@/components/ui/toast";

export default function HardwareSettingsClient() {
  const { toast } = useToast();
  const [devices, setDevices] = React.useState<HardwareDevice[]>([]);
  const [scannedLog, setScannedLog] = React.useState<string[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [wifiEndpoints, setWifiEndpoints] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    // Subscribe to hardware service updates
    const unsubscribe = hardware.subscribe((updatedDevices) => {
      setDevices(updatedDevices);
    });

    // Barcode globally intercepted listener
    function handleBarcode(e: any) {
      setScannedLog((prev) => [
        `[${new Date().toLocaleTimeString("en-KE")}] Scanned Barcode/ISBN: ${e.detail}`,
        ...prev.slice(0, 15),
      ]);
      toast({
        title: "Barcode Scanned!",
        description: `Querying ISBN: ${e.detail}`,
        tone: "info",
      });
    }

    window.addEventListener("neyo:barcode-scanned", handleBarcode);

    // Barcode scanners are keyboard-wedge devices. NEYO listens for scanner keystrokes
    // only after the user plugs/scans; we do not mark hardware as connected until real input.

    return () => {
      unsubscribe();
      window.removeEventListener("neyo:barcode-scanned", handleBarcode);
    };
  }, [toast]);

  async function handleConnect(type: any) {
    if (type === "fingerprint" || type === "face") {
      await hardware.connectBiometrics();
      toast({ title: "USB biometric pairing attempted", description: "Connected only if the browser received a real device permission.", tone: "info" });
    } else if (type === "rfid") {
      await hardware.connectRFID();
      toast({ title: "RFID serial pairing attempted", description: "Connected only after a real serial reader is selected.", tone: "info" });
    } else if (type === "printer") {
      await hardware.connectThermalPrinter();
      toast({ title: "Thermal printer USB pairing attempted", description: "Connected only after a real printer is selected.", tone: "info" });
    }
  }

  async function handleBluetooth(type: any) {
    await hardware.connectBluetoothDevice(type);
    toast({ title: "Bluetooth pairing attempted", description: "NEYO marks connected only if a real Bluetooth device is selected.", tone: "info" });
  }

  async function handleWifi(type: any) {
    const endpoint = wifiEndpoints[type];
    if (!endpoint) {
      toast({ title: "Enter the device Wi-Fi/LAN endpoint first", tone: "error" });
      return;
    }
    await hardware.connectWifiDevice(type, endpoint);
    toast({ title: "Wi-Fi/LAN check attempted", description: "NEYO marks connected only if the endpoint responds.", tone: "info" });
  }

  function simulateCardTap() {
    const virtualUids = ["RFID_ST_10024", "RFID_ST_39401", "RFID_ST_88410"];
    const randomUid = virtualUids[Math.floor(Math.random() * virtualUids.length)];
    setScannedLog((prev) => [
      `[${new Date().toLocaleTimeString("en-KE")}] RFID Card Tapped: ${randomUid}`,
      ...prev.slice(0, 15),
    ]);
    toast({
      title: "RFID Card Tapped!",
      description: `Student ID: ${randomUid}`,
      tone: "success",
    });
  }

  function simulateBiometricScan() {
    const virtualFid = ["FINGER_ST_552", "FINGER_ST_981", "FINGER_ST_104"];
    const randomFid = virtualFid[Math.floor(Math.random() * virtualFid.length)];
    setScannedLog((prev) => [
      `[${new Date().toLocaleTimeString("en-KE")}] Biometric Gate Scan: ${randomFid}`,
      ...prev.slice(0, 15),
    ]);
    toast({
      title: "Biometric Access Granted",
      description: `Student check-in recorded (${randomFid})`,
      tone: "success",
    });
  }

  const icons: Record<string, any> = {
    fingerprint: Fingerprint,
    rfid: CreditCard,
    printer: Printer,
    barcode: Barcode,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
            <Cpu className="h-4 w-4" />
            Hardware & Biometrics
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            Plug-and-Play Hardware Bridges
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-navy-500 dark:text-navy-400">
            NEYO School OS supports connect-when-bought hardware seams. Nothing is shown as connected until a real USB/Serial/Bluetooth permission succeeds, a Wi-Fi/LAN endpoint responds, or a tracker feed posts data.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hardware Devices List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sliders className="h-5 w-5 text-green-600" />
                Device Integration Hub
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRefreshing(true);
                  setTimeout(() => setRefreshing(false), 500);
                }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {devices.map((d) => {
                const Icon = icons[d.type] || Cpu;
                const isConnected = d.state === "CONNECTED";
                const isReady = d.state === "READY_TO_PAIR";
                return (
                  <div
                    key={d.type}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border transition-all ${
                      isConnected
                        ? "border-green-200 bg-green-50/10 dark:border-green-900/30 dark:bg-green-950/10"
                        : "border-navy-100 bg-white/70 dark:border-navy-800 dark:bg-navy-900/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-2xl ${isConnected ? "bg-green-500/10 text-green-600" : "bg-navy-50 text-navy-400 dark:bg-navy-800"}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-navy-900 dark:text-navy-50">
                            {d.label}
                          </span>
                          <Badge tone={isConnected ? "green" : d.state === "ERROR" ? "red" : isReady ? "amber" : "neutral"}>
                            {d.state}
                          </Badge>
                        </div>
                        <p className="text-xs text-navy-400 dark:text-navy-500">
                          {isConnected ? `Connected device: ${d.deviceName}` : "Not connected. Pair only after the device is physically plugged in."}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-[260px] flex-col gap-2 shrink-0">
                      {!isConnected ? (
                        <>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {(d.transports?.includes("usb") || d.transports?.includes("serial")) && (
                              <Button size="sm" onClick={() => handleConnect(d.type)}>🔌 Pair USB/Serial</Button>
                            )}
                            {d.transports?.includes("bluetooth") && (
                              <Button size="sm" variant="secondary" onClick={() => handleBluetooth(d.type)}>Bluetooth</Button>
                            )}
                            {d.transports?.includes("keyboard") && (
                              <Badge tone="amber">Pair as keyboard, then scan</Badge>
                            )}
                          </div>
                          {d.transports?.includes("wifi") && (
                            <div className="flex gap-2">
                              <Input
                                value={wifiEndpoints[d.type] ?? ""}
                                onChange={(e) => setWifiEndpoints((p) => ({ ...p, [d.type]: e.target.value }))}
                                placeholder="http://device.local/health"
                                className="h-9 text-xs"
                              />
                              <Button size="sm" variant="secondary" onClick={() => handleWifi(d.type)}>Wi-Fi</Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1.5 px-3 py-1 bg-green-500/10 rounded-full self-end">
                          <CheckCircle className="h-4 w-4" /> Connected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Live Hardware Event Log & Simulation */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Real-Time Scan Logs</CardTitle>
              <p className="text-xs text-navy-400">Shows live byte streams decoded from USB ports.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event Log Box */}
              <div className="h-[220px] rounded-2xl border border-navy-100 bg-navy-950 p-4 font-mono text-[10px] text-green-400 overflow-y-auto space-y-1.5">
                {scannedLog.length === 0 ? (
                  <p className="text-navy-500 italic">[System Idle] Waiting for hardware transactions...</p>
                ) : (
                  scannedLog.map((log, idx) => <p key={idx}>{log}</p>)
                )}
              </div>

              {/* Hardware simulation triggers */}
              <div className="border-t border-navy-100 pt-4 space-y-3 dark:border-navy-800">
                <p className="text-xs font-semibold text-navy-700 dark:text-navy-300">
                  Developer test tools (do not mark hardware connected):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={simulateCardTap}>
                    💳 Test card event
                  </Button>
                  <Button variant="secondary" size="sm" onClick={simulateBiometricScan}>
                    🧬 Test fingerprint event
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
