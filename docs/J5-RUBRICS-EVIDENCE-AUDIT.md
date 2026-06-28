# 🔬 PART J.5 — RUBRICS & EVIDENCE NON-DUPLICATION AUDIT

> **Standing Operating Procedure (J.25 / Prompt 2):** Before building any J feature, conduct a strict audit of existing B/I features (Exams, CBC, Timetable, LMS, Parent Portal, Student Profile, Storage Vault, Document Design). If an existing feature is partial, extend it rather than creating a duplicate module.

## 1. Executive Summary & Philosophy
NEYO is evolving from a hardcoded CBC management system into a future-proof, curriculum-independent **Education Operating System**. Part J.5 introduces a configurable **Rubrics & Evidence Engine** that allows schools to define custom evaluation criteria (e.g. 3-level, 4-level CBC, 5-level project rubrics) and attach them to flexible assessment types, assessment plans, and competencies, supported by secure evidence attachments and narrative teacher comments.

This audit ensures that J.5 builds directly on top of NEYO's existing examination, CBC, flexible assessment, and storage vault foundations without creating redundant tables or conflicting workflows.

---

## 2. Detailed Audit of Existing Modules

### A. B.5 Exams (`Exam`, `ExamSubject`, `ExamResult`)
* **Current State:** Fully functional full-stack summative exam engine. `ExamResult` stores numerical marks and calculates grades (A..E or EE/ME/AE/BE) and cohort positions.
* **Non-Duplication Rule:** Formal exams remain the official summative record. J.5 rubrics will not modify or replace `ExamResult` or hardcoded formal exam logic. Instead, J.5 provides a configurable rubric layer for projects, practicals, portfolios, and continuous formative evaluations.

### B. B.6 CBC Management (`CbcStrand`, `CbcAssessment`)
* **Current State:** Provides formative append-only observations using a fixed 4-level KICD scale (`1=BE`, `2=AE`, `3=ME`, `4=EE`) with KICD outcome statements and parent-friendly plain language lines.
* **Non-Duplication Rule:** J.5 will not replace `CbcAssessment`. Instead, J.5 generalizes the rubric concept into configurable `Rubric` and `RubricLevel` models, allowing schools to create CBC-style 4-level rubrics as well as custom non-CBC rubrics (e.g. Cambridge 5-level, vocational pass/merit/distinction scales) for use across the school.

### C. J.3 Flexible Assessment Engine (`AssessmentType`, `AssessmentPlan`, `AssessmentRecord`, `AssessmentEvidence`)
* **Current State:** Tenant-owned flexible assessment models are live. `AssessmentPlan` explicitly includes `rubricJson String? // temporary descriptor storage until J.5 configurable Rubric model lands`. `AssessmentRecord` stores `rubricLevel Int?`, `rubricCode String?`, and `narrative String?`. `AssessmentEvidence` supports file references (`storedFileId`, `fileUrl`).
* **Extension Plan:** J.5 fulfills the explicit promise of `AssessmentPlan`. We will add `rubricId` scalar links to `AssessmentType`, `AssessmentPlan`, and `AssessmentRecord`, directly connecting the flexible assessment engine to configurable rubric definitions.

### D. J.4 Competency Framework (`CompetencyGroup`, `Competency`, `CompetencyEvidence`)
* **Current State:** Tenant-owned configurable competency framework is live. `CompetencyEvidence` stores `level Int?`, `scorePct Int?`, and `narrative String?`.
* **Extension Plan:** We will add `rubricId` scalar links to `Competency` and `CompetencyEvidence`, enabling schools to attach dedicated rubrics to specific competencies (e.g. a 5-level Critical Thinking rubric).

### E. I.56 Storage Vault (`StoredFile`, `/api/files/encrypted`)
* **Current State:** Provides AES-256-GCM envelope encryption for server-side uploads. Direct presigned browser uploads are locked/deprecated in favor of the encrypted path.
* **Non-Duplication Rule:** All evidence file attachments created through J.5 rubric scoring workflows will strictly utilize `FileUpload` pointing to `/api/files/encrypted` and reference `StoredFile` metadata.

---

## 3. J.5 Architecture & Data Model Proposal

We propose adding two tenant-owned models in `prisma/schema.prisma`:
1. `Rubric`: Stores the configurable rubric header (`name`, `description`, `category`, `isArchived`, `createdById`).
2. `RubricLevel`: Stores the individual levels/descriptors (`rubricId`, `level`, `code`, `label`, `descriptor`, `points`).

We will extend existing Part J models with optional `rubricId` scalar fields:
* `AssessmentType.rubricId`
* `AssessmentPlan.rubricId`
* `AssessmentRecord.rubricId`
* `Competency.rubricId`
* `CompetencyEvidence.rubricId`

Both new models will be registered in `src/lib/core/tenant-tables.ts` (`TENANT_OWNED_MODELS`) to maintain strict tenant isolation.

---

## 4. Strict Chunk Plan for J.5

* **CHUNK 1 — Database Foundation:** Add `Rubric` and `RubricLevel` models to `prisma/schema.prisma` plus `rubricId` links on existing J models. Register in `tenant-tables.ts`. Generate migration `j5_rubrics_evidence_foundation`, apply, and verify with `prisma migrate status`. Add `scripts/j5-rubrics-schema-test.ts` to prove tenant isolation and table relationships.
* **CHUNK 2 — Security & Validation (Zod):** Create `src/lib/validations/rubric.ts` with strict Zod schemas (`rubricSchema`, `rubricLevelSchema`, `rubricActionSchema`) and define 16-role access rules (manage = `academics.manage` or `tenant.manage_settings`; score/attach evidence = `exam.enter_marks`, `homework.assign`, or `academics.manage`). Add `scripts/j5-rubrics-validation-test.ts`.
* **CHUNK 3 — Backend Logic (Services):** Create `src/lib/services/rubric.service.ts` with real Prisma queries: `rubricBoard()`, `createRubric()`, `updateRubric()`, `archiveRubric()`, `attachRubricToAssessment()`, `attachRubricToCompetency()`, `scoreWithRubric()`, `attachEvidenceFile()`, and audit logs `rubric.created`, `rubric.updated`, `rubric.archived`, `rubric.attached`, `rubric.scored`, `rubric.evidence_attached`. Add `scripts/j5-rubrics-service-test.ts`.
* **CHUNK 4 — API Endpoints:** Create `src/app/api/rubrics/route.ts` wiring Service + Zod + session checks and graceful `RubricError` response mapping in `src/lib/api/respond.ts`. Add `scripts/j5-rubrics-api-test.ts`.
* **CHUNK 5 — UI Components & Icons:** Create `src/components/rubrics/rubric-components.tsx` with Liquid Glass-ready reusable components: `RubricHero`, `RubricSummaryGrid`, `RubricList`, `RubricCard`, `RubricForm`, `RubricLevelForm`, `TeacherRubricScoringPanel` (mobile + desktop friendly), `RubricEvidenceUploadCard` (Storage Vault encrypted path), and all 4 mandatory UX states (Loading, Empty, Error, Populated). Add `scripts/j5-rubrics-ui-components-test.ts`.
* **CHUNK 6 — Frontend Pages:** Create connected page `src/app/(app)/settings/rubrics/page.tsx` and `RubricEngineClient` wired to real `GET/POST /api/rubrics`. Connect teacher scoring panel on `/assessments` and `/competencies`. Add `scripts/j5-rubrics-page-test.ts` and capture review screenshot `screenshots/j5-rubrics-engine.png`.
* **CHUNK 7 — UX States & Browser Interaction Hardening:** Verify all 4 UX states across mobile and desktop views, confirming zero infinite spinners, beautiful empty states with CTAs, and clear error toasts.
* **CHUNK 8 — Kenyan Seed Data:** Update `prisma/seed.ts` to automatically seed a default 4-level CBC Rubric (`EE`, `ME`, `AE`, `BE`) and a 5-level Project Rubric (`EXCELLENT`, `GOOD`, `SATISFACTORY`, `PASS`, `NEEDS_WORK`) for Karibu High School, ensuring screens are never empty.
