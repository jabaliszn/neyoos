"use client";

import * as React from "react";
import { Plus, LayoutTemplate, Edit2, Loader2, GripVertical, Star, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";


function levelAwareReportDefaults(schoolLevelActivation?: { isSeniorSchool: boolean; isJuniorSchool: boolean; educationLevelsOffered: string[] }) {
  if (schoolLevelActivation?.isSeniorSchool) {
    return {
      emphasis: 'subject and pathway breadth',
      sections: ['student_profile', 'marks_summary', 'subject_breakdown', 'pathway_readiness', 'attendance'],
    };
  }
  if (schoolLevelActivation?.isJuniorSchool) {
    return {
      emphasis: 'subject progression and readiness',
      sections: ['student_profile', 'competency_summary', 'subject_breakdown', 'teacher_comments', 'attendance'],
    };
  }
  return {
    emphasis: 'competency growth and broad learner progress',
    sections: ['student_profile', 'competency_summary', 'portfolio_highlights', 'teacher_comments', 'attendance'],
  };
}

export function ReportBuilderClient({ canManage, schoolLevelActivation }: { canManage: boolean; schoolLevelActivation?: { isSeniorSchool: boolean; isJuniorSchool: boolean; isMixedSchool: boolean; educationLevelsOffered: string[] } }) {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = React.useState<any | null>(null);
  const [studentOptions, setStudentOptions] = React.useState<any[]>([]);
  const { toast } = useToast();
  const defaultPack = levelAwareReportDefaults(schoolLevelActivation);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [templateRes, studentRes] = await Promise.all([
        fetch("/api/academics/report-templates"),
        fetch("/api/students?limit=20"),
      ]);
      const templateJson = await templateRes.json();
      const studentJson = await studentRes.json();
      if (templateJson.ok) setTemplates(templateJson.data || []);
      if (studentJson.ok) setStudentOptions((studentJson.data?.students || []).map((s: any) => ({
        id: s.id,
        label: `${s.firstName} ${s.lastName} (${s.admissionNo})`,
      })));
    } catch {
      toast({ title: "Failed to load report builder", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6">
      {schoolLevelActivation ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
          <p className="font-semibold">Level-aware Report Builder</p>
          <p className="mt-1 text-xs text-green-800 dark:text-green-300">
            Active levels: {schoolLevelActivation.educationLevelsOffered.length > 0 ? schoolLevelActivation.educationLevelsOffered.join(', ') : 'None selected yet'}.
            {schoolLevelActivation.isSeniorSchool ? ' Senior School is active, so pathway and subject-selection-aware reports should be expected.' : ' Senior School report complexity is hidden until Senior School is activated.'}
          </p>
          <p className="mt-2 text-xs text-green-800 dark:text-green-300">
            Default report emphasis: {defaultPack.emphasis}.
          </p>
          <p className="mt-2 text-xs text-green-800 dark:text-green-300">
            Suggested default section pack: {defaultPack.sections.join(', ')}.
          </p>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Modular Report Builder</h2>
          <p className="text-sm font-medium text-navy-500">Build no-code report templates and generate branded modular PDFs from them.</p>
        </div>
        {canManage ? <Button onClick={() => setEditingId("NEW")} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> New Template</Button> : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No report templates" description="Build your first custom report layout. Mix marks, competencies, attendance, talent, pathway and portfolio sections without code." primaryAction={canManage ? { label: "Create Template", onClick: () => setEditingId("NEW") } : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const sections = JSON.parse(t.sectionsJson || "[]");
            return (
              <Card key={t.id} className="relative overflow-hidden group">
                <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {t.isDefault ? <Badge tone="blue"><Star className="h-3 w-3 mr-1" />Default</Badge> : null}
                      <CardTitle className="text-lg mt-2">{t.name}</CardTitle>
                    </div>
                    {canManage ? <Button variant="ghost" size="sm" onClick={() => setEditingId(t.id)}><Edit2 className="h-4 w-4" /></Button> : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {t.description ? <p className="text-xs text-navy-600 dark:text-navy-300">{t.description}</p> : null}
                  <div className="flex flex-wrap gap-1">
                    {sections.map((s: any, idx: number) => <Badge key={idx} tone="neutral">{s.type}</Badge>)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setPreviewTemplate(t)}><Eye className="h-4 w-4" /> Preview</Button>
                    <Button size="sm" onClick={() => setPreviewTemplate(t)}><FileDown className="h-4 w-4" /> Generate PDF</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editingId ? <TemplateEditorDialog template={editingId === "NEW" ? null : templates.find((x) => x.id === editingId)} onClose={() => setEditingId(null)} onDone={() => { setEditingId(null); void load(); }} /> : null}
      {previewTemplate ? <TemplatePreviewDialog template={previewTemplate} studentOptions={studentOptions} onClose={() => setPreviewTemplate(null)} /> : null}
    </div>
  );
}

const AVAILABLE_SECTIONS = [
  { type: "HEADER", label: "School Header & Student Info" },
  { type: "ACADEMIC_MARKS", label: "Academic Marks Table" },
  { type: "COMPETENCIES", label: "CBC Competencies" },
  { type: "ATTENDANCE", label: "Attendance Summary" },
  { type: "DISCIPLINE", label: "Behavior / Discipline" },
  { type: "TALENTS", label: "Talents & Co-curricular" },
  { type: "PORTFOLIO", label: "Portfolio Highlights" },
  { type: "TEACHER_REMARKS", label: "Class Teacher Remarks" },
  { type: "PRINCIPAL_REMARKS", label: "Principal Remarks" },
  { type: "QR_VERIFICATION", label: "QR Verification" },
];

function TemplateEditorDialog({ template, onClose, onDone }: any) {
  const [name, setName] = React.useState(template?.name || "");
  const [desc, setDesc] = React.useState(template?.description || "");
  const [isDefault, setIsDefault] = React.useState(template?.isDefault || false);
  const [sections, setSections] = React.useState<any[]>(template ? JSON.parse(template.sectionsJson) : []);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  function addSection(type: string) { setSections((prev) => [...prev, { id: crypto.randomUUID(), type }]); }
  function removeSection(idx: number) { setSections((prev) => prev.filter((_: any, i: number) => i !== idx)); }
  function moveSection(idx: number, direction: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function save() {
    if (!name.trim()) return toast({ title: "Name required", tone: "error" });
    if (sections.length === 0) return toast({ title: "Add at least one section", tone: "error" });
    setSaving(true);
    try {
      const url = template ? `/api/academics/report-templates?id=${template.id}` : "/api/academics/report-templates";
      const method = template ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: desc || undefined, isDefault, sections }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Template saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{template ? "Edit Report Template" : "New Report Template"}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Template Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBC Comprehensive Report" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this report is for" /></div>
          </div>
          <div className="flex items-center gap-2 border border-navy-100 dark:border-navy-800 p-3 rounded-xl bg-navy-50/50 dark:bg-navy-900/30">
            <input type="checkbox" id="def" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-navy-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="def" className="text-sm font-semibold text-navy-700 cursor-pointer dark:text-navy-200">Set as default template</label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold">Layout order</Label>
            <div className="space-y-2">
              {sections.length === 0 ? <div className="text-center p-6 border-2 border-dashed border-navy-100 dark:border-navy-800 rounded-xl text-navy-400 text-sm">Add sections below to build the report.</div> : null}
              {sections.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white dark:bg-navy-950 border border-navy-200 dark:border-navy-700 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3"><GripVertical className="h-4 w-4 text-navy-300" /><span className="font-bold text-sm text-navy-950 dark:text-white">{s.type.replace(/_/g, " ")}</span></div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => moveSection(idx, -1)}>↑</Button>
                    <Button variant="ghost" size="sm" onClick={() => moveSection(idx, 1)}>↓</Button>
                    <Button variant="danger" size="sm" onClick={() => removeSection(idx)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold">Available sections</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SECTIONS.map((s) => <Badge key={s.type} tone="blue" className="cursor-pointer" onClick={() => addSection(s.type)}><Plus className="h-3 w-3 mr-1" /> {s.label}</Badge>)}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-navy-100 dark:border-navy-800 pt-4 mt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePreviewDialog({ template, studentOptions, onClose }: any) {
  const [studentId, setStudentId] = React.useState(studentOptions[0]?.id || "");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Generate modular report PDF</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-navy-100 bg-navy-50 p-4 dark:border-navy-800 dark:bg-navy-900">
            <p className="font-semibold text-navy-950 dark:text-white">{template.name}</p>
            <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">{template.description || "No description"}</p>
            <div className="mt-3 flex flex-wrap gap-1">{JSON.parse(template.sectionsJson || "[]").map((s: any, idx: number) => <Badge key={idx} tone="neutral">{s.type}</Badge>)}</div>
          </div>
          <div className="space-y-1">
            <Label>Choose learner</Label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950">
              {studentOptions.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {studentId ? <a href={`/api/academics/report-templates?format=pdf&templateId=${template.id}&studentId=${studentId}`}><Button className="w-full"><FileDown className="h-4 w-4" /> Download modular PDF</Button></a> : <p className="text-sm text-navy-500">No learner found for preview.</p>}
        </div>
        <DialogFooter><Button variant="secondary" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
