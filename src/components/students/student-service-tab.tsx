"use client";

import * as React from "react";
import { Loader2, Trees, Plus, HeartHandshake, FileText, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function StudentServiceTab({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/community-service?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      toast({ title: "Failed to load community service", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this service record?")) return;
    try {
      const res = await fetch(`/api/students/community-service?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Record deleted", tone: "success" });
        load();
      } else toast({ title: "Failed to delete", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <Trees className="h-5 w-5 text-green-600" /> Community Service
          </h2>
          <p className="text-sm font-medium text-navy-500">Track volunteer work, charity, and environmental stewardship.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <a href={`/api/students/community-service?studentId=${studentId}&format=pdf`}><Button variant="secondary"><FileText className="mr-2 h-4 w-4" /> Report PDF</Button></a>
          <a href={`/api/students/community-service?studentId=${studentId}&format=certificate`}><Button variant="secondary">Certificate PDF</Button></a>
          <div className="text-right">
            <span className="text-xs font-semibold text-navy-500 block">Total Approved</span>
            <span className="text-xl font-black text-green-700 dark:text-green-500">{data.totalHours} hrs</span>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop bg-green-600 hover:bg-green-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Log Service
          </Button>
        </div>
      </div>

      {data.activities.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No community service logged"
          description="Record hours for tree planting, community clean-up, or helping at local charities."
        />
      ) : (
        <div className="space-y-4">
          {data.activities.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="green" className="text-[10px]">{a.category}</Badge>
                    <span className="text-xs text-navy-400 font-semibold">{new Date(a.date).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-navy-950 dark:text-white text-base">{a.title}</h4>
                  
                  {a.studentReflection && (
                    <p className="text-sm text-navy-600 dark:text-navy-300 mt-2 bg-navy-50 dark:bg-navy-900 p-2 rounded italic">
                      "{a.studentReflection}"
                    </p>
                  )}
                  
                  <div className="flex gap-4 mt-3 text-xs text-navy-500 font-medium">
                    {a.location && <span>📍 {a.location}</span>}
                    {a.supervisorName && <span>👤 Sup: {a.supervisorName}</span>}
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center gap-4">
                  <div className="text-center bg-navy-50 dark:bg-navy-900 px-4 py-2 rounded-xl border border-navy-100 dark:border-navy-800">
                    <span className="block text-2xl font-black text-navy-950 dark:text-white leading-none">{a.hours}</span>
                    <span className="text-[10px] uppercase font-bold text-navy-400 tracking-widest">Hours</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge tone={a.status === "APPROVED" ? "green" : a.status === "REJECTED" ? "red" : "amber"}>{a.status}</Badge>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && <ServiceLogDialog studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function ServiceLogDialog({ studentId, onClose, onDone }: any) {
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("ENVIRONMENT");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [supervisor, setSupervisor] = React.useState("");
  const [reflection, setReflection] = React.useState("");
  const [proofFileId, setProofFileId] = React.useState("");
  const [competencyId, setCompetencyId] = React.useState("");
  const [status, setStatus] = React.useState("PENDING");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (!title || !hours) return toast({ title: "Title and Hours are required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/students/community-service", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          studentId, title, category, date, 
          hours: parseInt(hours, 10), 
          location: location || undefined, 
          supervisorName: supervisor || undefined,
          studentReflection: reflection || undefined,
          proofFileId: proofFileId || undefined,
          competencyId: competencyId || undefined,
          status 
        })
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Service logged", tone: "success" });
        onDone();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Log Community Service</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Activity Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tree Planting" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm">
                <option value="ENVIRONMENT">Environment</option>
                <option value="CHARITY">Charity / Orphanage</option>
                <option value="SCHOOL_SERVICE">School Service</option>
                <option value="COMMUNITY">Community Dev</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Hours Completed</Label><Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 4" min="1" max="100"/></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Karura Forest" /></div>
            <div className="space-y-1"><Label>Supervisor Name</Label><Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Name (optional)" /></div>
          </div>

          <div className="space-y-1">
            <Label>Student Reflection (Optional)</Label>
            <Input value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="What did the student learn?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Evidence File ID (Optional)</Label><Input value={proofFileId} onChange={(e) => setProofFileId(e.target.value)} placeholder="StoredFile ID from Storage Vault" /></div>
            <div className="space-y-1"><Label>Competency ID (Optional)</Label><Input value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} placeholder="Competency to credit" /></div>
          </div>

          <div className="space-y-1">
            <Label>Workflow Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm">
              <option value="PENDING">Pending approval</option>
              <option value="APPROVED">Approve immediately</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
