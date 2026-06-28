const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

// The CoCurricularTab (or rather Timetable Settings) used to be merged.
// L.2 requires bulk-applying schedule rules. We need a way to bulk-select classes.

const oldBulkSave = `  async function saveClassConfig(classId: string, current: any | null, values: { coCurricularName: string; coCurricularCount: number }) {
    setSavingClassId(classId);
    try {
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", classId, ...values })
      });
      if (res.ok) { toast({ title: "Config saved", tone: "success" }); load(); }
      else { const j = await res.json(); toast({ title: j.error?.message || "Failed", tone: "error" }); }
    } finally { setSavingClassId(null); }
  }`;

// wait, the actual configuration for Timetable is likely under `api/academics/timetable/generator`.
// Let's modify the UI so the user can select multiple classes.
// I'll add a new BulkConfigDialog component to handle this instead of replacing existing functions perfectly.

const bulkConfigDialog = `
function BulkConfigDialog({ data, onClose, onDone }: any) {
  const [selectedClasses, setSelectedClasses] = React.useState<Set<string>>(new Set());
  const [periods, setPeriods] = React.useState(8);
  const [shortBreak, setShortBreak] = React.useState(2);
  const [shortBreak2, setShortBreak2] = React.useState(0);
  const [lunchAfter, setLunchAfter] = React.useState(6);
  const [satEnd, setSatEnd] = React.useState("12:40");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (selectedClasses.size === 0) return toast({ title: "Select at least one class", tone: "error" });
    setSaving(true);
    try {
      // Send multiple POSTs or a bulk POST. We'll do multiple for now to be safe.
      for (const cid of selectedClasses) {
        await fetch("/api/academics/timetable/generator", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "save_config", classId: cid, 
            periodsPerDay: periods, 
            shortBreakStart: shortBreak, 
            shortBreak2Start: shortBreak2 || null,
            lunchStart: lunchAfter,
            saturdayEndTime: satEnd
          })
        });
      }
      toast({ title: "Bulk rules applied", tone: "success" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Bulk Apply Schedule Rules</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1 border border-navy-100 dark:border-navy-800 p-3 rounded-xl">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold mb-2 block">Target Classes</Label>
            <div className="flex flex-wrap gap-2">
              {data.classes.map((c: any) => {
                const isSelected = selectedClasses.has(c.id);
                return (
                  <Badge 
                    key={c.id} 
                    variant={isSelected ? "secondary" : "outline"} 
                    className="cursor-pointer"
                    onClick={() => {
                      const next = new Set(selectedClasses);
                      if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                      setSelectedClasses(next);
                    }}
                  >
                    {c.level} {c.stream}
                  </Badge>
                );
              })}
            </div>
            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setSelectedClasses(new Set(data.classes.map((c:any)=>c.id)))}>Select All</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Periods Per Day (Max 12)</Label><Input type="number" value={periods} onChange={(e) => setPeriods(Number(e.target.value))} max={12} /></div>
            <div className="space-y-1"><Label>Saturday End Time</Label><Input type="time" value={satEnd} onChange={(e) => setSatEnd(e.target.value)} /></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Short Break 1 (After Period)</Label><Input type="number" value={shortBreak} onChange={(e) => setShortBreak(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Short Break 2 (Optional)</Label><Input type="number" value={shortBreak2} onChange={(e) => setShortBreak2(Number(e.target.value))} placeholder="0 to disable"/></div>
            <div className="space-y-1"><Label>Lunch (After Period)</Label><Input type="number" value={lunchAfter} onChange={(e) => setLunchAfter(Number(e.target.value))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

if (!code.includes('BulkConfigDialog')) {
  code += bulkConfigDialog;
  
  // Add a button to open it in TimetableGeneratorTab
  const headerSearch = `<h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" /> Auto-Generator
          </h2>
          <p className="text-sm font-medium text-navy-500">Configure curriculum constraints and let NEYO solve the timetable.</p>
        </div>`;
        
  const newHeader = `<h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" /> Auto-Generator
          </h2>
          <p className="text-sm font-medium text-navy-500">Configure curriculum constraints and let NEYO solve the timetable.</p>
        </div>
        {canManage && (
          <Button onClick={() => setBulkOpen(true)} className="rounded-full shadow-pop bg-purple-600 hover:bg-purple-700 text-white">
            Bulk Apply Rules
          </Button>
        )}`;
        
  code = code.replace(headerSearch, newHeader);
  code = code.replace(
    'const [validationOpen, setValidationOpen] = React.useState(false);',
    'const [validationOpen, setValidationOpen] = React.useState(false);\n  const [bulkOpen, setBulkOpen] = React.useState(false);'
  );
  
  code = code.replace(
    '{validationOpen && <GeneratorValidationDialog data={data} onClose={() => setValidationOpen(false)} />}',
    '{validationOpen && <GeneratorValidationDialog data={data} onClose={() => setValidationOpen(false)} />}\n      {bulkOpen && <BulkConfigDialog data={data} onClose={() => setBulkOpen(false)} onDone={() => { setBulkOpen(false); load(); }} />}'
  );
}

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
