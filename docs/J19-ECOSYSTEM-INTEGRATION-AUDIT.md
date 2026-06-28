# J.19 Whole-School Ecosystem Integration — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Ensure all the disparate modules (Attendance, Behavior, Assessments, Competencies, Portfolio, Clubs) form a single cohesive ecosystem, and provide NEYO Ops (the super-admin) with cross-tenant anonymous aggregate education trends.

## Current State Audit
- ✅ *Connect attendance, behavior, assessments, competencies, portfolio, clubs into one learner journey.* -> Built in **J.8 (Learner Journey Timeline)**.
- ✅ *Attendance can inform wellbeing insights.* -> Built in **J.16 (Advanced Analytics interventions)**.
- ✅ *Behavior can contribute to development reports.* -> Built in **J.15 (Modular Report Builder)**.
- ✅ *Projects feed portfolio.* -> Built in **J.7 (Portfolio)**.
- ✅ *Clubs feed talent profile.* -> Built in **J.11 (Talent Tracking)**.
- ✅ *Parent communication includes academic and co-curricular progress.* -> Built in **J.13 (Parent Growth Dashboard)**.
- ✅ *Storage Vault protects portfolio evidence.* -> Built in **J.7 / I.56**.
- ❌ *NEYO Ops can see cross-tenant anonymous aggregate education trends without exposing school data.* -> **Missing**.

## The Solution
Since 90% of J.19 was architected structurally into the previous J-chunks by design, the remaining technical feature is the **NEYO Ops Anonymous Aggregation Engine**.
1. **Service (`ecosystem-trends.service.ts`)**: A system-level query that bypasses `tenantDb()` to use the raw `db` context securely. It will count global stats, popular pathways, and average competency gaps across the entire NEYO customer base without returning any PII (no names, no school names).
2. **API (`/api/ops/education-trends`)**: Protected by `SUPER_ADMIN` requirement.
3. **UI**: Add an "Education Trends" tab to the NEYO Ops / Founder dashboard so the founder can see the macro impact of the platform across Kenya.

## J.19 Execution Plan
- **Chunk 1**: Backend Service (`ecosystem-trends.service.ts`).
- **Chunk 2**: API Endpoints (`/api/ops/education-trends`).
- **Chunk 3**: UI Components (Trend charts for NEYO Ops).
- **Chunk 4**: Frontend Integration (Inject into Founder Operations dashboard).
- **Chunk 5**: Validation and documentation of the ecosystem connections.
