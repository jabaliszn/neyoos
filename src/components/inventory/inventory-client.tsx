"use client";

/**
 * B.18 Inventory UI — 3 tabs:
 * - Stock: alerts strip (low stock / expiring / expired) + items table w/
 *   Stock in / Stock out / Sell-to-student (bills the B.7 invoice) + add item/store
 * - Movements: per-item audit trail
 * - Assets: fixed-asset register (auto AST-#### tags)
 */
import * as React from "react";
import {
  Boxes, Plus, X, Loader2, AlertCircle, ArrowDownToLine, ArrowUpFromLine,
  ShoppingCart, AlertTriangle, CalendarX2, Archive, ArrowLeft, History, Shirt,
  Truck, Star, FileSignature, ClipboardCheck, CheckCircle2, Send, PackageCheck, Scale,
  Receipt, Wallet, Check, XCircle, Tag, Building2, BarChart3, Paperclip,
} from "lucide-react";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { StudentSearchSelect } from "@/components/students/student-search-select";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface StoreRow { id: string; name: string; location: string | null; items: number; lowStock: number }
interface BatchRow { id: string; batchNo: string; qty: number; expiryDate: string | null; expiring: boolean; expired: boolean }
interface ItemRow { id: string; name: string; category: string; unit: string; storeId: string; storeName: string; qty: number; reorderLevel: number; low: boolean; sellPriceKes: number | null; trackExpiry: boolean; batches: BatchRow[]; expiringBatches: number; expiredBatches: number }
interface Alerts { lowStock: { id: string; name: string; storeName: string; qty: number; reorderLevel: number; unit: string }[]; expiring: { item: string; batchNo: string; qty: number; expiryDate: string; unit: string }[]; expired: { item: string; batchNo: string; qty: number; expiryDate: string; unit: string }[] }
interface MaintRow { id: string; date: string; kind: string; costKes: number; note: string | null; byName: string }
interface AssetRow {
  id: string; tag: string; name: string; category: string; location: string | null;
  custodian: string | null; valueKes: number; condition: string;
  acquiredOn: string | null; depreciationPctPerYear: number; nextMaintenanceOn: string | null;
  bookValueKes: number; maintenanceDue: boolean; maintenanceSoon: boolean;
  maintenanceCostKes: number; history: MaintRow[];
}
interface StudentOpt { id: string; name: string; admissionNo: string }
interface Data { stores: StoreRow[]; items: ItemRow[]; alerts: Alerts; assets: AssetRow[] }

export function InventoryClient({ canManage, canApprove = false }: { canManage: boolean; canApprove?: boolean }) {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"stock" | "sizes" | "assets" | "suppliers" | "procurement" | "expenses">("stock");
  const [openMovements, setOpenMovements] = React.useState<ItemRow | null>(null);
  const [openAsset, setOpenAsset] = React.useState<AssetRow | null>(null);
  const [dialog, setDialog] = React.useState<{ kind: "store" | "item" | "in" | "out" | "sell" | "asset"; item?: ItemRow } | null>(null);
  const [students, setStudents] = React.useState<StudentOpt[]>([]);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/inventory");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo,
      })));
    }).catch(() => {});
  }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-3"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  if (openMovements) return <MovementsView item={openMovements} onBack={() => setOpenMovements(null)} />;

  const a = data.alerts;
  const hasAlerts = a.lowStock.length + a.expiring.length + a.expired.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {[{ key: "stock" as const, label: "Stock", icon: Boxes }, { key: "sizes" as const, label: "Uniform sizes", icon: Shirt }, { key: "assets" as const, label: "Assets", icon: Archive }, { key: "suppliers" as const, label: "Suppliers", icon: Truck }, { key: "procurement" as const, label: "Procurement", icon: ClipboardCheck }, { key: "expenses" as const, label: "Expenses", icon: Receipt }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${
              tab === t.key
                ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900"
                : "bg-white text-navy-600 border border-navy-100 hover:bg-warm-50 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="space-y-4">
          {/* alerts strip */}
          {hasAlerts && (
            <div className="grid gap-2 sm:grid-cols-3">
              {a.lowStock.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Reorder now</p>
                  {a.lowStock.slice(0, 3).map((l) => (
                    <p key={l.id} className="mt-1 text-xs text-amber-700 dark:text-amber-200">{l.name}: {l.qty} {l.unit} left (reorder at {l.reorderLevel})</p>
                  ))}
                </div>
              )}
              {a.expiring.length > 0 && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-900/20">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-800 dark:text-orange-300"><CalendarX2 className="h-3.5 w-3.5" /> Expiring ≤30 days</p>
                  {a.expiring.slice(0, 3).map((e, i) => (
                    <p key={i} className="mt-1 text-xs text-orange-700 dark:text-orange-200">{e.item} batch {e.batchNo}: {e.qty} {e.unit} → {e.expiryDate}</p>
                  ))}
                </div>
              )}
              {a.expired.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300"><CalendarX2 className="h-3.5 w-3.5" /> EXPIRED — dispose</p>
                  {a.expired.slice(0, 3).map((e, i) => (
                    <p key={i} className="mt-1 text-xs text-red-700 dark:text-red-200">{e.item} batch {e.batchNo}: {e.qty} {e.unit} (exp {e.expiryDate})</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-1.5">
              <Button onClick={() => setDialog({ kind: "item" })}><Plus className="h-4 w-4" /> Add item</Button>
              <Button variant="secondary" onClick={() => setDialog({ kind: "store" })}><Plus className="h-4 w-4" /> Add store</Button>
            </div>
          )}

          {data.items.length === 0 ? (
            <EmptyState icon={Boxes} title="No stock yet" description="Add your stores (Main Store, Kitchen Store) and the items in them." action={canManage ? <Button onClick={() => setDialog({ kind: "store" })}><Plus className="h-4 w-4" /> Add store</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.items.map((i) => (
                <Card key={i.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <button onClick={() => setOpenMovements(i)} className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{i.name}</p>
                      <p className="text-xs text-navy-400">
                        {i.storeName} · {i.category}{i.sellPriceKes ? ` · sells at ${kes(i.sellPriceKes)}` : ""}
                        {i.expiringBatches > 0 ? ` · ${i.expiringBatches} batch expiring` : ""}{i.expiredBatches > 0 ? ` · ${i.expiredBatches} EXPIRED` : ""}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={i.low ? "red" : "green"}>{i.qty} {i.unit}</Badge>
                      {canManage && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "in", item: i })}><ArrowDownToLine className="h-3.5 w-3.5" /> In</Button>
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "out", item: i })}><ArrowUpFromLine className="h-3.5 w-3.5" /> Out</Button>
                          {i.sellPriceKes && <Button size="sm" onClick={() => setDialog({ kind: "sell", item: i })}><ShoppingCart className="h-3.5 w-3.5" /> Sell</Button>}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sizes" && <SizesTab canManage={canManage} />}

      {tab === "suppliers" && <SuppliersTab canManage={canManage} />}

      {tab === "procurement" && <ProcurementTab canManage={canManage} canApprove={canApprove} />}
      {tab === "expenses" && <ExpensesTab canManage={canManage} canApprove={canApprove} />}

      {tab === "assets" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog({ kind: "asset" })}><Plus className="h-4 w-4" /> Add asset</Button>}
          {data.assets.length === 0 ? (
            <EmptyState icon={Archive} title="No assets yet" description="Tag computers, furniture and equipment — each gets an AST-#### tag." action={canManage ? <Button onClick={() => setDialog({ kind: "asset" })}><Plus className="h-4 w-4" /> Add asset</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.assets.map((as) => (
                <Card key={as.id}>
                  <CardContent className="p-4">
                    <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpenAsset(as)}>
                      <div>
                        <p className="text-sm font-semibold text-navy-900 dark:text-navy-50"><span className="font-mono text-xs text-navy-400">{as.tag}</span> {as.name}</p>
                        <p className="text-xs text-navy-400">
                          {as.category}{as.location ? ` · ${as.location}` : ""}{as.custodian ? ` · ${as.custodian}` : ""}
                          {as.acquiredOn ? ` · since ${as.acquiredOn}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {as.maintenanceDue && <Badge tone="red">service due</Badge>}
                        {as.maintenanceSoon && <Badge tone="amber">service soon</Badge>}
                        <Badge tone={as.condition === "GOOD" ? "green" : as.condition === "FAIR" ? "amber" : "red"}>{as.condition.toLowerCase().replace("_", " ")}</Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium text-navy-700 dark:text-navy-200">{kes(as.bookValueKes)}</p>
                          {as.depreciationPctPerYear > 0 && as.bookValueKes !== as.valueKes && (
                            <p className="text-[11px] text-navy-400">bought {kes(as.valueKes)} · −{as.depreciationPctPerYear}%/yr</p>
                          )}
                        </div>
                      </div>
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog?.kind === "store" && <StoreDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.kind === "item" && <ItemDialog stores={data.stores} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.kind === "in" && dialog.item && <InDialog item={dialog.item} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.kind === "out" && dialog.item && <OutDialog item={dialog.item} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.kind === "sell" && dialog.item && <SellDialog item={dialog.item} students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.kind === "asset" && <AssetDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {openAsset && <AssetDrawer asset={openAsset} canManage={canManage} onClose={() => setOpenAsset(null)} onChanged={() => { setOpenAsset(null); load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movements view
// ---------------------------------------------------------------------------

interface Movement { id: string; type: string; qty: number; reason: string | null; studentName: string | null; byName: string; createdAt: string }

function MovementsView({ item, onBack }: { item: ItemRow; onBack: () => void }) {
  const [data, setData] = React.useState<{ item: { name: string; unit: string; qty: number; storeName: string }; movements: Movement[] } | null>(null);
  React.useEffect(() => {
    fetch(`/api/inventory?movements=${item.id}`).then((r) => r.json()).then((j) => j.ok && setData(j.data)).catch(() => {});
  }, [item.id]);

  if (data === null) return <Skeleton className="h-48 rounded-2xl" />;
  const TONE: Record<string, "green" | "red" | "blue" | "neutral"> = { IN: "green", OUT: "red", SALE: "blue", ADJUST: "neutral" };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> Stock
      </button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-navy-400" /> {data.item.name}</CardTitle>
          <p className="mt-1 text-xs text-navy-400">{data.item.storeName} · current balance {data.item.qty} {data.item.unit}</p>
        </CardHeader>
        <CardContent>
          {data.movements.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">No movements yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.movements.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">
                      {m.type === "IN" ? "+" : "−"}{m.qty} {data.item.unit}
                      {m.studentName ? ` — ${m.studentName}` : ""}
                    </p>
                    <p className="text-xs text-navy-400">{m.reason ?? "—"} · by {m.byName} · {new Date(m.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
                  </div>
                  <Badge tone={TONE[m.type] ?? "neutral"}>{m.type.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const selectCls = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StoreDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addStore", name, location: location || undefined }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Store added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title="Add a store" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen Store" /></div>
        <div><Label>Location (optional)</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Behind the dining hall" /></div>
        <Button onClick={save} disabled={saving || !name.trim()} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add store</Button>
      </div>
    </Dialog>
  );
}

function ItemDialog({ stores, onClose, onDone }: { stores: StoreRow[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ storeId: stores[0]?.id ?? "", name: "", category: "", unit: "pcs", reorderLevel: "", sellPriceKes: "", trackExpiry: false });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addItem", storeId: f.storeId, name: f.name, category: f.category, unit: f.unit,
          reorderLevel: Number(f.reorderLevel || 0), sellPriceKes: f.sellPriceKes ? Number(f.sellPriceKes) : undefined,
          trackExpiry: f.trackExpiry,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Item added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title="Add a stock item" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Store</Label>
          <select value={f.storeId} onChange={(e) => set("storeId", e.target.value)} className={selectCls}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><Label>Item name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Maize flour (2kg)" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Food / Uniform / Lab" /></div>
          <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="pcs / kg / L" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Reorder level</Label><Input type="number" min={0} value={f.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} placeholder="alert when ≤" /></div>
          <div><Label>Sell price (KES, optional)</Label><Input type="number" min={1} value={f.sellPriceKes} onChange={(e) => set("sellPriceKes", e.target.value)} placeholder="sellable to students" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
          <input type="checkbox" checked={f.trackExpiry} onChange={(e) => set("trackExpiry", e.target.checked)} className="h-4 w-4 rounded" />
          Track batches &amp; expiry (perishables)
        </label>
        <Button onClick={save} disabled={saving || !f.name.trim() || !f.category.trim() || !f.storeId} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add item
        </Button>
      </div>
    </Dialog>
  );
}

function InDialog({ item, onClose, onDone }: { item: ItemRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ qty: "", reason: "", batchNo: "", expiryDate: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "in", itemId: item.id, qty: Number(f.qty), reason: f.reason || undefined,
          batchNo: f.batchNo || undefined, expiryDate: f.expiryDate || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Stock received ✓", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title={`Stock in — ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Quantity ({item.unit})</Label><Input type="number" min={0.1} step="any" value={f.qty} onChange={(e) => set("qty", e.target.value)} /></div>
        <div><Label>Reason (optional)</Label><Input value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Term 2 delivery — Naivas wholesale" /></div>
        {item.trackExpiry && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Batch no</Label><Input value={f.batchNo} onChange={(e) => set("batchNo", e.target.value)} placeholder="B-2026-07" /></div>
            <div><Label>Expiry</Label><Input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} /></div>
          </div>
        )}
        <Button onClick={save} disabled={saving || !f.qty || (item.trackExpiry && !f.batchNo)} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />} Receive stock
        </Button>
      </div>
    </Dialog>
  );
}

function OutDialog({ item, onClose, onDone }: { item: ItemRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "out", itemId: item.id, qty: Number(qty), reason }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: json.data.lowStock ? `Issued — LOW STOCK: ${json.data.qtyLeft} ${item.unit} left` : "Stock issued ✓", tone: json.data.lowStock ? "error" : "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title={`Stock out — ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">In stock: {item.qty} {item.unit}</p>
        <div><Label>Quantity ({item.unit})</Label><Input type="number" min={0.1} step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kitchen issue — Tuesday lunch" /></div>
        <Button onClick={save} disabled={saving || !qty || !reason.trim()} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />} Issue stock
        </Button>
      </div>
    </Dialog>
  );
}

function SellDialog({ item, students, onClose, onDone }: { item: ItemRow; students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [studentId, setStudentId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [saving, setSaving] = React.useState(false);
  const total = item.sellPriceKes ? item.sellPriceKes * Number(qty || 0) : 0;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell", itemId: item.id, studentId, qty: Number(qty) }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Billed ${kes(json.data.totalKes)} to ${json.data.studentName}'s invoice ${json.data.invoiceNo}`, tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title={`Sell — ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <StudentSearchSelect
          students={students}
          value={studentId}
          onChange={setStudentId}
          label="Student"
          placeholder="Type learner name or admission number…"
        />
        <div><Label>Quantity ({item.unit})</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
          Total <span className="font-semibold">{kes(total)}</span> — billed to the student&apos;s fee invoice. The family sees it on the portal and can pay via M-Pesa.
        </p>
        <Button onClick={save} disabled={saving || !studentId || !qty} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Sell &amp; bill invoice
        </Button>
      </div>
    </Dialog>
  );
}

function AssetDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", category: "", location: "", custodian: "", valueKes: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addAsset", name: f.name, category: f.category, location: f.location || undefined, custodian: f.custodian || undefined, valueKes: Number(f.valueKes || 0) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `Asset tagged ${json.data.tag}`, tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title="Add an asset" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HP ProBook — Staff Room" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="ICT / Furniture" /></div>
          <div><Label>Value (KES)</Label><Input type="number" min={0} value={f.valueKes} onChange={(e) => set("valueKes", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Location</Label><Input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Staff room" /></div>
          <div><Label>Custodian</Label><Input value={f.custodian} onChange={(e) => set("custodian", e.target.value)} placeholder="Deputy Principal" /></div>
        </div>
        <Button onClick={save} disabled={saving || !f.name.trim() || !f.category.trim()} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add asset
        </Button>
      </div>
    </Dialog>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B.25 — Uniform sizes tab: per-size stock board (S/M/L/Size 30…) per item.
// Master StockItem.qty auto-syncs to the sum of sizes (service rule).
// ---------------------------------------------------------------------------
const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "Size 26", "Size 28", "Size 30", "Size 32", "Size 34"];

function SizesTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  interface SizeRow { id: string; size: string; qty: number }
  interface SizeItem { id: string; name: string; priceKes: number | null; imageUrl: string | null; totalQty: number; sizes: SizeRow[] }
  const [items, setItems] = React.useState<SizeItem[] | null>(null);
  const [editing, setEditing] = React.useState<{ itemId: string; size: string; qty: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/uniforms");
      const json = await res.json();
      if (json.ok) setItems(json.data.sizes);
    } catch { /* board is non-blocking */ }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    const qty = parseInt(editing.qty, 10);
    if (Number.isNaN(qty) || qty < 0) { toast({ title: "Enter a quantity of 0 or more", tone: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/uniforms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sizeStock", itemId: editing.itemId, size: editing.size, qty }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `${editing.size} set to ${qty}`, tone: "success" }); setEditing(null); load(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  if (items === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;
  if (items.length === 0) {
    return <EmptyState icon={Shirt} title="No uniform items yet" description='Add items in the Stock tab with category "Uniform" and a selling price — they appear here for size-by-size stock.' />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{item.name}</p>
                <p className="text-xs text-navy-400">
                  {item.priceKes ? kes(item.priceKes) : "no price"} · total {item.totalQty} in stock
                  {item.sizes.length > 0 ? ` across ${item.sizes.length} sizes` : " — no sizes yet"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.sizes.map((s) => (
                <button
                  key={s.id}
                  disabled={!canManage}
                  onClick={() => setEditing({ itemId: item.id, size: s.size, qty: String(s.qty) })}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${
                    s.qty === 0
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
                      : s.qty <= 3
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300"
                      : "border-navy-200 bg-white text-navy-700 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-200"
                  } ${canManage ? "hover:border-navy-400" : "cursor-default"}`}
                >
                  {s.size} · {s.qty}
                </button>
              ))}
              {canManage && (
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_PRESETS.filter((p) => !item.sizes.some((s) => s.size === p)).slice(0, 6).map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditing({ itemId: item.id, size: p, qty: "0" })}
                      className="rounded-full border border-dashed border-navy-200 px-3 py-1.5 text-xs text-navy-400 hover:border-green-500 hover:text-green-600 dark:border-navy-700"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Stock for size {editing.size}</h3>
              <button onClick={() => setEditing(null)} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <Label>Pieces in store</Label>
            <Input type="number" min={0} value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} autoFocus />
            <p className="mt-2 text-xs text-navy-400">The item&apos;s total stock auto-updates to the sum of its sizes.</p>
            <Button onClick={save} disabled={saving} className="mt-4 w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B.25 — Asset drawer: acquisition + depreciation + maintenance schedule/log.
// ---------------------------------------------------------------------------
function AssetDrawer({ asset, canManage, onClose, onChanged }: {
  asset: AssetRow; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  // edit fields
  const [acquiredOn, setAcquiredOn] = React.useState(asset.acquiredOn ?? "");
  const [valueKes, setValueKes] = React.useState(String(asset.valueKes));
  const [depPct, setDepPct] = React.useState(String(asset.depreciationPctPerYear));
  const [custodian, setCustodian] = React.useState(asset.custodian ?? "");
  const [condition, setCondition] = React.useState(asset.condition);
  const [nextOn, setNextOn] = React.useState(asset.nextMaintenanceOn ?? "");
  // maintenance log fields
  const [mDate, setMDate] = React.useState(new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10));
  const [mKind, setMKind] = React.useState("SERVICE");
  const [mCost, setMCost] = React.useState("");
  const [mNote, setMNote] = React.useState("");

  async function post(body: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: okMsg, tone: "success" }); onChanged(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-pop dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{asset.name}</h3>
            <p className="font-mono text-xs text-navy-400">{asset.tag} · {asset.category}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {/* Value strip */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="text-xs text-navy-400">Book value today</p>
            <p className="text-lg font-semibold text-navy-900 dark:text-navy-50">{kes(asset.bookValueKes)}</p>
          </div>
          <div className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="text-xs text-navy-400">Maintenance spent</p>
            <p className="text-lg font-semibold text-navy-900 dark:text-navy-50">{kes(asset.maintenanceCostKes)}</p>
          </div>
        </div>

        {canManage && (
          <div className="mb-6 space-y-3">
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Acquisition & depreciation</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bought on</Label><Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} /></div>
              <div><Label>Cost (KES)</Label><Input type="number" min={0} value={valueKes} onChange={(e) => setValueKes(e.target.value)} /></div>
              <div><Label>Depreciation %/year</Label><Input type="number" min={0} max={100} value={depPct} onChange={(e) => setDepPct(e.target.value)} /></div>
              <div><Label>Custodian</Label><Input value={custodian} onChange={(e) => setCustodian(e.target.value)} placeholder="e.g. Otieno Brian" /></div>
              <div>
                <Label>Condition</Label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {["GOOD", "FAIR", "NEEDS_REPAIR", "DISPOSED"].map((c) => <option key={c} value={c}>{c.replace("_", " ").toLowerCase()}</option>)}
                </select>
              </div>
              <div><Label>Next service due</Label><Input type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} /></div>
            </div>
            <Button
              disabled={saving}
              onClick={() => post({
                action: "updateAsset", assetId: asset.id,
                acquiredOn: acquiredOn || null, valueKes: Number(valueKes || 0),
                depreciationPctPerYear: Number(depPct || 0),
                custodian: custodian || null, condition, nextMaintenanceOn: nextOn || null,
              }, "Asset updated")}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save asset
            </Button>
          </div>
        )}

        {canManage && (
          <div className="mb-6 space-y-3 border-t border-navy-100 pt-5 dark:border-navy-800">
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Log service / repair</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div>
                <Label>Type</Label>
                <select value={mKind} onChange={(e) => setMKind(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {["SERVICE", "REPAIR", "INSPECTION", "OTHER"].map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}
                </select>
              </div>
              <div><Label>Cost (KES)</Label><Input type="number" min={0} value={mCost} onChange={(e) => setMCost(e.target.value)} /></div>
              <div><Label>Note</Label><Input value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="e.g. New RAM fitted" /></div>
            </div>
            <Button
              variant="secondary"
              disabled={saving || !mDate}
              onClick={() => post({ action: "assetMaintenance", assetId: asset.id, date: mDate, kind: mKind, costKes: Number(mCost || 0), note: mNote || undefined }, "Logged")}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log entry
            </Button>
          </div>
        )}

        <div className="space-y-2 border-t border-navy-100 pt-5 dark:border-navy-800">
          <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Service history</p>
          {asset.history.length === 0 ? (
            <p className="text-sm text-navy-400">No services logged yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {asset.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-navy-800 dark:text-navy-100">{h.kind.toLowerCase()}{h.note ? ` — ${h.note}` : ""}</p>
                    <p className="text-xs text-navy-400">{h.date} · {h.byName}</p>
                  </div>
                  <span className="font-medium text-navy-700 dark:text-navy-200">{kes(h.costKes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B.25 — Suppliers tab: records + categories + star ratings + contracts
// with expiry badges (red expired / amber ≤30 days).
// ---------------------------------------------------------------------------
function SuppliersTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  interface ContractRow { id: string; title: string; startsOn: string; endsOn: string; valueKes: number; note: string | null; expired: boolean; expiringSoon: boolean; daysLeft: number }
  interface SupplierRow { id: string; name: string; category: string; phone: string | null; email: string | null; contact: string | null; kraPin: string | null; rating: number; notes: string | null; contracts: ContractRow[]; activeContracts: number; hasExpiring: boolean; hasExpired: boolean }
  const [rows, setRows] = React.useState<SupplierRow[] | null>(null);
  const [cats, setCats] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [contractFor, setContractFor] = React.useState<SupplierRow | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers");
      const json = await res.json();
      if (json.ok) { setRows(json.data.suppliers); setCats(json.data.categories); }
    } catch { /* tab is non-blocking */ }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>, okMsg: string, after?: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: okMsg, tone: "success" }); after?.(); load(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  if (rows === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;

  return (
    <div className="space-y-3">
      {canManage && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add supplier</Button>}
      {rows.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers yet" description="Keep your food, uniform and cleaning suppliers in one place — with ratings and contract expiry reminders." action={canManage ? <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add supplier</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{s.name}</p>
                    <p className="text-xs text-navy-400">
                      {s.category}{s.contact ? ` · ${s.contact}` : ""}{s.phone ? ` · ${s.phone}` : ""}{s.kraPin ? ` · PIN ${s.kraPin}` : ""}
                    </p>
                    {s.notes && <p className="mt-1 text-xs text-navy-400">{s.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.hasExpired && <Badge tone="red">contract expired</Badge>}
                    {s.hasExpiring && <Badge tone="amber">renew soon</Badge>}
                    {s.activeContracts > 0 && !s.hasExpiring && !s.hasExpired && <Badge tone="green">{s.activeContracts} active</Badge>}
                    {/* star rating — one tap per star */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          disabled={!canManage || saving}
                          onClick={() => post({ action: "rate", supplierId: s.id, rating: n }, `${s.name}: ${n} star${n > 1 ? "s" : ""}`)}
                          aria-label={`${n} stars`}
                          className={canManage ? "cursor-pointer" : "cursor-default"}
                        >
                          <Star className={`h-4 w-4 ${n <= s.rating ? "fill-amber-400 text-amber-400" : "text-navy-200 dark:text-navy-700"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {s.contracts.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-navy-100 pt-3 dark:border-navy-800">
                    {s.contracts.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium text-navy-800 dark:text-navy-100">{c.title}</p>
                          <p className="text-xs text-navy-400">{c.startsOn} → {c.endsOn}{c.valueKes > 0 ? ` · ${kes(c.valueKes)}` : ""}</p>
                        </div>
                        {c.expired ? (
                          <Badge tone="red">expired</Badge>
                        ) : c.expiringSoon ? (
                          <Badge tone="amber">{c.daysLeft}d left</Badge>
                        ) : (
                          <Badge tone="green">active</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage && (
                  <button onClick={() => setContractFor(s)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700">
                    <FileSignature className="h-3.5 w-3.5" /> Add contract
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {adding && <SupplierDialog cats={cats} saving={saving} onSave={(body) => post({ action: "add", ...body }, "Supplier added", () => setAdding(false))} onClose={() => setAdding(false)} />}
      {contractFor && <ContractDialog supplier={contractFor} saving={saving} onSave={(body) => post({ action: "contract", supplierId: contractFor.id, ...body }, "Contract added", () => setContractFor(null))} onClose={() => setContractFor(null)} />}
    </div>
  );
}

function SupplierDialog({ cats, saving, onSave, onClose }: {
  cats: string[]; saving: boolean; onSave: (body: Record<string, unknown>) => void; onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState(cats[0] ?? "Food");
  const [contact, setContact] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [kraPin, setKraPin] = React.useState("");
  const [notes, setNotes] = React.useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Add supplier</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Business name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naivas Wholesale — Kiambu" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Contact person</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Mary Wanjiku" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></div>
            <div><Label>KRA PIN (optional)</Label><Input value={kraPin} onChange={(e) => setKraPin(e.target.value)} placeholder="A0..." /></div>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Delivers Tuesdays, 30-day credit" /></div>
          <Button disabled={saving || name.trim().length < 2} onClick={() => onSave({ name, category, contact: contact || undefined, phone: phone || undefined, kraPin: kraPin || undefined, notes: notes || undefined })} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save supplier
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContractDialog({ supplier, saving, onSave, onClose }: {
  supplier: { name: string }; saving: boolean; onSave: (body: Record<string, unknown>) => void; onClose: () => void;
}) {
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [title, setTitle] = React.useState("");
  const [startsOn, setStartsOn] = React.useState(today);
  const [endsOn, setEndsOn] = React.useState("");
  const [valueKes, setValueKes] = React.useState("");
  const [note, setNote] = React.useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Contract — {supplier.name}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maize flour supply — Term 2" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Starts</Label><Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
            <div><Label>Ends</Label><Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
          </div>
          <div><Label>Value (KES, optional)</Label><Input type="number" min={0} value={valueKes} onChange={(e) => setValueKes(e.target.value)} /></div>
          <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Renew before closing day" /></div>
          <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">
            You&apos;ll see an amber &quot;renew soon&quot; badge 30 days before it ends, red when it expires.
          </p>
          <Button disabled={saving || title.trim().length < 3 || !endsOn} onClick={() => onSave({ title, startsOn, endsOn, valueKes: Number(valueKes || 0), note: note || undefined })} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Save contract
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B.25 — Procurement tab: requests + quote comparison + PO pipeline + 3-way match.
// ---------------------------------------------------------------------------
function ProcurementTab({ canManage, canApprove }: { canManage: boolean; canApprove: boolean }) {
  const { toast } = useToast();
  interface QuoteRow { id: string; supplierName: string; amountKes: number; note: string | null }
  interface ReqRow { id: string; title: string; details: string | null; neededBy: string | null; status: string; requestedByName: string; quotes: QuoteRow[]; cheapestQuoteId: string | null }
  interface PoRow { id: string; poNo: string; supplierName: string; title: string; totalKes: number; status: string; approvedByName: string | null; deliveredValueKes: number | null; supplierInvoiceNo: string | null; supplierInvoiceKes: number | null; matchOk: boolean | null; matchNote: string | null }
  interface Board { thresholdKes: number; requests: ReqRow[]; orders: PoRow[] }
  const [board, setBoard] = React.useState<Board | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [newReq, setNewReq] = React.useState(false);
  const [quoteFor, setQuoteFor] = React.useState<ReqRow | null>(null);
  const [deliverFor, setDeliverFor] = React.useState<PoRow | null>(null);
  const [matchFor, setMatchFor] = React.useState<PoRow | null>(null);
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string }[]>([]);

  const load = React.useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetch("/api/procurement"), fetch("/api/suppliers")]);
      const pj = await p.json(); const sj = await s.json();
      if (pj.ok) setBoard(pj.data);
      if (sj.ok) setSuppliers(sj.data.suppliers.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    } catch { /* non-blocking */ }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>, okMsg: string, after?: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/procurement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: okMsg, tone: "success" }); after?.(); load(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  if (board === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;

  const PO_BADGE: Record<string, { tone: "neutral" | "green" | "red" | "amber" | "blue"; label: string }> = {
    PENDING_APPROVAL: { tone: "amber", label: "awaiting approval" },
    APPROVED: { tone: "blue", label: "approved" },
    SENT: { tone: "blue", label: "sent to supplier" },
    DELIVERED: { tone: "amber", label: "delivered — match pending" },
    MATCHED: { tone: "green", label: "matched ✓" },
    CANCELLED: { tone: "neutral", label: "cancelled" },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canManage && <Button onClick={() => setNewReq(true)}><Plus className="h-4 w-4" /> New purchase request</Button>}
        <p className="text-xs text-navy-400">Orders above <span className="font-semibold">{kes(board.thresholdKes)}</span> need leadership approval.</p>
      </div>

      {/* Requests + quote comparison */}
      {board.requests.filter((r) => r.status === "OPEN").length === 0 && board.orders.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing in procurement yet" description="Raise a purchase request, collect quotations, and turn the best one into a purchase order." action={canManage ? <Button onClick={() => setNewReq(true)}><Plus className="h-4 w-4" /> New purchase request</Button> : undefined} />
      ) : (
        <>
          {board.requests.filter((r) => r.status === "OPEN").map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{r.title}</p>
                    <p className="text-xs text-navy-400">by {r.requestedByName}{r.neededBy ? ` · needed by ${r.neededBy}` : ""}</p>
                    {r.details && <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{r.details}</p>}
                  </div>
                  {canManage && (
                    <Button variant="secondary" onClick={() => setQuoteFor(r)}><Plus className="h-3.5 w-3.5" /> Add quote</Button>
                  )}
                </div>
                {r.quotes.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-navy-100 pt-3 dark:border-navy-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Quotations — cheapest first</p>
                    {r.quotes.map((q) => (
                      <div key={q.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 ${q.id === r.cheapestQuoteId ? "bg-green-50 dark:bg-green-900/20" : "bg-warm-50 dark:bg-navy-800"}`}>
                        <div>
                          <p className="text-sm font-medium text-navy-800 dark:text-navy-100">
                            {q.supplierName}
                            {q.id === r.cheapestQuoteId && <span className="ml-2 text-[10px] font-semibold uppercase text-green-600">best price</span>}
                          </p>
                          {q.note && <p className="text-xs text-navy-400">{q.note}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-navy-900 dark:text-navy-50">{kes(q.amountKes)}</span>
                          {canManage && (
                            <Button size="sm" onClick={() => post({ action: "order", quoteId: q.id }, "Purchase order created")}>
                              Order
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Orders pipeline */}
          {board.orders.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Purchase orders</p>
              {board.orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                          <span className="font-mono text-xs text-navy-400">{o.poNo}</span> {o.title}
                        </p>
                        <p className="text-xs text-navy-400">{o.supplierName} · {kes(o.totalKes)}{o.approvedByName ? ` · approved by ${o.approvedByName}` : ""}</p>
                        {o.status === "MATCHED" && o.matchNote && (
                          <p className={`mt-1 text-xs ${o.matchOk ? "text-green-600" : "text-red-600"}`}>
                            {o.matchOk ? "✓ " : "⚠ "}{o.matchNote}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={PO_BADGE[o.status]?.tone ?? "neutral"}>{PO_BADGE[o.status]?.label ?? o.status.toLowerCase()}</Badge>
                        {o.status === "MATCHED" && o.matchOk === false && <Badge tone="red">mismatch</Badge>}
                        {canApprove && o.status === "PENDING_APPROVAL" && (
                          <Button size="sm" disabled={saving} onClick={() => post({ action: "approve", poId: o.id }, `${o.poNo} approved`)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                        )}
                        {canManage && o.status === "APPROVED" && (
                          <Button size="sm" variant="secondary" disabled={saving} onClick={() => post({ action: "send", poId: o.id }, `${o.poNo} sent to ${o.supplierName}`)}>
                            <Send className="h-3.5 w-3.5" /> Send
                          </Button>
                        )}
                        {canManage && o.status === "SENT" && (
                          <Button size="sm" variant="secondary" onClick={() => setDeliverFor(o)}>
                            <PackageCheck className="h-3.5 w-3.5" /> Record delivery
                          </Button>
                        )}
                        {canManage && o.status === "DELIVERED" && (
                          <Button size="sm" onClick={() => setMatchFor(o)}>
                            <Scale className="h-3.5 w-3.5" /> 3-way match
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* New request dialog */}
      {newReq && <ReqDialog saving={saving} onSave={(b) => post({ action: "request", ...b }, "Request raised", () => setNewReq(false))} onClose={() => setNewReq(false)} />}
      {quoteFor && <QuoteDialog request={quoteFor} suppliers={suppliers} saving={saving} onSave={(b) => post({ action: "quote", requestId: quoteFor.id, ...b }, "Quote added", () => setQuoteFor(null))} onClose={() => setQuoteFor(null)} />}
      {deliverFor && <DeliverDialog po={deliverFor} saving={saving} onSave={(b) => post({ action: "deliver", poId: deliverFor.id, ...b }, "Delivery recorded", () => setDeliverFor(null))} onClose={() => setDeliverFor(null)} />}
      {matchFor && <MatchDialog po={matchFor} saving={saving} onSave={(b) => post({ action: "match", poId: matchFor.id, ...b }, "Matched", () => setMatchFor(null))} onClose={() => setMatchFor(null)} />}
    </div>
  );
}

function ProcDialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReqDialog({ saving, onSave, onClose }: { saving: boolean; onSave: (b: Record<string, unknown>) => void; onClose: () => void }) {
  const [title, setTitle] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [neededBy, setNeededBy] = React.useState("");
  return (
    <ProcDialogShell title="New purchase request" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>What is needed?</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Term 3 dry foods" /></div>
        <div><Label>Details</Label><Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. 30 bales maize flour, 10 bags rice" /></div>
        <div><Label>Needed by</Label><Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></div>
        <Button disabled={saving || title.trim().length < 3} onClick={() => onSave({ title, details: details || undefined, neededBy: neededBy || undefined })} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Raise request
        </Button>
      </div>
    </ProcDialogShell>
  );
}

function QuoteDialog({ request, suppliers, saving, onSave, onClose }: {
  request: { title: string }; suppliers: { id: string; name: string }[]; saving: boolean;
  onSave: (b: Record<string, unknown>) => void; onClose: () => void;
}) {
  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? "");
  const [amountKes, setAmountKes] = React.useState("");
  const [note, setNote] = React.useState("");
  return (
    <ProcDialogShell title={`Quote — ${request.title}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Supplier</Label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {suppliers.length === 0 && <p className="mt-1 text-xs text-red-600">Add suppliers first (Suppliers tab).</p>}
        </div>
        <div><Label>Quoted amount (KES)</Label><Input type="number" min={1} value={amountKes} onChange={(e) => setAmountKes(e.target.value)} /></div>
        <div><Label>Terms / note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivers in 3 days, 30-day credit" /></div>
        <Button disabled={saving || !supplierId || !amountKes} onClick={() => onSave({ supplierId, amountKes: Number(amountKes), note: note || undefined })} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add quote
        </Button>
      </div>
    </ProcDialogShell>
  );
}

function DeliverDialog({ po, saving, onSave, onClose }: {
  po: { poNo: string; totalKes: number }; saving: boolean; onSave: (b: Record<string, unknown>) => void; onClose: () => void;
}) {
  const [value, setValue] = React.useState(String(po.totalKes));
  const [note, setNote] = React.useState("");
  return (
    <ProcDialogShell title={`Goods received — ${po.poNo}`} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Value of goods received (KES)</Label><Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 bales short — credited next delivery" /></div>
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">
          Count what actually arrived. The 3-way match will compare it against the PO ({kes(po.totalKes)}) and the supplier&apos;s invoice.
        </p>
        <Button disabled={saving} onClick={() => onSave({ deliveredValueKes: Number(value || 0), note: note || undefined })} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Record delivery
        </Button>
      </div>
    </ProcDialogShell>
  );
}

function MatchDialog({ po, saving, onSave, onClose }: {
  po: { poNo: string; totalKes: number; deliveredValueKes: number | null }; saving: boolean;
  onSave: (b: Record<string, unknown>) => void; onClose: () => void;
}) {
  const [invNo, setInvNo] = React.useState("");
  const [invKes, setInvKes] = React.useState("");
  return (
    <ProcDialogShell title={`3-way match — ${po.poNo}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-warm-50 p-3 text-sm dark:bg-navy-800">
          <div><p className="text-xs text-navy-400">PO total</p><p className="font-semibold text-navy-900 dark:text-navy-50">{kes(po.totalKes)}</p></div>
          <div><p className="text-xs text-navy-400">Goods received</p><p className="font-semibold text-navy-900 dark:text-navy-50">{kes(po.deliveredValueKes ?? 0)}</p></div>
        </div>
        <div><Label>Supplier invoice number</Label><Input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="e.g. NV-2026-1187" /></div>
        <div><Label>Supplier invoice amount (KES)</Label><Input type="number" min={1} value={invKes} onChange={(e) => setInvKes(e.target.value)} /></div>
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">
          All three must agree before paying. Any difference is flagged — never pay a mismatched invoice quietly.
        </p>
        <Button disabled={saving || !invNo || !invKes} onClick={() => onSave({ supplierInvoiceNo: invNo, supplierInvoiceKes: Number(invKes) })} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Run the match
        </Button>
      </div>
    </ProcDialogShell>
  );
}

// ---------------------------------------------------------------------------
// B.25 — Expenses tab: record spend → threshold approval → category/cost-center
// reports that feed the B.24 profitability line. Receipt photo via A.9 (OCR
// auto-extract is Bundi-gated — manual entry works fully without it).
// ---------------------------------------------------------------------------
const EXP_BADGE: Record<string, { tone: "neutral" | "green" | "red" | "amber" | "blue"; label: string }> = {
  PENDING_APPROVAL: { tone: "amber", label: "awaiting approval" },
  APPROVED: { tone: "green", label: "approved" },
  REJECTED: { tone: "red", label: "rejected" },
};

function ExpensesTab({ canManage, canApprove }: { canManage: boolean; canApprove: boolean }) {
  const { toast } = useToast();
  interface CatRow { id: string; name: string }
  interface ExpRow {
    id: string; categoryName: string; costCenterName: string | null; payee: string; amountKes: number;
    spentOn: string; note: string | null; status: string; approvedByName: string | null; rejectedReason: string | null;
    receiptFileUrl: string | null; receiptFileName: string | null;
  }
  interface Board {
    thresholdKes: number; monthKey: string; approvedThisMonthKes: number; pendingThisMonthKes: number;
    awaitingApproval: number; categories: CatRow[]; costCenters: CatRow[]; expenses: ExpRow[];
  }
  interface Report { monthKey: string; totalKes: number; byCategory: { label: string; totalKes: number }[]; byCostCenter: { label: string; totalKes: number }[]; count: number }

  const [board, setBoard] = React.useState<Board | null>(null);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [view, setView] = React.useState<"spend" | "reports" | "dimensions">("spend");
  const [report, setReport] = React.useState<Report | null>(null);
  const [newExp, setNewExp] = React.useState(false);
  const [rejectFor, setRejectFor] = React.useState<ExpRow | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/expenses");
      const json = await res.json();
      if (json.ok) setBoard(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const loadReport = React.useCallback(async () => {
    try {
      const res = await fetch("/api/expenses?reports=1");
      const json = await res.json();
      if (json.ok) setReport(json.data);
    } catch { /* non-blocking */ }
  }, []);
  React.useEffect(() => { if (view === "reports") loadReport(); }, [view, loadReport]);

  async function post(body: Record<string, unknown>, okMsg: string, after?: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: okMsg, tone: "success" }); after?.(); load(); if (view === "reports") loadReport(); }
      else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (board === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  const noDimensions = board.categories.length === 0;

  return (
    <div className="space-y-5">
      {/* Money this month */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-card dark:bg-navy-900">
          <p className="text-xs text-navy-400">Approved this month</p>
          <p className="mt-1 text-xl font-semibold text-navy-900 dark:text-navy-50">{kes(board.approvedThisMonthKes)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card dark:bg-navy-900">
          <p className="text-xs text-navy-400">Awaiting approval</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{kes(board.pendingThisMonthKes)}</p>
          <p className="text-xs text-navy-400">{board.awaitingApproval} expense{board.awaitingApproval === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card dark:bg-navy-900">
          <p className="text-xs text-navy-400">Approval threshold</p>
          <p className="mt-1 text-xl font-semibold text-navy-900 dark:text-navy-50">{kes(board.thresholdKes)}</p>
          <p className="text-xs text-navy-400">Above this needs leadership</p>
        </div>
      </div>

      {/* view switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {[{ k: "spend" as const, label: "Spend", icon: Wallet }, { k: "reports" as const, label: "Reports", icon: BarChart3 }, { k: "dimensions" as const, label: "Categories", icon: Tag }].map((v) => (
            <button key={v.k} onClick={() => setView(v.k)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-apple ${view === v.k ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "bg-white text-navy-600 border border-navy-100 hover:bg-warm-50 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800"}`}>
              <v.icon className="h-3.5 w-3.5" /> {v.label}
            </button>
          ))}
        </div>
        {canManage && !noDimensions && <Button onClick={() => setNewExp(true)}><Plus className="h-4 w-4" /> Record expense</Button>}
      </div>

      {/* No categories yet → seed the KE presets */}
      {noDimensions ? (
        <EmptyState
          icon={Receipt}
          title="Set up expense categories first"
          description="Add the standard Kenyan school expense categories and cost centers, then start recording spend."
          action={canManage ? <Button disabled={saving} onClick={() => post({ action: "seed_presets" }, "Categories added")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add standard categories</Button> : undefined}
        />
      ) : view === "spend" ? (
        board.expenses.length === 0 ? (
          <EmptyState icon={Wallet} title="No expenses recorded yet" description="Record what the school spends — utilities, repairs, food — and approve anything above the threshold." action={canManage ? <Button onClick={() => setNewExp(true)}><Plus className="h-4 w-4" /> Record expense</Button> : undefined} />
        ) : (
          <div className="space-y-2">
            {board.expenses.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                        {e.payee} <span className="font-normal text-navy-500 dark:text-navy-400">· {kes(e.amountKes)}</span>
                      </p>
                      <p className="text-xs text-navy-400">
                        {e.categoryName}{e.costCenterName ? ` · ${e.costCenterName}` : ""} · {e.spentOn}
                        {e.approvedByName ? ` · ${e.approvedByName}` : ""}
                      </p>
                      {e.note && <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{e.note}</p>}
                      {e.status === "REJECTED" && e.rejectedReason && <p className="mt-1 text-xs text-red-600">Rejected: {e.rejectedReason}</p>}
                      {e.receiptFileUrl && (
                        <a href={e.receiptFileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400">
                          <Paperclip className="h-3 w-3" /> {e.receiptFileName || "Receipt"}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={EXP_BADGE[e.status]?.tone ?? "neutral"}>{EXP_BADGE[e.status]?.label ?? e.status.toLowerCase()}</Badge>
                      {canApprove && e.status === "PENDING_APPROVAL" && (
                        <>
                          <Button size="sm" disabled={saving} onClick={() => post({ action: "approve", expenseId: e.id }, "Expense approved")}>
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setRejectFor(e)}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : view === "reports" ? (
        report === null ? (
          <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
        ) : report.count === 0 ? (
          <EmptyState icon={BarChart3} title="No approved spend this month" description="Approved expenses for the current month will be broken down here by category and cost center." />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-navy-500 dark:text-navy-400">
              {report.monthKey} · <span className="font-semibold text-navy-900 dark:text-navy-50">{kes(report.totalKes)}</span> approved across {report.count} expense{report.count === 1 ? "" : "s"}
            </p>
            <ReportBars title="By category" icon={Tag} rows={report.byCategory} total={report.totalKes} />
            <ReportBars title="By cost center" icon={Building2} rows={report.byCostCenter} total={report.totalKes} />
            <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">
              These approved expenses feed the school&apos;s money position on the Owner dashboard (My School).
            </p>
          </div>
        )
      ) : (
        /* dimensions */
        <div className="grid gap-4 sm:grid-cols-2">
          <DimensionCard title="Categories" icon={Tag} rows={board.categories} canManage={canManage} saving={saving}
            onAdd={(name) => post({ action: "category", name }, "Category added")}
            onArchive={(id) => post({ action: "archive_category", id }, "Category archived")} />
          <DimensionCard title="Cost centers" icon={Building2} rows={board.costCenters} canManage={canManage} saving={saving}
            onAdd={(name) => post({ action: "cost_center", name }, "Cost center added")}
            onArchive={(id) => post({ action: "archive_cost_center", id }, "Cost center archived")} />
        </div>
      )}

      {newExp && <ExpenseDialog categories={board.categories} costCenters={board.costCenters} threshold={board.thresholdKes} saving={saving} onSave={(b) => post({ action: "expense", ...b }, "Expense recorded", () => setNewExp(false))} onClose={() => setNewExp(false)} />}
      {rejectFor && <RejectDialog expense={rejectFor} saving={saving} onSave={(reason) => post({ action: "reject", expenseId: rejectFor.id, reason }, "Expense rejected", () => setRejectFor(null))} onClose={() => setRejectFor(null)} />}
    </div>
  );
}

function ReportBars({ title, icon: Icon, rows, total }: { title: string; icon: typeof Tag; rows: { label: string; totalKes: number }[]; total: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900 dark:text-navy-50"><Icon className="h-4 w-4 text-navy-400" /> {title}</p>
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-navy-600 dark:text-navy-300">{r.label}</span>
                <span className="font-semibold text-navy-900 dark:text-navy-50">{kes(r.totalKes)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${total > 0 ? Math.max(4, Math.round((r.totalKes / total) * 100)) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionCard({ title, icon: Icon, rows, canManage, saving, onAdd, onArchive }: {
  title: string; icon: typeof Tag; rows: { id: string; name: string }[]; canManage: boolean; saving: boolean;
  onAdd: (name: string) => void; onArchive: (id: string) => void;
}) {
  const [name, setName] = React.useState("");
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900 dark:text-navy-50"><Icon className="h-4 w-4 text-navy-400" /> {title}</p>
        <div className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl bg-warm-50 px-3 py-2 text-sm dark:bg-navy-800">
              <span className="text-navy-800 dark:text-navy-100">{r.name}</span>
              {canManage && <button onClick={() => onArchive(r.id)} className="text-xs text-navy-400 hover:text-red-600" aria-label="Archive">Archive</button>}
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-navy-400">None yet.</p>}
        </div>
        {canManage && (
          <div className="mt-3 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Add a ${title.toLowerCase().replace(/s$/, "")}`} />
            <Button variant="secondary" disabled={saving || name.trim().length < 2} onClick={() => { onAdd(name.trim()); setName(""); }}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({ categories, costCenters, threshold, saving, onSave, onClose }: {
  categories: { id: string; name: string }[]; costCenters: { id: string; name: string }[]; threshold: number;
  saving: boolean; onSave: (b: Record<string, unknown>) => void; onClose: () => void;
}) {
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [costCenterId, setCostCenterId] = React.useState("");
  const [payee, setPayee] = React.useState("");
  const [amountKes, setAmountKes] = React.useState("");
  const [spentOn, setSpentOn] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [receipt, setReceipt] = React.useState<UploadedFile | null>(null);
  const overThreshold = Number(amountKes) > threshold;
  return (
    <ProcDialogShell title="Record an expense" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Category</Label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Cost center (optional)</Label>
          <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            <option value="">— none —</option>
            {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Paid to</Label><Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. KPLC, Mama Wanjiku Tailors" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount (KES)</Label><Input type="number" min={1} value={amountKes} onChange={(e) => setAmountKes(e.target.value)} /></div>
          <div><Label>Spent on</Label><Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} /></div>
        </div>
        <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. June water bill" /></div>
        <div>
          <Label>Receipt photo (optional)</Label>
          <FileUpload category="expense-receipt" accept="image/*,application/pdf" onUploaded={setReceipt} label="Attach receipt (photo/PDF)" />
          {receipt && <p className="mt-1 text-xs text-green-700 dark:text-green-400">Attached: {receipt.fileName}</p>}
        </div>
        {overThreshold && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Above {kes(threshold)} — this will wait for leadership approval before it counts.
          </p>
        )}
        <Button disabled={saving || !categoryId || payee.trim().length < 2 || !amountKes} onClick={() => onSave({ categoryId, costCenterId: costCenterId || undefined, payee, amountKes: Number(amountKes), spentOn, note: note || undefined, receiptFileUrl: receipt?.url || undefined, receiptFileName: receipt?.fileName || undefined })} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Record expense
        </Button>
      </div>
    </ProcDialogShell>
  );
}

function RejectDialog({ expense, saving, onSave, onClose }: {
  expense: { payee: string; amountKes: number }; saving: boolean; onSave: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <ProcDialogShell title={`Reject — ${expense.payee}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-navy-500 dark:text-navy-400">{kes(expense.amountKes)} expense. Give a reason the bursar will see.</p>
        <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No receipt attached — re-submit" /></div>
        <Button disabled={saving || reason.trim().length < 3} onClick={() => onSave(reason.trim())} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject expense
        </Button>
      </div>
    </ProcDialogShell>
  );
}
