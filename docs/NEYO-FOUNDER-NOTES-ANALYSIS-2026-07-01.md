# NEYO Founder Notes Analysis — 2026-07-01

This note analyses the founder's latest product notes and sorts them into:
- already supported / aligned
- partially supported / strengthen later
- add to future feature list
- avoid or reshape so they fit NEYO build law

Important build law kept in this analysis:
- NEYO must stay configuration-first, not hard-coded to today's curriculum labels only.
- Core school operations must remain deterministic.
- Optional Bundi intelligence can guide, but not replace school decisions.
- Modules should be broad and reusable where possible, not over-fragmented into one-off tools.

---


## Important wording clarification
When this document says an item is added to the "future feature list", it does **not** mean the feature must wait for a distant future release.

It only means:
- the feature is approved and aligned to NEYO
- it should be tracked clearly
- it may be built now, next, or later depending on priority and stability

So in NEYO language, "future feature list" means **roadmap-approved feature bucket**, not "do not build now".

---

# 1. Immediate request from founder: advanced paper splitting

## Founder request
The exam auto-generator should support schools saying an exam has multiple papers, and those papers should not be hard-coded to only `PP1`, `PP2`, `PP3`. The school should be able to rename papers to things like:
- Insha
- Oral
- Practical
- Listening
- Paper A
- Section B
- Project
- Composition
- any other custom paper name

## Analysis
This request strongly supports NEYO and should be added to the exam roadmap.

### Why it fits NEYO
- schools in Kenya do not all use identical paper naming conventions
- different subjects and school levels use different paper structures
- some assessments are not best represented by PP1/PP2/PP3
- configuration-first design is more future-proof than hard-coding paper labels

## Recommended implementation direction
Do **not** hard-code only:
- PP1
- PP2
- PP3
- Theory
- Practical

Instead:
- keep a default starter list
- allow school-defined custom paper labels per subject or exam setup
- allow the auto-generator to split a subject into multiple papers according to configuration

## Recommended later feature title
**Exam Paper Template & Multi-Paper Split Engine**

### Suggested scope
- subject can have 1..N paper parts
- each paper part has:
  - name/label
  - duration
  - optional weight
  - optional facility requirement
  - optional invigilation notes
- auto-generator can place all required papers across the selected exam window

## Status
**ADD TO FUTURE FEATURE LIST — HIGH PRIORITY after current exam auto-generator foundation stabilizes**

---

# 2. Senior School pathway / subject-selection notes

## Summary
These notes are strongly aligned to NEYO and mostly confirm the correct long-term architecture.

## What already aligns well with NEYO
The founder notes correctly emphasize:
- pathway-agnostic design
- subject selection
- school-configurable pathway setup
- curriculum flexibility
- auto-adapting timetable, assessments, reports, and visibility
- analytics for staffing and resources

These are all correct for NEYO.

## Already partly supported in repo direction
From the current NEYO build direction, these areas are already either built or intentionally underway:
- subject selection manager direction exists
- pathway manager direction exists
- curriculum versioning direction exists
- report builder exists
- timetable engine already understands combination groups and subject-driven logic foundations

## What should remain true in NEYO
### Good rule
NEYO should be **pathway-agnostic**, not permanently hard-coded to only current labels.

That means schools/admins should be able to configure:
- pathways
- compulsory subjects
- optional subjects
- eligibility rules
- offered combinations
- staffing implications

### Good rule
Once a learner selects subjects, these must automatically affect:
- timetable
- assessment visibility
- class/teacher lists
- reports
- analytics

## Status
**SUPPORTED AND ALIGNED — continue strengthening, not a contradiction**

---

# 3. Career guidance notes

## Analysis
This fits NEYO very well, but should be handled carefully.

## Good for NEYO
Guidance based on:
- competencies
- interests
- subject performance
- teacher observations

is a strong differentiator.

## Guardrail
The system should:
- suggest
- guide
- explain
- never force pathway decisions automatically

## NEYO-aligned implementation rule
Use Bundi/analytics for recommendations, but the final decision stays with:
- school
- learner
- parent/guardian

## Status
**ADD / CONTINUE AS DIFFERENTIATOR — valid and aligned**

---

# 4. CBE/CBC capability checklists

## Analysis
These notes are useful as a product audit checklist, not as direct new features line-by-line.

Many items listed are already aligned to current NEYO direction:
- curriculum designs
- strands/sub-strands
- learning outcomes
- competencies
- values / PCIs
- assessments
- rubrics
- portfolios
- pathway selection
- reports
- workload / analytics
- curriculum versioning
- flexible configuration

## Recommendation
Treat this section as:
- a strategic validation checklist
- not a reason to create duplicate modules

## Status
**SUPPORTED AS PRODUCT AUDIT CHECKLIST**

---

# 5. Domain / hosting / rollout notes

## Analysis
These notes are business/ops guidance, not core school product features.

They are valid for the founder, but they should not become random school-app features.

## What fits NEYO product work
- custom domain support for schools already fits platform architecture
- dev/beta/demo environments fit deployment operations
- scalable infrastructure thinking fits platform ops

## What does NOT belong in the school feature backlog
Do not turn these into student/staff-facing modules like:
- domain advice tools
- cost-estimation widgets inside school UI
- hosting planner inside school product

These belong more to:
- founder ops notes
- deployment/infra roadmap
- go-to-market planning

## Status
**VALID BUSINESS GUIDANCE — not a direct school feature batch**

---

# 6. High-impact differentiators notes

## Analysis
These are strong and mostly aligned.

## Strong alignment items
These fit NEYO very well:
- Curriculum Intelligence Engine
- Student Learning Journey
- Curriculum Coverage Dashboard
- Digital Portfolio
- Intervention Manager
- Career & Pathway Advisor
- Resource Planner
- Parent Timeline
- Education Command Center
- Institution Knowledge Base

## Important reshaping
### Ask Neyo
Allowed only if:
- optional
- does not become a dependency for core operations
- core workflows still work manually and deterministically

### Automation Builder
Very strong feature, but should be deterministic rules-based automation first, not vague AI automation.

### School Analytics
Already strongly aligned.

## Status
**MOSTLY ALIGNED — add selectively, avoid duplication, keep deterministic core**

---

# 7. Senior School subject lists and education-level notes

## Analysis
These notes are very important, but they should be modeled as configurable curriculum data rather than frozen hard-coded system rules.

## What NEYO should do
The system should know whether a school is:
- ECDE only
- Primary only
- Junior School only
- Senior School only
- mixed / full PP1–Grade 12

And it should know which levels are active in that school.

## Founder line: “then also it should know a senior school and junior school”
This is correct and should be implemented as a school-level configuration and curriculum-activation rule.

### Correct NEYO design
A school profile / setup layer should define:
- offered education levels
- active curriculum tracks
- available pathways
- resources/facilities
- modules to surface

That is better than building separate disconnected products for junior vs senior.

## Status
**ALIGNED — should be strengthened as configuration logic**

---

# 8. Laboratories / resources / facilities / shifts

## Founder note
The founder wants practical/lab-oriented exam scheduling, including:
- practical exam flag
- target grade/form
- required session time
- number of students
- labs
- stations in labs
- shifts generated by capacity

## Analysis
This is an excellent future NEYO feature.

## Best NEYO-aligned shape
Do **not** build this as only "Laboratory Management".

Build under a broader configurable resource system such as:
**Resources & Facilities**

This broader model can later power:
- science labs
- computer labs
- art rooms
- workshops
- music rooms
- halls
- sports areas
- farms
- vehicles
- meeting rooms

Then the practical exam engine can consume those resources.

## Recommended later feature title
**Practical / Lab Exam Shift Scheduler**

### Suggested future capability
- mark paper as facility-required
- choose facility type
- define capacity per lab / room
- define stations / benches / computers
- define session duration
- define candidate count
- auto-split into shifts
- allocate labs and sessions
- prevent facility clashes

## Status
**ADD TO FUTURE FEATURE LIST — HIGH VALUE**

---

# 9. What should be added to the future feature list now

## A. Exam roadmap additions
1. **Exam Paper Template & Multi-Paper Split Engine**
   - custom paper labels
   - per-subject multi-paper structures
   - automatic PP1/PP2/custom-paper splitting

2. **Practical / Lab Exam Shift Scheduler**
   - facility-aware practical scheduling
   - station-based capacity planning
   - shift generation

3. **Facility-Aware Exam Venue Planner**
   - links exam scheduling to resources/facilities inventory

## B. Configuration / school-identity roadmap additions
4. **School Level & Curriculum Activation Profile**
   - school declares ECDE / Primary / Junior / Senior / mixed
   - system activates relevant curriculum layers and views

## C. Senior School roadmap additions
5. **Pathway-Aware Subject, Timetable, Assessment, and Reporting Orchestration**
   - stronger full-chain automation after selection

## D. Strategy / differentiator roadmap additions
6. **Curriculum Intelligence Engine**
7. **Student Learning Journey**
8. **Intervention Manager**
9. **Resource Planner**
10. **Education Command Center**

---

# 10. What should NOT be added as school product features right now

These should not be turned into direct school-facing modules now:
- domain registration guidance tools
- hosting cost estimators inside school UI
- generic infrastructure planning widgets for schools
- too many AI surfaces before core workflows are excellent

They belong to founder ops / company ops / deployment planning instead.

---

# Final conclusion
The founder notes are strongly useful overall.

## Strongly aligned and should continue
- pathway-agnostic curriculum design
- subject selection adaptation
- pathway-aware workflows
- career guidance as guidance only
- level-aware school configuration
- resources/facilities as broad reusable infrastructure

## Add to future feature list
- advanced multi-paper split engine
- practical/lab exam shift scheduler
- facility-aware exam planning
- school level & curriculum activation profile
- stronger curriculum intelligence / learning journey / intervention planning

## Do not misplace into school product backlog
- domain/hosting/business rollout guidance should stay as founder/business ops notes, not school-app features
