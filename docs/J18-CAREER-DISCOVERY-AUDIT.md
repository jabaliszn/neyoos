# J.18 Career Discovery & Pathway Guidance — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Track student career interests over time, log teacher/counselor recommendations, and document parent-student career conversations. This directly informs the Senior School Pathway decisions (J.10) and ensures a rule-based, longitudinal view of a student's aspirations.

## Current State Audit
- We have `StudentPathwayPreference` (J.10) for final track selections.
- We have `TalentRecord` (J.11) and `CompetencyEvidence` (J.4) for performance metrics.
- We lack a dedicated timeline for mapping interests and logging career-focused conversations before a final pathway is chosen.

## The Solution (Non-Duplication Rule)
1. **Model `CareerDiscoveryRecord`**: A single unified timeline model linking a `studentId`. It uses a `recordType` enum (`STUDENT_INTEREST`, `TEACHER_RECOMMENDATION`, `PARENT_CONVERSATION`) to capture different facets of career guidance.
2. **Standardized Areas**: Hardcode or provide a standardized list of Kenyan CBC/8-4-4 relevant career areas (Engineering, Medicine, Agriculture, ICT, Creative Arts, etc.).
3. **Backend Service**: `career-discovery.service.ts` to manage the CRUD operations and assemble the timeline.
4. **UI**: Add a `StudentCareerTab` to the `StudentProfileClient` so counselors can view the history of a student's interests and guide them into the correct Senior School Pathway.

## J.18 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`CareerDiscoveryRecord`).
- **Chunk 2**: Zod Schemas (`career-discovery.ts` validations).
- **Chunk 3**: Backend Service (`career-discovery.service.ts`).
- **Chunk 4**: API Endpoints (`/api/students/careers`).
- **Chunk 5**: UI Components (`StudentCareerTab`).
- **Chunk 6**: Frontend wiring into `StudentProfileClient`.
- **Chunk 7**: UX States & Hardening.
- **Chunk 8**: Kenyan Seed Data (Simulate an interest and a teacher recommendation).
