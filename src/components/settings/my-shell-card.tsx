"use client";

/**
 * NEYO Shell V2 — the personal per-user shell choice (founder-requested
 * "NEYO 2.0" phase 2, 2026-07-05). Founder's own words when this whole
 * feature was scoped: "for now neyo ops but later wen we launch it every
 * one can change in their setting and later it becomes companys default."
 *
 * This card is that "later" — but it stays fully invisible (renders
 * nothing at all) until NEYO Ops has genuinely released the capability for
 * this specific school (master switch OR real per-school early access,
 * both controlled from the NEYO Ops "Platform Flags" console). Never a
 * disabled/greyed-out picker teasing something that doesn't work yet —
 * the real API tells this component whether it's released, and it
 * honestly renders nothing until it is.
 *
 * Once released, this mirrors the exact same "company default vs personal
 * override" pattern already used by O.2's popup style / O.3's colour
 * intensity: null = "follow the platform/school default", "v1"/"v2" = an
 * explicit personal choice, saved server-side to User.shellVersion so it
 * follows the signed-in person across devices.
 */
import * as React from "react";
import { LayoutGrid, Loader2, Rows3 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Choice = "v1" | "v2" | null;

export function MyShellCard() {
  const { toast } = useToast();
  const [released, setReleased] = React.useState<boolean | null>(null);
  const [choice, setChoice] = React.useState<Choice>(null);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/me/shell-version");
      const json = await res.json();
      if (json.ok) {
        setReleased(json.data.released);
        setChoice(json.data.shellVersion);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function save(next: Choice) {
    setSaving(true);
    try {
      const res = await fetch("/api/me/shell-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shellVersion: next }),
      });
      const json = await res.json();
      if (json.ok) {
        setChoice(json.data.shellVersion);
        toast({
          title: next === null
            ? "Following your school's default shell again"
            : next === "v2"
              ? "You're now using Shell V2 (floating bar) — reload to see it"
              : "You're now using Shell V1 (classic sidebar) — reload to see it",
          tone: "success",
        });
      } else {
        toast({ title: json.error?.message || "Could not save.", tone: "error" });
      }
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  // Genuinely renders nothing (not even a loading skeleton) until we know
  // for certain the capability is released for this school — never teases
  // an option that would silently do nothing.
  if (error || released === false || released === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-4.5 w-4.5" />
          My NEYO Shell
        </CardTitle>
        <p className="text-xs text-navy-400">
          Your own personal choice for how NEYO's navigation looks, independent of your school's default. Only applies to your own account, on any device you sign into.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(null)}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              choice === null
                ? "border-green-500 bg-green-500/10 font-bold text-navy-950 dark:text-white"
                : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50 dark:border-navy-800 dark:bg-navy-950"
            }`}
          >
            <span className="text-sm">Follow school default</span>
            <span className="text-[11px] font-normal text-navy-400">Whatever your school currently has set</span>
            {choice === null && <Badge tone="green" className="mt-1">Active</Badge>}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save("v1")}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              choice === "v1"
                ? "border-green-500 bg-green-500/10 font-bold text-navy-950 dark:text-white"
                : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50 dark:border-navy-800 dark:bg-navy-950"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm"><Rows3 className="h-3.5 w-3.5" /> Shell V1</span>
            <span className="text-[11px] font-normal text-navy-400">Classic left sidebar</span>
            {choice === "v1" && <Badge tone="green" className="mt-1">Active</Badge>}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save("v2")}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              choice === "v2"
                ? "border-green-500 bg-green-500/10 font-bold text-navy-950 dark:text-white"
                : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50 dark:border-navy-800 dark:bg-navy-950"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm"><LayoutGrid className="h-3.5 w-3.5" /> Shell V2</span>
            <span className="text-[11px] font-normal text-navy-400">Floating glass bar + Activity/Intercom panel</span>
            {choice === "v2" && <Badge tone="green" className="mt-1">Active</Badge>}
          </button>
        </div>
        {saving && (
          <p className="flex items-center gap-1.5 text-[11px] text-navy-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
