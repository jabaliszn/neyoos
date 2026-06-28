"use client";

import * as React from "react";
import { Loader2, GitBranch, GitCommit, PlayCircle, Eye, Archive, CheckCircle2, DownloadCloud, BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CurriculumVersionManagerClient({ canManage }: { canManage: boolean }) {
  const [versions, setVersions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draftingId, setDraftingId] = React.useState<string | null>(null);
  const [diffId, setDiffId] = React.useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/curriculum/versions");
      const json = await res.json();
      if (json.ok) setVersions(json.data);
    } catch {
      toast({ title: "Failed to load versions", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
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
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-navy-100 dark:before:bg-navy-800">
        {versions.map((v) => (
          <div key={v.id} className="relative flex items-center gap-6">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-navy-950 shrink-0 z-10 
              ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 
                v.status === 'DRAFT' ? 'bg-amber-100 text-amber-600' : 
                'bg-navy-100 text-navy-500'}`}
            >
              {v.status === 'ACTIVE' ? <CheckCircle2 className="h-4 w-4" /> : 
               v.status === 'DRAFT' ? <GitCommit className="h-4 w-4" /> : 
               <Archive className="h-4 w-4" />}
            </div>
            
            <Card className="flex-1 overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-start justify-between p-4 bg-white dark:bg-navy-950">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={v.status === 'ACTIVE' ? 'secondary' : 'outline'} className={v.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : ''}>
                        {v.status}
                      </Badge>
                      <span className="text-xs font-bold text-navy-500 uppercase tracking-widest">{v.activeVersion}</span>
                    </div>
                    <h4 className="font-bold text-lg text-navy-950 dark:text-white">{v.name}</h4>
                    <p className="text-xs text-navy-500 mt-1">
                      {v.effectiveFrom ? `Effective: ${v.effectiveFrom}` : 'Not yet effective'} 
                      {v.effectiveTo ? ` — ${v.effectiveTo}` : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-navy-50 dark:bg-navy-900 px-3 py-1 rounded-full text-navy-600 dark:text-navy-300">
                      {v._count.learningAreas} Learning Areas
                    </span>
                  </div>
                </div>
                
                <div className="bg-navy-50 dark:bg-navy-900 px-4 py-3 flex items-center gap-2 border-t border-navy-100 dark:border-navy-800">
                  {v.status === 'ACTIVE' && canManage && (
                    <Button size="sm" variant="outline" className="text-xs rounded-full bg-white dark:bg-navy-950" onClick={() => setDraftingId(v.id)}>
                      <GitBranch className="h-3 w-3 mr-2" /> Draft Next Update
                    </Button>
                  )}
                  {v.status === 'DRAFT' && canManage && (
                    <>
                      <Button size="sm" variant="outline" className="text-xs rounded-full bg-white dark:bg-navy-950" onClick={() => setDiffId(v.id)}>
                        <Eye className="h-3 w-3 mr-2" /> Preview Diff
                      </Button>
                      <Button size="sm" className="text-xs rounded-full bg-green-600 hover:bg-green-700 text-white" onClick={async () => {
                        if (!confirm("Publishing will archive the active version. Continue?")) return;
                        const res = await fetch("/api/curriculum/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PUBLISH", draftId: v.id }) });
                        if (res.ok) { toast({ title: "Published", tone: "success" }); load(); }
                        else toast({ title: "Failed to publish", tone: "error" });
                      }}>
                        <PlayCircle className="h-3 w-3 mr-2" /> Publish Live
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {draftingId && <CreateDraftDialog originalId={draftingId} onClose={() => setDraftingId(null)} onDone={() => { setDraftingId(null); void load(); }} />}
      {diffId && <PreviewDiffDialog draftId={diffId} onClose={() => setDiffId(null)} />}
      {libraryOpen && <CurriculumLibraryDialog onClose={() => setLibraryOpen(false)} onDone={() => { setLibraryOpen(false); void load(); }} />}
    </div>
  );
}

function CreateDraftDialog({ originalId, onClose, onDone }: any) {
  const [versionName, setVersionName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (!versionName) return toast({ title: "Version name required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum/versions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DRAFT", curriculumId: originalId, versionName })
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Draft created", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Draft New Curriculum Version</DialogTitle></DialogHeader>
        <div className="py-4">
          <p className="text-xs text-navy-500 mb-4">Clones the active curriculum into a safe sandbox. You can add/remove subjects and competencies without affecting live reports.</p>
          <div className="space-y-1">
            <Label>New Version Name</Label>
            <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. 2027 Update" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDiffDialog({ draftId, onClose }: any) {
  const [diff, setDiff] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/curriculum/versions?diffId=${draftId}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setDiff(j.data); setLoading(false); });
  }, [draftId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Preview Migration Changes</DialogTitle></DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>
          ) : !diff ? (
            <p className="text-red-500 text-sm">Failed to load diff.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-navy-950 dark:text-white">
                <Badge variant="outline">{diff.baseVersion}</Badge> <span className="text-navy-400">→</span> <Badge variant="secondary">{diff.draftVersion}</Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="bg-navy-50 dark:bg-navy-900 p-3 rounded-lg border border-navy-100 dark:border-navy-800">
                  <span className="font-semibold text-navy-600 dark:text-navy-300">Unchanged Areas:</span> {diff.unchangedCount}
                </div>
                
                {diff.added.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-900/50">
                    <span className="font-semibold text-green-700 dark:text-green-400">Added (+{diff.added.length}):</span>
                    <ul className="list-disc pl-5 mt-1 text-green-600 dark:text-green-300 text-xs">
                      {diff.added.map((a: string) => <li key={a}>{a}</li>)}
                    </ul>
                  </div>
                )}
                
                {diff.removed.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
                    <span className="font-semibold text-red-700 dark:text-red-400">Removed (-{diff.removed.length}):</span>
                    <ul className="list-disc pl-5 mt-1 text-red-600 dark:text-red-300 text-xs">
                      {diff.removed.map((a: string) => <li key={a}>{a}</li>)}
                    </ul>
                  </div>
                )}
                
                {diff.added.length === 0 && diff.removed.length === 0 && (
                  <p className="text-xs italic text-navy-500">No structural changes detected.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
}