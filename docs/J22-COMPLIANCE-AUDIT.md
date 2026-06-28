# J.22 Compliance, Consent & Data Safety — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
Ensure all student portfolio, learner journey, and transfer data respect parental consent, role-based visibility, retention limits, and data minimization constraints (especially regarding sensitive medical and discipline data). This is critical for ODPC/Kenya Data Protection Act alignment.

## Current State Audit
- **J.14 (Digital Identity)**: We built a robust data minimization UI where admins explicitly check boxes (e.g. "MEDICAL", "DISCIPLINE") before generating a transfer passport. We also implemented `consentBy` (tracking parent name).
- **J.8 (Learner Journey)**: The `LearnerJourneyCard` handles `mode="parent"` vs `mode="staff"`. It strictly blocks `CounselingNote` items from the parent/timeline view.
- **J.7 (Student Portfolio)**: Items have an `isApproved` flag and `visibleToParents` flag.
- **Missing Elements**:
  1. We need a formal `StorageRetentionPolicy` or backend logic to auto-expire/purge sensitive portfolio data after a student graduates or leaves, or after a specific statutory timeframe.
  2. The actual **Audit Log** for exports: We need to ensure that every time a Transfer Passport is created, downloaded, or viewed, an explicit `auditLog` entry is dropped.
  3. We need to formalize the role-level guardrails inside the API (ensure that a teacher cannot export a transfer passport, only an Admin/Principal).

## The Solution (Non-Duplication Rule)
Since the structural components of consent and data minimization were built deeply into J.14, J.8, and J.7 during their respective chunks, our focus for J.22 is to **harden the compliance infrastructure**:
1. **Audit Logs for Transfer**: Update `digital-identity.service.ts` to log specific, legally binding audit records.
2. **Role Restrictions**: Ensure `POST /api/students/passport` is strictly bounded to `student.transfer` or `students.manage` permission levels.
3. **Data Retention Cron**: Write a backend script (`scripts/compliance-retention-job.ts`) that simulates or executes a retention purge of expired transfer passports and ancient portfolio artifacts, proving GDPR/ODPC alignment.

## J.22 Execution Plan
- **Chunk 1**: Audit Log implementation for the J.14 Digital Identity engine.
- **Chunk 2**: Review and tighten API role scopes across J.7, J.8, and J.14.
- **Chunk 3**: Backend Retention Job (`retention.service.ts` + cron seam).
- **Chunk 4**: Verification scripts.
