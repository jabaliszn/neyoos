"use client";

/**
 * PART J.8 — Learning Journey Timeline UI Components.
 *
 * Reusable Liquid Glass-ready components for learner journey timelines. These
 * are presentational only and do not fetch directly; page wiring comes later.
 */
import * as React from "react";
import {
  GraduationCap,
  ClipboardList,
  CalendarDays,
  ShieldCheck,
  Brain,
  Award,
  FolderOpen,
  FileCheck2,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Lock,
  Clock3,
  Download,
  ArrowRight,
  Activity,
  BookOpen,
  Users,
  Pin,
  PinOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LEARNER_JOURNEY_SOURCES,
  LEARNER_JOURNEY_MODES,
  LEARNER_JOURNEY_VERIFICATION,
  LEARNER_JOURNEY_VISIBILITY,
} from "@/lib/validations/learner-journey";
import { cn } from "@/lib/utils";

export interface LearnerJourneyStudentView {
  id: string;
  name: string;
  admissionNo: string;
  className: string | null;
  photoUrl: string | null;
}

export interface LearnerJourneyEntryView {
  id: string;
  date: string;
  sourceModule: (typeof LEARNER_JOURNEY_SOURCES)[number];
  eventType: string;
  title: string;
  summary: string;
  visibility: (typeof LEARNER_JOURNEY_VISIBILITY)[number];
  verificationStatus: (typeof LEARNER_JOURNEY_VERIFICATION)[number];
  status?: string | null;
  href?: string | null;
  pinned?: boolean;
  pinVisibility?: (typeof LEARNER_JOURNEY_VISIBILITY)[number] | null;
  pinNote?: string | null;
}

export interface LearnerJourneySummaryView {
  totalEntries: number;
  returnedEntries: number;
  sourceCounts: Array<{ source: (typeof LEARNER_JOURNEY_SOURCES)[number]; count: number }>;
}

export interface LearnerJourneyTimelineView {
  student: LearnerJourneyStudentView;
  mode: (typeof LEARNER_JOURNEY_MODES)[number];
  filters: {
    from: string | null;
    to: string | null;
    source: (typeof LEARNER_JOURNEY_SOURCES)[number] | "ALL";
    limit: number;
  };
  summary: LearnerJourneySummaryView;
  entries: LearnerJourneyEntryView[];
}

const SOURCE_META: Record<
  (typeof LEARNER_JOURNEY_SOURCES)[number],
  { label: string; description: string; icon: LucideIcon; tone: "blue" | "green" | "amber" | "red" | "neutral" }
> = {
  EXAM: {
    label: "Exam",
    description: "Published marks and result-release milestones.",
    icon: GraduationCap,
    tone: "blue",
  },
  ASSESSMENT: {
    label: "Assessment",
    description: "Projects, practicals, oral work and released class assessments.",
    icon: ClipboardList,
    tone: "amber",
  },
  ATTENDANCE: {
    label: "Attendance",
    description: "Important attendance moments like absence, lateness and excusal.",
    icon: CalendarDays,
    tone: "neutral",
  },
  DISCIPLINE: {
    label: "Discipline",
    description: "Approved behavior cases and suspension milestones, filtered by audience.",
    icon: ShieldCheck,
    tone: "red",
  },
  COMPETENCY: {
    label: "Competency",
    description: "Growth evidence linked to competencies and learning goals.",
    icon: Brain,
    tone: "green",
  },
  SKILLS: {
    label: "Skills",
    description: "Talent, leadership and growth points from the Skills Passport.",
    icon: Award,
    tone: "amber",
  },
  PORTFOLIO: {
    label: "Portfolio",
    description: "Projects, reflections and approved learner showcase work.",
    icon: FolderOpen,
    tone: "green",
  },
  CERTIFICATE: {
    label: "Certificate",
    description: "Verified certificate milestones already linked inside learner records.",
    icon: FileCheck2,
    tone: "blue",
  },
  SYSTEM: {
    label: "System",
    description: "School lifecycle milestones such as transfer history.",
    icon: Layers,
    tone: "neutral",
  },
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function visibilityBadge(visibility: LearnerJourneyEntryView["visibility"]) {
  return visibility === "PARENT_SAFE"
    ? { tone: "green" as const, label: "Family safe", icon: Eye }
    : { tone: "neutral" as const, label: "School staff only", icon: Lock };
}

function verificationBadge(status: LearnerJourneyEntryView["verificationStatus"]) {
  if (status === "VERIFIED") return { tone: "green" as const, label: "Verified" };
  if (status === "PENDING") return { tone: "amber" as const, label: "Pending review" };
  return { tone: "neutral" as const, label: "Recorded" };
}

function statusTone(status?: string | null) {
  if (!status) return "neutral" as const;
  const upper = status.toUpperCase();
  if (["APPROVED", "PUBLISHED", "RELEASED", "ACTIVE", "VERIFIED"].includes(upper)) return "green" as const;
  if (["PENDING", "SUBMITTED", "DRAFT", "SCORED", "MODERATED"].includes(upper)) return "amber" as const;
  if (["REJECTED", "SUSPENDED"].includes(upper)) return "red" as const;
  return "neutral" as const;
}

function modeLabel(mode: LearnerJourneyTimelineView["mode"]) {
  return mode === "staff" ? "Staff timeline" : "Family timeline";
}

function modeDescription(mode: LearnerJourneyTimelineView["mode"]) {
  return mode === "staff"
    ? "Shows internal and family-safe milestones pulled from live school records."
    : "Shows only milestones safe for families, already filtered by release and visibility rules.";
}

// ---- 1. Hero ---------------------------------------------------------------
export function LearnerJourneyHero({
  timeline,
  onExport,
  exporting,
}: {
  timeline: LearnerJourneyTimelineView;
  onExport?: () => void;
  exporting?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-navy-900/80 to-navy-850/80 p-6 backdrop-blur-2xl dark:border-white/10 dark:from-navy-950/80 dark:to-navy-900/80 sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green" className="border border-green-400/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Education OS · Learning Journey
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
            Follow one learner story across released exam results, flexible assessments, attendance, competencies, skills, discipline milestones and approved portfolio evidence without duplicating records across the school.
          </p>
          <p className="text-xs font-medium text-green-400">
            {modeLabel(timeline.mode)} · {timeline.summary.returnedEntries} item(s) shown
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur-xl">
            <p className="font-semibold">{modeLabel(timeline.mode)}</p>
            <p className="mt-1 max-w-xs text-xs text-navy-100/90">{modeDescription(timeline.mode)}</p>
          </div>
          {onExport ? (
            <Button onClick={onExport} disabled={exporting} className="rounded-full bg-green-600 text-white shadow-card hover:bg-green-500">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export learner journey
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---- 2. Summary Grid -------------------------------------------------------
export function LearnerJourneySummaryGrid({ timeline }: { timeline: LearnerJourneyTimelineView }) {
  const familySafeCount = timeline.entries.filter((entry) => entry.visibility === "PARENT_SAFE").length;
  const verifiedCount = timeline.entries.filter((entry) => entry.verificationStatus === "VERIFIED").length;
  const activeSources = timeline.summary.sourceCounts.length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Timeline Entries</p>
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{timeline.summary.returnedEntries}</p>
          </div>
          <div className="rounded-2xl bg-navy-50 p-3 dark:bg-navy-900/50">
            <Activity className="h-6 w-6 text-navy-600 dark:text-navy-300" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Family-Safe Entries</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{familySafeCount}</p>
          </div>
          <div className="rounded-2xl bg-green-50 p-3 dark:bg-green-900/20">
            <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Verified Milestones</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{verifiedCount}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-900/20">
            <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Active Sources</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{activeSources}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-900/20">
            <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- 3. UX Guidance / Refresh States --------------------------------------
export function LearnerJourneyModeNotice({ mode }: { mode: LearnerJourneyTimelineView["mode"] }) {
  const parentMode = mode === "parent";
  return (
    <Card className={cn(
      "backdrop-blur-xl",
      parentMode
        ? "border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/25"
        : "border-blue-200 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/25"
    )}>
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        <div className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          parentMode ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
        )}>
          {parentMode ? <Eye className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <p className={cn(
            "text-sm font-semibold",
            parentMode ? "text-green-900 dark:text-green-100" : "text-blue-900 dark:text-blue-100"
          )}>
            {parentMode ? "Family-safe learner journey" : "Staff learner journey"}
          </p>
          <p className={cn(
            "text-sm leading-6",
            parentMode ? "text-green-700 dark:text-green-200" : "text-blue-700 dark:text-blue-200"
          )}>
            {parentMode
              ? "Family view only shows milestones the school has already made safe to share. Internal-only records stay hidden automatically."
              : "Internal school milestones may appear here for staff review. Confidential counseling notes still stay outside this timeline."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LearnerJourneyRefreshToolbar({
  currentSource,
  refreshing,
  lastLoadedAt,
  onRefresh,
}: {
  currentSource: LearnerJourneyTimelineView["filters"]["source"];
  refreshing: boolean;
  lastLoadedAt: string | null;
  onRefresh?: () => void;
}) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
            {refreshing ? "Refreshing learner journey..." : "Learner journey ready"}
          </p>
          <p className="text-xs text-navy-500 dark:text-navy-400">
            Showing {currentSource === "ALL" ? "all sources" : `${currentSource.toLowerCase()} milestones`}.
            {lastLoadedAt ? ` Last refreshed ${lastLoadedAt}.` : ""}
          </p>
        </div>
        {onRefresh ? (
          <Button variant="secondary" onClick={onRefresh} disabled={refreshing} className="rounded-full">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Refresh
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---- 4. Mandatory UX States -----------------------------------------------
export function LearnerJourneyLoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LearnerJourneyErrorState({
  onRetry,
  message = "Please check your connection and try again.",
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <Card className="border-red-200 bg-red-50/80 backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/40">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/50">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-red-900 dark:text-red-200">Unable to load the learner journey</p>
          <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        </div>
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary" className="rounded-full bg-white dark:bg-navy-900">
            <Sparkles className="h-4 w-4" /> Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LearnerJourneyEmptyState({
  mode,
  onResetFilters,
}: {
  mode: LearnerJourneyTimelineView["mode"];
  onResetFilters?: () => void;
}) {
  return (
    <EmptyState
      icon={Activity}
      title={mode === "staff" ? "No learner journey entries yet" : "No family-safe learner journey entries yet"}
      description={
        mode === "staff"
          ? "As live school records grow across exams, assessments, competencies, attendance, discipline and portfolio work, the learner story will appear here automatically."
          : "Only approved and family-safe milestones appear here. Internal school notes stay protected until the school releases the right records."
      }
      primaryAction={onResetFilters ? { label: "Clear filters", onClick: onResetFilters } : undefined}
    />
  );
}

// ---- 4. Source Filter Bar --------------------------------------------------
export function LearnerJourneySourceFilterBar({
  currentSource,
  sourceCounts,
  onSelect,
  disabled = false,
}: {
  currentSource: LearnerJourneyTimelineView["filters"]["source"];
  sourceCounts: LearnerJourneySummaryView["sourceCounts"];
  onSelect?: (source: LearnerJourneyTimelineView["filters"]["source"]) => void;
  disabled?: boolean;
}) {
  const chips: Array<{ source: LearnerJourneyTimelineView["filters"]["source"]; label: string; count: number }> = [
    { source: "ALL", label: "All sources", count: sourceCounts.reduce((sum, row) => sum + row.count, 0) },
    ...sourceCounts.map((row) => ({ source: row.source, label: SOURCE_META[row.source].label, count: row.count })),
  ];

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5 text-navy-600" /> Source Filters
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">
          Narrow the learner journey to released exam results, attendance, competencies, portfolio milestones or other connected sources.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.source}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(chip.source)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200 ease-apple disabled:cursor-not-allowed disabled:opacity-70",
              currentSource === chip.source
                ? "border-green-300 bg-green-50 text-green-700 shadow-sm dark:border-green-700/60 dark:bg-green-950/30 dark:text-green-200"
                : "border-navy-200 bg-white/70 text-navy-600 hover:border-navy-300 hover:bg-white dark:border-navy-800 dark:bg-navy-900/40 dark:text-navy-300 dark:hover:border-navy-700"
            )}
          >
            <span>{chip.label}</span>
            <Badge tone={currentSource === chip.source ? "green" : "neutral"} className="min-w-7 justify-center px-2 py-0.5 text-[11px]">
              {chip.count}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ---- 5. Single Timeline Entry ---------------------------------------------
export function LearnerJourneyEntryCard({
  entry,
  canPin = false,
  pinBusy = false,
  onTogglePin,
}: {
  entry: LearnerJourneyEntryView;
  canPin?: boolean;
  pinBusy?: boolean;
  onTogglePin?: (entry: LearnerJourneyEntryView) => void;
}) {
  const meta = SOURCE_META[entry.sourceModule];
  const SourceIcon = meta.icon;
  const visibility = visibilityBadge(entry.visibility);
  const VisibilityIcon = visibility.icon;
  const verification = verificationBadge(entry.verificationStatus);

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl transition-all duration-200 ease-apple hover:shadow-card dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 dark:bg-navy-900/60">
              <SourceIcon className="h-5 w-5 text-navy-600 dark:text-navy-300" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <Badge tone={verification.tone}>{verification.label}</Badge>
                <Badge tone={visibility.tone}>
                  <VisibilityIcon className="mr-1 h-3 w-3" /> {visibility.label}
                </Badge>
                {entry.status ? <Badge tone={statusTone(entry.status)}>{entry.status}</Badge> : null}
              </div>
              <CardTitle className="text-lg font-bold text-navy-900 dark:text-navy-50">{entry.title}</CardTitle>
              <p className="text-xs text-navy-400">{formatDate(entry.date)} · {meta.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canPin && onTogglePin ? (
              <Button
                type="button"
                variant={entry.pinned ? "secondary" : "default"}
                onClick={() => onTogglePin(entry)}
                disabled={pinBusy}
                className={cn(
                  "rounded-full",
                  entry.pinned ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200" : "bg-green-600 text-white hover:bg-green-500"
                )}
              >
                {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : entry.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {entry.pinned ? "Unpin milestone" : "Pin milestone"}
              </Button>
            ) : null}
            {entry.href ? (
              <a
                href={entry.href}
                className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white/70 px-3 py-2 text-sm font-medium text-navy-700 transition hover:border-navy-300 hover:bg-white dark:border-navy-800 dark:bg-navy-900/50 dark:text-navy-200"
              >
                Open source <ArrowRight className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p className="text-sm leading-6 text-navy-600 dark:text-navy-300">{entry.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-navy-500 dark:text-navy-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 dark:bg-navy-900/40">
            <Clock3 className="h-3.5 w-3.5" /> {entry.eventType.replaceAll("_", " ")}
          </span>
          {entry.pinned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              <Pin className="h-3.5 w-3.5" /> Pinned milestone
            </span>
          ) : null}
          {entry.pinned && entry.pinVisibility ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-green-700 dark:bg-green-950/30 dark:text-green-200">
              <Eye className="h-3.5 w-3.5" /> {entry.pinVisibility === "PARENT_SAFE" ? "Shared with families" : "Staff only pin"}
            </span>
          ) : null}
        </div>
        {entry.pinned && entry.pinNote ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900 backdrop-blur-xl dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-semibold">Pinned note</p>
            <p className="mt-1 leading-6">{entry.pinNote}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---- 6. Timeline List ------------------------------------------------------
export function LearnerJourneyTimelineList({
  entries,
  canPin = false,
  busyEntryId,
  onTogglePin,
}: {
  entries: LearnerJourneyEntryView[];
  canPin?: boolean;
  busyEntryId?: string | null;
  onTogglePin?: (entry: LearnerJourneyEntryView) => void;
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <LearnerJourneyEntryCard
          key={entry.id}
          entry={entry}
          canPin={canPin}
          pinBusy={busyEntryId === entry.id}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  );
}
