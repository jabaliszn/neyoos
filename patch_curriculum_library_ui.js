const fs = require('fs');
let code = fs.readFileSync('src/components/academics/curriculum-version-manager.tsx', 'utf8');

const oldHeader = `<div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-600" /> Curriculum Versioning
          </h2>
          <p className="text-sm font-medium text-navy-500">Draft, preview, and deploy curriculum updates without breaking historical reports.</p>
        </div>
      </div>`;

const newHeader = `<div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-600" /> Curriculum Versioning
          </h2>
          <p className="text-sm font-medium text-navy-500">Draft, preview, and deploy curriculum updates without breaking historical reports.</p>
        </div>
        {canManage && (
          <Button onClick={() => setLibraryOpen(true)} className="rounded-full shadow-pop bg-blue-600 hover:bg-blue-700 text-white">
            <DownloadCloud className="mr-2 h-4 w-4" /> Import from NEYO Library
          </Button>
        )}
      </div>`;

if (!code.includes('Import from NEYO Library')) {
  code = code.replace(oldHeader, newHeader);
  
  code = code.replace('const [diffId, setDiffId] = React.useState<string | null>(null);', 'const [diffId, setDiffId] = React.useState<string | null>(null);\n  const [libraryOpen, setLibraryOpen] = React.useState(false);');

  code = code.replace(
    'import { Loader2, GitBranch, GitCommit, PlayCircle, Eye, Archive, CheckCircle2 } from "lucide-react";',
    'import { Loader2, GitBranch, GitCommit, PlayCircle, Eye, Archive, CheckCircle2, DownloadCloud, BookOpen } from "lucide-react";'
  );

  const libraryDialog = `
function CurriculumLibraryDialog({ onClose, onDone }: any) {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    fetch("/api/curriculum/library")
      .then(r => r.json())
      .then(j => { if (j.ok) setTemplates(j.data); setLoading(false); });
  }, []);

  async function adopt(id: string) {
    if (!confirm("This will import the curriculum as a new DRAFT. Continue?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum/library", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id })
      });
      if (res.ok) {
        toast({ title: "Template imported successfully", tone: "success" });
        onDone();
      } else {
        toast({ title: "Failed to import", tone: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>NEYO Curriculum Template Library</DialogTitle></DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-navy-500 italic">No published templates available from NEYO Ops.</p>
          ) : (
            <div className="space-y-4">
              {templates.map(t => (
                <div key={t.id} className="p-4 border border-navy-100 dark:border-navy-800 rounded-xl bg-navy-50/30 dark:bg-navy-900/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{t.country}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{t.version}</Badge>
                      </div>
                      <h4 className="font-bold text-navy-950 dark:text-white text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-500"/> {t.name}</h4>
                      {t.description && <p className="text-xs text-navy-600 dark:text-navy-400 mt-1">{t.description}</p>}
                    </div>
                    <Button onClick={() => adopt(t.id)} disabled={saving} size="sm" className="rounded-full shadow-sm">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import to Draft"}
                    </Button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-navy-100 dark:border-navy-800">
                    <p className="text-[10px] font-bold text-navy-500 uppercase tracking-widest mb-2">Includes Learning Areas:</p>
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(t.learningAreasJson).map((la: any) => (
                        <Badge key={la.code} variant="outline" className="text-[9px] bg-white dark:bg-navy-950">{la.name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}`;

  code += libraryDialog;

  code = code.replace(
    '{diffId && <PreviewDiffDialog draftId={diffId} onClose={() => setDiffId(null)} />}',
    '{diffId && <PreviewDiffDialog draftId={diffId} onClose={() => setDiffId(null)} />}\n      {libraryOpen && <CurriculumLibraryDialog onClose={() => setLibraryOpen(false)} onDone={() => { setLibraryOpen(false); void load(); }} />}'
  );

  fs.writeFileSync('src/components/academics/curriculum-version-manager.tsx', code);
}
