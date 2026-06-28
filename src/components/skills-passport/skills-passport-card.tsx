"use client";

/**
 * PART J.6 — connected Skills Passport card wrapper.
 * Fetches `/api/skills-passport?studentId=...`, handles logging/removing ratings,
 * supports all 4 mandatory UX states, and opens the PDF download route.
 */
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import {
  SkillsPassportHero,
  SkillsPassportSummaryGrid,
  SkillsPassportLoadingState,
  SkillsPassportErrorState,
  SkillsPassportEmptyState,
  AcademicGrowthList,
  CompetencyGrowthList,
  TalentLeadershipCard,
  SkillRatingForm,
  type SkillsPassportProfileView,
} from "@/components/skills-passport/skills-passport-components";

export function SkillsPassportCard({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const [profile, setProfile] = React.useState<SkillsPassportProfileView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/skills-passport?studentId=${studentId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Skills Passport could not load.");
        return;
      }
      setProfile(json.data.profile);
    } catch {
      setError("Check your connection and try again.");
    }
  }, [studentId]);

  React.useEffect(() => { void load(); }, [load]);

  async function post(action: string, payload: Record<string, unknown>, successTitle: string, targetId?: string) {
    if (targetId) setBusyId(targetId);
    else setSaving(true);
    try {
      const res = await fetch("/api/skills-passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Skills passport update failed", tone: "error" });
        return;
      }
      toast({ title: successTitle, tone: "success" });
      setShowModal(false);
      await load();
    } catch {
      toast({ title: "Could not reach the skills passport endpoint", tone: "error" });
    } finally {
      if (targetId) setBusyId(null);
      else setSaving(false);
    }
  }

  if (!profile && !error) return <SkillsPassportLoadingState />;
  if (error && !profile) return <SkillsPassportErrorState onRetry={load} />;

  if (!profile) return null;

  return (
    <div className="space-y-6 pt-6 border-t border-navy-100 dark:border-navy-800">
      <SkillsPassportHero
        profile={profile}
        onRecordRating={() => setShowModal(true)}
        onDownloadPdf={() => window.open(`/api/skills-passport/pdf?studentId=${studentId}`, "_blank")}
        saving={saving}
      />
      {error ? <SkillsPassportErrorState onRetry={load} /> : null}

      <SkillsPassportSummaryGrid summary={profile.summary} />

      {profile.summary.totalPoints === 0 ? (
        <SkillsPassportEmptyState canRecord={profile.canRecord} onRecordRating={() => setShowModal(true)} />
      ) : (
        <div className="space-y-6">
          <TalentLeadershipCard
            talentAreas={profile.talentAndLeadership}
            canRecord={profile.canRecord}
            onRemoveRating={(id) => post("remove_skill_rating", { id }, "Skill rating removed", id)}
            busyId={busyId}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <AcademicGrowthList exams={profile.academicGrowth.exams} flexibleAssessments={profile.academicGrowth.flexibleAssessments} />
            <CompetencyGrowthList competencies={profile.competencyGrowth} />
          </div>
        </div>
      )}

      {showModal && (
        <SkillRatingForm
          studentId={studentId}
          saving={saving}
          onClose={() => setShowModal(false)}
          onSubmit={(draft) => post("record_skill_rating", draft, "Skill rating logged successfully")}
        />
      )}
    </div>
  );
}
