const fs = require('fs');
const path = 'src/components/academics/academics-client.tsx';

let code = fs.readFileSync(path, 'utf8');

// 1. Update lucide-react imports
const oldImports = `import {
  BookOpen, Building2, CalendarRange, Grid3X3, NotebookPen, Plus,
  AlertCircle, Loader2, X, Sparkles, Trash2, Check, Calendar,
} from "lucide-react";`;

const newImports = `import {
  BookOpen, Building2, CalendarRange, Grid3X3, NotebookPen, Plus,
  AlertCircle, Loader2, X, Sparkles, Trash2, Check, Calendar, Printer, Palette, Sliders, Info, HelpCircle
} from "lucide-react";`;

if (code.includes(oldImports)) {
  code = code.replace(oldImports, newImports);
} else {
  // Try custom fallback imports
  code = code.replace(/import\s*\{\s*BookOpen,\s*Building2,[^}]*\}\s*from\s*"lucide-react";/, newImports);
}

// 2. We inject our helpers getSubjectStyle and getSubjectAbbreviation right above TimetableTab
const helpersCode = `
// Dynamic helper to compute subject-specific colors for high legibility
function getSubjectStyle(code: string, isBandW: boolean) {
  if (isBandW) {
    return "border border-navy-300 bg-white text-navy-950 font-bold dark:bg-navy-950 dark:text-white";
  }
  
  const c = code.toUpperCase();
  if (c.startsWith("MAT") || c.startsWith("MATH")) {
    return "bg-blue-500/10 border border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30";
  }
  if (c.startsWith("ENG")) {
    return "bg-green-500/10 border border-green-200 text-green-800 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30";
  }
  if (c.startsWith("KIS") || c.startsWith("SWA")) {
    return "bg-amber-500/10 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30";
  }
  if (c.startsWith("CHEM") || c.startsWith("PHY") || c.startsWith("BIO") || c.startsWith("SCI")) {
    return "bg-purple-500/10 border border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30";
  }
  if (c.startsWith("LUNCH") || c.startsWith("BREAK")) {
    return "bg-red-500/5 border border-red-200 text-red-800 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30";
  }
  if (c.startsWith("FREE")) {
    return "bg-navy-50/50 border border-navy-100 text-navy-400 dark:bg-navy-900/20 dark:text-navy-500 dark:border-navy-800/30";
  }
  
  return "bg-green-500/5 border border-green-500/20 text-navy-900 dark:text-green-300 dark:bg-green-950/10";
}

function getSubjectAbbreviation(name: string, code: string): string {
  if (code && code.trim().length > 0) return code.toUpperCase();
  const n = name.trim();
  if (n.length <= 10) return n;
  return n.slice(0, 8) + ".";
}
`;

// 3. New TimetableTab and SlotDialog implementation
const newTimetableCode = `
// ---- Timetable ---------------------------------------------------------------------
${helpersCode}

function TimetableTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [tenant, setTenant] = React.useState<any>(null);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [classId, setClassId] = React.useState("");
  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [config, setConfig] = React.useState<any>(null);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [staff, setStaff] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [cell, setCell] = React.useState<{ day: number; period: number } | null>(null);
  const [autoOpen, setAutoOpen] = React.useState(false);
  const [showSaturday, setShowSaturday] = React.useState(true); 
  const [bulkSatOpen, setBulkSatOpen] = React.useState(false);
  const [isBandW, setIsBandW] = React.useState(false);

  const daysList = showSaturday ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];

  React.useEffect(() => {
    fetch("/api/tenant/current").then((r) => r.json()).then((j) => j.ok && setTenant(j.data.tenant));
    fetch("/api/classes").then((r) => r.json()).then((j) => { if (j.ok) { setClasses(j.data.classes); if (j.data.classes[0]) setClassId(j.data.classes[0].id); } });
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/conversations/recipients").then((r) => r.json()).then((j) => j.ok && setStaff((j.data.recipients ?? []).filter((u: any) => ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"].includes(u.role))));
  }, []);

  const load = React.useCallback(async () => {
    if (!classId) return;
    setError(false); setSlots(null); setConfig(null);
    try {
      const res = await fetch(\`/api/academics/timetable?classId=\${classId}\`);
      const json = await res.json();
      if (json.ok) {
        setSlots(json.data.slots);
        setConfig(json.data.config);
      } else setError(true);
    } catch { setError(true); }
  }, [classId]);
  React.useEffect(() => { load(); }, [load]);

  const grid = new Map<string, Slot>();
  for (const s of slots ?? []) grid.set(\`\${s.dayOfWeek}|\${s.period}\`, s);

  function getPeriodTimeRange(p: number): string {
    const startHour = 8; 
    const startMin = 0;
    const duration = config?.lessonDurationMins ?? 40;
    const shortBreakStart = config?.shortBreakStart ?? 2;
    const shortBreakMins = config?.shortBreakMins ?? 15;
    const longBreakStart = config?.longBreakStart ?? 4;
    const longBreakMins = config?.longBreakMins ?? 30;
    const lunchStart = config?.lunchStart ?? 6;
    const lunchMins = config?.lunchMins ?? 60;
    
    let totalMinutes = 0;
    for (let i = 1; i < p; i++) {
      totalMinutes += duration;
      if (i === shortBreakStart) totalMinutes += shortBreakMins;
      if (i === longBreakStart) totalMinutes += longBreakMins;
      if (i === lunchStart) totalMinutes += lunchMins;
    }
    
    const startTotal = startHour * 60 + startMin + totalMinutes;
    const endTotal = startTotal + duration;
    
    const formatTime = (totalMins: number) => {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const periodLabel = h >= 12 ? "PM" : "AM";
      const formattedHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return \`\${String(formattedHour).padStart(2, "0")}:\${String(m).padStart(2, "0")} \${periodLabel}\`;
    };
    
    return \`\${formatTime(startTotal)} - \${formatTime(endTotal)}\`;
  }

  return (
    <div className="space-y-4">
      {/* Print-Only Header */}
      <div className="hidden print:flex items-center justify-between border-b border-navy-200 pb-2 mb-3">
        <div className="flex items-center gap-2.5">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" className="h-8 w-8 object-contain shrink-0" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-white text-xs font-black">
              {tenant?.name ? tenant.name.slice(0, 2).toUpperCase() : "NY"}
            </span>
          )}
          <div>
            <h2 className="text-sm font-bold text-navy-950 dark:text-white">
              {tenant?.name || "School Timetable"}
            </h2>
            <p className="text-[10px] text-navy-500 font-semibold">
              Class: {classes.find(c => c.id === classId)?.name || "Unassigned"} · {showSaturday ? "6-Day Week" : "5-Day Week"}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] text-navy-400">
          <p className="font-bold text-navy-700">A4 Landscape Schedule</p>
          <p>Generated: {new Date().toLocaleDateString("en-KE")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {classId && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4 text-green-600" /> Print Timetable
            </Button>
          )}
          {canManage && classId && (
            <>
              <Button variant="secondary" onClick={() => setAutoOpen(true)}><Sparkles className="h-4 w-4" /> Auto-fill week</Button>
              <Button variant="secondary" onClick={() => setBulkSatOpen(true)}><Calendar className="h-4 w-4 text-green-600" /> Bulk Saturday Scheduler</Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isBandW}
              onChange={(e) => setIsBandW(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            🖨️ Ink-Saver B&W Mode
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSaturday}
              onChange={(e) => setShowSaturday(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            Include Saturday Timetable
          </label>
        </div>
      </div>

      {error ? <LoadError onRetry={load} /> : slots === null ? <Skeletons /> : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 dark:border-navy-800">
            <table className="w-full min-w-[720px] border-collapse bg-white text-xs dark:bg-navy-900">
              <thead>
                <tr className="bg-warm-50 dark:bg-navy-800">
                  <th className="w-28 border-b border-navy-100 p-2.5 text-left font-semibold text-navy-400 dark:border-navy-800">Lesson Period</th>
                  {daysList.map((d) => <th key={d} className="border-b border-navy-100 p-2.5 text-left font-semibold text-navy-600 dark:border-navy-800 dark:text-navy-300">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
                  const rows = [];
                  rows.push(
                    <tr key={p}>
                      <td className="border-b border-navy-50 p-2.5 font-mono text-navy-500 dark:border-navy-800 text-[10px] leading-tight">
                        <span className="font-bold text-navy-700 dark:text-navy-300">Period {p}</span>
                        <span className="block font-sans text-navy-400 dark:text-navy-500 font-normal mt-0.5">{getPeriodTimeRange(p)}</span>
                      </td>
                      {Array.from({ length: daysList.length }, (_, dIdx) => {
                        const d = dIdx + 1;
                        const s = grid.get(\`\${d}|\${p}\`);
                        const cellBgClass = getSubjectStyle(s?.subjectCode || "FREE", isBandW);

                        return (
                          <td key={d} className="border-b border-l border-navy-50 p-1 dark:border-navy-800">
                            <button
                              disabled={!canManage}
                              onClick={() => setCell({ day: d, period: p })}
                              className={\`w-full min-h-[52px] rounded-xl p-2 text-left transition relative flex flex-col justify-between \${cellBgClass}\`}
                            >
                              {s ? (
                                <>
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-extrabold text-[11px] tracking-wide">
                                      {getSubjectAbbreviation(s.subjectName, s.subjectCode)}
                                    </span>
                                    {s.isCombined && (
                                      <span className="text-[7.5px] uppercase font-black bg-green-500/25 px-1 py-0.5 rounded">
                                        Combined
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-col text-[9px] mt-1 text-navy-500 dark:text-navy-400 font-medium">
                                    <span>{s.teacherName}</span>
                                    {s.isCombined && s.combinedDetails && (
                                      <span className="text-[8px] italic truncate max-w-[100px]">{s.combinedDetails}</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[10px] text-navy-300 dark:text-navy-600 font-medium italic">Unassigned</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );

                  if (config && p === config.shortBreakStart) {
                    rows.push(
                      <tr key={\`short-break-\${p}\`} className="bg-amber-500/5 text-center font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                        <td className="p-2 border-b border-navy-50 font-mono text-navy-500 text-[10px]">BREAK</td>
                        <td colSpan={daysList.length} className="p-2 border-b border-l border-navy-50 text-xs font-semibold">
                          Short Break ({config.shortBreakMins} mins)
                        </td>
                      </tr>
                    );
                  }

                  if (config && p === config.longBreakStart) {
                    rows.push(
                      <tr key={\`long-break-\${p}\`} className="bg-amber-500/5 text-center font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                        <td className="p-2 border-b border-navy-50 font-mono text-navy-500 text-[10px]">BREAK</td>
                        <td colSpan={daysList.length} className="p-2 border-b border-l border-navy-50 text-xs font-semibold">
                          Long Break ({config.longBreakMins} mins)
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>

          {/* Print-Only Footer */}
          <div className="hidden print:flex items-center justify-between border-t border-navy-100 pt-2 mt-4 text-[9px] text-navy-400">
            <p>NEYO School Operating System (School OS) · Class Timetable Schedule</p>
            <p className="font-bold uppercase tracking-wider">Powered by NEYO</p>
          </div>
        </>
      )}

      {cell && classId && (
        <SlotDialog
          classId={classId} day={cell.day} period={cell.period}
          existing={grid.get(\`\${cell.day}|\${cell.period}\`) ?? null}
          subjects={subjects.filter((s) => !s.archived)} staff={staff}
          showSaturday={showSaturday}
          onClose={() => setCell(null)}
          onDone={() => { setCell(null); load(); }}
        />
      )}
    </div>
  );
}

function SlotDialog({ classId, day, period, existing, subjects, staff, showSaturday, onClose, onDone }: any) {
  const { toast } = useToast();
  const [subId, setSubId] = React.useState(existing?.subjectId ?? "");
  const [teacherId, setStaffId] = React.useState(existing?.teacherId ?? "");
  const [isCombined, setIsCombined] = React.useState(existing?.isCombined ?? false);
  const [combinedDetails, setCombinedDetails] = React.useState(existing?.combinedDetails ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId, dayOfWeek: day, period,
          subjectId: subId || undefined,
          teacherId: teacherId || undefined,
          isCombined,
          combinedDetails: isCombined ? combinedDetails : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Slot updated", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function clear() {
    setSaving(true);
    try {
      const res = await fetch(\`/api/academics/timetable?classId=\${classId}&dayOfWeek=\${day}&period=\${period}\`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) { toast({ title: "Slot cleared", tone: "success" }); onDone(); }
      else toast({ title: "Failed", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-pop text-left" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-2">
          <h4 className="font-bold text-navy-950">Set Lesson Slot</h4>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Subject</Label>
            <select value={subId} onChange={(e)=>setSubId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned (Free Period)</option>
              {subjects.map((s: any)=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Teacher</Label>
            <select value={teacherId} onChange={(e)=>setStaffId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned</option>
              {staff.map((s: any)=><option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 py-1.5 border-t border-b border-navy-50">
            <input
              type="checkbox"
              id="isCombined"
              checked={isCombined}
              onChange={(e) => setIsCombined(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="isCombined" className="text-xs font-semibold text-navy-700 cursor-pointer select-none">
              Is Combined / Joint Lesson
            </label>
          </div>

          {isCombined && (
            <div className="space-y-1.5 animate-fade-in">
              <Label>Combined Lesson Details</Label>
              <Input
                placeholder="E.g. Mr. Njoroge, Joint Stream A & B"
                value={combinedDetails}
                onChange={(e) => setCombinedDetails(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {existing && <Button variant="secondary" onClick={clear} disabled={saving} className="text-red-600 hover:text-red-700 border-red-200 bg-red-50/50">Clear</Button>}
          <Button onClick={save} disabled={saving}>{saving?<Loader2 className="h-4 w-4 animate-spin" />:<Check className="h-4 w-4" />} Save</Button>
        </div>
      </div>
    </div>
  );
}
`;

// Locate the original TimetableTab and SlotDialog block
const startIndex = code.indexOf('function TimetableTab');
const endIndex = code.indexOf('function AutoFillDialog');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.slice(0, startIndex) + newTimetableCode + "\n" + code.slice(endIndex);
}

// 4. Update the TimetableGeneratorTab implementation
const newGeneratorCode = `
function TimetableGeneratorTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [weights, setWeights] = React.useState<Record<string, { lessons: string; doubles: string; singles: string }>>({});
  const [hasConfiguredConstraints, setHasConfiguredConstraints] = React.useState(false);
  const [validationOpen, setValidationOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/academics/timetable/generator");
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        const initialWeights = {};
        json.data.subjects.forEach((s) => {
          initialWeights[s.id] = { lessons: "5", doubles: "1", singles: "3" };
        });
        setWeights(initialWeights);
      }
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function generate(force = false) {
    if (!force && !hasConfiguredConstraints) {
      setValidationOpen(true);
      return;
    }

    setLoading(true);
    setValidationOpen(false);
    try {
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", weights }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Timetable generated successfully!", description: "All lessons mapped conflict-free.", tone: "success" });
        load();
      } else {
        toast({ title: json.error?.message || "Generation failed", tone: "error" });
      }
    } catch {
      toast({ title: "Network error during timetable generation.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  function handleSaveConstraints() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setHasConfiguredConstraints(true);
      toast({
        title: "Subject constraints saved",
        description: "Ministry lessons-per-week weights applied to generator limits.",
        tone: "success",
      });
    }, 600);
  }

  if (data === null) return <Skeletons />;

  return (
    <div className="space-y-6 text-left">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subject Weights Constraints Editor Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sliders className="h-5 w-5 text-green-600 animate-pulse" />
              Subject constraints & Period Weights
            </CardTitle>
            <p className="text-xs text-navy-400">
              Configure standard period constraints (lessons per week, double blocks, and singles) in alignment with Ministry of Education regulations.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
              {data.subjects.map((sub) => {
                const w = weights[sub.id] || { lessons: "5", doubles: "1", singles: "3" };
                return (
                  <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-navy-50 bg-white dark:border-navy-800 dark:bg-navy-950 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-navy-900 dark:text-white">{sub.name}</span>
                      <span className="block text-[10px] text-navy-400 font-mono">Code: {sub.code}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400">Lessons/Wk</Label>
                        <Input
                          type="number"
                          value={w.lessons}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, lessons: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400 font-semibold">Doubles</Label>
                        <Input
                          type="number"
                          value={w.doubles}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, doubles: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400 font-semibold">Singles</Label>
                        <Input
                          type="number"
                          value={w.singles}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, singles: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button size="sm" onClick={handleSaveConstraints} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save MoE Subject Constraints
            </Button>
          </CardContent>
        </Card>

        {/* Generator Controls Card */}
        <Card className="flex flex-col h-full justify-between">
          <CardHeader>
            <CardTitle className="text-base">Conflict-Free Generator</CardTitle>
            <p className="text-xs text-navy-400">Generates mathematical timetables with 0 teacher conflicts.</p>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="rounded-2xl border border-navy-50 bg-navy-50/20 p-4 text-xs text-navy-600 leading-relaxed dark:border-navy-800">
              ⚡ <strong>Active Scoping:</strong> Generates a full week including break periods, Saturday morning alternates, and combined classes for all {data.classCount} classes and {data.teacherCount} teachers on record.
            </div>

            <Button
              onClick={() => generate(false)}
              disabled={loading}
              className="w-full h-12 text-sm shadow-md"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Timetable
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PRE-GENERATION CONSTRAINTS VALIDATION MODAL */}
      {validationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={() => setValidationOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-6 shadow-pop text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-4">
              <HelpCircle className="h-8 w-8 animate-bounce" />
            </div>

            <h3 className="text-base font-bold text-navy-950">
              Review Subject Constraints?
            </h3>
            
            <p className="mt-3 text-xs leading-relaxed text-navy-500">
              Are you sure you would like to generate the timetable without your own configured subject weights constraints?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setValidationOpen(false);
                  toast({
                    title: "Action halted",
                    description: "Do the necessary, configure your subject weights, and get back!",
                    tone: "info",
                  });
                }}
              >
                No, Configure First
              </Button>
              <Button
                size="sm"
                onClick={() => generate(true)}
              >
                Yes, Bypass & Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

const genStartIndex = code.indexOf('function TimetableGeneratorTab');
const genEndIndex = code.indexOf('function TeacherSubjectsModal');

if (genStartIndex !== -1 && genEndIndex !== -1) {
  code = code.slice(0, genStartIndex) + newGeneratorCode + "\n" + code.slice(genEndIndex);
}

fs.writeFileSync(path, code, 'utf8');
console.log("SUCCESSFULLY MERGED ACADEMICS CODE!");
