const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

// Add "Auto Match Teachers" button in TimetableGeneratorTab
const searchStr = `<Button onClick={generate} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-pop">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Generate Timetable
            </Button>`;

const replaceStr = `<Button onClick={async () => {
              if (!confirm("This will automatically assign unassigned classes to teachers based on workload and strong subjects. Proceed?")) return;
              setSaving(true);
              const res = await fetch("/api/academics/timetable/generator", {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ action: "auto_match_teachers" })
              });
              setSaving(false);
              if (res.ok) { toast({ title: "Teachers Auto-Matched!", tone: "success" }); load(); }
              else toast({ title: "Failed to auto-match", tone: "error" });
            }} disabled={saving} variant="outline" className="rounded-full shadow-sm text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100">
              <Sparkles className="mr-2 h-4 w-4" /> Auto Match Teachers
            </Button>
            <Button onClick={generate} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-pop">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Generate Timetable
            </Button>`;

code = code.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
