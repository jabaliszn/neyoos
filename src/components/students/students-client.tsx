"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus, Search, LayoutGrid, List as ListIcon, Loader2, AlertCircle,
  GraduationCap, Users, UserCheck, X, Printer,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableContainer, Table, THead, TBody, TR, TH, TD,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ClassOpt { id: string; name: string; curriculum: string; stream: string | null; }
interface StudentItem {
  id: string; admissionNo: string; legacyAdmissionNo?: string | null; name: string; gender: string;
  status: string; photoUrl: string | null; className: string | null;
}
interface Stats { total: number; active: number; classes: number; }

const STATUS_TONE: Record<string, "green"|"neutral"|"amber"|"blue"|"red"> = {
  ACTIVE: "green", INACTIVE: "neutral", GRADUATED: "blue", TRANSFERRED: "amber", SUSPENDED: "red",
};
const STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "SUSPENDED"];

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-200" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

export function StudentsClient({ canCreate }: { canCreate: boolean }) {
  const { toast } = useToast();
  const [students, setStudents] = React.useState<StudentItem[] | null>(null);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [tenant, setTenant] = React.useState<any>(null);
  const [error, setError] = React.useState(false);
  const [view, setView] = React.useState<"list" | "kanban">("list");
  const [q, setQ] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [stream, setStream] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [dialog, setDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Student ID printing customizations
  const [idPrintOpen, setIdPrintOpen] = React.useState(false);
  const [idWidth, setIdWidth] = React.useState("74");
  const [idHeight, setIdHeight] = React.useState("105");
  const [idTemplate, setIdTemplate] = React.useState("emerald");
  const [idPrinting, setIdPrinting] = React.useState(false);
  const [documentTemplate, setDocumentTemplate] = React.useState("modern");
  const [poweredByNeyo, setPoweredByNeyo] = React.useState(true);

  // Student Newsletter customizations (A4 eco-multi up)
  const [newsOpen, setNewsOpen] = React.useState(false);
  const [newsTitle, setNewsTitle] = React.useState("End of Term Newsletter");
  const [newsContent, setNewsContent] = React.useState("Dear Parent/Guardian,\n\nWe would like to thank you for your support this term. Please note that the school re-opens on September 5th, 2026. Have a safe and happy holiday!\n\nRegards,\nPrincipal's Office");
  const [newsPersonalized, setNewsPersonalized] = React.useState(true);
  const [newsFormat, setNewsFormat] = React.useState("2-up");

  // G.8 Polish — Saved filters / saved views state
  const [savedViews, setSavedViews] = React.useState<any[]>([]);
  const [saveViewOpen, setSaveViewOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

  const loadSavedViews = React.useCallback(async () => {
    try {
      const r = await fetch("/api/saved-views?entityType=student");
      const j = await r.json();
      if (j.ok) setSavedViews(j.data.views);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    loadSavedViews();
  }, [loadSavedViews]);

  React.useEffect(() => {
    fetch("/api/document-design").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setIdWidth(String(j.data.idCardWidthMm));
        setIdHeight(String(j.data.idCardHeightMm));
        setIdTemplate(j.data.idTemplate);
        setDocumentTemplate(j.data.documentTemplate);
        setPoweredByNeyo(j.data.poweredByNeyo);
      }
    }).catch(() => {});
  }, []);

  const currentFilters = React.useMemo(() => ({ q, classId, stream, status, gender }), [q, classId, stream, status, gender]);
  const isDefaultView = !q && !classId && !stream && !status && !gender;
  const isAlreadySaved = React.useMemo(() => {
    return savedViews.some((v) => JSON.stringify(v.filters) === JSON.stringify(currentFilters));
  }, [savedViews, currentFilters]);

  React.useEffect(() => {
    const activeView = savedViews.find((v) => v.id === activeViewId);
    if (activeView) {
      const isMatch = JSON.stringify(activeView.filters) === JSON.stringify(currentFilters);
      if (!isMatch) setActiveViewId(null);
    }
  }, [currentFilters, activeViewId, savedViews]);

  async function saveCurrentView() {
    if (!newViewName.trim()) return;
    try {
      const res = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "student",
          name: newViewName.trim(),
          filters: currentFilters,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "View saved", tone: "success" });
        setNewViewName("");
        setSaveViewOpen(false);
        loadSavedViews();
        setActiveViewId(json.data.id);
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } catch {
      toast({ title: "Failed", tone: "error" });
    }
  }

  async function deleteView(id: string) {
    if (!window.confirm("Delete this saved view?")) return;
    try {
      const res = await fetch(`/api/saved-views/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "View deleted", tone: "success" });
        if (activeViewId === id) setActiveViewId(null);
        loadSavedViews();
      }
    } catch { /* ignore */ }
  }

  function applySavedView(v: any) {
    setQ(v.filters.q ?? "");
    setClassId(v.filters.classId ?? "");
    setStream(v.filters.stream ?? "");
    setStatus(v.filters.status ?? "");
    setGender(v.filters.gender ?? "");
    setActiveViewId(v.id);
  }

  function clearAllFilters() {
    setQ("");
    setClassId("");
    setStream("");
    setStatus("");
    setGender("");
    setActiveViewId(null);
    setSelected(new Set());
  }

  React.useEffect(() => {
    setSelected(new Set());
  }, [q, classId, stream, status, gender]);

  // ⌘K "New student" deep-link (G.7): /students?new=1 opens the dialog.
  // B.12 roster deep-link: /students?classId=... pre-filters to that class.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (canCreate && sp.get("new") === "1") {
      setDialog(true);
      window.history.replaceState(null, "", "/students");
    }
    const cid = sp.get("classId");
    if (cid) setClassId(cid);
  }, [canCreate]);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (classId) p.set("classId", classId);
      if (stream) p.set("stream", stream);
      if (status) p.set("status", status);
      if (gender) p.set("gender", gender);
      const res = await fetch(`/api/students?${p.toString()}`);
      const json = await res.json();
      if (json.ok) { setStudents(json.data.students); setStats(json.data.stats); }
      else setError(true);
    } catch { setError(true); }
  }, [q, classId, stream, status, gender]);

  React.useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  React.useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes));
    fetch("/api/tenant/current").then((r) => r.json()).then((j) => j.ok && setTenant(j.data.tenant));
  }, []);

  // Unique streams across the school's classes (B.1.8 stream facet).
  const streams = React.useMemo(
    () => [...new Set(classes.map((c) => c.stream).filter((s): s is string => Boolean(s)))].sort(),
    [classes]
  );

  async function saveDocumentDesignDefault() {
    const res = await fetch("/api/document-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idCardWidthMm: Number(idWidth),
        idCardHeightMm: Number(idHeight),
        idTemplate,
        documentTemplate,
        smallTimetableLogo: true,
        poweredByNeyo,
      }),
    });
    const json = await res.json();
    if (json.ok) toast({ title: "School document design saved", tone: "success" });
    else toast({ title: json.error?.message || "Could not save document design", tone: "error" });
  }

  async function handleBulkIdPrint() {
    if (!students || students.length === 0) {
      toast({ title: "No students loaded to print.", tone: "error" });
      return;
    }
    setIdPrinting(true);
    try {
      const studentIds = students.map((s) => s.id);
      const res = await fetch("/api/students/bulk-id-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          width: Number(idWidth),
          height: Number(idHeight),
          template: idTemplate,
        }),
      });

      if (!res.ok) throw new Error("Could not generate PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NEYO-Custom-ID-Cards-${studentIds.length}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: `Generated ${studentIds.length} ID Cards!`,
        description: `Measurements: ${idWidth} x ${idHeight} mm (${idTemplate} template)`,
        tone: "success",
      });
      setIdPrintOpen(false);
    } catch (err: any) {
      toast({
        title: "ID printing failed",
        description: err.message,
        tone: "error",
      });
    } finally {
      setIdPrinting(false);
    }
  }

  function handlePrintNewsletter() {
    if (!students || students.length === 0) {
      toast({ title: "No students loaded to print.", tone: "error" });
      return;
    }
    
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Pop-up blocked! Please allow popups to print newsletters.", tone: "error" });
      return;
    }

    const brandColor = tenant?.brandPrimary || "#1c2740";
    const GREEN_ACCENT = "#1f9d5f";
    const MUTED_COLOR = "#677fab";
    const schoolLogoHtml = tenant?.logoUrl 
      ? `<img src="${tenant.logoUrl}" style="height: 32px; object-fit: contain; margin-right: 10px;" />`
      : "";

    let cardsHtml = "";
    
    // Eco Paper-Saver pagination logic
    // 2-up (A5 size) means 2 cards per sheet. 
    // 4-up (A6 size) means 4 cards per sheet.
    // 1-up (A4 size) means 1 card per sheet.
    const itemsPerPage = newsFormat === "4-up" ? 4 : newsFormat === "2-up" ? 2 : 1;
    
    for (let index = 0; index < students.length; index += itemsPerPage) {
      const pageStudents = students.slice(index, index + itemsPerPage);
      
      let pageHtml = `<div class="a4-page">`;
      let gridClass = newsFormat === "4-up" ? "grid-4" : newsFormat === "2-up" ? "grid-2" : "grid-1";
      pageHtml += `<div class="grid ${gridClass}">`;
      
      pageStudents.forEach((st) => {
        let content = newsContent;
        if (newsPersonalized) {
          content = content
            .replace(/\{\{student_name\}\}/g, st.name)
            .replace(/\{\{admission_no\}\}/g, st.admissionNo);
        } else {
          content = content
            .replace(/\{\{student_name\}\}/g, "Parent/Guardian")
            .replace(/\{\{admission_no\}\}/g, "Student");
        }
        
        const contentParagraphs = content.split("\n\n").map(p => `<p style="margin: 0 0 10px 0; line-height: 1.5;">${p.replace(/\n/g, "<br/>")}</p>`).join("");

        pageHtml += `
          <div class="newsletter-card">
            <div class="header">
              <div class="school-header">
                ${schoolLogoHtml}
                <div>
                  <div class="school-name">${tenant?.name || "School Update"}</div>
                  <div class="school-motto">${tenant?.motto || ""}</div>
                </div>
              </div>
              <div class="newsletter-title">${newsTitle}</div>
            </div>
            <div class="content">
              ${contentParagraphs}
            </div>
            <div class="footer-block">
              <div class="signature">
                <div class="sign-line">Signed / Stamped</div>
                <div class="sign-by">Administration</div>
              </div>
              <div class="trademark">Powered by NEYO</div>
            </div>
          </div>
        `;
      });
      
      pageHtml += `</div></div>`;
      cardsHtml += pageHtml;
    }

    win.document.write(`
      <html>
      <head>
        <title>NEYO Personalized Newsletter Station</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            color: #1e293b;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            body { background: #fff; }
            .a4-page {
              page-break-after: always;
              height: 297mm;
              width: 210mm;
              box-shadow: none !important;
              margin: 0 !important;
              border: none !important;
              background-color: #fff !important;
            }
          }
          .a4-page {
            background-color: #fff;
            width: 210mm;
            height: 297mm;
            margin: 20px auto;
            box-sizing: border-box;
            padding: 15mm;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            position: relative;
            page-break-after: always;
          }
          .grid {
            display: grid;
            gap: 12mm;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
          }
          .grid-1 {
            grid-template-rows: 1fr;
          }
          .grid-2 {
            grid-template-rows: repeat(2, 1fr);
          }
          .grid-4 {
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
          }
          .newsletter-card {
            border: 1.5px dashed #94a3b8;
            border-radius: 12px;
            padding: 8mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            background-color: #fff;
            position: relative;
          }
          .newsletter-card::after {
            content: "✂ Cut Line";
            position: absolute;
            top: -8px;
            right: 15px;
            background: #fff;
            padding: 0 5px;
            font-size: 8px;
            color: #94a3b8;
            font-weight: bold;
          }
          .school-header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid ${brandColor};
            padding-bottom: 3mm;
            margin-bottom: 4mm;
          }
          .school-name {
            font-size: 13px;
            font-weight: 800;
            color: ${brandColor};
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .school-motto {
            font-size: 8px;
            color: ${GREEN_ACCENT};
            font-style: italic;
            font-weight: bold;
            margin-top: 2px;
          }
          .newsletter-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 4mm;
            text-align: center;
          }
          .content {
            font-size: 10.5px;
            color: #334155;
            flex: 1;
          }
          .footer-block {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0;
            padding-top: 3mm;
            margin-top: 4mm;
          }
          .signature {
            border-top: 1px dotted #94a3b8;
            width: 40%;
            text-align: center;
            padding-top: 2px;
          }
          .sign-line {
            font-size: 8px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: bold;
          }
          .sign-by {
            font-size: 9px;
            font-weight: bold;
            color: ${brandColor};
          }
          .trademark {
            font-size: 8px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `);
    
    win.document.close();
    toast({
      title: `Generated ${students.length} Personalized Newsletters!`,
      description: `Format is ${newsFormat} with Eco-Cut guides (Paper saving active)`,
      tone: "success",
    });
    setNewsOpen(false);
  }

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats === null ? (
          [0,1,2].map((i)=><Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Students" value={String(stats.total)} icon={GraduationCap} tone="navy" />
            <StatCard label="Active" value={String(stats.active)} icon={UserCheck} tone="green" />
            <StatCard label="Classes" value={String(stats.classes)} icon={Users} tone="navy" />
          </>
        )}
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 dark:border-navy-700 dark:bg-navy-900">
          <Search className="h-4 w-4 text-navy-400" />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search name or admission no…" className="w-full bg-transparent text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none dark:text-navy-50" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} onChange={(e)=>setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            <option value="">All classes</option>
            {classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {streams.length > 0 && (
            <select value={stream} onChange={(e)=>setStream(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
              <option value="">All streams</option>
              {streams.map((s)=><option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            <option value="">Any status</option>
            {STATUSES.map((s)=><option key={s} value={s}>{s[0]+s.slice(1).toLowerCase()}</option>)}
          </select>
          <select value={gender} onChange={(e)=>setGender(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            <option value="">All</option><option value="M">Boys</option><option value="F">Girls</option>
          </select>
          <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
            <button onClick={()=>setView("list")} className={"rounded-full p-1.5 "+(view==="list"?"bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900":"text-navy-400")} aria-label="List view"><ListIcon className="h-4 w-4" /></button>
            <button onClick={()=>setView("kanban")} className={"rounded-full p-1.5 "+(view==="kanban"?"bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900":"text-navy-400")} aria-label="Kanban view"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          {canCreate && <Button onClick={()=>setDialog(true)}><Plus className="h-4 w-4" /> New student</Button>}
          {students && students.length > 0 && (
            <>
              <Button variant="secondary" onClick={() => setIdPrintOpen(true)}>
                <Printer className="h-4 w-4 text-green-600" /> Print ID Cards
              </Button>
              <Button variant="secondary" onClick={() => setNewsOpen(true)}>
                <Printer className="h-4 w-4 text-green-600" /> Print Newsletters
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4 text-green-600" /> Print Class List
              </Button>
            </>
          )}
        </div>
      </div>

      {/* G.8 Polish — Saved views list bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-navy-400 font-medium">Views:</span>
        <button
          onClick={clearAllFilters}
          className={cn(
            "rounded-full px-3 py-1 font-semibold border transition-colors",
            isDefaultView
              ? "bg-navy-900 text-white border-navy-900 dark:bg-navy-50 dark:text-navy-900 dark:border-navy-50"
              : "border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-400 dark:hover:bg-navy-800 bg-white dark:bg-navy-900"
          )}
        >
          All Students
        </button>

        {savedViews.map((v) => {
          const isActive = activeViewId === v.id;
          return (
            <div key={v.id} className="flex items-center rounded-full border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 overflow-hidden">
              <button
                onClick={() => applySavedView(v)}
                className={cn(
                  "px-3 py-1 font-semibold transition-colors",
                  isActive
                    ? "bg-green-600 text-white"
                    : "text-navy-700 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-800"
                )}
              >
                {v.name}
              </button>
              <button
                onClick={() => deleteView(v.id)}
                className="px-2 py-1 border-l border-navy-100 dark:border-navy-800 hover:bg-red-50 hover:text-red-600 text-navy-400 dark:hover:bg-red-900/20"
                title="Delete view"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Save Current View button */}
        {!isDefaultView && !isAlreadySaved && (
          <button
            onClick={() => setSaveViewOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-300 bg-white px-3 py-1 font-semibold text-navy-500 hover:border-green-500 hover:text-green-600 dark:border-navy-700 dark:bg-navy-900"
          >
            <Plus className="h-3 w-3" /> Save current view…
          </button>
        )}
      </div>

      {/* G.8 Polish — Save Current View Dialog */}
      {saveViewOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSaveViewOpen(false)}>
          <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Save Current View</h3>
              <button onClick={() => setSaveViewOpen(false)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="view-name">View Name</Label>
                <Input
                  id="view-name"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g. Form 2 East Boys"
                  autoFocus
                />
              </div>
              <p className="text-xs text-navy-400">
                Saves active filter criteria (Class, Stream, Status, Gender, or Search query) so you can recall it in one click.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
                <Button onClick={saveCurrentView} disabled={!newViewName.trim()}>Save View</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* body / states */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load students.
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : students === null ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={q||classId||status||gender ? "No students match" : "No students yet"}
          description={q||classId||status||gender ? "Try clearing the filters." : "Register your first student to get started."}
          action={canCreate && !(q||classId||status||gender) ? <Button onClick={()=>setDialog(true)}><Plus className="h-4 w-4" /> New student</Button> : undefined}
        />
      ) : view === "list" ? (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    checked={students && students.length > 0 && selected.size === students.length}
                    onChange={(e) => {
                      if (e.target.checked && students) {
                        setSelected(new Set(students.map((st) => st.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                </TH>
                <TH>Student</TH>
                <TH>School / NEYO No.</TH>
                <TH>Class</TH>
                <TH>Gender</TH>
                <TH align="center">Status</TH>
              </TR>
            </THead>
            <TBody>
              {students.map((s)=>(
                <TR key={s.id} className="cursor-pointer">
                  <TD onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelected(next);
                      }}
                      className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                  </TD>
                  <TD>
                    <Link href={`/students/${s.id}`} className="flex items-center gap-3">
                      <Avatar name={s.name} photoUrl={s.photoUrl} />
                      <span className="font-medium text-navy-900 dark:text-navy-50">{s.name}</span>
                    </Link>
                  </TD>
                  <TD><Link href={`/students/${s.id}`} className="font-mono text-xs">{s.legacyAdmissionNo ? `${s.legacyAdmissionNo} · ${s.admissionNo}` : s.admissionNo}</Link></TD>
                  <TD>{s.className ?? <span className="text-navy-400">Unassigned</span>}</TD>
                  <TD>{s.gender === "M" ? "Boy" : "Girl"}</TD>
                  <TD align="center"><Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status.toLowerCase()}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      ) : (
        <KanbanBoard students={students} onMoved={load} />
      )}

      {dialog && <NewStudentDialog classes={classes} onClose={()=>setDialog(false)} onSaved={(adm)=>{ setDialog(false); toast({title:`Student registered · ${adm}`, tone:"success"}); load(); }} />}
      </div>

      {/* Print-only Class List Table (H.3) */}
      {students && (
        <div className="hidden print:block w-full text-black p-4 bg-white">
          <div className="mb-6 flex items-start justify-between border-b-2 border-black pb-3">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider">
                {classes.find((c) => c.id === classId)?.name || tenant?.name || "School"} - Class List
              </h1>
              <p className="text-xs text-gray-500 mt-1">Generated on: {new Date().toLocaleDateString("en-KE")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">Total Learners: {students.length}</p>
              <p className="text-xs text-gray-500">NEYO School OS</p>
            </div>
          </div>
          
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left w-10">#</th>
                <th className="border border-gray-300 p-2 text-left w-32">School / NEYO No.</th>
                <th className="border border-gray-300 p-2 text-left">Student Name</th>
                <th className="border border-gray-300 p-2 text-left w-24"> </th>
                <th className="border border-gray-300 p-2 text-left w-24"> </th>
                <th className="border border-gray-300 p-2 text-left w-24"> </th>
                <th className="border border-gray-300 p-2 text-left w-16">Gender</th>
                <th className="border border-gray-300 p-2 text-left w-20">Status</th>
                <th className="border border-gray-300 p-2 text-left w-36">Signature / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {[...students]
                .sort((a, b) => (a.legacyAdmissionNo || a.admissionNo).localeCompare(b.legacyAdmissionNo || b.admissionNo))
                .map((s, idx) => (
                  <tr key={s.id}>
                    <td className="border border-gray-300 p-2 font-medium">{idx + 1}</td>
                    <td className="border border-gray-300 p-2 font-mono">{s.legacyAdmissionNo ? `${s.legacyAdmissionNo} / ${s.admissionNo}` : s.admissionNo}</td>
                    <td className="border border-gray-300 p-2 font-medium">{s.name}</td>
                    <td className="border border-gray-300 p-2"></td>
                    <td className="border border-gray-300 p-2"></td>
                    <td className="border border-gray-300 p-2"></td>
                    <td className="border border-gray-300 p-2">{s.gender === "M" ? "Boy" : "Girl"}</td>
                    <td className="border border-gray-300 p-2 text-xs capitalize">{s.status.toLowerCase()}</td>
                    <td className="border border-gray-300 p-2"></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 💳 Student ID Printing Customization Modal */}
      {idPrintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={() => setIdPrintOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-6 shadow-pop dark:border-navy-700 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-3 dark:border-navy-800">
              <h3 className="text-base font-bold text-navy-900 dark:text-navy-50 flex items-center gap-2">
                <Printer className="h-5 w-5 text-green-600" />
                Customize & Print ID Cards
              </h3>
              <button onClick={() => setIdPrintOpen(false)} className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-navy-400">
                Bulk print official co-branded student ID cards with custom dimensions and templates. Set filters on the student list to restrict to specific streams/classes before printing.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Card Width (mm)</Label>
                  <Input type="number" value={idWidth} onChange={(e) => setIdWidth(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Card Height (mm)</Label>
                  <Input type="number" value={idHeight} onChange={(e) => setIdHeight(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Design Template</Label>
                <select value={idTemplate} onChange={(e) => setIdTemplate(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                  <option value="emerald">Kenyan Growth (Emerald Green)</option>
                  <option value="frost">Sleek Frost (Translucent Glass)</option>
                  <option value="navy">Corporate Navy (Dark theme)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>School document style</Label>
                  <select value={documentTemplate} onChange={(e) => setDocumentTemplate(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                    <option value="modern">Modern official</option>
                    <option value="classic">Classic office</option>
                    <option value="compact">Compact low-ink</option>
                  </select>
                </div>
                <label className="mt-7 flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
                  <input type="checkbox" checked={poweredByNeyo} onChange={(e) => setPoweredByNeyo(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
                  Powered by NEYO footer
                </label>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-navy-100 p-3 bg-navy-50/30 dark:border-navy-800">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-700">
                  ⚡
                </div>
                <div className="text-[11px] text-navy-500">
                  <strong>Branding Active:</strong> Each ID includes the {tenant?.logoUrl ? "official school logo" : "default logo"}, barcode references, and the <strong>Powered by NEYO</strong> trade mark at the bottom.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setIdPrintOpen(false)}>Cancel</Button>
              <Button variant="secondary" onClick={saveDocumentDesignDefault}>Save as school default</Button>
              <Button onClick={handleBulkIdPrint} disabled={idPrinting}>
                {idPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Generate Custom IDs PDF ({students?.length ?? 0})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 📄 Eco Paper-Saver Newsletter Customization Modal */}
      {newsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={() => setNewsOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-navy-100 bg-white p-6 shadow-pop dark:border-navy-700 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-3 dark:border-navy-800">
              <h3 className="text-base font-bold text-navy-900 dark:text-navy-50 flex items-center gap-2">
                <Printer className="h-5 w-5 text-green-600" />
                Eco-Bulk Personalized Newsletter Printer
              </h3>
              <button onClick={() => setNewsOpen(false)} className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-navy-400">
                Type short letters or terminal notifications, customize them with student names automatically, and print them in space-saving grid sheets (Eco Paper-Saver mode) with dotted cut guide lines to avoid wasting A4 space!
              </p>

              <div className="space-y-1.5">
                <Label>Newsletter Title</Label>
                <Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="End of Term Parent Newsletter" />
              </div>

              <div className="space-y-1.5">
                <Label>Newsletter Body Content</Label>
                <textarea
                  value={newsContent}
                  onChange={(e) => setNewsContent(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 transition-colors duration-200 focus:border-green-500 focus:outline-none dark:border-navy-700 dark:bg-navy-950 dark:text-navy-50"
                  placeholder="Type body... Use {{student_name}} or {{admission_no}} to personalize!"
                />
                <p className="text-[10px] text-navy-400 italic">
                  Tip: Use <strong className="text-green-600 font-mono">{"{{student_name}}"}</strong> and <strong className="text-green-600 font-mono">{"{{admission_no}}"}</strong> for automatic placeholder insertion.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>A4 Grid Layout (Paper Saver)</Label>
                  <select value={newsFormat} onChange={(e) => setNewsFormat(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                    <option value="2-up">2-Up (2 A5 letters per A4 sheet) ✂</option>
                    <option value="4-up">4-Up (4 A6 letters per A4 sheet) ✂</option>
                    <option value="1-up">1-Up (1 full A4 sheet per letter)</option>
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col justify-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer select-none font-semibold">
                    <input type="checkbox" checked={newsPersonalized} onChange={(e) => setNewsPersonalized(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                    Personalize with Student Names
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setNewsOpen(false)}>Cancel</Button>
              <Button onClick={handlePrintNewsletter}>
                <Printer className="h-4 w-4" />
                Preview & Bulk Print ({students?.length ?? 0})
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- kanban by status ------------------------------------------------------
function KanbanBoard({ students, onMoved }: { students: StudentItem[]; onMoved: () => void }) {
  const { toast } = useToast();
  const cols = ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED", "TRANSFERRED"];
  async function move(id: string, status: string) {
    const res = await fetch(`/api/students/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (json.ok) { toast({ title: `Moved to ${status.toLowerCase()}`, tone: "success" }); onMoved(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cols.map((col)=>{
        const items = students.filter((s)=>s.status===col);
        return (
          <div key={col} className="rounded-2xl border border-navy-100 bg-navy-50/40 p-2.5 dark:border-navy-800 dark:bg-navy-900/40">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">{col.toLowerCase()}</span>
              <Badge tone={STATUS_TONE[col]}>{items.length}</Badge>
            </div>
            <div className="space-y-2"
              onDragOver={(e)=>e.preventDefault()}
              onDrop={(e)=>{ const id=e.dataTransfer.getData("text/plain"); if(id) move(id, col); }}>
              {items.map((s)=>(
                <div key={s.id} draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain", s.id)}
                  className="rounded-xl border border-navy-100 bg-white p-2.5 shadow-sm dark:border-navy-800 dark:bg-navy-900">
                  <Link href={`/students/${s.id}`} className="flex items-center gap-2">
                    <Avatar name={s.name} photoUrl={s.photoUrl} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                      <p className="truncate text-[11px] text-navy-400">{s.className ?? s.admissionNo}</p>
                    </div>
                  </Link>
                </div>
              ))}
              {items.length===0 && <p className="px-1 py-3 text-center text-xs text-navy-300">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- new student dialog ----------------------------------------------------
function NewStudentDialog({ classes, onClose, onSaved }: { classes: ClassOpt[]; onClose: ()=>void; onSaved:(adm:string)=>void }) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState({ firstName:"", middleName:"", lastName:"", gender:"", dateOfBirth:"", classId:"", legacyAdmissionNo:"", upiNumber:"", birthCertNo:"" });
  const [g, setG] = React.useState({ fullName:"", phone:"", relationship:"Parent", createLogin:false });
  const set = (k:string,v:string|boolean)=>setF((p)=>({...p,[k]:v}));
  const setGuardian = (k:string,v:string|boolean)=>setG((p)=>({...p,[k]:v}));

  async function save() {
    if (!f.firstName.trim()||!f.lastName.trim()||!f.gender) { toast({title:"Name and gender are required.", tone:"error"}); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName:f.firstName.trim(), middleName:f.middleName.trim()||undefined, lastName:f.lastName.trim(),
        gender:f.gender, dateOfBirth:f.dateOfBirth||undefined, classId:f.classId||undefined, legacyAdmissionNo:f.legacyAdmissionNo||undefined,
        upiNumber:f.upiNumber.trim()||undefined, birthCertNo:f.birthCertNo.trim()||undefined,
      };
      if (g.fullName.trim() && g.phone.trim()) {
        body.guardians = [{ fullName:g.fullName.trim(), phone:g.phone.trim(), relationship:g.relationship, isPrimary:true, createLogin:g.createLogin }];
      }
      const res = await fetch("/api/students", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) onSaved(json.data.admissionNo);
      else {
        const msg = json.error?.fields ? Object.values(json.error.fields)[0] : json.error?.message;
        toast({ title:(msg as string)||"Could not save", tone:"error" });
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-card dark:bg-navy-900 sm:rounded-2xl" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Register new student</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First name</Label><Input value={f.firstName} onChange={(e)=>set("firstName",e.target.value)} placeholder="Achieng" autoFocus /></div>
            <div className="space-y-1"><Label>Last name</Label><Input value={f.lastName} onChange={(e)=>set("lastName",e.target.value)} placeholder="Otieno" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Middle name (optional)</Label><Input value={f.middleName} onChange={(e)=>set("middleName",e.target.value)} /></div>
            <div className="space-y-1"><Label>Gender</Label>
              <select value={f.gender} onChange={(e)=>set("gender",e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                <option value="">Choose…</option><option value="M">Boy</option><option value="F">Girl</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date of birth</Label><Input type="date" value={f.dateOfBirth} onChange={(e)=>set("dateOfBirth",e.target.value)} /></div>
            <div className="space-y-1"><Label>Class</Label>
              <select value={f.classId} onChange={(e)=>set("classId",e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                <option value="">Unassigned</option>
                {classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label>School admission no. (optional)</Label><Input value={f.legacyAdmissionNo} onChange={(e)=>set("legacyAdmissionNo",e.target.value)} placeholder="Keep the school's existing number" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>UPI / NEMIS no. (optional)</Label><Input value={f.upiNumber} onChange={(e)=>set("upiNumber",e.target.value)} /></div>
            <div className="space-y-1"><Label>Birth cert no. (optional)</Label><Input value={f.birthCertNo} onChange={(e)=>set("birthCertNo",e.target.value)} /></div>
          </div>

          <div className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
            <p className="mb-2 text-sm font-medium text-navy-700 dark:text-navy-200">Primary guardian (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input value={g.fullName} onChange={(e)=>setGuardian("fullName",e.target.value)} placeholder="Wanjiru Mary" /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={g.phone} onChange={(e)=>setGuardian("phone",e.target.value)} placeholder="0712 345 678" /></div>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input type="checkbox" checked={g.createLogin} onChange={(e)=>setGuardian("createLogin",e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
              Create a parent portal login
            </label>
          </div>
          <p className="text-xs text-navy-400">An admission number is generated automatically. Joining requirements are copied from your school profile.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving?<Loader2 className="h-4 w-4 animate-spin" />:<Plus className="h-4 w-4" />} Register student</Button>
        </div>
      </div>
    </div>
  );
}
