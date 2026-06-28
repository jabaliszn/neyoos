# J.20 Future-Proof Configuration & Versioning — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Curriculums and assessments change. Schools need to be able to safely build a "Draft" or "Preview" of next year's curriculum (e.g., "CBC 2027 Update"), see what changes from their current active version, and deploy it smoothly. Historical reports must remain locked to the version they were generated under.

## Current State Audit
- The `Curriculum` model (from J.2) has `activeVersion`, `effectiveFrom`, `effectiveTo`, and `isActive` boolean.
- It lacks a formal `status` (DRAFT/PREVIEW/ACTIVE/ARCHIVED).
- It lacks a self-relation to know if "CBC 2027" is a direct descendent of "CBC 2026".
- We don't have a specific `CurriculumMigration` or Versioning snapshot service.

## The Solution
1. **Extend `Curriculum` model**:
   - Add `status String @default("ACTIVE") // DRAFT | ACTIVE | ARCHIVED`.
   - Add `previousVersionId String?` self-relation to explicitly link a v2 update to a v1 base.
   - Extend `ReportTemplate` and `AssessmentType` with `effectiveFrom` / `effectiveTo` to version them too.
2. **Backend Versioning Engine**:
   - A service that clones an active curriculum into a `DRAFT` so the school can mutate learning areas without breaking live reports.
   - A "Preview Migration" endpoint that computes a diff (Added Areas, Removed Areas) between v1 and v2.
   - A "Publish" action that archives v1 (`effectiveTo = today`) and activates v2.
3. **UI Updates**:
   - Add "Version History & Updates" to the Curriculum engine UI.
   - Show a visual diff before publishing an update.

## J.20 Execution Plan
- **Chunk 1**: Prisma Schema updates (`Curriculum.status`, `Curriculum.previousVersionId`).
- **Chunk 2**: Backend Services (`curriculum-versioning.service.ts`).
- **Chunk 3**: API Endpoints.
- **Chunk 4**: UI Components (Version History timeline, Diff visualizer).
- **Chunk 5**: Frontend Integration (Curriculum settings tab).
- **Chunk 6**: Seed Data.
