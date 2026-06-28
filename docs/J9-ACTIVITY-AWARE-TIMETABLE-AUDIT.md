# J.9 Activity-Aware Timetable — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Extend the existing Timetable (which currently strictly handles academic subjects) to support non-academic and co-curricular activities: Clubs, Sports, STEM labs, Agriculture practicals, Music, Guidance, Community Service, and Remedial / Pathway sessions.

## Current State Audit (B.4 Academics / Timetable / G.18 Generator)
- `TimetableSlot`: Maps `tenantId`, `classId`, `dayOfWeek`, `period`, `slotType` to a `subjectId` and `teacherId`. 
  - `slotType` defaults to `"ACADEMIC"`. Other hardcoded types are `"REMEDIAL" | "PREP"`.
- `TimetableConfig`: Configures periods per day, free periods, co-curricular counts, etc. 
  - It currently has basic scalar defaults for co-curricular like `coCurricularCount` and `coCurricularName` (defaults to "Games").
- `Subject` / `Department`: We currently overload `Subject` sometimes to represent co-curricular activities by flagging them or putting them in a specific department.

## The Problem
Forcing "Drama Club" or "Guidance Counseling" to be a `Subject` is rigid. It breaks academic analytics, doesn't map cleanly to skills passports (J.6) or talent tracking (J.11), and makes the timetable confusing when generating purely academic schedules.

## The Solution (Part J Rule: Don't duplicate, extend)
1. **Model `ActivityCategory`:** Create a new model allowing schools to define types of activities with display colors (e.g. STEM=Blue, Sports=Green, Clubs=Purple).
2. **Extend `TimetableSlot`:** Add an optional `activityCategoryId` relation. 
3. **Widen `slotType`:** Allow the slot to explicitly be `"ACTIVITY"` instead of `"ACADEMIC"`.
4. **Constraint Tracking:** Ensure the backend generator/validation logic respects custom constraints (e.g., maximum 2 STEM lab sessions per week).
5. **Print Layout:** Make sure the printed view cleanly groups these colorful activity blocks and fits on A4 natively (I.73 alignment).

## J.9 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`ActivityCategory`, update `TimetableSlot`).
- **Chunk 2**: Zod Schemas & Types.
- **Chunk 3**: Backend Service updates (Timetable Service + constraints).
- **Chunk 4**: API Endpoints (`/api/timetable/activities`).
- **Chunk 5**: UI Components (Activity Category Badge, expanded Slot Block).
- **Chunk 6**: Frontend wiring into Timetable builder/viewer.
- **Chunk 7**: UX Hardening + Print-ready A4 CSS.
- **Chunk 8**: Kenyan Seed Data.
