"use client";

/**
 * G.24 — "Uniform shop" card on the family portal: photos + prices,
 * order for your child, supplier delivers at school, billed to the invoice.
 */
import * as React from "react";
import { Shirt, X, Loader2, ShoppingCart, Package } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface Item { id: string; name: string; priceKes: number; unit: string; imageUrl: string | null; inStock: boolean }
interface Order { id: string; orderNo: string; itemName: string; size: string | null; qty: number; totalKes: number; status: string; invoiceStatus: string }
interface SizeRow { id: string; size: string; qty: number }
interface SizeItem { id: string; sizes: SizeRow[] }

const STATUS_LABEL: Record<string, string> = {
  PLACED: "placed", SENT_TO_SUPPLIER: "with the tailor", DELIVERED: "delivered ✓", CANCELLED: "cancelled",
};

export function UniformCard({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [sizes, setSizes] = React.useState<SizeItem[]>([]);
  const [ordering, setOrdering] = React.useState<Item | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/uniforms");
      const json = await res.json();
      if (json.ok) { setItems(json.data.items); setOrders(json.data.orders); setSizes(json.data.sizes ?? []); }
    } catch { /* non-blocking card */ }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shirt className="h-4 w-4 text-navy-400" /> Uniform shop</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : items.length === 0 ? (
          <p className="py-3 text-center text-sm text-navy-400">The school hasn&apos;t listed uniforms yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((i) => (
              <div key={i.id} className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt={i.name} className="mb-2 h-20 w-full rounded-xl object-cover" />
                ) : (
                  <div className="mb-2 flex h-20 w-full items-center justify-center rounded-xl bg-warm-50 dark:bg-navy-800">
                    <Shirt className="h-8 w-8 text-navy-200 dark:text-navy-600" />
                  </div>
                )}
                <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{i.name}</p>
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">{kes(i.priceKes)}</p>
                <Button size="sm" className="mt-2 w-full" disabled={!i.inStock} onClick={() => setOrdering(i)}>
                  <ShoppingCart className="h-3.5 w-3.5" /> {i.inStock ? "Order" : "Out of stock"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-navy-500 dark:text-navy-400"><Package className="h-3.5 w-3.5" /> Your orders</p>
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-1 py-2 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{o.itemName} × {o.qty}{o.size ? ` (${o.size})` : ""}</p>
                    <p className="text-xs text-navy-400">{o.orderNo} · {kes(o.totalKes)} · invoice {o.invoiceStatus.toLowerCase()}</p>
                  </div>
                  <Badge tone={o.status === "DELIVERED" ? "green" : o.status === "SENT_TO_SUPPLIER" ? "blue" : "amber"}>
                    {STATUS_LABEL[o.status] ?? o.status.toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-navy-400">Orders are billed to your fees and delivered AT SCHOOL by the school&apos;s tailor.</p>
      </CardContent>
      {ordering && (
        <OrderDialog
          item={ordering}
          sizeRows={sizes.find((s) => s.id === ordering.id)?.sizes ?? []}
          studentId={studentId}
          studentName={studentName}
          onClose={() => setOrdering(null)}
          onDone={() => { setOrdering(null); load(); }}
        />
      )}
    </Card>
  );
}

function OrderDialog({ item, sizeRows, studentId, studentName, onClose, onDone }: {
  item: Item; sizeRows: SizeRow[]; studentId: string; studentName: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [qty, setQty] = React.useState("1");
  const [size, setSize] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const total = item.priceKes * Number(qty || 0);

  async function order() {
    setSaving(true);
    try {
      const res = await fetch("/api/uniforms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "order", itemId: item.id, studentId, qty: Number(qty), size: size || undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: json.data.supplierNotified
            ? `Order ${json.data.orderNo} sent to ${json.data.supplierName ?? "the tailor"} — delivery at school`
            : `Order ${json.data.orderNo} placed — billed to invoice ${json.data.invoiceNo}`,
          tone: "success",
        });
        onDone();
      } else toast({ title: json.error?.message || "Could not order", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Order — {item.name}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">For {studentName}</p>
          {/* B.25: when the school keeps stock per size, pick from live pills
              (sold-out sizes disabled). Otherwise free-text as before. */}
          {sizeRows.length > 0 ? (
            <div>
              <Label>Size</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {sizeRows.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={s.qty <= 0}
                    onClick={() => setSize(s.size)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${
                      size === s.size
                        ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : s.qty <= 0
                        ? "cursor-not-allowed border-navy-100 text-navy-300 line-through dark:border-navy-800 dark:text-navy-600"
                        : "border-navy-200 text-navy-600 hover:border-navy-400 dark:border-navy-700 dark:text-navy-300"
                    }`}
                  >
                    {s.size}
                    {s.qty > 0 && s.qty <= 3 ? <span className="ml-1 text-[10px] text-amber-600">({s.qty} left)</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantity</Label><Input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            {sizeRows.length === 0 && (
              <div><Label>Size / note</Label><Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. Size 32 / M" /></div>
            )}
          </div>
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
            Total <span className="font-semibold">{kes(total)}</span> — added to your fees invoice. The tailor delivers at school.
          </p>
          <Button onClick={order} disabled={saving || !qty || (sizeRows.length > 0 && !size)} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Place order
          </Button>
        </div>
      </div>
    </div>
  );
}
