"use client";

/**
 * B.19 Cafeteria UI — 3 tabs:
 * - Kitchen today: headcount per meal (cards + boarders), today's menu,
 *   low-stock warnings, "Issue food" against a meal (B.18 stockOut reuse)
 * - Week menu: 7×3 grid, click-to-edit (Kenyan dishes in placeholders)
 * - Meal cards: issue (billed to invoice — founder rule), cancel, ledger status
 */
import * as React from "react";
import {
  UtensilsCrossed, CalendarDays, CreditCard, Plus, X, Loader2, AlertCircle,
  Users, AlertTriangle, Soup, Ban,
} from "lucide-react";
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
const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["BREAKFAST", "LUNCH", "SUPPER"] as const;
const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };

interface MenuRow { id: string; dayOfWeek: number; mealType: string; menu: string }
interface StockRow { id: string; name: string; qty: number; unit: string; low: boolean }
interface CardRow { id: string; cardNo: string; studentName: string; admissionNo: string; planName: string; meals: string[]; termFeeKes: number; active: boolean; invoiceNo: string; invoiceStatus: string }
interface Today { dayOfWeek: number; todayMenu: { mealType: string; menu: string }[]; headcount: Record<string, number>; dayScholarsWithCards: number; boarders: number; lowStock: StockRow[] }
interface StudentOpt { id: string; name: string; admissionNo: string }
interface CafeteriaPolicy { mealModel: "HYBRID" | "CARDS_ONLY" | "BOARDING_GROUPS" | "NO_CARDS"; mealScope: "ALL" | "LUNCH" | "SUPPER"; mealCardsEnabled: boolean; tableSize: number }
interface Data { menu: MenuRow[]; stock: { storeId: string | null; items: StockRow[] }; cards: CardRow[]; today: Today; policy: CafeteriaPolicy }

export function CafeteriaClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"today" | "menu" | "cards" | "tables" | "queue">("today");
  const [students, setStudents] = React.useState<StudentOpt[]>([]);
  const [editCell, setEditCell] = React.useState<{ day: number; meal: string; current: string } | null>(null);
  const [issuing, setIssuing] = React.useState(false);
  const [feeding, setFeeding] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/cafeteria");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string; className: string | null }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo, className: s.className,
      })));
    }).catch(() => {});
  }, [load]);

  async function cancelCard(id: string, cardNo: string) {
    const res = await fetch("/api/cafeteria", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancelCard", cardId: id }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `Card ${cardNo} cancelled`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  async function savePolicy(mealModel: CafeteriaPolicy["mealModel"], mealScope: CafeteriaPolicy["mealScope"]) {
    const res = await fetch("/api/cafeteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setPolicy", mealModel, mealScope }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: "Cafeteria meal model saved", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not save meal model", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  const mealCardsEnabled = data.policy.mealCardsEnabled;
  const mealPlanScope = data.policy.mealScope;
  const tabs = [
    { key: "today" as const, label: "Kitchen today", icon: Soup },
    { key: "menu" as const, label: "Week menu", icon: CalendarDays },
    ...(mealCardsEnabled ? [{ key: "cards" as const, label: "Meal cards", icon: CreditCard }] : []),
    { key: "tables" as const, label: "Table allocations", icon: Users },
    { key: "queue" as const, label: "Meal queue", icon: Users },
  ];
  const menuFor = (day: number, meal: string) => data.menu.find((m) => m.dayOfWeek === day && m.mealType === meal)?.menu ?? "";

  return (
    <div className="space-y-4">
      {/* If meal cards are disabled, we show a gorgeous banner enabling them back (H.3) */}
      {!mealCardsEnabled && canManage && (
        <Card className="border border-dashed border-navy-200 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-950 flex items-center justify-between gap-4 animate-fade-in">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-navy-800 dark:text-navy-200 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-navy-400" />
              Meal Cards are currently disabled school-wide.
            </p>
            <p className="text-[11px] text-navy-400">All student meal-billing plans are temporarily suspended.</p>
          </div>
          <Button size="sm" onClick={() => savePolicy("HYBRID", data.policy.mealScope)}>
            Enable Meal Cards
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
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

      {tab === "today" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {MEALS.map((m) => (
              <div key={m} className="rounded-2xl border border-navy-100/70 bg-white px-4 py-3 dark:border-navy-800 dark:bg-navy-900">
                <p className="text-[11px] text-navy-400">{MEAL_LABEL[m]} headcount</p>
                <p className="text-xl font-semibold text-navy-900 dark:text-navy-50">{data.today.headcount[m] ?? 0}</p>
                <p className="text-[11px] text-navy-400">{data.today.todayMenu.find((x) => x.mealType === m)?.menu ?? "menu not set"}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-navy-400">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {data.today.boarders} boarders (covered by boarding fees) + {data.today.dayScholarsWithCards} day-scholar meal card{data.today.dayScholarsWithCards === 1 ? "" : "s"}.
          </p>

          {data.today.lowStock.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Kitchen low stock</p>
              {data.today.lowStock.map((l) => <p key={l.id} className="mt-1 text-xs text-amber-700 dark:text-amber-200">{l.name}: {l.qty} {l.unit} left</p>)}
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-green-600" /> Kitchen store</CardTitle></CardHeader>
            <CardContent>
              {data.stock.items.length === 0 ? (
                <p className="py-3 text-center text-sm text-navy-400">No Kitchen Store yet — create one in Inventory.</p>
              ) : (
                <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                  {data.stock.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                      <p className="font-medium text-navy-900 dark:text-navy-50">{i.name}</p>
                      <Badge tone={i.low ? "red" : "green"}>{i.qty} {i.unit}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && data.stock.items.length > 0 && (
                <Button variant="secondary" className="mt-3 w-full" onClick={() => setFeeding(true)}>
                  <Soup className="h-4 w-4" /> Issue food for a meal
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "menu" && (
        <Card>
          <CardHeader>
            <CardTitle>Week menu</CardTitle>
            {canManage && <p className="mt-1 text-xs text-navy-400">Tap a cell to set the dish.</p>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-navy-400">
                    <th className="pb-2 font-medium">Day</th>
                    {MEALS.map((m) => <th key={m} className="pb-2 font-medium">{MEAL_LABEL[m]}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 dark:divide-navy-800">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <tr key={day}>
                      <td className="py-2 font-medium text-navy-900 dark:text-navy-50">{DAYS[day]}</td>
                      {MEALS.map((m) => {
                        const v = menuFor(day, m);
                        return (
                          <td key={m} className="py-2 pr-3">
                            <button
                              disabled={!canManage}
                              onClick={() => setEditCell({ day, meal: m, current: v })}
                              className={`w-full rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${v ? "bg-green-50 text-navy-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-navy-100" : "bg-warm-50 text-navy-300 hover:bg-warm-100 dark:bg-navy-800 dark:text-navy-500"}`}
                            >
                              {v || "— set menu —"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "cards" && (
        <div className="space-y-3">
          {/* Meal Card Configurator Card (H.3) */}
          {canManage && (
            <Card className="border border-green-200/50 bg-green-500/5 animate-fade-in">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-navy-800 dark:text-navy-100 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-green-600 animate-pulse" />
                    School Meal Card Configurator
                  </p>
                  <p className="text-xs text-navy-400">
                    Choose whether the school uses individual meal cards, boarding/group meals, both, or no physical cards.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={data.policy.mealModel}
                    onChange={(e) => savePolicy(e.target.value as CafeteriaPolicy["mealModel"], data.policy.mealScope)}
                    className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-850 dark:text-navy-100"
                  >
                    <option value="HYBRID">Hybrid: boarding groups + day cards</option>
                    <option value="CARDS_ONLY">Individual meal cards only</option>
                    <option value="BOARDING_GROUPS">Boarding/group meals only</option>
                    <option value="NO_CARDS">No physical meal cards</option>
                  </select>
                  <select
                    value={mealPlanScope}
                    onChange={(e) => savePolicy(data.policy.mealModel, e.target.value as CafeteriaPolicy["mealScope"])}
                    className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-850 dark:text-navy-100"
                  >
                    <option value="ALL">Full Scope (Breakfast + Lunch + Supper)</option>
                    <option value="LUNCH">Lunch Only Plan</option>
                    <option value="SUPPER">Supper Only Plan</option>
                  </select>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-red-600 border border-red-200/50 bg-red-500/5 hover:bg-red-500/10"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to completely turn off meal cards? Parents won't be able to buy cards.")) {
                        savePolicy("NO_CARDS", data.policy.mealScope);
                        setTab("today");
                      }
                    }}
                  >
                    Turn OFF Cards
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {canManage && <Button onClick={() => setIssuing(true)}><Plus className="h-4 w-4" /> Issue meal card</Button>}
          {data.cards.length === 0 ? (
            <EmptyState icon={CreditCard} title="No meal cards yet" description="Issue a lunch plan to a day scholar — it bills the family's invoice automatically." action={canManage ? <Button onClick={() => setIssuing(true)}><Plus className="h-4 w-4" /> Issue meal card</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.cards.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50"><span className="font-mono text-xs text-navy-400">{c.cardNo}</span> {c.studentName}</p>
                      <p className="text-xs text-navy-400">{c.planName} · {kes(c.termFeeKes)} · invoice {c.invoiceNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.invoiceStatus === "PAID" ? "green" : c.invoiceStatus === "PARTIAL" ? "amber" : "red"}>{c.invoiceStatus.toLowerCase()}</Badge>
                      {c.active ? (
                        canManage && (
                          <button onClick={() => cancelCard(c.id, c.cardNo)} className="rounded-full p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={`Cancel ${c.cardNo}`}>
                            <Ban className="h-4 w-4" />
                          </button>
                        )
                      ) : (
                        <Badge tone="neutral">cancelled</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tables" && (
        <TableAllocationsTab />
      )}
      {tab === "queue" && (
        <MealQueueTab students={students} canManage={canManage} />
      )}

      {editCell && (
        <MenuDialog
          cell={editCell}
          onClose={() => setEditCell(null)}
          onDone={() => { setEditCell(null); load(); }}
        />
      )}
      {issuing && <IssueCardDialog students={students} mealScope={data.policy.mealScope} onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); load(); }} />}
      {feeding && <KitchenIssueDialog items={data.stock.items} onClose={() => setFeeding(false)} onDone={() => { setFeeding(false); load(); }} />}
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

function MenuDialog({ cell, onClose, onDone }: { cell: { day: number; meal: string; current: string }; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [menu, setMenu] = React.useState(cell.current);
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cafeteria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setMenu", dayOfWeek: cell.day, mealType: cell.meal, menu }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Menu saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog title={`${DAYS[cell.day]} — ${MEAL_LABEL[cell.meal]}`} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Dish</Label><Input value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="e.g. Ugali, sukuma wiki na beef stew" /></div>
        <Button onClick={save} disabled={saving || menu.trim().length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Save menu
        </Button>
      </div>
    </Dialog>
  );
}

function IssueCardDialog({ students, mealScope, onClose, onDone }: { students: StudentOpt[]; mealScope: CafeteriaPolicy["mealScope"]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [studentId, setStudentId] = React.useState("");
  const [meals, setMeals] = React.useState<string[]>(mealScope === "SUPPER" ? ["SUPPER"] : ["LUNCH"]);
  const [fee, setFee] = React.useState("6500");
  const [saving, setSaving] = React.useState(false);
  const year = new Date().getFullYear();

  function toggleMeal(m: string) {
    setMeals((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cafeteria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issueCard", studentId, meals, termFeeKes: Number(fee), year, term: 2 }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Card ${json.data.cardNo} issued — billed to invoice ${json.data.invoiceNo}`, tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Issue a meal card" onClose={onClose}>
      <div className="space-y-3">
        <StudentSearchSelect
          students={students}
          value={studentId}
          onChange={setStudentId}
          label="Student (day scholars — boarders eat on the boarding fee)"
          placeholder="Type learner name or admission number…"
        />
        <div>
          <Label>Meals covered</Label>
          <div className="flex gap-1.5">
            {MEALS.map((m) => {
              const blocked = (mealScope === "LUNCH" && m !== "LUNCH") || (mealScope === "SUPPER" && m !== "SUPPER");
              return (
              <button
                key={m}
                disabled={blocked}
                onClick={() => toggleMeal(m)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${meals.includes(m) ? "bg-green-600 text-white" : "border border-navy-100 bg-white text-navy-600 dark:border-navy-800 dark:bg-navy-900 dark:text-navy-300"}`}
              >
                {MEAL_LABEL[m]}
              </button>
            );})}
          </div>
        </div>
        <div><Label>Plan fee for the term (KES)</Label><Input type="number" min={1} value={fee} onChange={(e) => setFee(e.target.value)} /></div>
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
          The plan is billed to the student&apos;s fee invoice — the family sees it on the portal and can pay via M-Pesa.
        </p>
        <Button onClick={save} disabled={saving || !studentId || meals.length === 0 || !fee} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Issue card &amp; bill invoice
        </Button>
      </div>
    </Dialog>
  );
}

function KitchenIssueDialog({ items, onClose, onDone }: { items: StockRow[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [itemId, setItemId] = React.useState(items[0]?.id ?? "");
  const [qty, setQty] = React.useState("");
  const [meal, setMeal] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const picked = items.find((i) => i.id === itemId);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cafeteria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kitchenIssue", itemId, qty: Number(qty), meal }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: json.data.lowStock ? `Issued — LOW STOCK: ${json.data.qtyLeft} left` : "Food issued to the kitchen ✓", tone: json.data.lowStock ? "error" : "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Issue food for a meal" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Item</Label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={selectCls}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.qty} {i.unit} in stock</option>)}
          </select>
        </div>
        <div><Label>Quantity{picked ? ` (${picked.unit})` : ""}</Label><Input type="number" min={0.1} step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><Label>For which meal?</Label><Input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="e.g. Tuesday lunch — githeri" /></div>
        <Button onClick={save} disabled={saving || !itemId || !qty || meal.trim().length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Soup className="h-4 w-4" />} Issue to kitchen
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

// ---- School Cafeteria Table Allocations (Chunk E — Part 2) -------------------
function TableAllocationsTab() {
  const { toast } = useToast();
  const [session, setSession] = React.useState<"LUNCH" | "SUPPER">("LUNCH");
  const [tableSize, setTableSize] = React.useState(8);
  const [board, setBoard] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const loadBoard = React.useCallback(async (s: "LUNCH" | "SUPPER") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cafeteria?tables=1&session=${s}`);
      const json = await res.json();
      if (json.ok) {
        setBoard(json.data);
        if (json.data.tableSize) setTableSize(json.data.tableSize);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { loadBoard(session); }, [session, loadBoard]);

  async function allocate() {
    setWorking(true);
    try {
      const res = await fetch("/api/cafeteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "allocateTables", session, tableSize }),
      });
      const json = await res.json();
      if (json.ok) { setBoard(json.data); toast({ title: `Seating plan saved — ${json.data.totalTables} tables`, tone: "success" }); }
      else toast({ title: json.error?.message || "Couldn't allocate tables", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setWorking(false); }
  }

  async function clearPlan() {
    setWorking(true);
    try {
      const res = await fetch("/api/cafeteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearTables", session }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Seating plan cleared", tone: "success" }); loadBoard(session); }
      else toast({ title: json.error?.message || "Couldn't clear", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setWorking(false); }
  }

  const hasPlan = board && board.classes && board.classes.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4 text-green-600" /> School Cafeteria Table Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          <p className="text-xs text-navy-500 dark:text-navy-400">
            Students are seated per class (same stream, never mixed). Pick the meal session and table size, then generate a saved seating plan.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Meal session</Label>
              <div className="inline-flex rounded-full border border-navy-200 p-1 dark:border-navy-700">
                {(["LUNCH", "SUPPER"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSession(s)}
                    className={"rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors " + (session === s ? "bg-green-600 text-white" : "text-navy-600 dark:text-navy-300")}
                  >
                    {s === "LUNCH" ? "Lunch only" : "Supper only"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Students per table</Label>
              <select
                value={tableSize}
                onChange={(e) => setTableSize(Number(e.target.value))}
                className="rounded-2xl border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100 h-10 cursor-pointer"
              >
                {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} students / table</option>)}
              </select>
            </div>
            <Button onClick={allocate} disabled={working} className="h-10">{working ? "Working…" : "Generate seating plan"}</Button>
            {hasPlan && <Button variant="secondary" onClick={clearPlan} disabled={working} className="h-10">Clear plan</Button>}
          </div>
          {board && (
            <p className="text-xs font-medium text-navy-500">
              {board.totalSeated} students · {board.totalTables} tables · {session === "LUNCH" ? "Lunch" : "Supper"} session
            </p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !hasPlan ? (
        <EmptyState icon={Users} title="No seating plan yet" description="Pick a session and table size, then generate the cafeteria seating plan." />
      ) : (
        <div className="space-y-4">
          {board.classes.map((ac: any) => (
            <Card key={ac.classLabel}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-navy-800 dark:text-navy-200">
                  {ac.classLabel} — {ac.tables.length} table{ac.tables.length === 1 ? "" : "s"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ac.tables.map((t: any) => (
                  <div key={t.tableNo} className="rounded-2xl border border-navy-100 bg-warm-50/50 p-3.5 dark:border-navy-800 dark:bg-navy-950">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400 border-b border-navy-100/30 pb-1.5 mb-1.5 flex justify-between">
                      <span>Table {t.tableNo}</span>
                      <span className="font-normal text-navy-400">({t.students.length} seats)</span>
                    </p>
                    <ul className="space-y-1 text-xs">
                      {t.students.map((s: any) => (
                        <li key={s.id} className="flex justify-between text-navy-800 dark:text-navy-200">
                          <span className="font-medium truncate max-w-[140px]">{s.name}</span>
                          <span className="font-mono text-[10px] text-navy-400">{s.admNo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// ---- Meal serving queue (I.19) --------------------------------------------
function MealQueueTab({ students, canManage }: { students: StudentOpt[]; canManage: boolean }) {
  const { toast } = useToast();
  const [session, setSession] = React.useState<"BREAKFAST" | "LUNCH" | "SUPPER">("LUNCH");
  const [studentId, setStudentId] = React.useState("");
  const [board, setBoard] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cafeteria?queue=1&session=${session}`);
      const json = await res.json();
      if (json.ok) setBoard(json.data);
    } finally { setLoading(false); }
  }, [session]);
  React.useEffect(() => { load(); }, [load]);

  async function action(body: any, success: string) {
    setWorking(true);
    try {
      const res = await fetch("/api/cafeteria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: success, tone: "success" }); setStudentId(""); load(); }
      else toast({ title: json.error?.message || "Queue action failed", tone: "error" });
    } finally { setWorking(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-green-600" /> Meal serving queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-navy-500 dark:text-navy-400">Add learners as they queue for meals, then mark them served at the counter. This is separate from table allocation.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Meal session</Label>
              <select value={session} onChange={(e) => setSession(e.target.value as any)} className={selectCls}>
                {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </select>
            </div>
            {canManage && (
              <>
                <div className="min-w-[260px] flex-1">
                  <StudentSearchSelect
                    students={students}
                    value={studentId}
                    onChange={setStudentId}
                    label="Add learner to queue"
                    placeholder="Type learner name or admission number…"
                    helper="Required before adding a learner to the meal queue."
                  />
                </div>
                <Button disabled={!studentId || working} onClick={() => action({ action: "joinQueue", studentId, session }, "Added to meal queue")}>Add to queue</Button>
              </>
            )}
          </div>
          {board && <p className="text-xs font-medium text-navy-500">Waiting {board.waiting} · Served {board.served} · Cancelled {board.cancelled}</p>}
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-32 rounded-2xl" /> : !board || board.rows.length === 0 ? (
        <EmptyState icon={Users} title="No one in this meal queue" description="Add learners as they arrive at the serving line." />
      ) : (
        <div className="space-y-2">
          {board.rows.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/10 text-sm font-black text-green-700">#{r.queueNo}</div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-white">{r.studentName}</p>
                    <p className="text-xs text-navy-400">{r.admissionNo}{r.classLabel ? ` · ${r.classLabel}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "SERVED" ? "green" : r.status === "CANCELLED" ? "red" : "amber"}>{r.status.toLowerCase()}</Badge>
                  {canManage && r.status === "WAITING" && (
                    <>
                      <Button size="sm" onClick={() => action({ action: "serveQueue", id: r.id }, "Learner marked served")}>Serve</Button>
                      <Button size="sm" variant="ghost" onClick={() => action({ action: "cancelQueue", id: r.id }, "Queue entry cancelled")}>Cancel</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
