# J.17 Community Service Module — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Create a dedicated `CommunityServiceActivity` system to track volunteer work, charity, tree planting, and environmental projects. This contributes heavily to the CBC curriculum's emphasis on citizenship and environmental stewardship, and ties directly into the Learner Journey (J.8).

## Current State Audit
- We have `TalentRecord` (J.11) for sports/arts and `CompetencyEvidence` (J.4) for academics. 
- Community Service requires distinct tracking (hours logged, supervisor approval, student reflections, and location).
- This is a new model, but it must reuse the `StoredFile` ecosystem for photo evidence and `LearnerJourney` for display.

## The Solution (Non-Duplication Rule)
1. **Model `CommunityServiceActivity`**: A student's log of a specific service act. It tracks `hours`, `category` (e.g. "Environment", "Charity"), `location`, and a `supervisorName`.
2. **Model integration**: Connects to `Student`, `Tenant`, and optional `StoredFile` for photographic evidence (e.g. a picture of planting a tree).
3. **Backend Service**: `community-service.ts` for CRUD and calculating total student volunteer hours.
4. **UI**: Add a `CommunityServiceTab` to the `StudentProfileClient` so teachers/admins can log these events and generate the required certificates.

## J.17 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`CommunityServiceActivity`).
- **Chunk 2**: Zod Schemas (`community-service.ts` validations).
- **Chunk 3**: Backend Service (`community-service.ts`).
- **Chunk 4**: API Endpoints (`/api/community-service`).
- **Chunk 5**: UI Components (`CommunityServiceTab` with hours summary and log table).
- **Chunk 6**: Frontend wiring into `StudentProfileClient`.
- **Chunk 7**: Learner Journey integration (Ensure these show up in the unified J.8 timeline).
- **Chunk 8**: Kenyan Seed Data (Simulate tree planting activities).
