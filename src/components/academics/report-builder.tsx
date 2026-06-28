"use client";

import * as React from "react";
import { Plus, LayoutTemplate, Trash2, Edit2, Loader2, GripVertical, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function ReportBuilderClient({ canManage }: { canManage: boolean }) {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academics/report-templates");
      const json = await res.json();
      if (json.ok) setTemplates(json.data);
    } catch {
      toast({ title: "Failed to load templates", tone: "error" });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Modular Report Builder</h2>
          <p className="text-sm font-medium text-navy-500">Design no-code layout templates for termly reports.</p>
        </div>
        {canManage && <Button onClick={() => setEditingId("NEW")} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> New Template</Button>}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No report templates"
          description="Build your first custom report layout. Mix and match marks, CBC competencies, attendance, and talents."
          action={canManage ? { label: "Create Template", onClick: () => setEditingId("NEW") } : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="relative overflow-hidden group">
              <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
                <div className="flex items-start justify-between">
                  <div>
                    {t.isDefault && <Badge variant="secondary" className="mb-2 text-[9px] uppercase tracking-widest"><Star className="h-3 w-3 mr-1"/> Default</Badge>}
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(t.id)} className="h-8 w-8 text-navy-400 hover:text-navy-950 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {t.description && <p className="text-xs text-navy-600 dark:text-navy-300">{t.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(t.sectionsJson).map((s: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[9px]">{s.type}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {editingId && (
        <TemplateEditorDialog 
          template={editingId === "NEW" ? null : templates.find(x => x.id === editingId)} 
          onClose={() => setEditingId(null)} 
          onDone={() => { setEditingId(null); void load(); }} 
        />
      )}
    </div>
  );
}

const AVAILABLE_SECTIONS = [
  { type: "HEADER", label: "School Header & Student Info" },
  { type: "ACADEMIC_MARKS", label: "Academic Marks Table" },
  { type: "COMPETENCIES", label: "CBC Competencies" },
  { type: "ATTENDANCE", label: "Attendance Summary" },
  { type: "DISCIPLINE", label: "Discipline & Behavior" },
  { type: "TALENTS", label: "Talents & Co-curricular" },
  { type: "PORTFOLIO", label: "Portfolio Highlights" },
  { type: "TEACHER_REMARKS", label: "Class Teacher Remarks" },
  { type: "PRINCIPAL_REMARKS", label: "Principal Remarks" },
  { type: "GRADING_KEY", label: "Grading Scale / Key" },
  { type: "QR_VERIFICATION", label: "QR Code Verification" },
];

function TemplateEditorDialog({ template, onClose, onDone }: any) {
  const [name, setName] = React.useState(template?.name || "");
  const [desc, setDesc] = React.useState(template?.description || "");
  const [isDefault, setIsDefault] = React.useState(template?.isDefault || false);
  const [sections, setSections] = React.useState<any[]>(template ? JSON.parse(template.sectionsJson) : []);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  function addSection(type: string) {
    setSections([...sections, { id: Math.random().toString(), type }]);
  }

  function removeSection(idx: number) {
    setSections(sections.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name) return toast({ title: "Name required", tone: "error" });
    if (sections.length === 0) return toast({ title: "Add at least one section", tone: "error" });
    setSaving(true);
    try {
      const url = template ? \`/api/academics/report-templates?id=\${template.id}\` : "/api/academics/report-templates";
      const method = template ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc || undefined, isDefault, sections }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Template saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{template ? "Edit Report Template" : "New Report Template"}</DialogTitle></DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. End of Term 2 (Mixed)" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mixes CBC and Marks" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 border border-navy-100 dark:border-navy-800 p-3 rounded-xl bg-navy-50/50 dark:bg-navy-900/30">
            <input type="checkbox" id="def" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-navy-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="def" className="text-sm font-semibold text-navy-700 cursor-pointer">Set as the Default Report Template</label>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold">Report Layout Sections (Top to Bottom)</Label>
            <div className="space-y-2">
              {sections.length === 0 && <div className="text-center p-6 border-2 border-dashed border-navy-100 dark:border-navy-800 rounded-xl text-navy-400 text-sm">Drag or click sections below to build the report.</div>}
              {sections.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white dark:bg-navy-950 border border-navy-200 dark:border-navy-700 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-navy-300 cursor-grab" />
                    <span className="font-bold text-sm text-navy-950 dark:text-white">{s.type.replace(/_/g, " ")}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeSection(idx)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold">Available Modules</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SECTIONS.map(s => (
                <Badge 
                  key={s.type} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-navy-200 dark:hover:bg-navy-800 text-[10px] py-1 px-2"
                  onClick={() => addSection(s.type)}
                >
                  <Plus className="h-3 w-3 mr-1" /> {s.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-navy-100 dark:border-navy-800 pt-4 mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function X({ className }: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
}
