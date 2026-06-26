"use client";

import * as React from "react";
import { Database, RefreshCw, CheckCircle, WifiOff, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { clearBundle, estimateBundleSizeMb, readBundle, saveBundle } from "@/lib/offline/bundle-cache";

const CACHE_KEY = "school-core";

export function PwaDataSaverCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(false);
  const [savedMb, setSavedMb] = React.useState(0);
  const [syncTime, setSyncTime] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState({ students: 0, invoices: 0, events: 0, timetable: 0 });
  const [syncing, setSyncing] = React.useState(false);

  async function loadLocalState() {
    const isOn = localStorage.getItem("neyo-bundle-saver-enabled") === "true";
    setEnabled(isOn);
    const cached = await readBundle<any>(CACHE_KEY);
    if (cached) {
      setSyncTime(new Date(cached.savedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }));
      setSummary({
        students: cached.data?.students?.length ?? 0,
        invoices: cached.data?.invoices?.length ?? 0,
        events: cached.data?.calendarEvents?.length ?? 0,
        timetable: cached.data?.timetableSlots?.length ?? 0,
      });
      setSavedMb(await estimateBundleSizeMb(CACHE_KEY));
    }
  }

  React.useEffect(() => { void loadLocalState(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/offline/bundle", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not save offline bundle.");
      const row = await saveBundle(CACHE_KEY, json.data);
      localStorage.setItem("neyo-bundle-saver-enabled", "true");
      setEnabled(true);
      setSyncTime(new Date(row.savedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }));
      setSummary({
        students: json.data.students?.length ?? 0,
        invoices: json.data.invoices?.length ?? 0,
        events: json.data.calendarEvents?.length ?? 0,
        timetable: json.data.timetableSlots?.length ?? 0,
      });
      setSavedMb(await estimateBundleSizeMb(CACHE_KEY));
      toast({
        title: "Bundle Saver synced",
        description: "Students, balances, calendar items and timetable are saved on this device for the NEYO app only.",
        tone: "success",
      });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not sync offline bundle.", tone: "error" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(val: boolean) {
    setEnabled(val);
    localStorage.setItem("neyo-bundle-saver-enabled", String(val));
    if (val) {
      await handleSync();
    } else {
      toast({ title: "Bundle Saver paused", description: "Saved data remains on this device until you clear it.", tone: "info" });
    }
  }

  async function clearSaved() {
    await clearBundle(CACHE_KEY);
    setSavedMb(0);
    setSyncTime(null);
    setSummary({ students: 0, invoices: 0, events: 0, timetable: 0 });
    toast({ title: "Saved offline bundle cleared", tone: "info" });
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-5 w-5 text-green-600" />
          NEYO Bundle Saver Mode
        </CardTitle>
        <p className="text-xs text-navy-400">
          Feasible via PWA + IndexedDB: with your permission, NEYO saves key school data on this device for this app only, reducing repeat data use on bundle plans.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-navy-50 bg-white dark:border-navy-800 dark:bg-navy-950">
          <div className="space-y-0.5 text-left">
            <span className="text-xs font-bold text-navy-900 dark:text-white">Offline Saved-Data / Bundle Saver</span>
            <p className="text-[10px] text-navy-400">Stores read-only snapshots locally; offline actions still sync through the outbox.</p>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-navy-50 p-3 rounded-2xl bg-navy-50/20 text-left">
            <p className="text-[9px] font-bold text-navy-400 uppercase tracking-wider">Saved on device</p>
            <p className="text-lg font-extrabold text-green-700 dark:text-green-400 mt-1">{savedMb.toFixed(1)} MB</p>
            <p className="text-[9px] text-navy-400 mt-0.5">App-only IndexedDB cache</p>
          </div>
          <div className="border border-navy-50 p-3 rounded-2xl bg-navy-50/20 text-left">
            <p className="text-[9px] font-bold text-navy-400 uppercase tracking-wider">Offline readiness</p>
            <p className="text-xs font-bold text-navy-950 dark:text-white mt-1.5 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" /> {syncTime ? "Ready" : "Not synced"}
            </p>
            <p className="text-[9px] text-navy-400 mt-1">Last Sync: {syncTime || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-navy-500">
          <span className="rounded-xl bg-navy-50 p-2 dark:bg-navy-900">{summary.students} learners</span>
          <span className="rounded-xl bg-navy-50 p-2 dark:bg-navy-900">{summary.invoices} balances</span>
          <span className="rounded-xl bg-navy-50 p-2 dark:bg-navy-900">{summary.events} events</span>
          <span className="rounded-xl bg-navy-50 p-2 dark:bg-navy-900">{summary.timetable} slots</span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={syncing || !enabled} onClick={handleSync} className="h-10 text-xs font-bold flex-1">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-green-600" />}
            Sync saved data now
          </Button>
          <Button size="sm" variant="ghost" disabled={syncing || !syncTime} onClick={clearSaved} className="h-10 text-xs">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        <div className="rounded-xl border border-navy-50 p-2.5 bg-navy-50/20 text-[10px] text-navy-500 flex items-start gap-1.5 dark:border-navy-800 text-left">
          <WifiOff className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
          <span>
            This does not create a mobile-data bundle. It reduces repeat cloud reads by using this device&apos;s saved NEYO app snapshot when internet is patchy.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
