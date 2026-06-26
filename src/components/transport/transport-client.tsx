"use client";

/**
 * B.17 Transport UI — 3 tabs:
 * - Routes: cards (vehicle, driver, riders/seats) -> riders board (assign w/
 *   pickup stop, release) + "Invoice riders" for the term fee
 * - Fleet: vehicles (NTSA insurance/inspection expiry alerts, km/L) ->
 *   vehicle file (maintenance + fuel logs w/ add dialogs)
 * - Drivers: DL records w/ licence-expiry alerts
 * GPS bus tracking = hardware-deferred (notice shown, never faked).
 */
import * as React from "react";
import {
  Bus, Plus, X, Loader2, AlertCircle, ArrowLeft, Users, Banknote, Wrench,
  Fuel, UserMinus, BadgeAlert, MapPin, ShieldAlert,
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

interface RouteRow { id: string; name: string; stops: string[]; termFeeKes: number; vehicle: { id: string; regNo: string; capacity: number } | null; driver: { id: string; fullName: string; phone: string } | null; riders: number; seatsLeft: number | null }
interface DriverRow { id: string; fullName: string; phone: string; licenseNo: string; licenseExpiry: string | null; licenseDaysLeft: number | null; licenseExpiring: boolean; routes: string[] }
interface VehicleRow { id: string; regNo: string; make: string | null; capacity: number; insuranceExpiry: string | null; insuranceExpiring: boolean; inspectionExpiry: string | null; inspectionExpiring: boolean; routes: string[]; lastService: { date: string; type: string } | null; kmPerL: number | null }
interface Rider { id: string; studentId: string; studentName: string; admissionNo: string; pickupStop: string | null }
interface StudentOpt { id: string; name: string; admissionNo: string }

interface AllData { routes: RouteRow[]; drivers: DriverRow[]; vehicles: VehicleRow[] }

export function TransportClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<AllData | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"routes" | "fleet" | "drivers">("routes");
  const [openRoute, setOpenRoute] = React.useState<RouteRow | null>(null);
  const [openVehicle, setOpenVehicle] = React.useState<VehicleRow | null>(null);
  const [dialog, setDialog] = React.useState<"route" | "driver" | "vehicle" | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/transport");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function invoiceRoute(r: RouteRow) {
    const year = new Date().getFullYear();
    const due = new Date(Date.now() + 3 * 3600_000 + 21 * 24 * 3600_000).toISOString().slice(0, 10);
    const res = await fetch("/api/transport", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invoice", routeId: r.id, year, term: 2, dueDate: due }),
    });
    const json = await res.json();
    if (json.ok) toast({ title: `Invoiced ${json.data.created} rider${json.data.created === 1 ? "" : "s"} ${kes(json.data.amountKes)} each (${json.data.skipped} already invoiced)`, tone: "success" });
    else toast({ title: json.error?.message || "Could not invoice", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="grid gap-3 sm:grid-cols-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>;

  if (openRoute) return <RidersBoard route={openRoute} canManage={canManage} onBack={() => { setOpenRoute(null); load(); }} />;
  if (openVehicle) return <VehicleFile vehicle={openVehicle} canManage={canManage} onBack={() => { setOpenVehicle(null); load(); }} />;

  const tabs = [
    { key: "routes" as const, label: "Routes", icon: MapPin },
    { key: "fleet" as const, label: "Fleet", icon: Bus },
    { key: "drivers" as const, label: "Drivers", icon: Users },
  ];

  return (
    <div className="space-y-4">
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

      {tab === "routes" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("route")}><Plus className="h-4 w-4" /> New route</Button>}
          {data.routes.length === 0 ? (
            <EmptyState icon={MapPin} title="No routes yet" description='Create "Route A — Kasarani" with its stops, bus and driver.' action={canManage ? <Button onClick={() => setDialog("route")}><Plus className="h-4 w-4" /> New route</Button> : undefined} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.routes.map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{r.name}</p>
                        <p className="text-xs text-navy-400">
                          {r.vehicle ? r.vehicle.regNo : "no bus"} · {r.driver ? r.driver.fullName : "no driver"}
                          {r.termFeeKes > 0 ? ` · ${kes(r.termFeeKes)}/term` : ""}
                        </p>
                      </div>
                      <Badge tone={r.seatsLeft === null ? "neutral" : r.seatsLeft > 0 ? "green" : "red"}>
                        {r.seatsLeft === null ? `${r.riders} riders` : `${r.seatsLeft} seats left`}
                      </Badge>
                    </div>
                    {r.stops.length > 0 && (
                      <p className="text-xs text-navy-500 dark:text-navy-400">
                        <MapPin className="mr-1 inline h-3 w-3 text-green-600" />
                        {r.stops.join(" → ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setOpenRoute(r)}><Users className="h-3.5 w-3.5" /> Riders</Button>
                      {canManage && r.termFeeKes > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => invoiceRoute(r)}><Banknote className="h-3.5 w-3.5" /> Invoice riders</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "fleet" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("vehicle")}><Plus className="h-4 w-4" /> Add vehicle</Button>}
          {data.vehicles.length === 0 ? (
            <EmptyState icon={Bus} title="No vehicles yet" description="Register the school buses — insurance and NTSA inspection dates give you expiry alerts." action={canManage ? <Button onClick={() => setDialog("vehicle")}><Plus className="h-4 w-4" /> Add vehicle</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.vehicles.map((v) => (
                <Card key={v.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <button onClick={() => setOpenVehicle(v)} className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{v.regNo} {v.make && <span className="font-normal text-navy-400">· {v.make}</span>}</p>
                      <p className="text-xs text-navy-400">
                        {v.capacity} seats{v.routes.length ? ` · ${v.routes.join(", ")}` : ""}
                        {v.lastService ? ` · last ${v.lastService.type.toLowerCase()} ${v.lastService.date}` : ""}
                        {v.kmPerL !== null ? ` · ${v.kmPerL} km/L` : ""}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {v.insuranceExpiring && <Badge tone="red"><ShieldAlert className="h-3 w-3" /> insurance {v.insuranceExpiry}</Badge>}
                      {v.inspectionExpiring && <Badge tone="amber"><BadgeAlert className="h-3 w-3" /> NTSA {v.inspectionExpiry}</Badge>}
                      {!v.insuranceExpiring && !v.inspectionExpiring && <Badge tone="green">compliant</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <p className="text-xs text-navy-400">GPS bus tracking arrives with tracker hardware — flagged for later, never faked.</p>
        </div>
      )}

      {tab === "drivers" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("driver")}><Plus className="h-4 w-4" /> Add driver</Button>}
          {data.drivers.length === 0 ? (
            <EmptyState icon={Users} title="No drivers yet" description="Add drivers with their DL numbers — licence expiry alerts keep you compliant." action={canManage ? <Button onClick={() => setDialog("driver")}><Plus className="h-4 w-4" /> Add driver</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.drivers.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{d.fullName}</p>
                      <p className="text-xs text-navy-400">{d.phone} · DL <span className="font-mono">{d.licenseNo}</span>{d.routes.length ? ` · ${d.routes.join(", ")}` : ""}</p>
                    </div>
                    {d.licenseExpiry && (
                      <Badge tone={d.licenseExpiring ? "red" : "green"}>
                        {d.licenseExpiring ? `DL expires ${d.licenseExpiry}` : `DL valid → ${d.licenseExpiry}`}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog === "route" && <RouteDialog vehicles={data.vehicles} drivers={data.drivers} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "driver" && <DriverDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "vehicle" && <VehicleDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const selectCls = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

function RouteDialog({ vehicles, drivers, onClose, onDone }: { vehicles: VehicleRow[]; drivers: DriverRow[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", stops: "", termFeeKes: "", vehicleId: "", driverId: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addRoute", name: f.name,
          stops: f.stops ? f.stops.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          termFeeKes: Number(f.termFeeKes || 0),
          vehicleId: f.vehicleId || undefined, driverId: f.driverId || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Route created", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not create", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="New route" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Route A — Kasarani" /></div>
        <div><Label>Stops (comma-separated, in order)</Label><Input value={f.stops} onChange={(e) => set("stops", e.target.value)} placeholder="Mwiki, Kasarani Mwiki Rd, Seasons, School" /></div>
        <div><Label>Term fee (KES)</Label><Input type="number" min={0} value={f.termFeeKes} onChange={(e) => set("termFeeKes", e.target.value)} placeholder="e.g. 9000" /></div>
        <div>
          <Label>Bus</Label>
          <select value={f.vehicleId} onChange={(e) => set("vehicleId", e.target.value)} className={selectCls}>
            <option value="">No bus yet…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo} — {v.capacity} seats</option>)}
          </select>
        </div>
        <div>
          <Label>Driver</Label>
          <select value={f.driverId} onChange={(e) => set("driverId", e.target.value)} className={selectCls}>
            <option value="">No driver yet…</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
        <Button onClick={save} disabled={saving || !f.name.trim()} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create route
        </Button>
      </div>
    </Dialog>
  );
}

function DriverDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ fullName: "", phone: "", licenseNo: "", licenseExpiry: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addDriver", fullName: f.fullName, phone: f.phone, licenseNo: f.licenseNo, licenseExpiry: f.licenseExpiry || undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Driver added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not add", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Add a driver" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Omondi Peter" /></div>
        <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07XX XXX XXX" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>DL number</Label><Input value={f.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} placeholder="DL-0001234" /></div>
          <div><Label>DL expiry</Label><Input type="date" value={f.licenseExpiry} onChange={(e) => set("licenseExpiry", e.target.value)} /></div>
        </div>
        <Button onClick={save} disabled={saving || !f.fullName || !f.phone || !f.licenseNo} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add driver
        </Button>
      </div>
    </Dialog>
  );
}

function VehicleDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ regNo: "", make: "", capacity: "33", insuranceExpiry: "", inspectionExpiry: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addVehicle", regNo: f.regNo, make: f.make || undefined, capacity: Number(f.capacity),
          insuranceExpiry: f.insuranceExpiry || undefined, inspectionExpiry: f.inspectionExpiry || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Vehicle registered", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not register", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Add a vehicle" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Registration</Label><Input value={f.regNo} onChange={(e) => set("regNo", e.target.value)} placeholder="KCB 123A" /></div>
          <div><Label>Seats</Label><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
        </div>
        <div><Label>Make</Label><Input value={f.make} onChange={(e) => set("make", e.target.value)} placeholder="Toyota Coaster" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Insurance expiry</Label><Input type="date" value={f.insuranceExpiry} onChange={(e) => set("insuranceExpiry", e.target.value)} /></div>
          <div><Label>NTSA inspection expiry</Label><Input type="date" value={f.inspectionExpiry} onChange={(e) => set("inspectionExpiry", e.target.value)} /></div>
        </div>
        <Button onClick={save} disabled={saving || !f.regNo.trim()} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Register vehicle
        </Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Riders board
// ---------------------------------------------------------------------------

function RidersBoard({ route, canManage, onBack }: { route: RouteRow; canManage: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<{ route: { name: string; stops: string[]; vehicleRegNo: string | null; capacity: number | null; driverName: string | null }; riders: Rider[] } | null>(null);
  const [students, setStudents] = React.useState<StudentOpt[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [studentId, setStudentId] = React.useState("");
  const [pickupStop, setPickupStop] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/transport?riders=${route.id}`);
    const json = await res.json();
    if (json.ok) setData(json.data);
  }, [route.id]);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo,
      })));
    }).catch(() => {});
  }, [load]);

  async function assign() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", routeId: route.id, studentId, pickupStop: pickupStop || undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Added to the route ✓", tone: "success" }); setAdding(false); setStudentId(""); setPickupStop(""); load(); }
      else toast({ title: json.error?.message || "Could not add", tone: "error" });
    } finally { setSaving(false); }
  }

  async function release(id: string, name: string) {
    const res = await fetch("/api/transport", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", assignmentId: id }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${name} removed from the route`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not remove", tone: "error" });
  }

  if (data === null) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
          <ArrowLeft className="h-4 w-4" /> Routes
        </button>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add rider</Button>}
      </div>
      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{data.route.name}</h2>
      <p className="text-xs text-navy-400">
        {data.route.vehicleRegNo ?? "no bus"}{data.route.capacity ? ` (${data.riders?.length ?? data.riders}/${data.route.capacity})` : ""} · {data.route.driverName ?? "no driver"}
        {data.route.stops.length ? ` · ${data.route.stops.join(" → ")}` : ""}
      </p>

      <Card>
        <CardHeader><CardTitle>Riders — {data.riders.length}{data.route.capacity ? `/${data.route.capacity}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {data.riders.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">No riders yet — add the first student.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.riders.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{r.studentName}</p>
                    <p className="text-xs text-navy-400"><span className="font-mono">{r.admissionNo}</span>{r.pickupStop ? ` · picks up at ${r.pickupStop}` : ""}</p>
                  </div>
                  {canManage && (
                    <button onClick={() => release(r.id, r.studentName)} className="rounded-full p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={`Remove ${r.studentName}`}>
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {adding && (
        <Dialog title={`Add rider — ${data.route.name}`} onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <StudentSearchSelect
              students={students}
              value={studentId}
              onChange={setStudentId}
              label="Student"
              placeholder="Type learner name or admission number…"
            />
            {data.route.stops.length > 0 && (
              <div>
                <Label>Pickup stop</Label>
                <select value={pickupStop} onChange={(e) => setPickupStop(e.target.value)} className={selectCls}>
                  <option value="">Pick a stop…</option>
                  {data.route.stops.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <Button onClick={assign} disabled={saving || !studentId} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to route
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicle file (maintenance + fuel)
// ---------------------------------------------------------------------------

interface VFile { vehicle: { id: string; regNo: string; make: string | null; capacity: number }; maintenance: { id: string; date: string; type: string; description: string; costKes: number; garage: string | null; odometerKm: number | null }[]; fuel: { id: string; date: string; litres: number; costKes: number; odometerKm: number | null; station: string | null }[]; totals: { maintenanceKes: number; fuelKes: number; litres: number } }

function VehicleFile({ vehicle, canManage, onBack }: { vehicle: VehicleRow; canManage: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = React.useState<VFile | null>(null);
  const [dialog, setDialog] = React.useState<"maintenance" | "fuel" | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/transport?vehicle=${vehicle.id}`);
    const json = await res.json();
    if (json.ok) setFile(json.data);
  }, [vehicle.id]);
  React.useEffect(() => { load(); }, [load]);

  if (file === null) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
          <ArrowLeft className="h-4 w-4" /> Fleet
        </button>
        {canManage && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setDialog("fuel")}><Fuel className="h-3.5 w-3.5" /> Log fuel</Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("maintenance")}><Wrench className="h-3.5 w-3.5" /> Log maintenance</Button>
          </div>
        )}
      </div>
      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{file.vehicle.regNo} {file.vehicle.make && <span className="text-sm font-normal text-navy-400">· {file.vehicle.make}</span>}</h2>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Fuel total" value={kes(file.totals.fuelKes)} sub={`${file.totals.litres} L`} />
        <Tile label="Maintenance total" value={kes(file.totals.maintenanceKes)} sub={`${file.maintenance.length} entries`} />
        <Tile label="Seats" value={String(file.vehicle.capacity)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Fuel className="h-4 w-4 text-green-600" /> Fuel log</CardTitle></CardHeader>
          <CardContent>
            {file.fuel.length === 0 ? <p className="py-3 text-center text-sm text-navy-400">No fill-ups logged.</p> : (
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {file.fuel.map((fl) => (
                  <li key={fl.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{fl.litres} L · {kes(fl.costKes)}</p>
                      <p className="text-xs text-navy-400">{fl.date}{fl.station ? ` · ${fl.station}` : ""}{fl.odometerKm ? ` · ${fl.odometerKm.toLocaleString()} km` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4 text-navy-400" /> Maintenance log</CardTitle></CardHeader>
          <CardContent>
            {file.maintenance.length === 0 ? <p className="py-3 text-center text-sm text-navy-400">No maintenance logged.</p> : (
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {file.maintenance.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-navy-900 dark:text-navy-50">{m.description}</p>
                      <Badge tone="neutral">{kes(m.costKes)}</Badge>
                    </div>
                    <p className="text-xs text-navy-400">{m.date} · {m.type.toLowerCase()}{m.garage ? ` · ${m.garage}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog === "fuel" && <FuelDialog vehicleId={vehicle.id} onClose={() => setDialog(null)} onDone={() => { setDialog(null); toast({ title: "Fuel logged", tone: "success" }); load(); }} />}
      {dialog === "maintenance" && <MaintenanceDialog vehicleId={vehicle.id} onClose={() => setDialog(null)} onDone={() => { setDialog(null); toast({ title: "Maintenance logged", tone: "success" }); load(); }} />}
    </div>
  );
}

function FuelDialog({ vehicleId, onClose, onDone }: { vehicleId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [f, setF] = React.useState({ date: today, litres: "", costKes: "", odometerKm: "", station: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fuel", vehicleId, date: f.date, litres: Number(f.litres), costKes: Number(f.costKes),
          odometerKm: f.odometerKm ? Number(f.odometerKm) : undefined, station: f.station || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not log", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Log a fill-up" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><Label>Odometer (km)</Label><Input type="number" min={0} value={f.odometerKm} onChange={(e) => set("odometerKm", e.target.value)} placeholder="84500" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Litres</Label><Input type="number" min={0} step="0.1" value={f.litres} onChange={(e) => set("litres", e.target.value)} placeholder="60" /></div>
          <div><Label>Cost (KES)</Label><Input type="number" min={1} value={f.costKes} onChange={(e) => set("costKes", e.target.value)} placeholder="10800" /></div>
        </div>
        <div><Label>Station (optional)</Label><Input value={f.station} onChange={(e) => set("station", e.target.value)} placeholder="Shell Kasarani" /></div>
        <Button onClick={save} disabled={saving || !f.litres || !f.costKes} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fuel className="h-4 w-4" />} Log fill-up
        </Button>
      </div>
    </Dialog>
  );
}

function MaintenanceDialog({ vehicleId, onClose, onDone }: { vehicleId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [f, setF] = React.useState({ date: today, type: "SERVICE", description: "", costKes: "", garage: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "maintenance", vehicleId, date: f.date, type: f.type, description: f.description,
          costKes: Number(f.costKes || 0), garage: f.garage || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not log", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Log maintenance" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div>
            <Label>Type</Label>
            <select value={f.type} onChange={(e) => set("type", e.target.value)} className={selectCls}>
              <option value="SERVICE">Service</option>
              <option value="REPAIR">Repair</option>
              <option value="TYRES">Tyres</option>
              <option value="INSPECTION">Inspection</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div><Label>Description</Label><Input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. 10,000km service — oil + filters" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Cost (KES)</Label><Input type="number" min={0} value={f.costKes} onChange={(e) => set("costKes", e.target.value)} placeholder="18500" /></div>
          <div><Label>Garage (optional)</Label><Input value={f.garage} onChange={(e) => set("garage", e.target.value)} placeholder="Toyota Kenya" /></div>
        </div>
        <Button onClick={save} disabled={saving || !f.description.trim()} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />} Log maintenance
        </Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

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

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-navy-100/70 bg-white px-4 py-3 dark:border-navy-800 dark:bg-navy-900">
      <p className="text-[11px] text-navy-400">{label}</p>
      <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{value}</p>
      {sub && <p className="text-[11px] text-navy-400">{sub}</p>}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}
