"use client";

import * as React from "react";
import { Loader2, GitBranch, GitCommit, PlayCircle, Eye, Archive, CheckCircle2, DownloadCloud, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function statusTone(status: string): "green" | "amber" | "neutral" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "amber";
  return "neutral";
}

export function CurriculumVersionManagerClient({ canManage }: { canManage: boolean }) {
  const [versions, setVersions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [draftingId, setDraftingId] = React.useState<string | null>(null);
  const [diffId, setDiffId] = React.useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [updates, setUpdates] = React.useState<any[]>([]);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/curriculum/versions");
      const json = await res.json();
      if (json.ok) setVersions(Array.isArray(json.data) ? json.data : []);
      else setError(json.error?.message || "Failed to load versions");
    } catch {
      setError("Failed to load versions");
      toast({ title: "Failed to load versions", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // J.21 — surface NEYO Ops template updates the school can adopt intentionally.
  const loadUpdates = React.useCallback(async () => {
    try {
      const res = await fetch("/api/curriculum/library?view=updates");
      const json = await res.json();
      if (json.ok) setUpdates(Array.isArray(json.data) ? json.data : []);
    } catch {
      /* non-blocking */
    }
  }, []);

  React.useEffect(() => {
    void load();
    void loadUpdates();
  }, [load, loadUpdates]);

  // 1) LOADING state
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-navy-400" />
      </div>
    );
  }

  // 2) ERROR state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-navy-950 dark:text-white">
            <GitBranch className="h-5 w-5 text-blue-600" /> Curriculum Versioning
          </h2>
          <p className="text-sm font-medium text-navy-500">Draft, preview, and deploy curriculum updates without breaking historical reports.</p>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setLibraryOpen(true)}>
            <DownloadCloud className="mr-2 h-4 w-4" /> Import from NEYO Library
          </Button>
        )}
      </div>

      {/* J.21 — update-available banner from the NEYO Ops library */}
      {updates.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Curriculum updates available from NEYO Ops</p>
          <ul className="mt-2 space-y-1">
            {updates.map((u) => (
              <li key={u.curriculumId} className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-semibold">{u.curriculumName}</span>: {u.adoptedVersion} → {u.latestVersion}
                {u.changeNote ? ` — ${u.changeNote}` : ""}
              </li>
            ))}
          </ul>
          {canManage && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setLibraryOpen(true)}>
              Review &amp; adopt update
            </Button>
          )}
        </div>
      )}

      {/* 3) EMPTY state */}
      {versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 p-10 text-center dark:border-navy-800">
          <GitBranch className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm font-semibold text-navy-700 dark:text-navy-200">No curriculum versions yet</p>
          <p className="mt-1 text-xs text-navy-500">Your active curriculum will appear here. Draft a new version when CBE updates, e.g. CBE 2027.</p>
        </div>
      ) : (
        /* 4) DATA state */
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-navy-100 dark:before:bg-navy-800">
          {versions.map((v) => (
            <div key={v.id} className="relative flex items-center gap-6">
              <div
                className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-navy-950 ${
                  v.status === "ACTIVE"
                    ? "bg-green-100 text-green-600"
                    : v.status === "DRAFT"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-navy-100 text-navy-500"
                }`}
              >
                {v.status === "ACTIVE" ? <CheckCircle2 className="h-4 w-4" /> : v.status === "DRAFT" ? <GitCommit className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </div>

              <Card className="flex-1 overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between bg-white p-4 dark:bg-navy-950">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                        <span className="text-xs font-bold uppercase tracking-widest text-navy-500">{v.activeVersion}</span>
                      </div>
                      <h4 className="text-lg font-bold text-navy-950 dark:text-white">{v.name}</h4>
                      <p className="mt-1 text-xs text-navy-500">
                        {v.effectiveFrom ? `Effective: ${v.effectiveFrom}` : "Not yet effective"}
                        {v.effectiveTo ? ` — ${v.effectiveTo}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-600 dark:bg-navy-900 dark:text-navy-300">
                        {v._count?.learningAreas ?? 0} Learning Areas
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-navy-100 bg-navy-50 px-4 py-3 dark:border-navy-800 dark:bg-navy-900">
                    {v.status === "ACTIVE" && canManage && (
                      <Button size="sm" variant="secondary" onClick={() => setDraftingId(v.id)}>
                        <GitBranch className="mr-2 h-3 w-3" /> Draft Next Update
                      </Button>
                    )}
                    {v.status === "DRAFT" && canManage && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setDiffId(v.id)}>
                          <Eye className="mr-2 h-3 w-3" /> Preview Diff
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            if (!confirm("Publishing will archive the active version. Historical reports keep their old version. Continue?")) return;
                            const res = await fetch("/api/curriculum/versions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "PUBLISH", draftId: v.id }),
                            });
                            if (res.ok) {
                              toast({ title: "Published", tone: "success" });
                              void load();
                            } else {
                              toast({ title: "Failed to publish", tone: "error" });
                            }
                          }}
                        >
                          <PlayCircle className="mr-2 h-3 w-3" /> Publish Live
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DRAFT", curriculumId: originalId, versionName }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Draft created", tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Draft New Curriculum Version</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="mb-4 text-xs text-navy-500">Clones the active curriculum into a safe sandbox. You can add or remove subjects and competencies without affecting live reports.</p>
          <div className="space-y-1">
            <Label>New Version Name</Label>
            <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. CBE 2027 Update" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
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
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setDiff(j.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [draftId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preview Migration Changes</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-navy-400" />
            </div>
          ) : !diff ? (
            <p className="text-sm text-red-500">Failed to load diff.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-navy-950 dark:text-white">
                <Badge tone="neutral">{diff.baseVersion}</Badge> <span className="text-navy-400">→</span> <Badge tone="blue">{diff.draftVersion}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-navy-100 bg-navy-50 p-3 dark:border-navy-800 dark:bg-navy-900">
                  <span className="font-semibold text-navy-600 dark:text-navy-300">Unchanged Areas:</span> {diff.unchangedCount}
                </div>

                {diff.added?.length > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/20">
                    <span className="font-semibold text-green-700 dark:text-green-400">Added (+{diff.added.length}):</span>
                    <ul className="mt-1 list-disc pl-5 text-xs text-green-600 dark:text-green-300">
                      {diff.added.map((a: any) => <li key={a.code}>{a.name}</li>)}
                    </ul>
                  </div>
                )}

                {diff.removed?.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                    <span className="font-semibold text-red-700 dark:text-red-400">Removed (-{diff.removed.length}):</span>
                    <ul className="mt-1 list-disc pl-5 text-xs text-red-600 dark:text-red-300">
                      {diff.removed.map((a: any) => <li key={a.code}>{a.name}</li>)}
                    </ul>
                  </div>
                )}

                {diff.renamed?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">Renamed ({diff.renamed.length}):</span>
                    <ul className="mt-1 list-disc pl-5 text-xs text-amber-600 dark:text-amber-300">
                      {diff.renamed.map((r: any) => <li key={r.code}>{r.from} → {r.to}</li>)}
                    </ul>
                  </div>
                )}

                {!diff.hasStructuralChanges && <p className="text-xs italic text-navy-500">No structural changes detected.</p>}

                {diff.impact?.warning && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                    {diff.impact.warning}
                    {typeof diff.impact.pinnedHistoricalReports === "number" && (
                      <div className="mt-1 font-semibold">{diff.impact.pinnedHistoricalReports} historical report template(s) stay pinned to {diff.baseVersion}.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
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
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setTemplates(Array.isArray(j.data) ? j.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function adopt(id: string) {
    if (!confirm("This will import the curriculum as a new DRAFT. Continue?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id }),
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
        <DialogHeader>
          <DialogTitle>NEYO Curriculum Template Library</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-4">
          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-navy-400" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm italic text-navy-500">No published templates available from NEYO Ops.</p>
          ) : (
            <div className="space-y-4">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-navy-100 bg-navy-50/30 p-4 dark:border-navy-800 dark:bg-navy-900/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex gap-2">
                        <Badge tone="neutral">{t.country}</Badge>
                        <Badge tone="blue">{t.version}</Badge>
                      </div>
                      <h4 className="flex items-center gap-2 text-base font-bold text-navy-950 dark:text-white">
                        <BookOpen className="h-4 w-4 text-blue-500" /> {t.name}
                      </h4>
                      {t.description && <p className="mt-1 text-xs text-navy-600 dark:text-navy-400">{t.description}</p>}
                    </div>
                    <Button onClick={() => adopt(t.id)} disabled={saving} size="sm" variant="primary">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import to Draft"}
                    </Button>
                  </div>
                  <div className="mt-3 border-t border-navy-100 pt-3 dark:border-navy-800">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-navy-500">Includes Learning Areas:</p>
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(t.learningAreasJson || "[]").map((la: any) => (
                        <Badge key={la.code} tone="neutral">{la.name}</Badge>
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
