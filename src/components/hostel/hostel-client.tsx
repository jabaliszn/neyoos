"use client";

/**
 * B.16 Hostel UI — 3 tabs:
 * - Dorms: hostel cards (occupancy) -> room/bed board, allocate/release beds,
 *   add hostel/room, "Invoice boarders" for the term's boarding fee
 * - Curfew: pick hostel + tonight -> one-tap IN/OUT/LEAVE per boarder; OUT
 *   triggers an URGENT guardian SMS automatically
 * All 4 UX states. Mobile-first (housemasters mark curfew on phones).
 */
import * as React from "react";
import {
  BedDouble, Plus, X, Loader2, AlertCircle, ArrowLeft, Users, Banknote,
  MoonStar, CheckCircle2, DoorOpen, UserMinus,
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

interface HostelRow { id: string; name: string; gender: string; masterName: string | null; boardingFeeKes: number; rooms: number; beds: number; occupied: number; free: number }
interface Bed { bedNo: number; allocationId: string | null; studentId: string | null; studentName: string | null; admissionNo: string | null }
interface Board { hostel: { id: string; name: string; gender: string; boardingFeeKes: number }; rooms: { id: string; name: string; capacity: number; beds: Bed[] }[] }
interface Boarder { studentId: string; studentName: string; admissionNo: string; room: string; bedNo: number; status: string | null; note: string | null }
interface StudentOpt { id: string; name: string; admissionNo: string; gender: string }

const GENDER_LABEL: Record<string, string> = { BOYS: "Boys", GIRLS: "Girls", MIXED: "Mixed" };

export function HostelClient({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = React.useState<"dorms" | "curfew">("dorms");
  const tabs = [
    { key: "dorms" as const, label: "Dorms & beds", icon: BedDouble },
    { key: "curfew" as const, label: "Curfew register", icon: MoonStar },
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
      {tab === "dorms" && <DormsTab canManage={canManage} />}
      {tab === "curfew" && <CurfewTab canManage={canManage} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dorms & beds
// ---------------------------------------------------------------------------

function DormsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [hostels, setHostels] = React.useState<HostelRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState<HostelRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/hostel");
      const json = await res.json();
      if (json.ok) setHostels(json.data.hostels); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function invoiceTerm(h: HostelRow) {
    const year = new Date().getFullYear();
    const due = new Date(Date.now() + 3 * 3600_000 + 21 * 24 * 3600_000).toISOString().slice(0, 10);
    const res = await fetch("/api/hostel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invoice", hostelId: h.id, year, term: 2, dueDate: due }),
    });
    const json = await res.json();
    if (json.ok) toast({ title: `Invoiced ${json.data.created} boarder${json.data.created === 1 ? "" : "s"} ${kes(json.data.amountKes)} each (${json.data.skipped} already invoiced)`, tone: "success" });
    else toast({ title: json.error?.message || "Could not invoice", tone: "error" });
  }

  if (open) return <RoomBoard hostel={open} canManage={canManage} onBack={() => { setOpen(null); load(); }} />;
  if (error) return <LoadError onRetry={load} />;
  if (hostels === null) return <div className="grid gap-3 sm:grid-cols-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-3">
      {canManage && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New hostel</Button>}
      {hostels.length === 0 ? (
        <EmptyState icon={BedDouble} title="No hostels yet" description="Register your first dorm — Simba House, Chui House — then add rooms and beds." action={canManage ? <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New hostel</Button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hostels.map((h) => (
            <Card key={h.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{h.name}</p>
                    <p className="text-xs text-navy-400">{GENDER_LABEL[h.gender] ?? h.gender} · {h.rooms} rooms{h.masterName ? ` · ${h.masterName}` : ""}</p>
                  </div>
                  <Badge tone={h.free > 0 ? "green" : "red"}>{h.free} free</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                  <div className="h-full rounded-full bg-green-600" style={{ width: h.beds ? `${Math.round((h.occupied / h.beds) * 100)}%` : "0%" }} />
                </div>
                <p className="text-xs text-navy-400">{h.occupied}/{h.beds} beds occupied · boarding {h.boardingFeeKes > 0 ? `${kes(h.boardingFeeKes)}/term` : "fee not set"}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setOpen(h)}><DoorOpen className="h-3.5 w-3.5" /> Rooms & beds</Button>
                  {canManage && h.boardingFeeKes > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => invoiceTerm(h)}><Banknote className="h-3.5 w-3.5" /> Invoice boarders</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {adding && <AddHostelDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddHostelDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", gender: "BOYS", boardingFeeKes: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addHostel", name: f.name, gender: f.gender, boardingFeeKes: Number(f.boardingFeeKes || 0) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Hostel registered", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not add", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Register a hostel</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Simba House" /></div>
          <div>
            <Label>Gender</Label>
            <select value={f.gender} onChange={(e) => set("gender", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
              <option value="BOYS">Boys</option>
              <option value="GIRLS">Girls</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <div><Label>Boarding fee per term (KES)</Label><Input type="number" min={0} value={f.boardingFeeKes} onChange={(e) => set("boardingFeeKes", e.target.value)} placeholder="e.g. 15000" /></div>
          <Button onClick={save} disabled={saving || !f.name.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Register hostel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Room / bed board
// ---------------------------------------------------------------------------

function RoomBoard({ hostel, canManage, onBack }: { hostel: HostelRow; canManage: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<Board | null>(null);
  const [students, setStudents] = React.useState<StudentOpt[]>([]);
  const [allocating, setAllocating] = React.useState<{ roomId: string; roomName: string; bedNo: number } | null>(null);
  const [addingRoom, setAddingRoom] = React.useState(false);
  const [autoAllocOpen, setAutoAllocOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/hostel?board=${hostel.id}`);
    const json = await res.json();
    if (json.ok) setBoard(json.data);
  }, [hostel.id]);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string; gender: string }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo, gender: s.gender,
      })));
    }).catch(() => {});
  }, [load]);

  async function release(allocationId: string, name: string) {
    const res = await fetch("/api/hostel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", allocationId }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${name}'s bed released`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not release", tone: "error" });
  }

  if (board === null) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
          <ArrowLeft className="h-4 w-4" /> Hostels
        </button>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAutoAllocOpen(true)}>
              <MoonStar className="h-3.5 w-3.5 text-green-600" /> Auto-Allocate Beds
            </Button>
            <Button size="sm" onClick={() => setAddingRoom(true)}><Plus className="h-3.5 w-3.5" /> Add room</Button>
          </div>
        )}
      </div>
      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{board.hostel.name} <span className="text-sm font-normal text-navy-400">· {GENDER_LABEL[board.hostel.gender]}</span></h2>

      {board.rooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="No rooms yet" description="Add rooms with their bed counts to start allocating." action={canManage ? <Button onClick={() => setAddingRoom(true)}><Plus className="h-4 w-4" /> Add room</Button> : undefined} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {board.rooms.map((r) => (
            <Card key={r.id}>
              <CardHeader><CardTitle className="flex items-center justify-between text-sm">{r.name} <span className="text-xs font-normal text-navy-400">{r.beds.filter((b) => b.allocationId).length}/{r.capacity} beds</span></CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {r.beds.map((b) => (
                    <li key={b.bedNo} className="flex items-center justify-between gap-2 rounded-xl bg-warm-50 px-3 py-2 text-sm dark:bg-navy-800">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-navy-400">Bed {b.bedNo}</span>
                        {b.studentName ? (
                          <span className="font-medium text-navy-900 dark:text-navy-50">{b.studentName} <span className="font-mono text-xs text-navy-400">{b.admissionNo}</span></span>
                        ) : (
                          <span className="text-navy-300 dark:text-navy-500">empty</span>
                        )}
                      </span>
                      {canManage && (b.allocationId ? (
                        <button onClick={() => release(b.allocationId!, b.studentName!)} className="rounded-full p-1 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={`Release bed ${b.bedNo}`}>
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setAllocating({ roomId: r.id, roomName: r.name, bedNo: b.bedNo })}>Allocate</Button>
                      ))}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {allocating && (
        <AllocateDialog
          target={allocating}
          students={students}
          hostelGender={board.hostel.gender}
          onClose={() => setAllocating(null)}
          onDone={() => { setAllocating(null); load(); }}
        />
      )}
      {addingRoom && <AddRoomDialog hostelId={hostel.id} onClose={() => setAddingRoom(false)} onDone={() => { setAddingRoom(false); load(); }} />}
      {autoAllocOpen && (
        <AutoAllocateDormDialog
          hostelId={hostel.id}
          onClose={() => setAutoAllocOpen(false)}
          onDone={(msg) => { setAutoAllocOpen(false); toast({ title: msg, tone: "success" }); load(); }}
        />
      )}
    </div>
  );
}

function AllocateDialog({ target, students, hostelGender, onClose, onDone }: {
  target: { roomId: string; roomName: string; bedNo: number };
  students: StudentOpt[]; hostelGender: string;
  onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [studentId, setStudentId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const eligible = hostelGender === "BOYS" ? students.filter((s) => s.gender === "M")
    : hostelGender === "GIRLS" ? students.filter((s) => s.gender === "F") : students;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "allocate", roomId: target.roomId, studentId, bedNo: target.bedNo }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Bed allocated ✓", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not allocate", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{target.roomName} — Bed {target.bedNo}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <StudentSearchSelect
              students={eligible}
              value={studentId}
              onChange={setStudentId}
              label="Student"
              placeholder="Type learner name or admission number…"
            />
            {hostelGender !== "MIXED" && <p className="mt-1 text-xs text-navy-400">Only {hostelGender === "BOYS" ? "boys" : "girls"} are listed for this hostel.</p>}
          </div>
          <Button onClick={save} disabled={saving || !studentId} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BedDouble className="h-4 w-4" />} Allocate bed
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddRoomDialog({ hostelId, onClose, onDone }: { hostelId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("4");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addRoom", hostelId, name, capacity: Number(capacity) }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Room added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not add", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Add a room</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Room name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 4" /></div>
          <div><Label>Beds</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          <Button onClick={save} disabled={saving || !name.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add room
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Auto-Allocate Dorm Placement Engine Modal (Chunk D — Part 1) ------------------
function AutoAllocateDormDialog({ hostelId, onClose, onDone }: { hostelId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { toast } = useToast();
  const [strategy, setStrategy] = React.useState<"FORM" | "MIXED">("FORM");
  const [saving, setSaving] = React.useState(false);

  async function run() {
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autoAllocate", hostelId, strategy }),
      });
      const json = await res.json();
      if (json.ok) {
        onDone(
          `Successfully allocated ${json.data.allocatedCount} beds! ${
            json.data.totalUnallocatedLeft > 0 
              ? `${json.data.totalUnallocatedLeft} boarders left unassigned.` 
              : "All boarders assigned!"
          }`
        );
      } else {
        toast({ title: json.error?.message || "Allocation failed.", tone: "error" });
      }
    } catch {
      toast({ title: "Failed to connect to allocation engine.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-navy-900 border border-navy-100 dark:border-navy-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-navy-900 dark:text-navy-50">Auto-Allocate Beds</h3>
            <p className="text-xs text-navy-400">Run the automatic dorm placement solver for this hostel.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-green-200/50 bg-green-500/5 p-4 text-xs">
            <p className="font-bold text-green-700 dark:text-green-300">Intelligent Safety Rules Enabled:</p>
            <p className="mt-1 text-navy-500 dark:text-navy-400">① Checks and strictly blocks Day Scholars (DAY boardingType) from allocation.</p>
            <p className="text-navy-500 dark:text-navy-400">② Validates student gender against the hostel's allowed gender (Boys / Girls / Mixed).</p>
          </div>

          <div className="space-y-2">
            <Label>Placement Strategy</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setStrategy("FORM")}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ease-apple ${
                  strategy === "FORM"
                    ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-navy-100 hover:bg-navy-50 dark:border-navy-800 dark:bg-navy-950"
                }`}
              >
                <p className="font-bold text-sm">Form-Based</p>
                <p className="text-[10px] text-navy-400 mt-0.5">Group same-level classes together (sleep with peers).</p>
              </button>

              <button
                onClick={() => setStrategy("MIXED")}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ease-apple ${
                  strategy === "MIXED"
                    ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-navy-100 hover:bg-navy-50 dark:border-navy-800 dark:bg-navy-950"
                }`}
              >
                <p className="font-bold text-sm">Mixed Levels</p>
                <p className="text-[10px] text-navy-400 mt-0.5">Distribute sequentially (mentorship/mix streams).</p>
              </button>
            </div>
          </div>

          <Button onClick={run} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BedDouble className="h-4 w-4" />} Run Placement Solver
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curfew register
// ---------------------------------------------------------------------------

function CurfewTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [hostels, setHostels] = React.useState<HostelRow[]>([]);
  const [hostelId, setHostelId] = React.useState("");
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [date, setDate] = React.useState(today);
  const [boarders, setBoarders] = React.useState<Boarder[] | null>(null);
  const [marks, setMarks] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/hostel").then((r) => r.json()).then((j) => {
      if (j.ok) { setHostels(j.data.hostels); if (j.data.hostels.length) setHostelId((p: string) => p || j.data.hostels[0].id); }
    }).catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    if (!hostelId) return;
    setBoarders(null);
    const res = await fetch(`/api/hostel?curfew=${hostelId}&date=${date}`);
    const json = await res.json();
    if (json.ok) {
      setBoarders(json.data.boarders);
      const m: Record<string, string> = {};
      for (const b of json.data.boarders) if (b.status) m[b.studentId] = b.status;
      setMarks(m);
    }
  }, [hostelId, date]);
  React.useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "curfew", hostelId, date,
          marks: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: json.data.out > 0
            ? `Saved — ${json.data.out} MISSING, ${json.data.smsSent} guardian SMS sent`
            : "Curfew saved — all in ✓",
          tone: json.data.out > 0 ? "error" : "success",
        });
        load();
      } else toast({ title: json.error?.message || "Could not save", tone: "error" });
    } finally { setSaving(false); }
  }

  const STATUS: { key: string; label: string; tone: string }[] = [
    { key: "IN", label: "In", tone: "bg-green-600 text-white" },
    { key: "OUT", label: "Out", tone: "bg-red-600 text-white" },
    { key: "LEAVE", label: "Leave", tone: "bg-amber-500 text-white" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>

      {boarders === null ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : boarders.length === 0 ? (
        <EmptyState icon={Users} title="No boarders" description="Allocate beds in this hostel first — the curfew list builds itself." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MoonStar className="h-4 w-4 text-navy-400" /> Curfew — {date}</CardTitle>
            <p className="mt-1 text-xs text-navy-400">Mark each boarder. &quot;Out&quot; sends an URGENT SMS to the guardian immediately.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {boarders.map((b) => (
                <li key={b.studentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{b.studentName}</p>
                    <p className="text-xs text-navy-400">{b.room} · Bed {b.bedNo} · <span className="font-mono">{b.admissionNo}</span></p>
                  </div>
                  <div className="flex gap-1">
                    {STATUS.map((s) => (
                      <button
                        key={s.key}
                        disabled={!canManage}
                        onClick={() => setMarks((p) => ({ ...p, [b.studentId]: s.key }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 ease-apple disabled:opacity-60 ${
                          marks[b.studentId] === s.key ? s.tone : "bg-navy-100 text-navy-500 hover:bg-navy-200 dark:bg-navy-800 dark:text-navy-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {canManage && (
              <Button onClick={save} disabled={saving || Object.keys(marks).length === 0} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save register ({Object.keys(marks).length}/{boarders.length} marked)
              </Button>
            )}
          </CardContent>
        </Card>
      )}
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
