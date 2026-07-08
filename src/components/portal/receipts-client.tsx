"use client";

import * as React from "react";
import { Receipt, Download, Smartphone, Banknote, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface ReceiptItem {
  id: string;
  receiptNo: string;
  amount: number;
  method: string;
  mpesaRef: string | null;
  paidAt: string | null;
  studentNames: string;
  description: string | null;
}

function methodMeta(method: string): { label: string; icon: typeof Smartphone } {
  if (method.includes("mpesa")) return { label: "M-Pesa", icon: Smartphone };
  if (method.includes("bank")) return { label: "Bank", icon: Landmark };
  return { label: "Cash", icon: Banknote };
}

export function ReceiptsClient() {
  const [receipts, setReceipts] = React.useState<ReceiptItem[] | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/portal?view=receipts");
      const json = await res.json();
      if (json.ok) setReceipts(json.data.receipts); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-navy-400">Could not load your receipts.</p>
          <Button variant="secondary" onClick={load} className="mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (receipts === null) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  if (receipts.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No receipts yet"
        description="The moment a payment for your child is confirmed — by M-Pesa, cash, or bank — a receipt will land here automatically, whether or not anyone at school prints one."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {receipts.map((r) => {
        const { label, icon: Icon } = methodMeta(r.method);
        return (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-navy-50">{r.studentNames}</p>
                  <p className="text-xs text-navy-400">
                    {r.receiptNo} · {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    {r.mpesaRef ? ` · ${r.mpesaRef}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="green">{label}</Badge>
                <span className="text-sm font-bold text-navy-900 dark:text-navy-50">{kes(r.amount)}</span>
                <a href={`/api/payments/${r.id}/receipt`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> PDF</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
