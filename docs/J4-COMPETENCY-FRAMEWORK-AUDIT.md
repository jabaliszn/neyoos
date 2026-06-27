# J.4 — Competency Framework Audit

_Date: 2026-06-26_

## Purpose

Start J.4 without duplicating existing CBC or assessment work. J.4 must create a configurable competency framework that connects to J.2 Curriculum, B.6 CBC observations, J.3 flexible assessments, Student Profile and Parent Portal.

## Existing systems audited

### 1. J.2 Curriculum Engine

Files:

- `prisma/schema.prisma`
- `src/lib/services/curriculum.service.ts`
- `src/app/api/curriculum/route.ts`
- `src/components/curriculum/*`

Existing foundation:

- `Curriculum`
- `EducationLevel`
- `GradeBand`
- `LearningArea`
- Existing `Subject`, `SchoolClass`, `AcademicTerm`, `CbcStrand` are mapped into the curriculum engine.

J.4 decision:

Competencies should link to `Curriculum` and optionally to `LearningArea`. Do not hardcode CBC-only competencies.

---

### 2. B.6 CBC Management

Files:

- `src/lib/services/cbc.service.ts`
- `src/lib/validations/cbc.ts`
- `src/app/api/cbc/*`

Existing foundation:

- `CbcStrand`
- `CbcAssessment`
- `studentCompetencies()` already produces a CBC learner competency-like report from strand observations.

Gap:

CBC assessment is strand/subject-specific and uses fixed 4-level BE/AE/ME/EE. It is not a configurable cross-curriculum competency framework.

J.4 decision:

Reuse CBC history as one source of evidence, but create a new configurable `Competency` layer for communication, critical thinking, creativity, citizenship, etc.

---

### 3. J.3 Flexible Assessment Engine

Files:

- `src/lib/services/assessment.service.ts`
- `src/lib/validations/assessment.ts`
- `src/app/api/assessments/route.ts`
- `src/components/assessments/*`

Existing foundation:

- `AssessmentType`
- `AssessmentPlan`
- `AssessmentRecord`
- `AssessmentEvidence`

Gap:

Assessment records do not yet link to competencies.

J.4 decision:

Add a competency evidence model that can reference `AssessmentRecord` without forcing J.3 final completion now.

---

### 4. Student Profile / Parent Portal

Files:

- `src/components/students/student-profile-client.tsx`
- `src/lib/services/student.service.ts`
- `src/components/portal/parent-portal-client.tsx`
- `src/lib/services/parent-portal.service.ts`

Existing foundation:

- Student profile already shows academic/guardian/document/requirement sections.
- Parent portal already shows attendance, results, fees, homework/notes/LMS, health and related child details.

Gap:

No general competency summary card or heatmap exists yet.

J.4 decision:

Start with backend/data foundation first, then later add competency summary UI to Student Profile and parent-safe competency view.

---

## Proposed J.4 data model

Add tenant-owned models:

- `CompetencyGroup`
- `Competency`
- `CompetencyEvidence`

Potential fields:

### CompetencyGroup

- tenantId
- curriculumId optional
- name
- code
- description
- sequence
- active

### Competency

- tenantId
- groupId optional
- curriculumId optional
- learningAreaId optional
- name
- code
- description
- sequence
- active

### CompetencyEvidence

- tenantId
- competencyId
- studentId
- sourceModule: CBC, ASSESSMENT, LMS, MANUAL, CLUB, PORTFOLIO
- sourceId optional
- level 1–4 or scorePct optional
- narrative optional
- evidenceDate
- teacher/staff fields
- approved/released flags for parent visibility later

## J.4 chunk plan

### Chunk 1 — Database foundation

Add `CompetencyGroup`, `Competency`, `CompetencyEvidence`, tenant isolation.

### Chunk 2 — Validation/security

Add `src/lib/validations/competency.ts` and 16-role access rules.

### Chunk 3 — Backend service

Create/list competency groups, competencies, evidence, summary/heatmap service.

### Chunk 4 — API endpoints

Add `/api/competencies` endpoints.

### Chunk 5 — UI components

Reusable competency cards, heatmap, evidence timeline components.

### Chunk 6 — Student Profile / Parent Portal integration

Mount competency summary on Student Profile and parent-safe view.

### Chunk 7 — UX/screenshot

Capture screenshots.

### Chunk 8 — Seed and checklist completion

Seed Kenyan competency examples and evidence.

## Next build target

Start **J.4 Chunk 1 — Database foundation**.
