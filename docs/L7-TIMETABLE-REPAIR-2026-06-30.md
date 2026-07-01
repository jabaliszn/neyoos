# L.7 Timetable Engine Repair — 2026-06-30

## What was repaired
This pass completed the serious timetable engine requested by the founder for NEYO School OS.

Built and verified:
- per-class per-subject lesson requirements
- single and double lessons
- optional split doubles for hard subjects
- combination classes across selected classes
- subject-choice-aware combination grouping from student subject selections
- teacher time-off windows
- school-configurable timetable constraints
- one master button that starts background timetable generation and shows progress
- real Smart Timetable UI inside Academics

## Data / schema
Added and applied real models:
- `CombinationGroup`
- `CombinationGroupClass`
- `TimetableConstraint`
- `TeacherTimeOff`
- `TimetableGenerationJob`

Extended:
- `ClassSubjectNeed.doubleCount`
- `ClassSubjectNeed.allowSplitDouble`

## Service layer
Built `src/lib/services/timetable-engine.service.ts` with:
- CRUD for constraints
- CRUD for combination groups
- teacher time-off save flow
- background generation jobs
- deterministic solver
- progress updates
- same-period scheduling for combination groups
- support for manual and subject-choice-derived combinations

## API
Built:
- `GET/POST /api/academics/timetable/engine`
- `GET/POST /api/academics/timetable/generate-job`

Extended existing generator route so class subject needs now save:
- lessons per week
- teacher
- double count
- split-double choice

## UI
Added Smart Timetable UI in `src/components/academics/academics-client.tsx` with:
- master button
- live progress bar
- constraint toggles / quick-add rules
- teacher time-off setup
- class subject requirement setup
- combination class setup

## What is enforced now
Verified in engine tests:
- no teacher double-booking
- no class double-booking
- consecutive doubles when needed
- same-period combination lessons across member classes
- shared teacher for combination lessons
- subject-morning placement
- teacher time-off blocking
- stream distribution control across streams
- split-allowed doubles still forced onto the same day when `DOUBLE_SAME_DAY` is enabled
- class-stream conflict avoidance for shared teachers
- no unplaced loads in the test scenario

## Honest status
Fully repaired now for the core timetable engine requested by the founder.

Still not honestly complete yet:
- exam-paper timetable generation (PP1/PP2/PP3/Theory/Practical)

## Verification run
Passed:
- `scripts/l7-timetable-engine-test.ts` → 15/15
- `scripts/k5-master-report-test.ts` → 13/13
- `scripts/k6-k8-sync-test.ts` → 7/7
- `scripts/k10-approval-test.ts` → 6/6
- `scripts/k16-knec-export-test.ts` → 10/10
- `npm run test:roles` → 24/24


## Follow-up extensions completed after the first repair
Built after the first L.7 core repair:
- draft-resume protection for Smart Timetable setup (`scripts/l7-draft-resume-test.ts`)
- auto-grouping foundation with subject-choice-aware placement and teacher replacement (`scripts/l7-auto-grouping-test.ts`)
- continuity engine for class-group teacher memory + apply-change flow (`scripts/l7-continuity-engine-test.ts`)
- teacher transfer impact analysis with ranked replacement comparison and timetable regeneration trigger (`scripts/l7-teacher-transfer-impact-test.ts`)
- timetable regeneration edge-case fix after staffing changes (`scripts/l7-timetable-engine-test.ts` remains 15/15 green)

## 2026-06-30 — Exam timetable + invigilator extension added on top of the stable L.7 work
This same repair session also moved the separate exam timetable forward inside Academics without breaking the repaired L.7 Smart Timetable engine.

What is now truly built:
- Academics → Exam Timetable tab inside `src/components/academics/academics-client.tsx`
- save exam slot
- edit exam slot
- delete exam slot
- PP1 / PP2 / PP3 / Theory / Practical paper typing
- target scopes for `CLASS`, `STREAM_GROUP`, and `COMBINATION`
- real eligible invigilator pool per slot
- deterministic invigilator generation
- honest fallback warning when no fully free teacher exists and normal teaching may be affected
- real combination targeting now reading saved `CombinationGroup` records for the selected subject where available

Important honest boundary:
- this exam timetable UI parses and its backend tests are green
- but a true manual browser click-through verification has still not been captured in this workspace yet
- so docs should not claim full visual/browser verification yet

Verification completed in code/tests:
- `scripts/exam-timetable-invigilator-test.ts` → 5 passed, 0 failed
- `npm run test:roles` → 24 passed, 0 failed
- esbuild parse checks stayed green for the touched Exam Timetable UI/service/route files

## 2026-07-01 — Level-aware extension on top of Smart Timetable + Exam generation foundation
The timetable/exam work was extended so NEYO starts behaving differently depending on whether a school is ECDE, Primary, Junior School, Senior School, or mixed.

What is now truly added:
- school profile can store active education levels
- activation summary derives whether Subject Selection and Senior Pathway tools should show
- Academics / Exams / Curriculum / Reports / Grading / Exam Auto-Generator / Smart Timetable now show level-aware behavior or default guidance
- Exam Auto-Generator now also supports:
  - class/form-aware multi-paper generation foundation
  - custom paper names from `SubjectPaperConfig`
  - fallback paper presets by level when no paper config exists

Important honest boundary:
- this is a strong defaults/preset layer and behavior foundation
- but it is not yet the final deep solver specialization or fully automatic report/report-card adaptation everywhere

Verification in this batch stayed green:
- `scripts/school-level-activation-test.ts`
- `scripts/school-level-activation-summary-test.ts`
- `scripts/exam-timetable-generator-test.ts`
- `scripts/exam-timetable-invigilator-test.ts`
- `npm run test:roles`

## 2026-07-01 — Solver preset specialization by school level
The Smart Timetable engine now has a first real level-aware solver specialization layer.

What changed in the solver:
- the timetable engine now reads the tenant's active school levels from `educationLevelsOffered`
- it derives a level-aware preset inside `src/lib/services/timetable-engine.service.ts`
- Senior School schools now bias more strongly toward richer combination handling where subject-choice combination groups exist
- Junior School schools now bias toward subject-selection-aware scheduling without full Senior pathway complexity
- lower-level schools keep a simpler scheduling pressure profile
- the generation result now returns honest preset warnings so the school can see which scheduling bias was applied
- Junior School preset logic now also deepens stream balancing pressure by tightening the effective same-day-per-level distribution cap in the solver
- Junior School preset logic now also prefers stronger per-day lesson spreading so the same subject is less likely to stack on one day
- Senior School preset logic now also gives a stronger placement preference toward morning academic density when choosing between otherwise valid slots

Preset warning behavior now added:
- Senior School preset warning:
  - `Senior School preset bias applied: richer combination and subject-structure planning is preferred.`
- Junior School preset warning:
  - `Junior School preset bias applied: subject-selection-aware scheduling is preferred without full Senior pathway complexity.`
- Lower-level preset warning:
  - `Lower-level preset bias applied: simpler scheduling pressure with less pathway complexity.`

Important honest boundary:
- this is the first-stage solver specialization layer
- it does NOT yet mean every timetable rule has been deeply re-authored by school level
- it DOES mean the real solver now behaves differently based on school-level activation and surfaces those preset warnings honestly

Verification completed after this solver change:
- `scripts/l7-timetable-engine-test.ts` → 15 passed, 0 failed
- `scripts/l7-timetable-solver-presets-test.ts` → 5 passed, 0 failed
- `npm run test:roles` → 24 passed, 0 failed

So the repaired L.7 Smart Timetable baseline remains stable after this latest school-level solver specialization.
