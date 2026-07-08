"use client";

/**
 * PART J.6 — Skills Passport UI Components.
 *
 * Liquid Glass-ready reusable components for the Skills Passport profile views,
 * star rating cards, and rating builder. All components are presentational/forms
 * only and intentionally do not fetch directly; page/API wiring comes in Chunk 6.
 */
import * as React from "react";
import {
  Award, Target, Sparkles, Layers, ShieldCheck, Star,
  Eye, CheckCircle2, AlertCircle, Loader2, Plus, Save, X, Archive,
  Trash2, FileText, FileCheck2, RefreshCw, Bookmark, GraduationCap,
  Download, Trophy, Music, Code, Dumbbell, Users, Brain,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SKILL_AREAS, EVIDENCE_SOURCES } from "@/lib/validations/skills-passport";

export interface AcademicExamView { examName: string; subjectName: string; marks: number; grade: string; term: number; year: number; }
export interface AcademicAssessmentView { planTitle: string; typeName: string; scoreMarks: number | null; scorePct: number | null; rubricLevel: number | null; rubricCode: string | null; narrative: string | null; term: number; year: number; }
export interface CompetencyEvidenceView { competencyName: string; competencyCode: string; groupName: string; level: number | null; scorePct: number | null; narrative: string | null; date: string; recordedByName: string; }
export interface TalentRatingView { id: string; skillArea: string; ratingLevel: number; evidenceSource: string; narrative: string | null; evidenceDate: string; recordedByName: string; }
export interface TalentAreaView { skillArea: string; latestRating: number; evidenceCount: number; latestSource: string; latestNarrative: string | null; latestDate: string; history: TalentRatingView[]; }

export interface SkillsPassportProfileView {
  canRecord: boolean;
  student: { id: string; name: string; admissionNo: string; className: string | null; photoUrl: string | null; };
  academicGrowth: { exams: AcademicExamView[]; flexibleAssessments: AcademicAssessmentView[]; };
  competencyGrowth: CompetencyEvidenceView[];
  talentAndLeadership: TalentAreaView[];
  summary: { academicPoints: number; competencyPoints: number; talentPoints: number; totalPoints: number; };
}

// ---- 1. Skills Passport Hero -----------------------------------------------
export function SkillsPassportHero({ profile, onRecordRating, onDownloadPdf, saving }: {
  profile: SkillsPassportProfileView;
  onRecordRating: () => void;
  onDownloadPdf: () => void;
  saving: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-navy-900/80 to-navy-850/80 p-6 backdrop-blur-2xl dark:border-white/10 dark:from-navy-950/80 dark:to-navy-900/80 sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="green" className="border border-green-400/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Education OS · Skills Passport
            </Badge>
            <Badge tone="neutral" className="border border-white/20 font-mono text-xs text-white">
              {profile.student.admissionNo}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {profile.student.name}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-navy-100 dark:text-navy-200">
            Formal exams, CBE observations and LMS work stay intact. The Skills Passport aggregates academic, competency, talent and leadership growth into one portable digital identity to prove growth beyond marks.
          </p>
          <p className="text-xs font-medium text-green-400">{profile.student.className ?? "Unassigned Class"} · Verified Learner Profile</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onDownloadPdf} className="rounded-full backdrop-blur-xl">
            <Download className="h-4 w-4 text-green-400" /> Download passport PDF
          </Button>
          {profile.canRecord && (
            <Button onClick={onRecordRating} disabled={saving} className="rounded-full bg-green-600 hover:bg-green-500 text-white shadow-card">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log skill rating
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 2. Skills Passport Summary Grid ---------------------------------------
export function SkillsPassportSummaryGrid({ summary }: { summary: SkillsPassportProfileView["summary"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardContent className="flex items-center justify-between p-6"><div className="space-y-1"><p className="text-sm font-medium text-navy-500 dark:text-navy-400">Total Evidence</p><p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{summary.totalPoints}</p></div><div className="rounded-2xl bg-navy-50 p-3 dark:bg-navy-900/50"><Award className="h-6 w-6 text-navy-600 dark:text-navy-300" /></div></CardContent></Card>
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardContent className="flex items-center justify-between p-6"><div className="space-y-1"><p className="text-sm font-medium text-navy-500 dark:text-navy-400">Academic Points</p><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.academicPoints}</p></div><div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-900/20"><GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" /></div></CardContent></Card>
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardContent className="flex items-center justify-between p-6"><div className="space-y-1"><p className="text-sm font-medium text-navy-500 dark:text-navy-400">Competency Points</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.competencyPoints}</p></div><div className="rounded-2xl bg-green-50 p-3 dark:bg-green-900/20"><Brain className="h-6 w-6 text-green-600 dark:text-green-400" /></div></CardContent></Card>
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardContent className="flex items-center justify-between p-6"><div className="space-y-1"><p className="text-sm font-medium text-navy-500 dark:text-navy-400">Talent & Leadership</p><p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.talentPoints}</p></div><div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-900/20"><Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div></CardContent></Card>
    </div>
  );
}

// ---- 3. Mandatory UX States ------------------------------------------------
export function SkillsPassportLoadingState() { return <div className="space-y-6"><Skeleton className="h-32 w-full rounded-2xl" /><div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div></div>; }
export function SkillsPassportErrorState({ onRetry }: { onRetry: () => void }) { return <Card className="border-red-200 bg-red-50/80 backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/40"><CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center"><div className="rounded-full bg-red-100 p-3 dark:bg-red-900/50"><AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" /></div><div className="space-y-1"><p className="text-base font-semibold text-red-900 dark:text-red-200">Unable to load Skills Passport</p><p className="text-sm text-red-600 dark:text-red-400">Please check your connection and try again.</p></div><Button onClick={onRetry} variant="secondary" className="rounded-full bg-white dark:bg-navy-900"><RefreshCw className="h-4 w-4" /> Try again</Button></CardContent></Card>; }
export function SkillsPassportEmptyState({ canRecord, onRecordRating }: { canRecord: boolean; onRecordRating: () => void; }) { return <EmptyState icon={Award} title="No skills passport entries yet" description="Start by logging specific skill ratings for Leadership, Coding, Music, Sports or Creativity to build this learner's portable digital identity." primaryAction={canRecord ? { label: "Log skill rating", onClick: onRecordRating } : undefined} />; }

// ---- 4. Academic Growth List -----------------------------------------------
export function AcademicGrowthList({ exams, flexibleAssessments }: { exams: AcademicExamView[]; flexibleAssessments: AcademicAssessmentView[] }) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-blue-600" /> Academic Growth & Assessments
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">Aggregated automatically from formal exams and flexible assessment plans.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {exams.length === 0 && flexibleAssessments.length === 0 ? (
          <p className="text-sm text-navy-500 dark:text-navy-400">No academic results recorded yet.</p>
        ) : (
          <>
            {exams.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Formal Exams</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {exams.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white/60 p-4 dark:border-navy-800 dark:bg-navy-900/40">
                      <div>
                        <p className="font-semibold text-navy-900 dark:text-navy-50">{e.subjectName}</p>
                        <p className="text-xs text-navy-400">{e.examName} · Term {e.term}, {e.year}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy-700 dark:text-navy-200">{e.marks} marks</span>
                        <Badge tone="blue" className="font-mono font-bold">{e.grade}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {flexibleAssessments.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Flexible Assessments</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {flexibleAssessments.map((a, i) => (
                    <div key={i} className="rounded-2xl border border-navy-100 bg-white/60 p-4 dark:border-navy-800 dark:bg-navy-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-navy-900 dark:text-navy-50">{a.planTitle}</p>
                          <p className="text-xs text-navy-400">{a.typeName} · Term {a.term}, {a.year}</p>
                        </div>
                        {a.rubricCode ? (
                          <Badge tone="green" className="font-mono font-bold">Level {a.rubricLevel} ({a.rubricCode})</Badge>
                        ) : a.scorePct !== null ? (
                          <Badge tone="blue" className="font-bold">{a.scorePct}%</Badge>
                        ) : <Badge tone="neutral">Recorded</Badge>}
                      </div>
                      {a.narrative && <p className="text-xs text-navy-600 dark:text-navy-300">{a.narrative}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 5. Competency Growth List ---------------------------------------------
export function CompetencyGrowthList({ competencies }: { competencies: CompetencyEvidenceView[] }) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-green-600" /> Core Competency Observations
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">Aggregated automatically from J.4 Core Competency teacher observations.</p>
      </CardHeader>
      <CardContent>
        {competencies.length === 0 ? (
          <p className="text-sm text-navy-500 dark:text-navy-400">No competency evidence recorded yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {competencies.map((c, i) => (
              <div key={i} className="rounded-2xl border border-navy-100 bg-white/60 p-4 dark:border-navy-800 dark:bg-navy-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy-900 dark:text-navy-50">{c.competencyName}</p>
                    <p className="text-xs text-navy-400">{c.groupName} · {c.date}</p>
                  </div>
                  {c.level !== null ? (
                    <Badge tone="green" className="font-bold">Level {c.level}</Badge>
                  ) : c.scorePct !== null ? (
                    <Badge tone="blue" className="font-bold">{c.scorePct}%</Badge>
                  ) : <Badge tone="neutral">Recorded</Badge>}
                </div>
                {c.narrative && <p className="text-xs text-navy-600 dark:text-navy-300">{c.narrative}</p>}
                <p className="text-[10px] text-navy-400 text-right">Recorded by {c.recordedByName}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 6. Talent & Leadership Card -------------------------------------------
function getSkillIcon(skillArea: string) {
  const s = skillArea.toLowerCase();
  if (s.includes("leader")) return <Users className="h-5 w-5 text-amber-600" />;
  if (s.includes("music")) return <Music className="h-5 w-5 text-blue-600" />;
  if (s.includes("code") || s.includes("coding")) return <Code className="h-5 w-5 text-green-600" />;
  if (s.includes("sport") || s.includes("athlet")) return <Dumbbell className="h-5 w-5 text-red-600" />;
  return <Trophy className="h-5 w-5 text-amber-500" />;
}

export function TalentLeadershipCard({ talentAreas, canRecord, onRemoveRating, busyId }: {
  talentAreas: TalentAreaView[];
  canRecord: boolean;
  onRemoveRating: (id: string) => void;
  busyId: string | null;
}) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" /> Talent & Leadership Growth
        </CardTitle>
        <p className="text-sm text-navy-500 dark:text-navy-400">Specific skill ratings and co-curricular evidence tracking over time.</p>
      </CardHeader>
      <CardContent>
        {talentAreas.length === 0 ? (
          <p className="text-sm text-navy-500 dark:text-navy-400">No talent or leadership ratings logged yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {talentAreas.map((area) => (
              <div key={area.skillArea} className="rounded-2xl border border-navy-100 bg-white/60 p-5 dark:border-navy-800 dark:bg-navy-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-50 dark:bg-navy-800">
                      {getSkillIcon(area.skillArea)}
                    </span>
                    <div>
                      <p className="font-bold text-navy-900 dark:text-navy-50">{area.skillArea}</p>
                      <p className="text-xs text-navy-400">{area.evidenceCount} evidence point(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{area.latestRating}</span>
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-navy-100 pt-3 dark:border-navy-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Rating History</p>
                  {area.history.map((h) => (
                    <div key={h.id} className="rounded-xl bg-white p-3 dark:bg-navy-900 shadow-sm border border-navy-50 dark:border-navy-850 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral" className="font-mono text-[10px]">{h.evidenceSource}</Badge>
                          <span className="text-xs font-medium text-navy-500">{h.evidenceDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, idx) => (
                              <Star key={idx} className={`h-3 w-3 ${idx < h.ratingLevel ? "fill-amber-500 text-amber-500" : "text-navy-200 dark:text-navy-700"}`} />
                            ))}
                          </div>
                          {canRecord && (
                            <Button size="sm" variant="ghost" onClick={() => onRemoveRating(h.id)} disabled={busyId === h.id} className="rounded-full p-1 text-navy-400 hover:text-red-600">
                              {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                      {h.narrative && <p className="text-xs text-navy-700 dark:text-navy-200">{h.narrative}</p>}
                      <p className="text-[9px] text-navy-400 text-right">by {h.recordedByName}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 7. Skill Rating Modal Form --------------------------------------------
export function SkillRatingForm({ studentId, onSubmit, onClose, saving }: {
  studentId: string;
  onSubmit: (data: { studentId: string; skillArea: string; ratingLevel: number; evidenceSource: string; narrative: string; evidenceDate: string }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [skillArea, setSkillArea] = React.useState(SKILL_AREAS[0] as string);
  const [customArea, setCustomArea] = React.useState("");
  const [ratingLevel, setRatingLevel] = React.useState(5);
  const [evidenceSource, setEvidenceSource] = React.useState(EVIDENCE_SOURCES[0] as string);
  const [narrative, setNarrative] = React.useState("");
  const [evidenceDate, setEvidenceDate] = React.useState(new Date().toISOString().slice(0, 10));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalArea = skillArea === "CUSTOM" ? customArea : skillArea;
    onSubmit({ studentId, skillArea: finalArea, ratingLevel, evidenceSource, narrative, evidenceDate });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm dark:bg-navy-950/60" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg overflow-hidden border-white/40 bg-white backdrop-blur-2xl dark:border-white/10 dark:bg-navy-900 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-navy-100 px-6 py-4 dark:border-navy-800">
            <CardTitle className="text-lg font-bold">Log Skill Rating</CardTitle>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-full p-2.5">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Skill Area</Label>
              <select value={skillArea} onChange={(e) => setSkillArea(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                {SKILL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="CUSTOM">Custom Skill Area...</option>
              </select>
            </div>
            {skillArea === "CUSTOM" && (
              <div className="space-y-1.5">
                <Label>Custom Skill Name</Label>
                <Input value={customArea} onChange={(e) => setCustomArea(e.target.value)} placeholder="e.g. Public Speaking, Chess..." required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Star Rating Level (1-5)</Label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((stars) => (
                  <button
                    type="button"
                    key={stars}
                    onClick={() => setRatingLevel(stars)}
                    className={`flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl border transition-all duration-200 ease-apple ${
                      ratingLevel === stars
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow-sm"
                        : "border-navy-200 bg-white/60 hover:bg-white dark:border-navy-700 dark:bg-navy-900"
                    }`}
                  >
                    <span className="text-sm font-bold text-navy-900 dark:text-navy-50">{stars}</span>
                    <Star className={`h-4 w-4 ${ratingLevel >= stars ? "fill-amber-500 text-amber-500" : "text-navy-200 dark:text-navy-700"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Evidence Source</Label>
                <select value={evidenceSource} onChange={(e) => setEvidenceSource(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {EVIDENCE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Evidence Date</Label>
                <Input type="date" value={evidenceDate} onChange={(e) => setEvidenceDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Qualitative Growth Narrative</Label>
              <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Provide specific details supporting this skill rating..." className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-sm dark:border-navy-700 dark:bg-navy-900" rows={3} required />
            </div>
          </CardContent>
          <div className="flex items-center justify-end gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4 dark:border-navy-800 dark:bg-navy-900/50">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="rounded-full">Cancel</Button>
            <Button type="submit" disabled={saving || (skillArea === "CUSTOM" && !customArea)} className="rounded-full bg-green-600 hover:bg-green-500 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Rating
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
