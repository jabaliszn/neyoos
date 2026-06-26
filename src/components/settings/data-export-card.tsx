"use client";

import * as React from "react";
import { Download, Loader2, FileJson } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Data export card (A.2.10). Downloads the school's full data as JSON. */
export function DataExportCard({ canExport }: { canExport: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/export");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast({
          title: j?.error?.message || "Could not generate the export.",
          tone: "error",
        });
        return;
      }
      // Turn the response into a downloadable file in the browser.
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] || "neyo-export.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Export downloaded", tone: "success" });
    } catch {
      toast({ title: "Network problem. Try again.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-navy-100 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-950">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-500 dark:bg-navy-800 dark:text-navy-300">
            <FileJson className="h-5 w-5" />
          </div>
          <p className="text-sm text-navy-600 dark:text-navy-300">
            Download a complete copy of your school&apos;s data — profile, staff
            accounts, enabled modules and activity history — as a single JSON
            file. Passwords and encryption keys are never included. This supports
            your right to data portability under the Kenya Data Protection Act.
          </p>
        </div>

        {canExport ? (
          <Button onClick={download} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download export (.json)
          </Button>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Only the school owner or principal can export data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
