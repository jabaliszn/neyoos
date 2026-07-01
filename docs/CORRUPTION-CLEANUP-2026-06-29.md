# Escaped-Backtick Corruption Cleanup — 2026-06-29
**Status:** ✅ All 8 corrupted files repaired and re-verified.

## The problem
An old patch script had over-escaped template literals across 8 files: it wrote a literal
backslash before every backtick (`\` + backtick`) and before every `${` (`\${`). JavaScript/TypeScript
template literals must use a plain backtick and plain `${ }`, so these files failed to
transform/compile and their features were broken at runtime.

## Files fixed (occurrences = escaped backticks repaired)
| File | Escaped backticks | What it powers |
|------|-------------------|----------------|
| src/app/api/academics/exams/print-roster/route.ts | 4 | Exam roster printing (student name + class labels) |
| src/components/academics/computation-dashboard.tsx | 2 | Results-computation dashboard card styling |
| src/components/academics/marks-grid-client.tsx | 8 | Marks entry grid (API fetch URLs + input styling) |
| src/components/academics/report-builder.tsx | 2 | Report template builder save URL |
| src/components/academics/subject-selection-manager.tsx | 6 | Senior-school subject selection (buttons + fetch) |
| src/components/founder/ecosystem-trends-tab.tsx | 4 | Founder ecosystem trends progress bars |
| src/lib/services/computation-engine.service.ts | 2 | Results-release parent SMS message |
| src/lib/services/global-curriculum.service.ts | 2 | Imported curriculum version label |

## The fix (precise, mechanical)
Per file: `\` + backtick` → backtick, and `\${` → `${`. Backed up originals to
`/tmp/corruption-backup/` first. After fixing, every file has a balanced (even) number of backticks.

## Verification (honest)
- `grep -rln '\`' src/` → **CLEAN** (zero escaped backticks anywhere in src/).
- `typescript.transpileModule` on all 8 → **ALL 8 CLEAN** (they failed before).
- Runtime module load (`tsx`): `computation-engine.service` and `global-curriculum.service` both **LOAD** now (they couldn't before — the SMS line and version-label line were broken).
- Feature tests run: `k3-k5-computation-test` ✓, `j21-global-curriculum-test` ✓, `l4-subject-selection-test` ✓, `k1-k2-grading-test` ✓.
- `npm run test:roles` → **24 passed, 0 failed**.
- Checked these 8 files for the other known latent bugs (`students.view`/`students.manage`, portfolio `isApproved`) → none present.

## Pre-existing, UNRELATED issue noted (not introduced or fixed here)
- `scripts/j15-report-builder-test.ts` is **non-idempotent**: it does a raw `reportTemplate.create`
  with a fixed name and no cleanup, so it throws P2002 (unique `tenantId+name`) on a **second run**
  because "CBC Comprehensive Term Report" / "Standard 8-4-4 Scorecard" already exist in the seeded DB.
  This is a test-hygiene issue, not a defect in the repaired `report-builder.tsx`. Left as-is (out of scope).

## Honesty notes
- No browser screenshots (Chromium binary absent in sandbox) — not faked.
- Full-repo `tsc` not run (OOMs in sandbox); verified via per-file transpile + runtime load + feature tests.
