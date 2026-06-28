# J.15 Modular Report Builder — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Create a no-code report-template engine. Instead of hardcoded report cards, schools should be able to define "Report Templates" composed of different "Sections" (e.g., Marks, CBC Competencies, Attendance, Behavior, Talents, Teacher Comments, QR Verification).

## Current State Audit
- We have a legacy `ReportCardPdf` and `cbc-report-pdf.tsx` which are mostly hardcoded React-PDF components.
- In I.42 we touched on "Document Design defaults", possibly establishing a `DocumentTemplate` or `DocumentDesign` model for headers/footers/colors. Let's verify `prisma/schema.prisma` for this.
- We need a `ReportTemplate` model that allows selecting which sections are included, their order, and specific configurations (e.g., "Show Class Position?").

## The Solution (Non-Duplication Rule)
1. **Model `ReportTemplate`**: Belongs to `Tenant`. Has fields for `name`, `type` (e.g. END_OF_TERM, MID_TERM, CBC), and a JSON column `sections` that stores an array of section definitions.
2. **Reuse I.42**: We will ensure the generated PDF uses the tenant's global document design (logo, brand color, font) for the header/footer.
3. **No-Code Builder UI**: A drag-and-drop or simple toggle/ordering UI where a school admin can add "Marks Table", "Attendance Summary", "Talent & Co-curricular", "Teacher Remarks", etc.
4. **Dynamic PDF Generation**: The report generator will read the `ReportTemplate.sections` JSON and dynamically mount the corresponding React-PDF components sequentially.

## J.15 Execution Plan
- **Chunk 1**: Prisma Schema updates (`ReportTemplate`).
- **Chunk 2**: Security & Zod Validation (Defining the section schema types).
- **Chunk 3**: Backend Service (`report-template.service.ts`).
- **Chunk 4**: API Endpoints (`/api/academics/report-templates`).
- **Chunk 5**: UI Components (Report Template Builder).
- **Chunk 6**: Frontend Pages (Settings/Academics route to manage templates).
- **Chunk 7**: Dynamic PDF Engine (updating the PDF renderer to map over sections).
- **Chunk 8**: Kenyan Seed Data (A custom Term 2 CBC + Talent report template).
