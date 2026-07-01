"use client";

/**
 * PART J.8 — connected Learning Journey card wrapper.
 * Fetches `/api/learner-journey`, handles source-filter reloads, and mounts the
 * reusable J.8 UI components inside Student Profile and Parent Portal.
 */
import * as React from "react";
import {
  LearnerJourneyHero,
  LearnerJourneySummaryGrid,
  LearnerJourneyLoadingState,
  LearnerJourneyErrorState,
  LearnerJourneyEmptyState,
  LearnerJourneySourceFilterBar,
  LearnerJourneyTimelineList,
  LearnerJourneyModeNotice,
  LearnerJourneyRefreshToolbar,
  type LearnerJourneyTimelineView,
} from "@/components/learner-journey/learner-journey-components";
import { LEARNER_JOURNEY_SOURCES, LEARNER_JOURNEY_MODES } from "@/lib/validations/learner-journey";
import { cn } from "@/lib/utils";

type JourneySource = (typeof LEARNER_JOURNEY_SOURCES)[number] | "ALL";
type JourneyMode = (typeof LEARNER_JOURNEY_MODES)[number];
type JourneyVisibility = "STAFF" | "PARENT_SAFE";

export function LearnerJourneyCard({
  studentId,
  mode,
  className,
  limit = 18,
}: {
  studentId: string;
  mode: JourneyMode;
  className?: string;
  limit?: number;
}) {
  const [timeline, setTimeline] = React.useState<LearnerJourneyTimelineView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<JourneySource>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const load = React.useCallback(async (nextSource: JourneySource = source, options?: { soft?: boolean }) => {
    const soft = options?.soft ?? false;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ studentId, mode, limit: String(limit) });
      if (nextSource !== "ALL") params.set("source", nextSource);
      const res = await fetch(`/api/learner-journey?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        if (!soft) setTimeline(null);
        setError(json.error?.message || "Learner journey could not load.");
        return;
      }
      setTimeline(json.data.timeline);
      setLastLoadedAt(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      if (!soft) setTimeline(null);
      setError("Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId, mode, limit, source]);

  React.useEffect(() => {
    void load(source, { soft: !!timeline });
  }, [load, source]);

  function handleSelectSource(nextSource: JourneySource) {
    if (refreshing && nextSource === source) return;
    setSource(nextSource);
  }

  function resetFilters() {
    setSource("ALL");
    void load("ALL", { soft: !!timeline });
  }

  async function togglePin(entry: LearnerJourneyTimelineView["entries"][number]) {
    setBusyEntryId(entry.id);
    setError(null);
    try {
      const payload = entry.pinned
        ? { action: "unpin_milestone", payload: { studentId, entryId: entry.id } }
        : {
            action: "pin_milestone",
            payload: {
              studentId,
              entryId: entry.id,
              sourceModule: entry.sourceModule,
              visibility: (entry.pinVisibility ?? (mode === "parent" ? "PARENT_SAFE" : "STAFF")) as JourneyVisibility,
              note: entry.pinNote ?? `Pinned from ${entry.sourceModule.toLowerCase()} learner journey milestone.`,
            },
          };

      const res = await fetch("/api/learner-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Learner milestone action could not be saved.");
        return;
      }

      setTimeline((current) => {
        if (!current) return current;
        return {
          ...current,
          entries: current.entries.map((currentEntry) => {
            if (currentEntry.id !== entry.id) return currentEntry;
            if (entry.pinned) {
              return {
                ...currentEntry,
                pinned: false,
                pinVisibility: null,
                pinNote: null,
              };
            }
            return {
              ...currentEntry,
              pinned: true,
              pinVisibility: mode === "parent" ? "PARENT_SAFE" : "STAFF",
              pinNote: `Pinned from ${entry.sourceModule.toLowerCase()} learner journey milestone.`,
            };
          }),
        };
      });
      setLastLoadedAt(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusyEntryId(null);
    }
  }

  if (loading && !timeline && !error) {
    return <div className={className}><LearnerJourneyLoadingState /></div>;
  }

  if (error && !timeline) {
    return <div className={className}><LearnerJourneyErrorState message={error} onRetry={() => void load(source)} /></div>;
  }

  if (!timeline) return null;

  return (
    <div className={cn("space-y-6 border-t border-navy-100 pt-6 dark:border-navy-800", className)}>
      <LearnerJourneyHero timeline={timeline} onExport={exportJourney} exporting={exporting} />
      <LearnerJourneyModeNotice mode={mode} />
      <LearnerJourneyRefreshToolbar currentSource={source} refreshing={refreshing} lastLoadedAt={lastLoadedAt} onRefresh={() => void load(source, { soft: true })} />
      {error ? <LearnerJourneyErrorState message={error} onRetry={() => void load(source, { soft: true })} /> : null}
      <LearnerJourneySummaryGrid timeline={timeline} />

      {timeline.summary.totalEntries === 0 ? (
        <LearnerJourneyEmptyState mode={mode} onResetFilters={resetFilters} />
      ) : (
        <div className="space-y-6">
          <LearnerJourneySourceFilterBar
            currentSource={source}
            sourceCounts={timeline.summary.sourceCounts}
            onSelect={handleSelectSource}
            disabled={refreshing}
          />
          {timeline.entries.length === 0 ? (
            <LearnerJourneyEmptyState mode={mode} onResetFilters={resetFilters} />
          ) : (
            <LearnerJourneyTimelineList
              entries={timeline.entries}
              canPin={mode === "staff"}
              busyEntryId={busyEntryId}
              onTogglePin={togglePin}
            />
          )}
        </div>
      )}
    </div>
  );
}
