# 🔬 PART J.7 — STUDENT PORTFOLIO SYSTEM NON-DUPLICATION AUDIT

> **Standing Operating Procedure (J.25 / Prompt 2):** Before building any J feature, conduct a strict audit of existing B/I features (Exams, CBC, Timetable, LMS, Parent Portal, Student Profile, Storage Vault, Document Design). If an existing feature is partial, extend it rather than creating a duplicate module.

## 1. Executive Summary & Philosophy
NEYO is evolving from a hardcoded CBC management system into a future-proof, curriculum-independent **Education Operating System**. Part J.7 introduces the **Student Portfolio System**, an encrypted, teacher-approved digital ledger of student co-curricular projects, creative works, coding repos, videos, art, and community activities, complete with media size controls, storage warnings, and a portable transfer pack.

This audit ensures that J.7 integrates cleanly with NEYO's existing student document storage, encrypted storage vault, competency framework, and parent portal without creating redundant tables or conflicting workflows.

---

## 2. Detailed Audit of Existing Modules

### A. B.1 Student Documents (`StudentDocument`) & I.56 Storage Vault (`StoredFile`)
* **Current State:** `StudentDocument` stores official school administrative documents (`label`, `fileUrl`, `hardcopyLocation`). `StoredFile` provides AES-256-GCM envelope encryption for uploads via `/api/files/encrypted`.
* **Non-Duplication Rule:** Administrative student records (birth certificates, fee receipts, discipline letters) belong in `StudentDocument`. The Student Portfolio System will not mix administrative files with creative student work. Instead, we will create a dedicated `PortfolioItem` model that strictly links to `StoredFile` (`storedFileId`) to guarantee that every student project, video, or art piece utilizes the encrypted Storage Vault path.

### B. J.4 Competency Framework (`Competency`) & J.6 Skills Passport (`SkillsPassportEntry`)
* **Current State:** `Competency` stores Core Competency definitions. `SkillsPassportEntry` stores specific skill ratings and references evidence sources (`PORTFOLIO`, `CLUB`, `AWARD`).
* **Extension Plan:** `PortfolioItem` will include optional scalar links to `competencyId`, `subjectId`, `clubId`, and `awardId`. This establishes a clear, bidirectional bridge where a portfolio item can substantiate a Skills Passport rating or a Core Competency observation.

### C. Student Profile & Parent Portal (`student-profile-client.tsx`, `parent-portal-client.tsx`)
* **Current State:** Both clients render exam results, attendance timelines, leaving certificates, J.4 competency summaries, and J.6 skills passports.
* **Extension Plan:** We will mount a dedicated `PortfolioTimelineCard` in both clients, displaying approved portfolio items with media previews, teacher approval badges, storage usage warnings, and a one-tap download button for the portfolio export pack.

---

## 3. J.7 Architecture & Data Model Proposal

We propose adding one tenant-owned model in `prisma/schema.prisma`:
```prisma
// =============================================================================
// PART J.7 — Student Portfolio System foundation
// =============================================================================

// One item in a student's digital portfolio: project, video, photo, art, coding
// work, certificate, teacher observation, or community activity. Uploads must
// use the encrypted Storage Vault path (StoredFile).
model PortfolioItem {
  id               String      @id @default(cuid())
  tenantId         String
  tenant           Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  title            String
  category         String      // PROJECT | VIDEO | PHOTO | ART | CODING | CERTIFICATE | OBSERVATION | COMMUNITY
  description      String?
  storedFileId     String?     // Link to encrypted StoredFile in Storage Vault
  fileUrl          String?
  fileName         String?
  fileSizeBytes    Int?        // For media size controls and storage usage warnings
  externalLink     String?     // e.g., GitHub repo or external video link
  status           String      @default("SUBMITTED") // DRAFT | SUBMITTED | APPROVED | REJECTED
  approvedById     String?
  approvedByName   String?
  approvedAt       DateTime?
  visibleToParents Boolean     @default(false)
  
  // Optional scalar links to existing/J modules
  competencyId     String?
  subjectId        String?
  clubId           String?
  awardId          String?

  createdById      String
  createdByName    String
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([tenantId, studentId])
  @@index([tenantId, category])
  @@index([tenantId, status])
}
```

This model will be registered in `src/lib/core/tenant-tables.ts` (`TENANT_OWNED_MODELS`) to maintain strict tenant isolation.

---

## 4. Strict Chunk Plan for J.7

* **CHUNK 1 — Database Foundation:** Add `PortfolioItem` model to `prisma/schema.prisma` and `tenant-tables.ts`. Generate migration `j7_student_portfolio_foundation`, apply, and verify with `prisma migrate status`. Add `scripts/j7-student-portfolio-schema-test.ts` to prove tenant isolation and table relationships.
* **CHUNK 2 — Security & Validation (Zod):** Create `src/lib/validations/portfolio.ts` with strict Zod schemas (`portfolioItemSchema`, `portfolioApprovalSchema`, `portfolioActionSchema`) and define 16-role access rules (read = `academics.view`, `exam.view`, or `student.view`; submit = `exam.enter_marks`, `homework.assign`, `academics.manage`, or `STUDENT`; approve = `exam.publish` or `academics.manage`). Add `scripts/j7-student-portfolio-validation-test.ts`.
* **CHUNK 3 — Backend Logic (Services):** Create `src/lib/services/portfolio.service.ts` with real Prisma queries: `getPortfolioTimeline()`, `submitPortfolioItem()` (enforces encrypted Storage Vault check via `storedFileId`, media size limits, and storage warnings), `approvePortfolioItem()`, `rejectPortfolioItem()`, `exportPortfolioPack()`, and audit logs `portfolio.item_submitted`, `portfolio.item_approved`, `portfolio.item_rejected`, `portfolio.pack_exported`. Add `scripts/j7-student-portfolio-service-test.ts`.
* **CHUNK 4 — API Endpoints:** Create `src/app/api/portfolio/route.ts` wiring Service + Zod + session checks and graceful `PortfolioError` response mapping in `src/lib/api/respond.ts`. Add `scripts/j7-student-portfolio-api-test.ts`.
* **CHUNK 5 — UI Components & Icons:** Create `src/components/portfolio/portfolio-components.tsx` with Liquid Glass-ready reusable components: `PortfolioHero`, `PortfolioSummaryGrid`, `PortfolioTimelineCard`, `PortfolioItemCard`, `PortfolioItemForm`, `PortfolioApprovalQueue`, `StorageUsageWarningBanner`, and all 4 mandatory UX states. Add `scripts/j7-student-portfolio-ui-components-test.ts`.
* **CHUNK 6 — Frontend Pages & Export Pack:** Create `src/app/api/portfolio/export/route.ts` (exportable portfolio pack). Mount `PortfolioTimelineCard` in `src/components/students/student-profile-client.tsx` and `src/components/portal/parent-portal-client.tsx` connected to real API. Add `scripts/j7-student-portfolio-page-test.ts` and capture review screenshot `screenshots/j7-student-portfolio-timeline.png`.
* **CHUNK 7 — UX States & Browser Interaction Hardening:** Verify all 4 UX states across mobile and desktop views, confirming zero infinite spinners, beautiful empty states with CTAs, and clear error toasts.
* **CHUNK 8 — Kenyan Seed Data:** Update `prisma/seed.ts` to automatically seed real `PortfolioItem` rows (`PROJECT`, `ART`, `CODING`) for Achieng Mary Otieno in Form 2 East, ensuring screens are never empty.
