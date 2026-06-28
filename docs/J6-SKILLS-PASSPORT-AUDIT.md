# 🔬 PART J.6 — SKILLS PASSPORT NON-DUPLICATION AUDIT

> **Standing Operating Procedure (J.25 / Prompt 2):** Before building any J feature, conduct a strict audit of existing B/I features (Exams, CBC, Timetable, LMS, Parent Portal, Student Profile, Storage Vault, Document Design). If an existing feature is partial, extend it rather than creating a duplicate module.

## 1. Executive Summary & Philosophy
NEYO is evolving from a hardcoded CBC management system into a future-proof, curriculum-independent **Education Operating System**. Part J.6 introduces the **Skills Passport**, a comprehensive learner profile and exportable PDF that showcases a student's holistic growth across academic achievements, core competencies, specialized talents, and leadership roles.

This audit ensures that J.6 integrates cleanly with NEYO's existing examination, CBC, flexible assessment, competency framework, and student profile foundations without creating redundant tables or conflicting workflows.

---

## 2. Detailed Audit of Existing Modules

### A. B.5 Exams (`Exam`, `ExamResult`) & J.3 Flexible Assessments (`AssessmentRecord`)
* **Current State:** Fully functional summative exam and flexible assessment engines. `ExamResult` stores numerical marks/grades; `AssessmentRecord` stores rubric levels and scores.
* **Non-Duplication Rule:** The Skills Passport will not duplicate or store academic exam results. Instead, the Skills Passport service will dynamically aggregate existing `ExamResult` and `AssessmentRecord` rows into the "Academic Growth" section of the passport view.

### B. J.4 Competency Framework (`Competency`, `CompetencyEvidence`)
* **Current State:** Configurable competency framework is live, storing evidence across Core Competencies (Communication, Critical Thinking, Problem Solving, etc.) with `scorePct` and `level`.
* **Non-Duplication Rule:** The Skills Passport will not duplicate competency evidence. Instead, it will aggregate existing `CompetencyEvidence` rows into the "Competency Growth" section of the passport view.

### C. Co-curricular, Talent & Leadership Tracking
* **Current State:** Co-curricular subjects exist in `Subject` (e.g. Drama Club, Football), but there is no dedicated table for tracking specific skill ratings like `Leadership`, `Coding`, `Music`, `Sports`, or `Creativity` over time with explicit evidence sources (`ASSESSMENT`, `CLUB`, `PORTFOLIO`, `AWARD`, `OBSERVATION`).
* **Extension Plan:** We will create a tenant-owned `SkillsPassportEntry` table in `prisma/schema.prisma` to record these specific talent and leadership skill ratings over time, linking them directly to the `Student` model.

### D. Student Profile & Parent Portal (`student-profile-client.tsx`, `parent-portal-client.tsx`)
* **Current State:** Both clients currently render exam results, attendance timelines, leaving certificates, and J.4 competency framework summaries.
* **Extension Plan:** We will mount a dedicated `SkillsPassportCard` in both clients, displaying skill ratings (Leadership, Communication, Coding, Music, Sports, Creativity) and providing a one-tap download button for the exportable Skills Passport PDF.

### E. A.10 / I.42 Document Design & Branding
* **Current State:** Provides school logo, motto, brand colors, physical dimensions, and Powered by NEYO footer defaults.
* **Non-Duplication Rule:** The exportable Skills Passport PDF will strictly adhere to `getDocumentDesign()` defaults and include the Powered by NEYO trademark and QR verification code (`PAS-XXXXXXXX`).

---

## 3. J.6 Architecture & Data Model Proposal

We propose adding one tenant-owned model in `prisma/schema.prisma`:
```prisma
model SkillsPassportEntry {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId      String
  student        Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  skillArea      String    // Leadership | Communication | Coding | Music | Sports | Creativity | custom
  ratingLevel    Int       // 1..5 stars/levels
  evidenceSource String    // ASSESSMENT | CLUB | PORTFOLIO | AWARD | OBSERVATION
  sourceId       String?   // optional scalar link to future club, award, or portfolio item
  narrative      String?   // Qualitative growth description
  evidenceDate   String    // YYYY-MM-DD
  recordedById   String
  recordedByName String
  verified       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId, studentId])
  @@index([tenantId, skillArea])
  @@index([tenantId, evidenceSource])
}
```

This model will be registered in `src/lib/core/tenant-tables.ts` (`TENANT_OWNED_MODELS`) to maintain strict tenant isolation.

---

## 4. Strict Chunk Plan for J.6

* **CHUNK 1 — Database Foundation:** Add `SkillsPassportEntry` model to `prisma/schema.prisma` and `tenant-tables.ts`. Generate migration `j6_skills_passport_foundation`, apply, and verify with `prisma migrate status`. Add `scripts/j6-skills-passport-schema-test.ts` to prove tenant isolation and table relationships.
* **CHUNK 2 — Security & Validation (Zod):** Create `src/lib/validations/skills-passport.ts` with strict Zod schemas (`skillsPassportEntrySchema`, `skillsPassportActionSchema`) and define 16-role access rules (read = `academics.view`, `exam.view`, or `student.view`; record rating = `exam.enter_marks`, `homework.assign`, or `academics.manage`). Add `scripts/j6-skills-passport-validation-test.ts`.
* **CHUNK 3 — Backend Logic (Services):** Create `src/lib/services/skills-passport.service.ts` with real Prisma queries: `getSkillsPassportProfile()` (aggregates academic exams, J.4 competencies, and `SkillsPassportEntry` talent/leadership ratings), `recordSkillRating()`, `removeSkillRating()`, and audit logs `skills_passport.rating_recorded`, `skills_passport.rating_removed`. Add `scripts/j6-skills-passport-service-test.ts`.
* **CHUNK 4 — API Endpoints:** Create `src/app/api/skills-passport/route.ts` wiring Service + Zod + session checks and graceful `SkillsPassportError` response mapping in `src/lib/api/respond.ts`. Add `scripts/j6-skills-passport-api-test.ts`.
* **CHUNK 5 — UI Components & Icons:** Create `src/components/skills-passport/skills-passport-components.tsx` with Liquid Glass-ready reusable components: `SkillsPassportCard`, `SkillRatingItem`, `SkillRatingForm`, `SkillsPassportEmptyState`, `SkillsPassportLoadingState`, `SkillsPassportErrorState`, and `SkillsPassportPdfLink`. Add `scripts/j6-skills-passport-ui-components-test.ts`.
* **CHUNK 6 — Frontend Pages & Exportable PDF:** Create `src/lib/documents/skills-passport-pdf.tsx` (co-branded, QR-verified, Powered by NEYO footer). Mount `SkillsPassportCard` in `src/components/students/student-profile-client.tsx` and `src/components/portal/parent-portal-client.tsx` connected to real API. Add `scripts/j6-skills-passport-page-test.ts` and capture review screenshot `screenshots/j6-skills-passport-profile.png`.
* **CHUNK 7 — UX States & Browser Interaction Hardening:** Verify all 4 UX states across mobile and desktop views, confirming zero infinite spinners, beautiful empty states with CTAs, and clear error toasts.
* **CHUNK 8 — Kenyan Seed Data:** Update `prisma/seed.ts` to automatically seed real `SkillsPassportEntry` ratings (Leadership, Coding, Music, Sports, Creativity) for Achieng Mary Otieno in Form 2 East, ensuring screens are never empty.
