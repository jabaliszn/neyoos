# J.3 — Flexible Assessment Engine Audit

_Date: 2026-06-26_

## Purpose

Part J requires NEYO School OS to become a curriculum-independent Education Operating System. J.3 must add flexible assessments without duplicating the existing Exams, CBC and LMS modules.

This audit records what already exists and how J.3 should extend it.

## Existing systems audited

### 1. B.5 Examination

Key files:

- `prisma/schema.prisma`
- `src/lib/services/exam.service.ts`
- `src/lib/validations/exams.ts`
- `src/app/api/exams/route.ts`
- `src/app/api/exams/marks/route.ts`
- `src/app/api/exams/[id]/route.ts`
- `src/app/api/exams/[id]/release/route.ts`
- `src/components/exams/*`

Existing models:

- `Exam`
- `ExamSubject`
- `ExamResult`
- `ExamReleaseApprovalRequest`

What exists:

- Exam/CAT setup.
- Subject mapping per exam.
- Marks entry sheet.
- Idempotent mark upsert.
- Teacher row-scoping via student/class access.
- Result publishing/release approval workflow.
- Position, mean score and report-card logic.
- Parent/student release gating.
- Multi-term analytics foundation through I.60.

Gaps for J.3:

- Exam type is limited to `EXAM | CAT` in validation.
- Assessment is marks-first; no general assessment plan layer.
- No weighting per assessment type.
- No project/practical/oral/portfolio/peer/self assessment model.
- No narrative observation/evidence file support in the exam result model.
- Report logic is tied to exams/results and needs a compatible layer, not replacement.

Decision:

J.3 should keep `Exam` / `ExamResult` intact for formal exams and CATs, then add a compatible flexible assessment layer that can optionally connect to existing exams later.

---

### 2. B.6 CBC Management

Key files:

- `prisma/schema.prisma`
- `src/lib/services/cbc.service.ts`
- `src/lib/validations/cbc.ts`
- `src/app/api/cbc/strands/route.ts`
- `src/app/api/cbc/assess/route.ts`
- `src/app/api/cbc/report/[studentId]/route.ts`
- `src/components/cbc/*`

Existing models:

- `CbcStrand`
- `CbcAssessment`

What exists:

- Strand setup per subject.
- KICD strand presets.
- 4-level rubric scale: BE/AE/ME/EE.
- Append-only formative assessment history.
- Teacher row-scoped assessment sheets.
- Parent-friendly CBC report output.
- J.2 already mapped `CbcStrand.learningAreaId` to `LearningArea`.

Gaps for J.3:

- Rubrics are fixed to 1–4 levels, not configurable per school/assessment.
- Assessment history is strand-specific, not generalized across projects/practicals/portfolio evidence.
- Evidence attachments are not part of `CbcAssessment`.
- No assessment plan, weights, due dates or release workflow for non-exam assessments.

Decision:

J.3 should reuse CBC’s append-only observation philosophy but not force all flexible assessments into `CbcAssessment`. Add new flexible assessment models that can link to `LearningArea`, `Subject`, `SchoolClass`, `Curriculum`, `GradeBand` and future J.4 competencies.

---

### 3. B.13 LMS

Key files:

- `prisma/schema.prisma`
- `src/lib/services/lms.service.ts`
- `src/app/api/lms/quizzes/route.ts`
- `src/app/api/lms/submissions/route.ts`
- `src/app/api/portal/lms/route.ts`
- `src/components/lms/*`
- `src/components/portal/lms-cards.tsx`

Existing models:

- `Homework`
- `HomeworkSubmission`
- `Quiz`
- `QuizQuestion`
- `QuizAttempt`
- `ForumThread`
- `ForumPost`

What exists:

- Homework assignment.
- File upload for homework submissions.
- Teacher grading with `gradePct` and feedback.
- MCQ quizzes with server-side auto-grading.
- One attempt per learner.
- Parent/student views.
- Teacher class scoping.

Gaps for J.3:

- Homework/quiz grading is separate from Exams/CBC and not part of one assessment ledger.
- Homework submissions support file evidence but do not link to curriculum/learning areas or assessment plans.
- Quiz attempts auto-grade but are not weighted with term assessment plans.
- No moderation/release workflow for project/portfolio/practical assessments.

Decision:

J.3 should not rebuild LMS. It should create a flexible assessment layer that can later reference LMS homework/quiz outcomes as evidence or assessment sources.

---

### 4. I.60 Exam Analytics

Key files:

- `src/lib/services/exam-analytics.service.ts`
- `src/app/api/exams/analytics/route.ts`
- `src/components/exams/exam-analytics-client.tsx`

What exists:

- Term trends.
- Subject performance.
- Teacher-linked performance using `ClassSubjectNeed.teacherId`.
- Student progress over multiple terms.

Gaps for J.3:

- Analytics only reads `Exam` and `ExamResult` today.
- Flexible assessment plans/results need to feed future analytics without breaking existing exam analytics.

Decision:

J.3 should add data in a way that later analytics can include both formal exam results and flexible assessment results.

---

### 5. Storage Vault / Evidence Files

Key files:

- `src/lib/services/storage.service.ts`
- `src/app/api/files/encrypted/route.ts`
- `src/components/ui/file-upload.tsx`
- `src/lib/services/storage-vault.service.ts`

What exists:

- Encrypted upload path through `/api/files/encrypted`.
- Shared `FileUpload` now uses encrypted upload path.
- `StoredFile` records encrypted metadata.

J.3 rule:

Any flexible-assessment evidence file must use the existing encrypted `FileUpload` path. No direct plaintext upload routes.

---

## J.3 implementation decision

Do not create a duplicate “exam module.”

Build a flexible assessment layer that sits alongside existing modules and links to them:

### New foundation models proposed

- `AssessmentType`
- `AssessmentPlan`
- `AssessmentRubricLevel` or compatible rubric reference if J.5 later owns configurable rubrics
- `AssessmentRecord`
- `AssessmentEvidence`

### Existing models to link to

- `Curriculum`
- `EducationLevel`
- `GradeBand`
- `LearningArea`
- `Subject`
- `SchoolClass`
- `AcademicTerm`
- `Student`
- Optional future link to `Homework`, `Quiz`, `Exam`, `CbcStrand`, `Competency`

### Must support

- Assessment types: exam, CAT, project, practical, oral, observation, portfolio, peer assessment, self assessment, continuous assessment.
- Marks, rubric levels, narrative observations and evidence files.
- School-defined weighting per assessment type/plan.
- Moderation/release workflow for non-exam assessments.
- Parent/student visibility based on release status.
- Teacher row-scoping and leadership oversight.
- Audit logs for plan creation, score entry, evidence upload and release.

## Recommended chunk plan for J.3

### Chunk 1 — Database foundation

Add flexible assessment models and tenant isolation entries.

### Chunk 2 — Validation and security

Add Zod schemas for assessment types/plans/records/evidence/release and define role rules.

### Chunk 3 — Backend service

Real Prisma services for type catalog, plan creation, assessment sheet, scoring and release workflow.

### Chunk 4 — API endpoints

`/api/assessments` routes wired to service + Zod + auth.

### Chunk 5 — UI components

Reusable assessment plan cards, type catalog cards, rubric/marks entry rows and evidence cards.

### Chunk 6 — Frontend page

Mount under academics/assessments or `/assessments`, connected to real API.

### Chunk 7 — UX states and screenshots

Loading, empty, error, populated, mobile screenshot.

### Chunk 8 — Seed data and final checklist

Seed project/practical/oral/observation assessment plans and records using Kenyan data.

## Next build target

Start **J.3 Chunk 1 — Database foundation**.
