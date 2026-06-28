# J.12 Teacher Planning Linked to Curriculum Objectives — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Extend the existing `LessonPlan` module to tightly integrate with the Curriculum Engine (J.2), Flexible Assessment (J.3), and Competency Framework (J.4). It needs to move from a standalone text-based log to a connected system that provides coverage tracking, evidence attachment, and deep insights into what is planned vs taught vs assessed.

## Current State Audit
- `LessonPlan` exists with `topic`, `objectives` (string), `activities` (string), `notes` (string), and `status` (PLANNED/TAUGHT/SKIPPED).
- It lacks any relations to `CbcStrand` (topics/objectives), `Competency`, or `AssessmentPlan`.
- There is no native way to attach J.7 / `StoredFile` resources as evidence or materials.
- Coverage tracking is disconnected from actual DB counts.

## The Solution
1. **Extend `LessonPlan`:**
   - Add optional links to `CbcStrand` (J.2), `Competency` (J.4), and `AssessmentPlan` (J.3).
   - Allow JSON or comma-separated file URLs for attached resources (or a dedicated `LessonResource` table). Let's use `resourceFileIds` if SQLite supports it, or a separate `LessonResource` model to connect to `StoredFile`.
2. **Update Validation & API:** Include these new optional links when creating or updating a lesson plan.
3. **Analytics Endpoint:** Create an endpoint to aggregate "planned vs taught vs assessed" objectives per class/subject.
4. **UI Evolution:** Update `LessonsTab` and the editing dialog in `academics-client.tsx` to include smart dropdowns for strands, competencies, and assessments.

## J.12 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`LessonPlan` additions, `LessonResource`).
- **Chunk 2**: Security & Validation (Zod schemas).
- **Chunk 3**: Backend Service (`academics.service.ts` / `planning.service.ts`).
- **Chunk 4**: API Endpoints (Lesson Plan CRUD updates, Planning Analytics endpoint).
- **Chunk 5 & 6**: Frontend Pages (Lesson editor + Analytics Dashboard cards).
- **Chunk 7**: UX States & Hardening.
- **Chunk 8**: Kenyan Seed Data.
