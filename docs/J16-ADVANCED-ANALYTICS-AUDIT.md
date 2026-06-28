# J.16 Advanced School Analytics — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Build a high-level aggregate dashboard for school leadership (Principal/Director). It needs to pull together data across Academic, Competency, Attendance, and Talent modules to identify systemic gaps (e.g., "Which classes are failing in Math?", "What is the correlation between attendance and performance?", "Which teacher's classes are struggling with specific CBC competencies?").

## Current State Audit
- We already have a strong start under I.60 (Exams Analytics UI/Service).
- However, the checklist specifically requires:
  - Competency gap analytics.
  - Assessment balance analytics (Exams vs Practicals vs Portfolio).
  - Attendance-to-performance correlation.
  - Talent participation & wellbeing indicators.
  - Pathway readiness analytics (from J.10).
  - Principal dashboard intervention cards.

## The Solution (Non-Duplication Rule)
Instead of creating a brand new "Dashboard", we should extend the current `PrincipalDashboard` (or create a dedicated `AdvancedAnalyticsClient`) that houses these specific multi-module insights. 
We need a robust backend service to do the heavy lifting of aggregating this data so the frontend remains fast.

## J.16 Execution Plan
- **Chunk 1**: Backend Service (`advanced-analytics.service.ts` to aggregate cross-module correlations).
- **Chunk 2**: API Endpoints (`/api/analytics/advanced`).
- **Chunk 3**: UI Components (Trend Charts, Correlation Graphs, Intervention Alert Cards).
- **Chunk 4**: Frontend Integration (A new Advanced Analytics page or tab for Principals).
- **Chunk 5**: UX States & Hardening.
- **Chunk 6**: Kenyan Seed Data (Simulated insights like "Form 2 East attendance correlates with lower English scores").
