# J.10 Senior School Pathway Management — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Introduce "Pathways" for Senior School (e.g., STEM, Arts & Sports, Social Sciences). Schools must define these pathways, outline subject prerequisites (e.g., "Must have 70% in Mathematics to join STEM"), and manage the workflow of student preferences, teacher recommendations, and final pathway allocations.

## Current State Audit
- `Subject` and `Department` exist for academics.
- Students enroll in `SchoolClass` but have no concept of a specialized "Track" or "Pathway".
- Learner profiles track marks and competencies (J.4, J.6, B.5) but have no place to log future career/pathway ambitions.

## The Solution (Non-Duplication Rule)
We won't replace `SchoolClass` or `Subject`. Instead, we will build a supplementary matching and allocation engine:
1. **Model `Pathway`:** Configurable (e.g. STEM, Creative Arts).
2. **Model `PathwaySubjectRequirement`:** Links existing `Subject` IDs to a `Pathway` to denote Core vs Elective and minimum grade/competency gates.
3. **Model `StudentPathwayPreference`:** Links a `Student` to a `Pathway` with `choiceOrder` (1st, 2nd), counselor/teacher recommendations, and final `isAllocated` status.

## J.10 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`Pathway`, `PathwaySubjectRequirement`, `StudentPathwayPreference`).
- **Chunk 2**: Security & Validation (Zod schemas).
- **Chunk 3**: Backend Service (`pathway.service.ts` for tracking preferences and checking readiness against past exam/assessment records).
- **Chunk 4**: API Endpoints (`/api/pathways`, `/api/pathways/preferences`, `/api/pathways/allocate`).
- **Chunk 5**: UI Components (Readiness Gauge, Pathway Badge).
- **Chunk 6**: Frontend Pages (Admin allocation board, Student Profile pathway tab).
- **Chunk 7**: UX States & Hardening.
- **Chunk 8**: Kenyan Seed Data (CBC Senior School pathways).
