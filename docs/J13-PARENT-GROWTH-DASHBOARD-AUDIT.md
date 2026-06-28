# J.13 Parent Growth Dashboard — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Transform the Parent Portal from a traditional "marks and attendance" view into a holistic "Growth Dashboard". It should highlight competencies, talents, projects, upcoming assessments, teacher feedback, and collaborative goal-setting.

## Current State Audit
- `ParentPortalClient` currently exists and already mounts the `LearnerJourneyCard` (from J.8) which provides a great timeline.
- We have data models for `CompetencyEvidence` (J.4), `TalentRecord` (J.11), `AssessmentPlan` (J.3), and `DisciplineIncident` (B.20).
- **Missing Data Models**: We lack a way to track collaborative "Student Goals" that a parent can acknowledge. We also need a structured "Teacher Feedback Digest" or we can aggregate existing `notes` from recent records.

## The Solution
1. **Model `StudentGoal`:** A new model for termly or yearly goals (Academic, Social, Co-curricular) set by the teacher, with an `acknowledgedByParent` boolean.
2. **Aggregated API Endpoint (`/api/portal/parent/growth`)**:
   - Fetch upcoming `AssessmentPlan` and `Exam` schedules.
   - Fetch recent `TalentRecord` and `CompetencyEvidence` to build "Growth Summary Cards".
3. **UI Upgrades to `ParentPortalClient`**:
   - Add a "Growth & Wellbeing" tab or section.
   - Show a digest of recent teacher feedback (from lesson plans, talent records, and assessments).
   - Display an "Upcoming Assessments & Goals" widget.

## J.13 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`StudentGoal`).
- **Chunk 2**: Backend Services (`parent-portal.service.ts` extensions).
- **Chunk 3**: API Endpoints.
- **Chunk 4 & 5**: UI Components (`GrowthSummaryCards`, `UpcomingAssessmentsWidget`, `GoalTrackerWidget`).
- **Chunk 6**: Frontend wiring into `parent-portal-client.tsx`.
- **Chunk 7**: UX States & Kenyan Seed Data.
