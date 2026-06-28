"use client";

import * as React from "react";
import { Loader2, Save, FileSpreadsheet, Lock } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MarksGridClient({ examId, subjectId, classId, className }: any) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [gridState, setGridState] = React.useState<Record<string, Record<string, string>>>({});
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(\`/api/academics/grading/grid?examId=\${examId}&subjectId=\${subjectId}&classId=\${classId}\`);
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        const st: Record<string, Record<string, string>> = {};
        json.data.gridData.forEach((row: any) => {
          st[row.studentId] = {};
          json.data.configs.forEach((cfg: any) => {
            const val = row.papers[cfg.id];
            st[row.studentId][cfg.id] = val !== undefined && val !== null ? String(val) : "";
          });
        });
        setGridState(st);
      } else {
        toast({ title: json.error?.message || "Failed to load grid", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [examId, subjectId, classId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleChange = (studentId: string, cfgId: string, val: string) => {
    setGridState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [cfgId]: val }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const results: any[] = [];
      Object.keys(gridState).forEach(studentId => {
        Object.keys(gridState[studentId]).forEach(cfgId => {
          const v = gridState[studentId][cfgId];
          if (v !== "") {
            results.push({ studentId, paperConfigId: cfgId, marksScored: parseFloat(v) });
          }
        });
      });

      const res = await fetch(\`/api/academics/grading/grid?classId=\${classId}\`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, subjectId, results })
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Marks saved", tone: "success" });
        load();
      } else {
        toast({ title: json.error?.message || "Failed to save", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;
  if (!data) return null;

  return (
    <div className={\`space-y-4 \${className}\`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-navy-950 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-green-600"/> Marks Entry Grid</h3>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-full shadow-pop bg-green-600 hover:bg-green-700 text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Progress
        </Button>
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-navy-200 shadow-sm bg-white dark:border-navy-800 dark:bg-navy-950">
        <table className="w-full text-sm text-left">
          <thead className="bg-navy-50 dark:bg-navy-900 border-b border-navy-200 dark:border-navy-800">
            <tr>
              <th className="p-3 font-bold text-navy-900 dark:text-white">Student Name</th>
              <th className="p-3 font-bold text-navy-900 dark:text-white text-center w-24">Adm No</th>
              {data.configs.map((c: any) => (
                <th key={c.id} className="p-3 font-bold text-navy-900 dark:text-white text-center">
                  {c.name}
                  <div className="text-[10px] text-navy-500 uppercase tracking-widest font-normal">Out of {c.outOfMarks} • {c.weightPct}%</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
            {data.gridData.map((row: any) => (
              <tr key={row.studentId} className="hover:bg-navy-50/50 dark:hover:bg-navy-900/50">
                <td className="p-3 font-semibold text-navy-900 dark:text-white">{row.studentName}</td>
                <td className="p-3 text-center text-navy-600 dark:text-navy-400">{row.admissionNo}</td>
                {data.configs.map((c: any) => {
                  const val = gridState[row.studentId]?.[c.id] || "";
                  const numVal = parseFloat(val);
                  const isInvalid = !isNaN(numVal) && numVal > c.outOfMarks;
                  return (
                    <td key={c.id} className="p-3 text-center">
                      <Input 
                        type="number" 
                        value={val} 
                        onChange={(e) => handleChange(row.studentId, c.id, e.target.value)} 
                        className={\`w-20 text-center mx-auto \${isInvalid ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500" : ""}\`}
                        placeholder="—"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
