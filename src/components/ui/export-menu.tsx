"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Reusable CSV/XLSX export button (A.10). Posts columns+rows the caller already
 * has, downloads the file. "CSV export everywhere" via one component.
 */
export function ExportMenu({
  sheetName,
  columns,
  rows,
}: {
  sheetName: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"csv" | "xlsx" | null>(null);

  async function run(format: "csv" | "xlsx") {
    setBusy(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, sheetName, columns, rows }),
      });
      if (!res.ok) {
        toast({ title: "Export failed.", tone: "error" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sheetName}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => run("csv")} disabled={busy !== null}>
        {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={() => run("xlsx")} disabled={busy !== null}>
        {busy === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Excel
      </Button>
    </div>
  );
}
