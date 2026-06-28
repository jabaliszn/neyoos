# J.21 NEYO Ops Curriculum Template Library — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Create a global (company-level) library of curriculum templates (e.g., "CBC Kenya", "8-4-4 Legacy"). NEYO Ops can create and publish these. Individual schools can browse the library and "adopt" a template, which copies the structure into their school as a new DRAFT curriculum, allowing them to review and customize it before publishing it live.

## Current State Audit
- We have a robust `Curriculum` and `CbcStrand`/`LearningArea` model per tenant.
- J.20 gave us Versioning (Draft -> Diff -> Active -> Archived) *within* a school.
- We do not have a cross-tenant / global template repository. 

## The Solution
1. **Model `GlobalCurriculumTemplate`**: A tenant-less global table managed by `SUPER_ADMIN`. It stores the metadata and a JSON representation of the learning areas/strands to keep it lightweight and easily transportable.
2. **NEYO Ops UI**: Extend the Founder Ops dashboard with a "Curriculums" tab to manage these global templates.
3. **School Adoption Workflow**: In the Academics `Curriculum Version Manager` (J.20), add an "Import from NEYO Library" button. When clicked, it reads the published global templates. Adopting one creates a local `Curriculum` clone in `DRAFT` status so the school can review the diff and publish safely.
4. **Audit Logging**: Ensure the adoption event logs an audit trail.

## J.21 Execution Plan
- **Chunk 1**: Prisma Schema updates + Migration (`GlobalCurriculumTemplate`).
- **Chunk 2**: Security & Zod Validation.
- **Chunk 3**: Backend Service (`global-curriculum.service.ts`).
- **Chunk 4**: API Endpoints (Ops management + Tenant adoption).
- **Chunk 5**: Founder Ops UI integration.
- **Chunk 6**: School UI Integration (Import from NEYO Library dialog).
- **Chunk 7**: Kenyan Seed Data (Seed "CBC Kenya Junior School v1" template).
