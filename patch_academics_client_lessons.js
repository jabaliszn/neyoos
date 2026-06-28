const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const oldLessonDialogStart = `function LessonPlanDialog({ subjects, classes, onClose, onDone }: any) {
  const { toast } = useToast();
  const [subId, setSubId] = React.useState(subjects[0]?.id ?? "");
  const [clsId, setClsId] = React.useState(classes[0]?.id ?? "");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = React.useState("");
  const [obj, setObj] = React.useState("");
  const [act, setAct] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);`;

const newLessonDialogStart = `function LessonPlanDialog({ subjects, classes, onClose, onDone }: any) {
  const { toast } = useToast();
  const [subId, setSubId] = React.useState(subjects[0]?.id ?? "");
  const [clsId, setClsId] = React.useState(classes[0]?.id ?? "");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = React.useState("");
  const [obj, setObj] = React.useState("");
  const [act, setAct] = React.useState("");
  const [notes, setNotes] = React.useState("");
  
  // J.12 Curriculum Links
  const [strandId, setStrandId] = React.useState("");
  const [competencyId, setCompetencyId] = React.useState("");
  const [strands, setStrands] = React.useState<any[]>([]);
  const [competencies, setCompetencies] = React.useState<any[]>([]);

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!subId) return;
    fetch(\`/api/curriculum/strands?subjectId=\${subId}\`).then(r => r.json()).then(j => j.ok && setStrands(j.data || []));
    fetch(\`/api/competencies?subjectId=\${subId}\`).then(r => r.json()).then(j => j.ok && setCompetencies(j.data || []));
  }, [subId]);
`;

code = code.replace(oldLessonDialogStart, newLessonDialogStart);

const oldLessonSave = `      const res = await fetch("/api/academics/lesson-plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: subId, classId: clsId, date, topic, objectives: obj, activities: act, notes }),
      });`;

const newLessonSave = `      const res = await fetch("/api/academics/lesson-plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subjectId: subId, classId: clsId, date, topic, 
          objectives: obj, activities: act, notes,
          strandId: strandId || undefined,
          competencyId: competencyId || undefined,
        }),
      });`;

code = code.replace(oldLessonSave, newLessonSave);

const oldLessonJSX = `          <div className="space-y-1"><Label>Topic / Title</Label><Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="e.g. Parts of a flower" /></div>
          <div className="space-y-1"><Label>Objectives</Label><Input value={obj} onChange={(e)=>setObj(e.target.value)} placeholder="By the end of the lesson..." /></div>
          <div className="space-y-1"><Label>Activities</Label><Input value={act} onChange={(e)=>setAct(e.target.value)} placeholder="Group discussion, drawing..." /></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="..." /></div>`;

const newLessonJSX = `          <div className="space-y-1"><Label>Topic / Title</Label><Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="e.g. Parts of a flower" /></div>
          
          <div className="grid grid-cols-2 gap-4 bg-navy-50/50 dark:bg-navy-900/20 p-3 rounded-xl border border-navy-100 dark:border-navy-800">
            <div className="space-y-1">
              <Label className="text-xs text-navy-500">Link to Curriculum Strand (Optional)</Label>
              <select value={strandId} onChange={(e) => setStrandId(e.target.value)} className="w-full h-9 rounded-md border border-navy-200 bg-white px-3 text-xs">
                <option value="">None...</option>
                {strands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-navy-500">Link to Competency (Optional)</Label>
              <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className="w-full h-9 rounded-md border border-navy-200 bg-white px-3 text-xs">
                <option value="">None...</option>
                {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1"><Label>Objectives</Label><Input value={obj} onChange={(e)=>setObj(e.target.value)} placeholder="By the end of the lesson..." /></div>
          <div className="space-y-1"><Label>Activities / Resources</Label><Input value={act} onChange={(e)=>setAct(e.target.value)} placeholder="Group discussion, drawing..." /></div>
          <div className="space-y-1"><Label>Teacher Notes</Label><Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Post-lesson reflections..." /></div>`;

code = code.replace(oldLessonJSX, newLessonJSX);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
