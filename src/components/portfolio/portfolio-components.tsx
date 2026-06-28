"use client";

/**
 * PART J.7 — Student Portfolio System UI Components.
 *
 * Liquid Glass-ready reusable components for learner portfolio timelines,
 * approval workflows, encrypted uploads and export surfaces. These components
 * are presentational/forms only and intentionally do not fetch directly;
 * page/API wiring comes in Chunk 6.
 */
import * as React from "react";
import {
  FolderOpen,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Save,
  X,
  Trash2,
  Pencil,
  Download,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Camera,
  Video,
  Code2,
  Medal,
  ImageIcon,
  BookMarked,
  Clock3,
  CheckSquare,
  UploadCloud,
  Archive,
  Link2,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { PORTFOLIO_CATEGORIES } from "@/lib/validations/portfolio";

export interface PortfolioStudentView {
  id: string;
  name: string;
  admissionNo: string;
  className: string | null;
  photoUrl: string | null;
}

export interface PortfolioItemView {
  id: string;
  title: string;
  category: (typeof PORTFOLIO_CATEGORIES)[number];
  description: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  visibleToParents: boolean;
  storedFileId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  externalLink: string | null;
  competencyId: string | null;
  subjectId: string | null;
  clubId: string | null;
  awardId: string | null;
  createdByName: string;
  approvedByName?: string | null;
  approvedAt?: string | Date | null;
  createdAt: string | Date;
}

export interface PortfolioStorageView {
  totalStorageBytes: number;
  totalStorageMegabytes: number;
  warningThresholdBytes: number;
  warningThresholdMegabytes: number;
  storageWarningExceeded: boolean;
  maxLimitMegabytes: number;
}

export interface PortfolioTimelineView {
  canSubmit: boolean;
  canApprove: boolean;
  student: PortfolioStudentView;
  items: PortfolioItemView[];
  storage: PortfolioStorageView;
}

export interface PortfolioLinkOption {
  id: string;
  label: string;
  helper?: string;
}

function statusTone(status: PortfolioItemView["status"]): "green" | "amber" | "red" | "neutral" {
  if (status === "APPROVED") return "green";
  if (status === "SUBMITTED") return "amber";
  if (status === "REJECTED") return "red";
  return "neutral";
}

function categoryIcon(category: PortfolioItemView["category"]) {
  switch (category) {
    case "VIDEO":
      return <Video className="h-5 w-5 text-red-500" />;
    case "PHOTO":
      return <Camera className="h-5 w-5 text-amber-500" />;
    case "ART":
      return <ImageIcon className="h-5 w-5 text-pink-500" />;
    case "CODING":
      return <Code2 className="h-5 w-5 text-green-500" />;
    case "CERTIFICATE":
      return <Medal className="h-5 w-5 text-blue-500" />;
    case "OBSERVATION":
      return <BookMarked className="h-5 w-5 text-navy-500" />;
    case "COMMUNITY":
      return <Trophy className="h-5 w-5 text-emerald-500" />;
    default:
      return <FolderOpen className="h-5 w-5 text-green-600" />;
  }
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "No file";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
}

// ---- 1. Hero ----------------------------------------------------------------
export function PortfolioHero({
  timeline,
  onNewItem,
  onOpenQueue,
  onExport,
  busy,
}: {
  timeline: PortfolioTimelineView;
  onNewItem: () => void;
  onOpenQueue: () => void;
  onExport: () => void;
  busy: boolean;
}) {
  const submittedCount = timeline.items.filter((item) => item.status === "SUBMITTED").length;
  const approvedCount = timeline.items.filter((item) => item.status === "APPROVED").length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-navy-900/80 to-navy-850/80 p-6 backdrop-blur-2xl dark:border-white/10 dark:from-navy-950/80 dark:to-navy-900/80 sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green" className="border border-green-400/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Education OS · Student Portfolio
            </Badge>
            <Badge tone="neutral" className="border border-white/20 font-mono text-xs text-white">
              {timeline.student.admissionNo}
            </Badge>
            {timeline.student.className ? (
              <Badge tone="neutral" className="border border-white/20 text-xs text-white">
                {timeline.student.className}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {timeline.student.name}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-navy-100 dark:text-navy-200">
            Capture learner projects, creative work, certificates, coding pieces and community activities in one trusted timeline. Student uploads stay encrypted in the Storage Vault until the school approves what families should see.
          </p>
          <p className="text-xs font-medium text-green-400">
            {approvedCount} approved item(s) · {submittedCount} awaiting review
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onExport} className="rounded-full backdrop-blur-xl">
            <Download className="h-4 w-4 text-green-400" /> Export pack
          </Button>
          {timeline.canApprove ? (
            <Button variant="secondary" onClick={onOpenQueue} className="rounded-full backdrop-blur-xl">
              <CheckSquare className="h-4 w-4 text-amber-500" /> Review queue
            </Button>
          ) : null}
          {timeline.canSubmit ? (
            <Button onClick={onNewItem} disabled={busy} className="rounded-full bg-green-600 text-white shadow-card hover:bg-green-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New portfolio item
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---- 2. Summary Grid --------------------------------------------------------
export function PortfolioSummaryGrid({ timeline }: { timeline: PortfolioTimelineView }) {
  const approved = timeline.items.filter((item) => item.status === "APPROVED").length;
  const submitted = timeline.items.filter((item) => item.status === "SUBMITTED").length;
  const familyVisible = timeline.items.filter((item) => item.status === "APPROVED" && item.visibleToParents).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Timeline Items</p>
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{timeline.items.length}</p>
          </div>
          <div className="rounded-2xl bg-navy-50 p-3 dark:bg-navy-900/50">
            <FolderOpen className="h-6 w-6 text-navy-600 dark:text-navy-300" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Awaiting Review</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{submitted}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-900/20">
            <Clock3 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Approved & Visible</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{familyVisible}</p>
          </div>
          <div className="rounded-2xl bg-green-50 p-3 dark:bg-green-900/20">
            <Eye className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Storage Used</p>
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{timeline.storage.totalStorageMegabytes} MB</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-900/20">
            <UploadCloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- 3. Mandatory UX States -------------------------------------------------
export function PortfolioLoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function PortfolioErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50/80 backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/40">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/50">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-red-900 dark:text-red-200">Unable to load portfolio timeline</p>
          <p className="text-sm text-red-600 dark:text-red-400">Please check your connection and try again.</p>
        </div>
        <Button onClick={onRetry} variant="secondary" className="rounded-full bg-white dark:bg-navy-900">
          <Sparkles className="h-4 w-4" /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export function PortfolioEmptyState({ canSubmit, onNewItem }: { canSubmit: boolean; onNewItem: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No portfolio items yet"
      description="Start with a project, certificate, coding sample, artwork or community activity. Student uploads stay encrypted in the Storage Vault until the school reviews them."
      primaryAction={canSubmit ? { label: "Create portfolio item", onClick: onNewItem } : undefined}
    />
  );
}

// ---- 4. Storage Warning -----------------------------------------------------
export function PortfolioStorageWarningCard({ storage }: { storage: PortfolioStorageView }) {
  const percentage = Math.min(100, Math.round((storage.totalStorageBytes / (storage.warningThresholdBytes || 1)) * 100));
  const overLimit = storage.storageWarningExceeded;

  return (
    <Card className={`${overLimit ? "border-amber-300 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/30" : "border-white/40 bg-white/80 dark:border-white/10 dark:bg-navy-950/70"} backdrop-blur-xl`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {overLimit ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
          Portfolio Storage Monitor
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">
          Portfolio evidence files use the encrypted Storage Vault path. A storage warning threshold appears once the learner crosses {storage.warningThresholdMegabytes} MB, while each single file still caps at {storage.maxLimitMegabytes} MB.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{storage.totalStorageMegabytes} MB</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Current encrypted portfolio storage</p>
          </div>
          <Badge tone={overLimit ? "amber" : "green"}>
            {overLimit ? "Warning threshold reached" : "Within safe range"}
          </Badge>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-900">
          <div
            className={`h-full rounded-full ${overLimit ? "bg-amber-500" : "bg-green-500"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---- 5. Timeline Card -------------------------------------------------------
export function PortfolioTimelineCard({
  item,
  canManage,
  busyId,
  onEdit,
  onDelete,
}: {
  item: PortfolioItemView;
  canManage: boolean;
  busyId: string | null;
  onEdit: (item: PortfolioItemView) => void;
  onDelete: (item: PortfolioItemView) => void;
}) {
  const busy = busyId === item.id;

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl transition-all duration-200 ease-apple hover:shadow-card dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 dark:bg-navy-900/60">
            {categoryIcon(item.category)}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              <Badge tone="neutral">{item.category}</Badge>
              {item.visibleToParents ? (
                <Badge tone="green"><Eye className="mr-1 h-3 w-3" /> Family visible</Badge>
              ) : (
                <Badge tone="neutral"><EyeOff className="mr-1 h-3 w-3" /> School-only</Badge>
              )}
            </div>
            <CardTitle className="text-lg font-bold text-navy-900 dark:text-navy-50">{item.title}</CardTitle>
            <p className="text-xs text-navy-400">
              Added {formatDate(item.createdAt)} by {item.createdByName}
              {item.approvedByName ? ` · approved by ${item.approvedByName}` : ""}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onEdit(item)} disabled={busy} className="rounded-full">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(item)} disabled={busy} className="rounded-full text-navy-500 hover:text-red-600">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {item.description ? <p className="text-sm leading-relaxed text-navy-600 dark:text-navy-300">{item.description}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-navy-100 bg-white/60 p-3 dark:border-navy-800 dark:bg-navy-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">File</p>
            <p className="mt-1 text-sm font-medium text-navy-900 dark:text-navy-50">{item.fileName ?? "No uploaded file"}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">{formatBytes(item.fileSizeBytes)}</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white/60 p-3 dark:border-navy-800 dark:bg-navy-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Evidence Link</p>
            <p className="mt-1 text-sm font-medium text-navy-900 dark:text-navy-50">{item.externalLink ? "Included" : "No external link"}</p>
            {item.externalLink ? <a href={item.externalLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600 hover:underline">Open link <ExternalLink className="h-3 w-3" /></a> : null}
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white/60 p-3 dark:border-navy-800 dark:bg-navy-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Linked Learning</p>
            <p className="mt-1 text-sm font-medium text-navy-900 dark:text-navy-50">{item.competencyId || item.subjectId ? "Mapped" : "Not mapped yet"}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Competencies, subjects, clubs and awards connect here.</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white/60 p-3 dark:border-navy-800 dark:bg-navy-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Approval Date</p>
            <p className="mt-1 text-sm font-medium text-navy-900 dark:text-navy-50">{formatDate(item.approvedAt)}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Status tracked in the school audit trail.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- 6. Approval Queue ------------------------------------------------------
export function PortfolioApprovalQueue({
  items,
  busyId,
  onApprove,
  onReject,
}: {
  items: PortfolioItemView[];
  busyId: string | null;
  onApprove: (item: PortfolioItemView) => void;
  onReject: (item: PortfolioItemView) => void;
}) {
  const queue = items.filter((item) => item.status === "SUBMITTED");

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-amber-600" /> Approval Queue
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">
          Review newly submitted learner work before it appears to families or enters the portable export pack.
        </p>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No items awaiting review" description="New student submissions appear here for teacher or leadership approval." />
        ) : (
          <div className="space-y-4">
            {queue.map((item) => {
              const busy = busyId === item.id;
              return (
                <div key={item.id} className="rounded-2xl border border-navy-100 bg-white/60 p-4 dark:border-navy-800 dark:bg-navy-900/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="amber">Awaiting review</Badge>
                        <Badge tone="neutral">{item.category}</Badge>
                      </div>
                      <p className="text-base font-bold text-navy-900 dark:text-navy-50">{item.title}</p>
                      <p className="text-xs text-navy-400">Submitted {formatDate(item.createdAt)} by {item.createdByName}</p>
                      {item.description ? <p className="text-sm text-navy-600 dark:text-navy-300">{item.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" onClick={() => onReject(item)} disabled={busy} className="rounded-full">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Reject
                      </Button>
                      <Button onClick={() => onApprove(item)} disabled={busy} className="rounded-full bg-green-600 text-white hover:bg-green-500">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve for families
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 7. Export CTA ----------------------------------------------------------
export function PortfolioExportCard({
  student,
  approvedCount,
  onExport,
  exporting,
}: {
  student: PortfolioStudentView;
  approvedCount: number;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-green-600" /> Portable Portfolio Export Pack
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">
          Export approved visible learner work for transfer, reporting and family sharing. Unapproved school-only items stay out of the pack automatically.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{student.name}</p>
          <p className="text-sm text-navy-500 dark:text-navy-400">{approvedCount} approved item(s) currently ready for export</p>
        </div>
        <Button onClick={onExport} disabled={exporting} className="rounded-full bg-green-600 text-white shadow-card hover:bg-green-500">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export pack
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- 8. Submit/Edit Form ----------------------------------------------------
export function PortfolioItemForm({
  studentId,
  initial,
  competencyOptions,
  subjectOptions,
  clubOptions,
  awardOptions,
  onSubmit,
  onClose,
  saving,
}: {
  studentId: string;
  initial?: PortfolioItemView;
  competencyOptions?: PortfolioLinkOption[];
  subjectOptions?: PortfolioLinkOption[];
  clubOptions?: PortfolioLinkOption[];
  awardOptions?: PortfolioLinkOption[];
  onSubmit: (data: {
    studentId: string;
    title: string;
    category: (typeof PORTFOLIO_CATEGORIES)[number];
    description?: string;
    storedFileId?: string;
    fileUrl?: string;
    fileName?: string;
    fileSizeBytes?: number;
    externalLink?: string;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
    visibleToParents: boolean;
    competencyId?: string;
    subjectId?: string;
    clubId?: string;
    awardId?: string;
  }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [category, setCategory] = React.useState<(typeof PORTFOLIO_CATEGORIES)[number]>(initial?.category ?? "PROJECT");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [externalLink, setExternalLink] = React.useState(initial?.externalLink ?? "");
  const [status, setStatus] = React.useState<"DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED">(initial?.status ?? "SUBMITTED");
  const [visibleToParents, setVisibleToParents] = React.useState(initial?.visibleToParents ?? false);
  const [competencyId, setCompetencyId] = React.useState(initial?.competencyId ?? "");
  const [subjectId, setSubjectId] = React.useState(initial?.subjectId ?? "");
  const [clubId, setClubId] = React.useState(initial?.clubId ?? "");
  const [awardId, setAwardId] = React.useState(initial?.awardId ?? "");
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile | null>(
    initial?.storedFileId || initial?.fileUrl
      ? {
          id: initial?.storedFileId ?? initial.id,
          url: initial?.fileUrl ?? "",
          fileName: initial?.fileName ?? `${initial.title}.file`,
          encrypted: true,
        }
      : null
  );
  const [uploadedFileSizeBytes, setUploadedFileSizeBytes] = React.useState<number | undefined>(initial?.fileSizeBytes ?? undefined);

  function selectValue(options: PortfolioLinkOption[] | undefined, value: string, setter: (value: string) => void, label: string) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <select value={value} onChange={(e) => setter(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">Not linked yet</option>
          {(options ?? []).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      studentId,
      title,
      category,
      description: description || undefined,
      storedFileId: uploadedFile?.id || undefined,
      fileUrl: uploadedFile?.url || undefined,
      fileName: uploadedFile?.fileName || undefined,
      fileSizeBytes: uploadedFileSizeBytes,
      externalLink: externalLink || undefined,
      status,
      visibleToParents,
      competencyId: competencyId || undefined,
      subjectId: subjectId || undefined,
      clubId: clubId || undefined,
      awardId: awardId || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm dark:bg-navy-950/60" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-4xl overflow-hidden border-white/40 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-navy-950/90">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-navy-100 px-6 py-4 dark:border-navy-800">
            <CardTitle className="text-lg font-bold">{initial ? "Edit Portfolio Item" : "Create Portfolio Item"}</CardTitle>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-full p-2.5">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="max-h-[min(82dvh,46rem)] space-y-6 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Community clean-up photo story" required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value as (typeof PORTFOLIO_CATEGORIES)[number])} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {PORTFOLIO_CATEGORIES.map((itemCategory) => (
                    <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Submission Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description / Reflection</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what the learner made, what was learned, and why it matters." className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-sm dark:border-navy-700 dark:bg-navy-900" rows={3} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-white/40 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UploadCloud className="h-5 w-5 text-green-600" /> Encrypted Portfolio Upload
                  </CardTitle>
                  <p className="text-sm text-navy-500 dark:text-navy-400">
                    Portfolio uploads go through the encrypted Storage Vault path. Each single file stays capped at 50 MB.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FileUpload
                    category="portfolio"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/*"
                    onUploaded={(file) => {
                      setUploadedFile(file);
                      setUploadedFileSizeBytes(undefined);
                    }}
                    label="Attach portfolio file"
                  />
                  {uploadedFile ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 text-sm dark:border-green-900/40 dark:bg-green-950/20">
                      <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300">
                        <CheckCircle2 className="h-4 w-4" /> {uploadedFile.fileName}
                      </div>
                      <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">Encrypted upload ready for submission.</p>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label>Optional file size override (bytes)</Label>
                    <Input type="number" min={0} value={uploadedFileSizeBytes ?? ""} onChange={(e) => setUploadedFileSizeBytes(e.target.value ? Number(e.target.value) : undefined)} placeholder="Leave blank unless you need to preserve exact imported size" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/40 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Link2 className="h-5 w-5 text-blue-600" /> Linked Learning & Family Visibility
                  </CardTitle>
                  <p className="text-sm text-navy-500 dark:text-navy-400">
                    Connect the item to learning areas and control whether approved work becomes visible to families.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>External Link (optional)</Label>
                    <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://github.com/... or project showcase link" />
                  </div>
                  {selectValue(competencyOptions, competencyId, setCompetencyId, "Linked Competency")}
                  {selectValue(subjectOptions, subjectId, setSubjectId, "Linked Subject")}
                  {selectValue(clubOptions, clubId, setClubId, "Linked Club")}
                  {selectValue(awardOptions, awardId, setAwardId, "Linked Award")}
                  <label className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white/70 px-4 py-3 text-sm dark:border-navy-800 dark:bg-navy-950/50">
                    <input type="checkbox" checked={visibleToParents} onChange={(e) => setVisibleToParents(e.target.checked)} className="h-4 w-4 rounded text-green-600" />
                    Approved item may be shown to families
                  </label>
                </CardContent>
              </Card>
            </div>
          </CardContent>

          <div className="flex items-center justify-end gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4 dark:border-navy-800 dark:bg-navy-900/50">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="rounded-full">Cancel</Button>
            <Button type="submit" disabled={saving} className="rounded-full bg-green-600 text-white hover:bg-green-500">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Portfolio Item
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
