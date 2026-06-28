"use client";

import * as React from "react";
import { FolderOpen, GraduationCap, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PortfolioHero,
  PortfolioSummaryGrid,
  PortfolioLoadingState,
  PortfolioErrorState,
  PortfolioEmptyState,
  PortfolioStorageWarningCard,
  PortfolioTimelineCard,
  PortfolioApprovalQueue,
  PortfolioExportCard,
  PortfolioItemForm,
  type PortfolioTimelineView,
  type PortfolioItemView,
  type PortfolioLinkOption,
} from "@/components/portfolio/portfolio-components";

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
  legacyAdmissionNo?: string | null;
  className: string | null;
}

export type PortfolioStatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "VISIBLE_TO_FAMILY";

export function portfolioStatusCounts(items: PortfolioItemView[]) {
  return {
    ALL: items.length,
    DRAFT: items.filter((item) => item.status === "DRAFT").length,
    SUBMITTED: items.filter((item) => item.status === "SUBMITTED").length,
    APPROVED: items.filter((item) => item.status === "APPROVED").length,
    REJECTED: items.filter((item) => item.status === "REJECTED").length,
    VISIBLE_TO_FAMILY: items.filter((item) => item.status === "APPROVED" && item.visibleToParents).length,
  };
}

export function filterPortfolioItems(items: PortfolioItemView[], query: string, status: PortfolioStatusFilter) {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery = !normalized || [
      item.title,
      item.category,
      item.description ?? "",
      item.fileName ?? "",
      item.createdByName,
      item.approvedByName ?? "",
    ].some((value) => value.toLowerCase().includes(normalized));

    const matchesStatus =
      status === "ALL" ? true :
      status === "VISIBLE_TO_FAMILY" ? (item.status === "APPROVED" && item.visibleToParents) :
      item.status === status;

    return matchesQuery && matchesStatus;
  });
}

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === "" || value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export function PortfolioClient({ initialStudentId = "" }: { initialStudentId?: string }) {
  const { toast } = useToast();
  const [students, setStudents] = React.useState<StudentOption[]>([]);
  const [studentId, setStudentId] = React.useState(initialStudentId);
  const [timeline, setTimeline] = React.useState<PortfolioTimelineView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PortfolioItemView | null>(null);
  const [queueOpen, setQueueOpen] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<PortfolioStatusFilter>("ALL");
  const queueRef = React.useRef<HTMLDivElement | null>(null);
  const [competencyOptions, setCompetencyOptions] = React.useState<PortfolioLinkOption[]>([]);
  const [subjectOptions, setSubjectOptions] = React.useState<PortfolioLinkOption[]>([]);

  const loadStudents = React.useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await fetch("/api/students", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setStudents([]);
        return;
      }
      const mapped: StudentOption[] = (json.data.students ?? []).map((student: any) => ({
        id: student.id,
        name: student.name,
        admissionNo: student.admissionNo,
        legacyAdmissionNo: student.legacyAdmissionNo ?? null,
        className: student.className ?? null,
      }));
      setStudents(mapped);
      setStudentId((current) => {
        if (current && mapped.some((student) => student.id === current)) return current;
        if (initialStudentId && mapped.some((student) => student.id === initialStudentId)) return initialStudentId;
        return mapped.length === 1 ? mapped[0].id : current;
      });
    } finally {
      setPickerLoading(false);
    }
  }, [initialStudentId]);

  const loadTimeline = React.useCallback(async (targetStudentId: string) => {
    if (!targetStudentId) {
      setTimeline(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?studentId=${encodeURIComponent(targetStudentId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setTimeline(null);
        setError(json.error?.message || "Portfolio timeline could not load.");
        return;
      }
      setTimeline(json.data.timeline);
    } catch {
      setTimeline(null);
      setError("Check your connection and try again.");
    }
  }, []);

  const loadOptions = React.useCallback(async () => {
    try {
      const [competenciesRes, subjectsRes] = await Promise.all([
        fetch("/api/competencies", { cache: "no-store" }),
        fetch("/api/academics/subjects", { cache: "no-store" }),
      ]);

      const competenciesJson = await competenciesRes.json().catch(() => ({ ok: false }));
      if (competenciesJson.ok) {
        setCompetencyOptions(
          (competenciesJson.data.board?.competencies ?? []).map((item: any) => ({
            id: item.id,
            label: `${item.name} (${item.code})`,
            helper: item.groupName,
          }))
        );
      }

      const subjectsJson = await subjectsRes.json().catch(() => ({ ok: false }));
      if (subjectsJson.ok) {
        setSubjectOptions(
          (subjectsJson.data.subjects ?? []).map((item: any) => ({
            id: item.id,
            label: `${item.name} (${item.code})`,
            helper: item.curriculum,
          }))
        );
      }
    } catch {
      // Non-fatal: selectors can remain empty when the user cannot access these sources.
    }
  }, []);

  React.useEffect(() => {
    void loadStudents();
    void loadOptions();
  }, [loadStudents, loadOptions]);

  React.useEffect(() => {
    void loadTimeline(studentId);
    setQuery("");
    setStatusFilter("ALL");
    setQueueOpen(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (studentId) url.searchParams.set("studentId", studentId);
      else url.searchParams.delete("studentId");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [studentId, loadTimeline]);

  async function post(action: string, payload: Record<string, unknown>, successTitle: string, targetId?: string) {
    if (targetId) setBusyId(targetId);
    else setSaving(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Portfolio action failed", tone: "error" });
        return null;
      }
      toast({ title: successTitle, tone: "success" });
      setShowForm(false);
      setEditingItem(null);
      await loadTimeline(studentId);
      return json.data.result;
    } catch {
      toast({ title: "Could not reach the portfolio endpoint", tone: "error" });
      return null;
    } finally {
      if (targetId) setBusyId(null);
      else setSaving(false);
    }
  }

  async function exportPack() {
    if (!studentId || !timeline) return;
    const approvedVisibleCount = timeline.items.filter((item) => item.status === "APPROVED" && item.visibleToParents).length;
    if (approvedVisibleCount === 0) {
      toast({ title: "Nothing is ready for export yet", description: "Approve at least one family-visible portfolio item first.", tone: "error" });
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(`/api/portfolio?studentId=${encodeURIComponent(studentId)}&export=1`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not export portfolio pack", tone: "error" });
        return;
      }
      const blob = new Blob([JSON.stringify(json.data.pack, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${timeline.student.admissionNo}-portfolio-pack.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Portfolio export downloaded", tone: "success" });
    } finally {
      setExporting(false);
    }
  }

  function openQueue() {
    setQueueOpen(true);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filteredItems = timeline ? filterPortfolioItems(timeline.items, query, statusFilter) : [];
  const counts = timeline ? portfolioStatusCounts(timeline.items) : null;
  const queueCount = timeline ? timeline.items.filter((item) => item.status === "SUBMITTED").length : 0;

  if (pickerLoading && !timeline && !error) return <PortfolioLoadingState />;

  return (
    <div className="space-y-6">
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-green-600" /> Choose learner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No learners available" description="Open a learner from Students or the Parent Portal first, then their portfolio timeline appears here." />
          ) : (
            <div className="space-y-3">
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-50">
                <option value="">Choose learner...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.legacyAdmissionNo ? `${student.legacyAdmissionNo} / ${student.admissionNo}` : student.admissionNo}{student.className ? ` · ${student.className}` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {students.slice(0, 6).map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setStudentId(student.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      student.id === studentId
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-navy-200 bg-white text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300 dark:hover:bg-navy-800"
                    }`}
                  >
                    {student.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!studentId ? (
        <EmptyState
          icon={GraduationCap}
          title="No learner selected yet"
          description="Choose a learner above to open their portfolio timeline, approval queue and export pack."
        />
      ) : error && !timeline ? (
        <PortfolioErrorState onRetry={() => loadTimeline(studentId)} />
      ) : !timeline ? (
        <PortfolioLoadingState />
      ) : (
        <>
          <PortfolioHero
            timeline={timeline}
            onNewItem={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            onOpenQueue={openQueue}
            onExport={exportPack}
            busy={saving}
          />

          {error ? <PortfolioErrorState onRetry={() => loadTimeline(studentId)} /> : null}

          <PortfolioSummaryGrid timeline={timeline} />
          <PortfolioStorageWarningCard storage={timeline.storage} />
          <PortfolioExportCard
            student={timeline.student}
            approvedCount={timeline.items.filter((item) => item.status === "APPROVED" && item.visibleToParents).length}
            onExport={exportPack}
            exporting={exporting}
          />

          {timeline.items.length === 0 ? (
            <PortfolioEmptyState canSubmit={timeline.canSubmit} onNewItem={() => setShowForm(true)} />
          ) : (
            <>
              <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
                <CardHeader className="gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <SlidersHorizontal className="h-5 w-5 text-green-600" /> Timeline Filters
                      </CardTitle>
                      <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Search learner work quickly and narrow the timeline by approval state.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setQueueOpen((current) => !current)} className="rounded-full">
                        {queueOpen ? "Hide queue" : `Show queue (${queueCount})`}
                      </Button>
                      {(query || statusFilter !== "ALL") ? (
                        <Button variant="ghost" onClick={() => { setQuery(""); setStatusFilter("ALL"); }} className="rounded-full">
                          Clear filters
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 dark:border-navy-700 dark:bg-navy-900">
                      <Search className="h-4 w-4 text-navy-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title, category, file name or owner…"
                        className="w-full bg-transparent text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none dark:text-navy-50"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["ALL", counts?.ALL ?? 0, "All"],
                        ["SUBMITTED", counts?.SUBMITTED ?? 0, "Awaiting Review"],
                        ["APPROVED", counts?.APPROVED ?? 0, "Approved"],
                        ["REJECTED", counts?.REJECTED ?? 0, "Rejected"],
                        ["VISIBLE_TO_FAMILY", counts?.VISIBLE_TO_FAMILY ?? 0, "Family Visible"],
                      ] as const).map(([value, count, label]) => (
                        <button
                          key={value}
                          onClick={() => setStatusFilter(value)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            statusFilter === value
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-navy-200 bg-white text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300 dark:hover:bg-navy-800"
                          }`}
                        >
                          {label} <span className="opacity-80">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  {filteredItems.length === 0 ? (
                    <EmptyState
                      icon={FolderOpen}
                      title="No portfolio items match these filters"
                      description="Try clearing the search text or switching back to another status view."
                      action={<Button variant="secondary" onClick={() => { setQuery(""); setStatusFilter("ALL"); }} className="rounded-full">Clear filters</Button>}
                    />
                  ) : (
                    filteredItems.map((item) => (
                      <PortfolioTimelineCard
                        key={item.id}
                        item={item}
                        canManage={timeline.canSubmit || timeline.canApprove}
                        busyId={busyId}
                        onEdit={(target) => {
                          setEditingItem(target);
                          setShowForm(true);
                        }}
                        onDelete={(target) => {
                          if (!window.confirm(`Delete “${target.title}”?`)) return;
                          void post("delete_item", { id: target.id }, "Portfolio item deleted", target.id);
                        }}
                      />
                    ))
                  )}
                </div>

                <div ref={queueRef} className="space-y-4">
                  {(timeline.canApprove || queueCount > 0) && queueOpen ? (
                    <PortfolioApprovalQueue
                      items={timeline.items}
                      busyId={busyId}
                      onApprove={(item) => void post("approve_item", { itemId: item.id, status: "APPROVED", visibleToParents: true }, "Portfolio item approved", item.id)}
                      onReject={(item) => {
                        const note = window.prompt("Optional note for the learner/family", "Needs a clearer description before approval.") || undefined;
                        void post("reject_item", { itemId: item.id, status: "REJECTED", visibleToParents: false, note }, "Portfolio item rejected", item.id);
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showForm && studentId ? (
        <PortfolioItemForm
          studentId={studentId}
          initial={editingItem ?? undefined}
          competencyOptions={competencyOptions}
          subjectOptions={subjectOptions}
          clubOptions={[]}
          awardOptions={[]}
          saving={saving}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSubmit={(draft) => {
            if (editingItem) {
              void post("update_item", compactPayload({ id: editingItem.id, ...draft }), "Portfolio item updated");
            } else {
              void post("submit_item", compactPayload(draft), "Portfolio item submitted");
            }
          }}
        />
      ) : null}
    </div>
  );
}
