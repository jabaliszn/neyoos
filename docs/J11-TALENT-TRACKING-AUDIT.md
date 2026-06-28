# J.11 Talent Tracking & Co-Curricular Growth — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Track student talents and co-curricular participation systematically (Music, Drama, Coding, Athletics). Coaches and teachers need a way to log talent development scores, qualitative notes, and participate in broader analytics.

## Current State Audit
- We recently added `ActivityCategory` (J.9) which tracks the *types* of activities available (e.g., STEM, Drama) on the timetable.
- `SkillsPassport` (J.6) tracks 5-star ratings for broader core skills (Leadership, Teamwork).
- `Portfolio` (J.7) stores tangible evidence and files.
- We do not currently have a system that logs *continuous participation, talent score, and coach evaluations* for specific co-curricular domains.

## The Solution (Non-Duplication Rule)
Instead of redefining "Drama Club", we will link to the `ActivityCategory` (or create a dedicated `TalentArea` if we want deeper abstraction, but `TalentArea` is explicitly requested in the prompt checklist). We will:
1. **Model `TalentArea`**: specific domains of talent (e.g., "Football", "Public Speaking", "Piano").
2. **Model `TalentRecord`**: A recurring log where a coach/teacher evaluates a student's progress in a `TalentArea` (e.g., "Term 2 Evaluation: Scored 8/10, shows great leadership on the field").
3. **Analytics**: Aggregate these records to show school-wide talent participation by grade, gender, and term.
4. **Integration**: Link talent records implicitly to the J.8 Learner Journey and J.7 Portfolio when evidence is attached.

## J.11 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`TalentArea`, `TalentRecord`).
- **Chunk 2**: Security & Validation (Zod schemas).
- **Chunk 3**: Backend Service (`talent.service.ts`).
- **Chunk 4**: API Endpoints (`/api/talents`, `/api/talents/records`).
- **Chunk 5**: UI Components (Talent Board, Student Talent History).
- **Chunk 6**: Frontend Pages (Co-curricular tracking dashboard, Student Profile 'Talent' tab).
- **Chunk 7**: Analytics aggregation (Participation by cohort).
- **Chunk 8**: Kenyan Seed Data (CBC Sports, Music festival records).
