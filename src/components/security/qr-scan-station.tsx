"use client";

/**
 * N.2 — QR Hardware Integration: "Scan ID" station.
 * A staff member (gate/reception/class teacher) points their phone/tablet
 * camera at a student's printed ID card QR. Uses the browser's built-in
 * BarcodeDetector (same pattern already proven in the library module's
 * barcode scanner) — no extra hardware SDK required. A USB handheld QR
 * scanner also works out of the box: it just "types" the decoded text into
 * the manual-entry box below and presses Enter, so schools without a good
 * camera can still use a cheap USB scanner.
 *
 * Two real 1-tap actions, each with a strict duplicate-scan guard enforced
 * server-side (a repeat scan of the same card within 15s is rejected with a
 * clear message, never silently double-counted):
 *  - 1-Tap Attendance
 *  - 1-Tap Payment lookup (surfaces the real open balance instantly)
 */
import * as React from "react";
import { Camera, ScanLine, CheckCircle2, AlertCircle, Loader2, UserCheck, Wallet, History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface ResolvedStudent {
  id: string; firstName: string; middleName: string | null; lastName: string;
  admissionNo: string; photoUrl: string | null; className: string;
}
interface PaymentResult {
  studentId: string; studentName: string; admissionNo: string; className: string;
  totalBalanceKes: number; guardianPhone: string | null; guardianName: string | null;
  invoices: { id: string; invoiceNo: string; description: string; balanceKes: number; dueDate: string }[];
  hasFeeInvoices: boolean;
}
interface ScanEvent {
  id: string; studentName: string; admissionNo: string | null; action: string;
  result: string; detail: string | null; scannedByName: string; createdAt: string;
}

export function QrScanStation({ canMarkAttendance, canLookupPayment }: { canMarkAttendance: boolean; canLookupPayment: boolean }) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"attendance" | "payment">(canMarkAttendance ? "attendance" : "payment");
  const [manualCode, setManualCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resolved, setResolved] = React.useState<ResolvedStudent | null>(null);
  const [paymentResult, setPaymentResult] = React.useState<PaymentResult | null>(null);
  const [lastMessage, setLastMessage] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraStatus, setCameraStatus] = React.useState("Camera idle");
  const [recent, setRecent] = React.useState<ScanEvent[] | null>(null);
  const [recentError, setRecentError] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanningRef = React.useRef(false);

  const loadRecent = React.useCallback(async () => {
    setRecentError(false);
    try {
      const res = await fetch("/api/qr-scan/recent");
      const json = await res.json();
      if (json.ok) setRecent(json.data.scans);
      else setRecentError(true);
    } catch {
      setRecentError(true);
    }
  }, []);
  React.useEffect(() => { void loadRecent(); }, [loadRecent]);

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraStatus("Camera idle");
  }
  React.useEffect(() => () => stopCamera(), []);

  async function processScan(scanned: string) {
    if (!scanned.trim()) return;
    setBusy(true);
    setLastMessage(null);
    setPaymentResult(null);
    setResolved(null);
    try {
      if (mode === "attendance") {
        const res = await fetch("/api/qr-scan/attendance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanned, status: "P" }),
        });
        const json = await res.json();
        if (json.ok) {
          setLastMessage({ tone: "success", text: `${json.data.result.studentName} (${json.data.result.admissionNo}) marked PRESENT for ${json.data.result.date}` });
          toast({ title: "Attendance marked", tone: "success" });
        } else {
          setLastMessage({ tone: "error", text: json.error?.message ?? "Could not process that scan." });
        }
      } else {
        const res = await fetch("/api/qr-scan/payment", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanned }),
        });
        const json = await res.json();
        if (json.ok) {
          setPaymentResult(json.data.result);
          setLastMessage({ tone: "success", text: `Balance found for ${json.data.result.studentName}` });
        } else {
          setLastMessage({ tone: "error", text: json.error?.message ?? "Could not process that scan." });
        }
      }
      await loadRecent();
    } catch {
      setLastMessage({ tone: "error", text: "Network problem while processing the scan." });
    } finally {
      setBusy(false);
      setManualCode("");
    }
  }

  async function startCamera() {
    if (!("BarcodeDetector" in window)) {
      toast({ title: "This browser does not support the built-in QR scanner. Type/paste the code below, or use a USB QR scanner.", tone: "error" });
      return;
    }
    try {
      setCameraOpen(true);
      setCameraStatus("Requesting camera permission…");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });
      scanningRef.current = true;
      setCameraStatus("Point the camera at the ID card's QR code");
      const loop = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes?.[0]?.rawValue;
          if (value) {
            setCameraStatus(`Scanned — checking…`);
            stopCamera();
            await processScan(value);
            return;
          }
        } catch { /* keep scanning */ }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setCameraStatus("Camera permission denied or unavailable");
      toast({ title: "Camera scanner could not start. Type the code below or use a USB scanner.", tone: "error" });
      stopCamera();
    }
  }

  const ACTION_TONE: Record<string, "green" | "amber" | "red"> = { OK: "green", DUPLICATE: "amber", BLOCKED: "red" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {canMarkAttendance && (
          <button
            onClick={() => setMode("attendance")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${mode === "attendance" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "bg-white text-navy-600 border border-navy-100 hover:bg-warm-50 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800"}`}
          >
            <UserCheck className="h-3.5 w-3.5" /> 1-Tap Attendance
          </button>
        )}
        {canLookupPayment && (
          <button
            onClick={() => setMode("payment")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${mode === "payment" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "bg-white text-navy-600 border border-navy-100 hover:bg-warm-50 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800"}`}
          >
            <Wallet className="h-3.5 w-3.5" /> 1-Tap Payment Lookup
          </button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-4 w-4 text-green-600" /> Scan a student ID</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {cameraOpen ? (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full max-w-sm rounded-xl border border-navy-200 dark:border-navy-700" muted playsInline />
              <p className="text-xs text-navy-500">{cameraStatus}</p>
              <Button variant="secondary" size="sm" onClick={stopCamera}>Stop camera</Button>
            </div>
          ) : (
            <Button onClick={startCamera} disabled={busy}>
              <Camera className="h-4 w-4" /> Open camera scanner
            </Button>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-navy-500">Or type/paste the code (USB scanners work here too)</label>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") processScan(manualCode); }}
                placeholder="e.g. 3F9A2C1B0D or the full verify link"
                className="font-mono"
              />
            </div>
            <Button variant="secondary" onClick={() => processScan(manualCode)} disabled={busy || !manualCode.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Process
            </Button>
          </div>

          {lastMessage && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${lastMessage.tone === "success" ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300" : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"}`}>
              {lastMessage.tone === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {lastMessage.text}
            </div>
          )}

          {paymentResult && (
            <div className="rounded-xl border border-navy-100 p-4 dark:border-navy-800">
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{paymentResult.studentName} · {paymentResult.admissionNo} · {paymentResult.className}</p>
              <p className="mt-1 text-2xl font-bold text-navy-900 dark:text-navy-50">
                KES {paymentResult.totalBalanceKes.toLocaleString("en-KE")}
                <span className="ml-2 text-sm font-normal text-navy-400">outstanding</span>
              </p>
              {paymentResult.guardianPhone && (
                <p className="mt-1 text-xs text-navy-500">Guardian: {paymentResult.guardianName} · {paymentResult.guardianPhone}</p>
              )}
              {paymentResult.invoices.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {paymentResult.invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between text-xs text-navy-600 dark:text-navy-300">
                      <span>{inv.invoiceNo} — {inv.description}</span>
                      <span className="font-semibold">KES {inv.balanceKes.toLocaleString("en-KE")}</span>
                    </li>
                  ))}
                </ul>
              )}
              {paymentResult.totalBalanceKes === 0 && (
                paymentResult.hasFeeInvoices ? (
                  <p className="mt-2 text-sm text-green-600">No outstanding balance — fully paid.</p>
                ) : (
                  <p className="mt-2 text-sm text-navy-400">No fees have been billed to this learner yet.</p>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-navy-400" /> Recent scans</CardTitle></CardHeader>
        <CardContent>
          {recentError ? (
            <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              Could not load scan history.
              <Button size="sm" variant="secondary" onClick={loadRecent}>Retry</Button>
            </div>
          ) : recent === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon={ScanLine} title="No scans yet" description="Every ID-card scan (successful, duplicate, or blocked) appears here for a real audit trail." />
          ) : (
            <ul className="space-y-1.5">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-xl border border-navy-100 px-3 py-2 text-xs dark:border-navy-800">
                  <span>
                    <span className="font-medium text-navy-900 dark:text-navy-50">{s.studentName}</span>
                    {s.admissionNo ? ` (${s.admissionNo})` : ""} · {s.action === "ATTENDANCE" ? "Attendance" : "Payment lookup"}
                    {s.detail ? ` — ${s.detail}` : ""}
                  </span>
                  <span className="flex items-center gap-2 text-navy-400">
                    <Badge tone={ACTION_TONE[s.result] ?? "neutral"}>{s.result.toLowerCase()}</Badge>
                    {new Date(s.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
