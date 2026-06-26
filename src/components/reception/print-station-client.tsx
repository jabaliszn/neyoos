"use client";

/**
 * G.31 Print station — the receptionist leaves this page open:
 * - polls /api/print-queue every 10s
 * - auto-print ON: each queued job's PDF loads in a hidden iframe and the
 *   browser print dialog fires to the default printer; job marked PRINTED
 * - printer/computer off = jobs stay QUEUED (visible count when you return)
 * - class batches grouped so the stack comes out class-by-class
 * - "Queue a class" button: all invoices of a fee structure's class at once
 * - Overhauled to support printer selection + custom printer additions + per-day limits
 */
import * as React from "react";
import { Printer, Play, Pause, Layers, CheckCircle2, AlertCircle, Loader2, ShieldAlert, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/auth/permissions-provider";
import { useBiometricGate } from "@/components/auth/biometric-gate";
import { cn } from "@/lib/utils";

interface Job { id: string; kind: string; title: string; url: string; classLabel: string | null; queuedBy: string; queuedAt: string }
interface ClassOpt { id: string; name: string }
interface Structure { id: string; name: string }

export function PrintStationClient() {
  const { toast } = useToast();
  const { requireBiometric } = useBiometricGate();
  const { role, secondaryRole } = usePermissions();
  
  // Only School Heads (Principal, Deputy, Owner) or Academics HOD can change print limits
  const canEditLimits = [
    "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "SCHOOL_OWNER"
  ].includes(role ?? "") || (secondaryRole && [
    "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "SCHOOL_OWNER"
  ].includes(secondaryRole));

  const [jobs, setJobs] = React.useState<Job[] | null>(null);
  const [printedToday, setPrintedToday] = React.useState(0);
  const [auto, setAuto] = React.useState(true);

  // G.31 Upgraded - Boarding School Batch Printing Mode (completely turn off instant printing)
  const [boardingMode, setBoardingMode] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("neyo_boarding_batch_print") === "true";
    }
    return false;
  });

  React.useEffect(() => {
    localStorage.setItem("neyo_boarding_batch_print", String(boardingMode));
    if (boardingMode) {
      setAuto(false); // Force instant auto-print to be completely OFF
    }
  }, [boardingMode]);
  const [printing, setPrinting] = React.useState<string | null>(null);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [structures, setStructures] = React.useState<Structure[]>([]);
  const [structureId, setStructureId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const busyRef = React.useRef(false);

  // G.31 Upgraded - Printer selection and daily limits persisted in localStorage
  const [printers, setPrinters] = React.useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("neyo_printers");
      return saved ? JSON.parse(saved) : ["Default Printer", "EPSON L3150", "HP LaserJet Pro M404n"];
    }
    return ["Default Printer", "EPSON L3150", "HP LaserJet Pro M404n"];
  });

  const [selectedPrinter, setSelectedPrinter] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("neyo_selected_printer") ?? "Default Printer";
    }
    return "Default Printer";
  });

  const [limit, setLimit] = React.useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("neyo_print_limit");
      return saved ? (saved === "unlimited" ? null : Number(saved)) : null;
    }
    return null;
  });

  const [newPrinter, setNewPrinter] = React.useState("");

  React.useEffect(() => {
    localStorage.setItem("neyo_printers", JSON.stringify(printers));
  }, [printers]);

  React.useEffect(() => {
    localStorage.setItem("neyo_selected_printer", selectedPrinter);
  }, [selectedPrinter]);

  React.useEffect(() => {
    localStorage.setItem("neyo_print_limit", limit === null ? "unlimited" : String(limit));
  }, [limit]);

  function addPrinter() {
    if (!newPrinter.trim()) return;
    if (printers.includes(newPrinter.trim())) {
      toast({ title: "Printer already exists", tone: "error" });
      return;
    }
    setPrinters((p) => [...p, newPrinter.trim()]);
    setSelectedPrinter(newPrinter.trim());
    setNewPrinter("");
    toast({ title: "Printer added", tone: "success" });
  }

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/print-queue");
      const json = await res.json();
      if (json.ok) {
        setJobs(json.data.jobs);
        setPrintedToday(json.data.printedToday);
        // H.2 — the station mode is a school-wide server setting (not per-device).
        if (json.data.printStationMode) {
          setBoardingMode(json.data.printStationMode === "HOLD");
        }
      }
    } catch { /* poll again next tick */ }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes)).catch(() => {});
    fetch("/api/finance/structures").then((r) => r.json()).then((j) => j.ok && setStructures(j.data.structures ?? [])).catch(() => {});
    return () => clearInterval(t);
  }, [load]);

  // The auto-printer: one job at a time, iframe loads the PDF, print() fires.
  const printNext = React.useCallback(async () => {
    if (!auto || busyRef.current || !jobs?.length) return;

    // Enforce daily printing limit
    if (limit !== null && printedToday >= limit) {
      setAuto(false);
      toast({
        title: `Daily print limit of ${limit} exceeded`,
        description: "Increase limit or set to Unlimited to resume.",
        tone: "error",
      });
      return;
    }

    const job = jobs[0];
    busyRef.current = true;
    setPrinting(job.id);
    try {
      const frame = frameRef.current;
      if (!frame) return;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("load timeout")), 20_000);
        frame.onload = () => { clearTimeout(timeout); resolve(); };
        frame.src = job.url;
      });
      try { frame.contentWindow?.print(); } catch { window.print(); }
      await fetch("/api/print-queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "printed", jobId: job.id }),
      });
      setJobs((prev) => (prev ? prev.filter((j) => j.id !== job.id) : prev));
      setPrintedToday((n) => n + 1);
    } catch {
      toast({ title: "Print failed — job kept in the queue", tone: "error" });
    } finally {
      setPrinting(null);
      busyRef.current = false;
    }
  }, [auto, jobs, limit, printedToday, toast]);

  React.useEffect(() => {
    const t = setTimeout(printNext, 1200); // small gap between prints
    return () => clearTimeout(t);
  }, [printNext]);

  async function queueClass() {
    const res = await fetch("/api/print-queue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "classBatch", structureId, classId }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${json.data.queued} invoices queued for ${json.data.classLabel}`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  if (jobs === null) return <Skeleton className="h-64 rounded-2xl" />;

  // Group by class for the distribution view.
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const key = j.classLabel ?? "General / receipts";
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }

  return (
    <div className="space-y-4">
      {/* hidden print frame */}
      <iframe ref={frameRef} title="print-frame" className="hidden" />

      {/* settings bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          onClick={() => {
            if (boardingMode) {
              toast({ title: "Auto-print is disabled in Term-End Batch Mode", tone: "info" });
              return;
            }
            setAuto((a) => !a);
          }} 
          variant={auto ? "primary" : "secondary"}
          disabled={boardingMode}
        >
          {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} 
          {boardingMode ? "Printer Off (Batch Mode)" : auto ? "Auto-print ON" : "Auto-print paused"}
        </Button>
        <Badge tone="neutral">🖨 {selectedPrinter}</Badge>
        {boardingMode && <Badge tone="red">🏫 Boarding Term-End Batch Mode</Badge>}
        <Badge tone={limit !== null && printedToday >= limit ? "red" : "neutral"}>
          Limit: {limit === null ? "Unlimited" : `${printedToday}/${limit} prints`}
        </Badge>
        <Badge tone={jobs.length ? "amber" : "green"}>{jobs.length} queued</Badge>
        <Badge tone="blue">{printedToday} printed (24h)</Badge>
        {printing && <Badge tone="neutral"><Loader2 className="h-3 w-3 animate-spin" /> printing…</Badge>}
      </div>

      {/* Printer & Daily Limit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-green-600" />
            Printer &amp; Daily Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Boarding School Switch */}
          <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-950">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-50 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-green-600" />
                Boarding School Term-End Batch Mode
              </p>
              <p className="text-xs text-navy-400">
                Instantly turns off automatic daily receipt/invoice printing. Receipts are quietly queued and saved to be printed as a batch when the term ends!
              </p>
            </div>
            <button
              onClick={() => {
                if (!canEditLimits) {
                  toast({ title: "Only School Heads or Academics HOD can toggle Batch Mode.", tone: "error" });
                  return;
                }
                const nextMode = !boardingMode ? "HOLD" : "AUTO";
                // H.2 Biometric-gated setting change: confirm before changing a
                // school-wide print setting — no password can bypass it.
                requireBiometric(`Change print station to ${nextMode === "HOLD" ? "Term-End Batch" : "Auto-print"} mode`, async () => {
                  try {
                    const res = await fetch("/api/print-queue", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "stationMode", mode: nextMode }),
                    });
                    const json = await res.json();
                    if (!json.ok) { toast({ title: json.error?.message || "Couldn't change mode", tone: "error" }); return; }
                    setBoardingMode(nextMode === "HOLD");
                    toast({
                      title: nextMode === "HOLD" ? "Term-End Batch Mode Activated (school-wide)" : "Batch Mode Disabled (school-wide)",
                      tone: "success",
                    });
                  } catch { toast({ title: "Network error", tone: "error" }); }
                });
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                boardingMode ? "bg-green-500" : "bg-navy-200 dark:bg-navy-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  boardingMode ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="printer-select">Select Printer</Label>
              <select
                id="printer-select"
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-900 dark:text-navy-50"
              >
                {printers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="new-printer">Add Custom Printer</Label>
              <div className="flex gap-2">
                <Input
                  id="new-printer"
                  value={newPrinter}
                  onChange={(e) => setNewPrinter(e.target.value)}
                  placeholder="e.g. Reception Desk"
                  className="h-10 w-44"
                />
                <Button size="sm" onClick={addPrinter} disabled={!newPrinter.trim()}>Add</Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="print-limit">Daily Limit</Label>
              <select
                id="print-limit"
                value={limit === null ? "unlimited" : String(limit)}
                disabled={!canEditLimits}
                onChange={(e) => {
                  if (!canEditLimits) {
                    toast({ title: "You do not have permission to change limits.", tone: "error" });
                    return;
                  }
                  setLimit(e.target.value === "unlimited" ? null : Number(e.target.value));
                }}
                className={cn(
                  "rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-900 dark:text-navy-50",
                  !canEditLimits && "opacity-60 cursor-not-allowed"
                )}
              >
                <option value="unlimited">Unlimited</option>
                <option value="10">10 prints</option>
                <option value="50">50 prints</option>
                <option value="100">100 prints</option>
                <option value="200">200 prints</option>
              </select>
            </div>

            {!canEditLimits && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                Only School Heads or Academics HOD can change limits
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* queue a class batch */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-green-600" /> Print a whole class (for distribution)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Fee structure</Label>
            <select value={structureId} onChange={(e) => setStructureId(e.target.value)} className="rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
              <option value="">Pick…</option>
              {structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Class</Label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
              <option value="">Pick…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Button onClick={queueClass} disabled={!structureId || !classId}><Printer className="h-4 w-4" /> Queue class invoices</Button>
        </CardContent>
      </Card>

      {/* the queue, grouped by class */}
      {jobs.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Queue is clear" description="New payments and invoices will appear here and print automatically." />
      ) : (
        [...groups.entries()].map(([label, list]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm">{label} — {list.length} document{list.length === 1 ? "" : "s"}</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {list.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{j.title}</p>
                      <p className="text-xs text-navy-400">{j.kind.toLowerCase().replace("_", " ")} · queued by {j.queuedBy} · {new Date(j.queuedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    {printing === j.id ? <Badge tone="blue">printing…</Badge> : <Badge tone="amber">queued</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
      <p className="flex items-center gap-1.5 text-xs text-navy-400">
        <AlertCircle className="h-3.5 w-3.5" />
        Printer or computer off? Nothing is lost — jobs wait in the queue and print the moment this page is open again.
      </p>
    </div>
  );
}
