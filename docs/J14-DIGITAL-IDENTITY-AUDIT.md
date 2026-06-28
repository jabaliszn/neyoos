# J.14 Student Digital Identity & Transfer Passport — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Create a unified "Digital Identity" for a learner that compiles their achievements, competencies, portfolio, medical alerts, and behavior into a single portable view. Enable exporting this as a "Transfer Passport" for non-NEYO schools, and build a secure, consent-based NEYO-to-NEYO transfer workflow with data minimization.

## Current State Audit
- We have a basic `StudentTransfer` model from B.1 that tracks `destinationSchool`, `transferDate`, and `reason`.
- All the underlying data exists across modules (J.4 Competencies, J.11 Talents, J.7 Portfolio, B.21 Clinic, B.20 Discipline, B.3 Attendance).
- We lack a formal "Passport Snapshot" generator and a consent-driven, cross-tenant data exchange system.

## The Solution (Non-Duplication Rule)
We will extend `StudentTransfer` and add a new model `TransferPassport` or just store the payload in `StudentTransfer`. Given the complexity of consent and data minimization, a dedicated `TransferPassportRequest` model is best for NEYO-to-NEYO handshakes.
1. **Model `TransferPassportRequest`**: Tracks a request between `sourceTenantId` and `destinationTenantId` (or email for non-NEYO). Stores `consentProof`, `selectedModules` (data minimization), `payload` (the actual snapshot), and `status` (PENDING, ACCEPTED, REJECTED).
2. **Passport Aggregator Service**: A backend utility that pulls the 360-degree view of a student based on selected modules (Academic, Portfolio, Medical, Discipline).
3. **UI**: A new tab in the Student Profile for "Identity & Transfer" to generate the passport and initiate transfers.

## J.14 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`TransferPassportRequest`).
- **Chunk 2**: Security & Validation (Zod schemas for passport configuration).
- **Chunk 3**: Backend Service (`digital-identity.service.ts` for aggregation, `transfer-passport.service.ts` for handshakes).
- **Chunk 4**: API Endpoints.
- **Chunk 5**: UI Components (Passport Preview, Data Minimization Checkboxes).
- **Chunk 6**: Frontend wiring into `StudentProfileClient` (Transfer Tab).
- **Chunk 7**: UX States & PDF Export scaffolding.
- **Chunk 8**: Kenyan Seed Data (Simulated transfer from Karibu High to Uhuru Academy).
