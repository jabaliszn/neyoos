"use client";

/**
 * B.1 Alumni directory (Chunks 5+6+7). GRADUATED students grouped by
 * "Class of YYYY" with year filter pills + a bulk "Graduate a class" action.
 * All 4 UX states.
 */
import * as React from "react";
import Link from "next/link";
import { GraduationCap, AlertCircle, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface AlumnusItem {
  id: string; admissionNo: string; name: string; gender: string;
  photoUrl: string | null; graduationYear: number | null; finalClassLabel: string | null;
}
interface YearPill { year: number; count: number }
interface ClassOpt { id: string; name: string; studentCount: number }

export function AlumniClient({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [alumni, setAlumni] = React.useState<AlumnusItem[] | null>(null);
  const [years, setYears] = React.useState<YearPill[]>([]);
  const [year, setYear] = React.useState<number | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/students/alumni${year ? `?year=${year}` : ""}`);
      const json = await res.json();
      if (json.ok) { setAlumni(json.data.alumni); setYears(json.data.years); }
      else setError(true);
    } catch { setError(true); }
  }, [year]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* year pills + action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setYear(null)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${year === null ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "border border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"}`}
          >
            All years
          </button>
          {years.map((y) => (
            <button
              key={y.year}
              onClick={() => setYear(y.year)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${year === y.year ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "border border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"}`}
            >
              Class of {y.year} <span className="opacity-60">· {y.count}</span>
            </button>
          ))}
        </div>
        {canEdit && (
          <Button onClick={() => setDialog(true)}>
            <GraduationCap className="h-4 w-4" /> Graduate a class
          </Button>
        )}
      </div>

      {/* body */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load alumni.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : alumni === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : alumni.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={year ? `No alumni in the Class of ${year}` : "No alumni yet"}
          description={canEdit
            ? "When a class completes Form 4 or Grade 9, use “Graduate a class” to move all its students here in one step."
            : "Graduated students will appear here, grouped by their graduating year."}
          action={canEdit ? <Button onClick={() => setDialog(true)}><GraduationCap className="h-4 w-4" /> Graduate a class</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alumni.map((a) => (
            <Link key={a.id} href={`/students/${a.id}`}>
              <Card className="transition-shadow duration-200 ease-apple hover:shadow-card">
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar name={a.name} photoUrl={a.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{a.name}</p>
                    <p className="truncate font-mono text-xs text-navy-400">{a.admissionNo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {a.graduationYear && <Badge tone="blue">Class of {a.graduationYear}</Badge>}
                    {a.finalClassLabel && <p className="mt-1 text-xs text-navy-400">{a.finalClassLabel}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {dialog && (
        <GraduateClassDialog
          onClose={() => setDialog(false)}
          onDone={(msg) => { setDialog(false); toast({ title: msg, tone: "success" }); setYear(null); load(); }}
        />
      )}
    </div>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  if (photoUrl) return <img src={photoUrl} alt={name} className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-100 text-sm font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-200">{initials}</span>;
}

// ---- bulk graduate dialog ---------------------------------------------------
function GraduateClassDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const { toast } = useToast();
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [classId, setClassId] = React.useState("");
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => {
      if (j.ok) setClasses(j.data.classes.filter((c: ClassOpt & { archived?: boolean }) => !c.archived));
    });
  }, []);

  const chosen = classes.find((c) => c.id === classId);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/students/alumni", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, year }),
      });
      const json = await res.json();
      if (json.ok) onDone(`${json.data.graduated} students graduated — Class of ${json.data.year}`);
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Graduate a class</h3>
            <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">
              Every active student in the class becomes an alumnus and the class empties.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-navy-600 dark:text-navy-300">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
              <option value="">Choose a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.studentCount} students)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-navy-600 dark:text-navy-300">Graduating year</label>
            <input type="number" value={year} min={1990} max={2100} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800" />
          </div>
          {chosen && chosen.studentCount > 0 && (
            <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
              {chosen.studentCount} active student{chosen.studentCount === 1 ? "" : "s"} in {chosen.name} will join the Class of {year}.
            </p>
          )}
          <Button onClick={save} disabled={saving || !classId} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
            Graduate class
          </Button>
        </div>
      </div>
    </div>
  );
}
