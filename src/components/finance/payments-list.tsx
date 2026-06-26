"use client";

import * as React from "react";
import { FileDown, Receipt, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportMenu } from "@/components/ui/export-menu";
import { usePermissions } from "@/components/auth/permissions-provider";
import { useToast } from "@/components/ui/toast";
import { formatKES, formatPhoneKE } from "@/lib/utils";

interface PaymentRow {
  id: string;
  payer: string;
  phone: string;
  amount: number;
  description: string;
  status: string;
  mpesaRef: string;
  date: string;
}

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  CANCELLED: "neutral",
};

export function PaymentsList({ rows: initialRows }: { rows: PaymentRow[] }) {
  const { has } = usePermissions();
  const { toast } = useToast();
  const [rows, setRows] = React.useState(initialRows);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const canDelete = has("finance.manage_structure");

  async function softDelete(id: string) {
    if (!confirm("Move this payment to the Recycle Bin?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not delete.", tone: "error" });
        return;
      }
      setRows((xs) => xs.filter((r) => r.id !== id));
      toast({ title: "Moved to Recycle Bin", tone: "info" });
    } finally {
      setDeleting(null);
    }
  }

  const exportCols = [
    { key: "date", label: "Date" },
    { key: "payer", label: "Payer" },
    { key: "phone", label: "Phone" },
    { key: "amount", label: "Amount (KES)" },
    { key: "status", label: "Status" },
    { key: "mpesaRef", label: "M-Pesa Ref" },
  ];
  const exportRows = rows.map((r) => ({
    date: new Date(r.date).toLocaleDateString("en-KE"),
    payer: r.payer,
    phone: r.phone,
    amount: r.amount,
    status: r.status,
    mpesaRef: r.mpesaRef,
  }));

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No payments yet"
        description="When parents pay fees, they'll appear here with downloadable receipts."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-500 dark:text-navy-400">
          {rows.length} payment{rows.length === 1 ? "" : "s"}
        </p>
        <ExportMenu sheetName="Payments" columns={exportCols} rows={exportRows} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wider text-navy-400 dark:border-navy-800">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Receipt</th>
                {canDelete && <th className="px-4 py-3 text-right font-medium"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <td className="whitespace-nowrap px-4 py-3 text-navy-600 dark:text-navy-300">
                    {new Date(r.date).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-navy-900 dark:text-navy-50">
                    {r.payer}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-navy-500 dark:text-navy-400">
                    {formatPhoneKE(r.phone)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-navy-900 dark:text-navy-50">
                    {formatKES(r.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PAID" ? (
                      <a
                        href={`/api/payments/${r.id}/receipt`}
                        className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 dark:text-green-400"
                      >
                        <FileDown className="h-4 w-4" /> PDF
                      </a>
                    ) : (
                      <span className="text-navy-300 dark:text-navy-600">—</span>
                    )}
                  </td>
                  {canDelete && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => softDelete(r.id)}
                        disabled={deleting === r.id}
                        aria-label="Delete payment"
                        className="text-navy-400 transition-colors hover:text-red-600 disabled:opacity-50"
                      >
                        {deleting === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
