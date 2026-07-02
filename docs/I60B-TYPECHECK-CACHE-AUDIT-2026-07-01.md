# Repo-Wide Full-Stack Audit — 2026-07-01

## Founder request
Founder cloned the repo into a new chat and asked for a full audit because they
doubted whether recent work (Part J onward) was truly full-stack. Per Prompt 2
("ZERO-SHORTCUT FULL-STACK EXECUTION"), this required actually running the
project — install, migrate, seed, typecheck, test, build — not trusting the
checklist's claims at face value.

## What we found (root cause)

**The repo had committed `.tsbuildinfo` files to git** (`tsconfig.tsbuildinfo`,
`tsconfig.j20check.tsbuildinfo`, `tsconfig.j21b.tsbuildinfo`,
`tsconfig.j22-check.tsbuildinfo`, `tsconfig.j23-check.tsbuildinfo`,
`tsconfig.j23-ui.tsbuildinfo`). These are TypeScript's *incremental compile
cache* — they should never be committed. Because `tsconfig.json` has
`"incremental": true`, running `tsc --noEmit` against a checked-out repo with a
stale cache silently **skips re-checking most files**, making `npm run
typecheck` report clean even when there are hundreds of real errors.

This meant every `npm run typecheck` ✅ claim recorded in `CONTEXT-ANCHOR.md`
for weeks of work was **not trustworthy** — the cache was masking real bugs.

Once the cache files were deleted and a genuinely clean `tsc --noEmit` was run,
**224 real TypeScript errors surfaced across 33 files**, plus 2 further
migration/runtime bugs found by actually running the app.

## Full list of real bugs found and fixed

### Environment / build-system bugs (found running the project for the first time)
1. **Duplicate Prisma migration** — `20260630164219_exam_timetable_invigilators`
   and `20260630164229_exam_timetable_invigilators` (created 10 seconds apart)
   contained byte-identical `ALTER TABLE` statements. `prisma migrate deploy`
   failed outright on a fresh clone (`duplicate column name`). Removed the
   duplicate folder.
2. **Schema/migration drift** — `Curriculum.adoptedTemplateId/Version`,
   `AssessmentType.effectiveFrom/effectiveTo`, and
   `GlobalCurriculumTemplate.publishedAt/changeNote/announcedAt` existed in
   `schema.prisma` but had never been captured in a migration file (very
   likely applied to the previous session's dev DB via `prisma db push`
   directly, per the anchor's own notes on J.20/J.21). This broke seeding
   (`P2022: column does not exist`) on a fresh clone. Fixed with a new,
   clean, additive migration `20260701125337_j20_j21_schema_drift_fix`.
3. **Committed `.tsbuildinfo` files** — see above. Deleted all 6 files, added
   `*.tsbuildinfo` to `.gitignore`.

### Real code bugs found only after the cache was removed (224 → 0)
- **`src/components/academics/academics-client.tsx`** (143 errors) — a bad
  automated patch had copy-pasted the "Draft resume protection" UI card and
  its `localStorage` draft-save effects (belonging only to the Smart
  Timetable / `TimetableEngineTab` screen) into 6 unrelated
  functions/screens (`SubjectsTab`, `TermsTab`, `TimetableTab`,
  `ObservationDialog`, `DutyRosterTab`, `TimetableGeneratorTab`) that had none
  of the required state. Removed the 5 stray broken copies, restored the one
  genuine copy to its rightful home in `TimetableEngineTab`. Also deleted a
  450-line **dead/unused** `OldCoCurricularTab` function (the real, active
  `CoCurricularTab` is a small wrapper around `TalentManagerClient` a few
  lines above it — confirmed nothing in the app calls `OldCoCurricularTab`).
  Also fixed 5 missing icon/component imports, an `ExamSlotRow` type missing
  two real fields (`paperConfigId`, `targetIds`), and a missing
  `schoolLevelActivation` prop thread into `ExamAutoGeneratorTab`.
- **UI `variant`/`size` prop misuse** across ~10 files (`pathway-manager.tsx`,
  `student-pathway-tab.tsx`, `subject-selection-manager.tsx`,
  `talent-manager.tsx`, `promotion-client.tsx`, `students-client.tsx`,
  `student-service-tab.tsx`, `parent-pathway-card.tsx`,
  `learner-journey-components.tsx`) — code used `variant="outline"`,
  `variant="secondary"` on `<Badge>` (which only accepts `tone`), and
  `variant="default"`/`size="icon"` on `<Button>` (component only supports
  `primary|secondary|ghost|danger` / `sm|md|lg`). Normalized every call site
  to the real component APIs.
- **`EmptyState` misuse** (`pathway-manager.tsx`, `talent-manager.tsx`,
  `report-builder.tsx`) — passed `action={{label, onClick}}` where the
  component only accepts that shape under `primaryAction`/`secondaryAction`
  (a bare `action` must be a rendered `ReactNode`). Fixed all 3.
- **Null-unsafe optional-subject timetable code** (`academics.service.ts`,
  `document.service.ts`, `teacher-portal.service.ts`,
  `parent-portal.service.ts`, `offline/bundle/route.ts`) —
  `TimetableSlot.subjectId`/`subject` is genuinely optional in the schema
  (activity/PE/games slots have no subject), but 9+ call sites did
  `s.subject.name` unguarded. Added `?.` + fallbacks everywhere, and fixed a
  `Prisma.findMany({ where: { id: { in: [...] } } })` call that could receive
  `null` values in the id list.
- **Missing `tenantId` (and `actorName`) on raw `AuditLog.create` calls**
  (`learner-journey.service.ts` ×3, `pathway.service.ts`,
  `talent.service.ts`, `timetable-activities.service.ts`'s
  `ActivityCategory.create`) — these used `tenantDb()` (which *runtime*-stamps
  `tenantId` automatically) but TypeScript's generated Prisma types still
  require it explicitly in the `data` object for `AuditLog`/`ActivityCategory`
  creates. Fixed all 6 call sites to match the working pattern used
  throughout the rest of the codebase (see `academics.service.ts`'s `audit()`
  helper).
- **`fail()` called without the required `status` argument**
  (`pathways/allocate/route.ts`).
- **API route passing a whole discriminated-union request body straight into
  a service function with an incompatible/stricter parameter type**
  (`promotion/auto-grouping/route.ts`'s `save_rule` action, and
  `grading/grid/route.ts` normalizing `marksScored: number | null |
  undefined` → `number | null`).
- **Wrong field path bug**: `learner-journey/export/route.ts` read
  `pack.export.generatedAt`, but the service actually returns `generatedAt`
  under `pack.manifest`, not `pack.export`. Real bug (not just typing) — the
  PDF's date would always have been `undefined`. Fixed.
- **Genuinely unimplemented function call**:
  `learner-journey-card.tsx`'s hero "Export learner journey" button was
  wired to `onExport={exportJourney}`, but `exportJourney` was never defined
  anywhere in the file — a broken CTA that had never actually worked. Built
  the real implementation (calls `/api/learner-journey/export`, downloads
  the JSON file) rather than just silencing the type error.
- **A hook naming footgun** (`learning-videos-client.tsx`): a plain helper
  function was named `useIdea(...)`, which is not a React Hook, but the
  `use*` naming convention tripped `react-hooks/rules-of-hooks` and failed
  the production build. Renamed to `applyIdea`.
- **`Set<string>` type-inference gap** (`promotion-client.tsx`): `Array.from(new
  Set(arr.map((c: any) => c.level)))` inferred `unknown[]` because the source
  array element type was `any`. Fixed with an explicit `Set<string>` generic.
- **Missing formal type fields**: `LearnerJourneyEntry`'s Zod schema
  (`learner-journey.ts`) didn't declare the `pinned`/`pinVisibility`/`pinNote`
  fields that the service has legitimately been attaching to timeline
  entries since the J.8 pin-milestone feature was built. Added them as
  optional fields so the real runtime shape and the compile-time type match.
- **Missing `withTenant()` wrapper — found only by actually running the app**:
  `src/app/api/academics/exams/print-roster/route.ts` called `tenantDb()`
  directly without `withTenant(user.tenantId, ...)`, which threw `"No tenant
  in scope"` at runtime for every real request (verified via a live curl
  test as PRINCIPAL before and after the fix). This bug was **not** caught by
  typecheck or build at all — only found because we actually clicked/curled
  the route as a logged-in user. Also fixed a pre-existing, unrelated logic
  bug in the same route: it tried `include: { results: { include: { student:
  ... } } }` on `Exam`, but `ExamResult` has no `student` relation in the
  schema (only a plain `studentId` string) — it needed a separate
  `student.findMany({ where: { id: { in: [...] } } })` join, which was built.
- **Several test/seed scripts** (`j15-report-builder-fullstack-test.ts`,
  `j8-chunk8-seed.ts`, `j8-learning-journey-export-test.ts`,
  `timetable-solver-test.ts`) had genuinely broken calls (missing required
  schema fields, `User.name` instead of `User.fullName`, incomplete
  `SessionUser` mocks, wrong argument shape) — all fixed and re-run green.

## Verification performed (not just "it compiles")
- `rm -rf node_modules/@prisma/.prisma/dev.db` fresh install, migrate, seed —
  all succeed cleanly and are idempotent on re-run.
- `npx tsc --noEmit -p tsconfig.json` with **zero `.tsbuildinfo` cache** →
  **0 errors** (was 224).
- `npm run test:roles` → 24/24 passed (unchanged, still green).
- Feature regression scripts re-run and passing: `j15-report-builder-fullstack-test`,
  `j8-chunk8-seed`, `j8-learning-journey-export-test`,
  `j8-learning-journey-pins-service-test`, `j8-learning-journey-service-test`,
  `timetable-solver-test`, `l7-timetable-engine-test`, `l7-auto-grouping-test`,
  `j10-pathways-fullstack-test`, `j11-talent-fullstack-test`,
  `l4-subject-selection-test`.
- `npm run build` → clean production build, zero compile/type errors (a small
  number of informational "Dynamic server usage: ... used `cookies`" log
  lines for authenticated API routes are expected Next.js behavior, not
  errors).
- **Live server test**: built app started with `npm start`, logged in for
  real as `principal@karibuhigh.ac.ke` via the real OTP flow, and hit
  previously-broken pages/routes over HTTP as an authenticated session:
  - `GET /students/promotion` → 200
  - `GET /settings/rubrics` → 200
  - `GET /academics` → 200
  - `GET /dashboard` → 200
  - `GET /api/learner-journey/export?...` → 200, real transfer-friendly export
    payload for Achieng Mary Otieno
  - `GET /api/academics/exams/print-roster` → **before fix**: 500 "No tenant
    in scope"; **after fix**: 200 with real computed class averages
    (Achieng 85%, Kamau 59%, Atieno 47%) from the live seeded database.

## Files changed this pass
DB: 1 duplicate migration removed, 1 new drift-fix migration added.
`.gitignore` updated to exclude `*.tsbuildinfo` going forward.

33 source files fixed (8 API routes, 15 UI components, 8 services,
2 validation files) + 4 test/seed scripts. Full list in `git status` at the
time of this audit; see the exact diff for line-level detail.

## What this means for the founder's original question
**Yes — real, meaningful gaps existed between "checklist says done" and "truly
full-stack and working."** They were not deliberately faked work; they were a
mix of (a) a tooling footgun (committed build cache masking real errors),
(b) a bad automated patch script that corrupted one large file with
copy-paste errors, and (c) a handful of ordinary integration bugs (missing
`withTenant`, wrong field paths, UI prop mismatches) that only show up when
the app is actually exercised end-to-end rather than trusted from a
checklist description. All of the above are now fixed and verified live,
not just typechecked.

## Recommended immediate next step
Continue the audit into the next layer: run the remaining feature-area
regression scripts across Part K/L/M and manually click through a few more
authenticated screens per role (teacher, parent, bursar) to build the same
level of confidence there. The founder should tell us which area to prioritize
next.
