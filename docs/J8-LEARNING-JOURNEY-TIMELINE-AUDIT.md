# J.8 — Learning Journey Timeline Audit

Date: 2026-06-28  
Scope: Required non-duplication audit before building J.8 Learning Journey Timeline.

## Goal
Build a unified learner timeline **without duplicating** modules that already exist.

The J.8 timeline should eventually pull from:
- exams
- flexible assessments
- attendance
- behavior / discipline
- awards / clubs
- portfolio
- community service
- certificates

This audit checks what is already live, what can be reused immediately, and what is still missing.

---

## Files / modules reviewed

### Existing learner evidence / academic modules
- `src/lib/services/exam.service.ts`
- `src/lib/services/assessment.service.ts`
- `src/lib/services/attendance.service.ts`
- `src/lib/services/discipline.service.ts`
- `src/lib/services/portfolio.service.ts`

### Existing learner-facing surfaces
- `src/components/students/student-profile-client.tsx`
- `src/components/portal/parent-portal-client.tsx`
- `src/components/portfolio/portfolio-client.tsx`

### Schema review
- `prisma/schema.prisma`

---

# 1) What already exists and should be reused

## 1.1 Exams (B.5)
### Existing source of truth
`Exam`, `ExamSubject`, `ExamResult`

### Already available
- exam setup
- marks entry
- positions / means
- report-card generation
- published-result gating
- transcript foundation
- analytics foundation

### Reuse value for J.8
These can already produce learner milestones such as:
- "CAT 1 — Term 2 scored 85% in Mathematics"
- "End of Term 2 report released"
- "Ranked position 2 in class"

### Non-duplication rule
J.8 must **not** create another exam-history table.
It should **read from `ExamResult` / exam summary services** and convert those into timeline entries.

---

## 1.2 Flexible Assessments (J.3)
### Existing source of truth
`AssessmentType`, `AssessmentPlan`, `AssessmentRecord`, `AssessmentEvidence`

### Already available
- configurable assessment types
- learner records with marks / rubric / narrative
- release workflow
- evidence links
- parent visibility rules in the backend

### Reuse value for J.8
These can already produce timeline entries such as:
- "Project submitted"
- "Oral assessment scored"
- "Portfolio assessment released"
- "Teacher observation recorded"

### Non-duplication rule
J.8 must **not** create another assessment ledger.
It should **read from `AssessmentRecord`** and maybe `AssessmentEvidence` metadata for timeline presentation.

### Important note
J.3 is still marked `[~]`, not final `[x]`, because some browser/UI completion is deferred.  
But the core data model is good enough to serve as a timeline source.

---

## 1.3 Attendance (B.3)
### Existing source of truth
`AttendanceRecord`

### Already available
- daily register statuses P / A / L / E
- date history
- row scoping
- absentee SMS hooks
- analytics

### Reuse value for J.8
Attendance can already produce timeline entries such as:
- "Present on 2026-06-28"
- "Absent on 2026-06-25"
- "Late with note: Matatu delay"

### Non-duplication rule
J.8 must **not** create a new attendance-history model.
It should **read directly from `AttendanceRecord`**.

### Design caution
A full raw attendance stream may be too noisy in a single learner timeline.  
Timeline logic should likely summarize or filter attendance events:
- absences
- lateness
- important attendance milestones
- maybe not every present-day by default

---

## 1.4 Discipline / behavior (B.20)
### Existing source of truth
- `DisciplineIncident`
- `Suspension`
- `CounselingNote`

### Already available
- incident categories
- severity / points
- suspension records
- counseling records with confidentiality rules
- parent notification on major events

### Reuse value for J.8
Timeline can reuse:
- approved incidents
- suspensions
- behavior milestones

### Critical privacy rule
`CounselingNote` is confidential and **must not simply be dropped into a shared learner timeline**.

### Non-duplication rule
J.8 should **reuse discipline rows**, but must introduce **visibility filtering by source type**:
- staff/internal learner timeline may include discipline entries
- parent-safe timeline must be more restricted
- counseling notes should remain excluded unless a future explicit rule says otherwise

---

## 1.5 Skills Passport (J.6)
### Existing source of truth
`SkillsPassportEntry`

### Already available
- talent / leadership ratings over time
- evidence source
- narrative
- parent/student-facing card

### Reuse value for J.8
These entries are already timeline-like and can be surfaced as milestones such as:
- "Leadership rated 5/5"
- "Creativity award recorded"
- "Coding skill updated"

### Non-duplication rule
J.8 should **reuse `SkillsPassportEntry`** instead of inventing a second growth-history table.

---

## 1.6 Competency Framework (J.4)
### Existing source of truth
`CompetencyEvidence`

### Already available
- learner competency evidence over time
- approval / parent visibility
- heatmap / learner summary

### Reuse value for J.8
Timeline can already surface:
- "Communication competency recorded"
- "Critical thinking evidence approved"

### Non-duplication rule
J.8 should **reuse `CompetencyEvidence`**.

---

## 1.7 Student Portfolio (J.7)
### Existing source of truth
`PortfolioItem`

### Already available
- project / photo / video / art / coding / certificate / observation / community item types
- approval workflow
- family visibility
- export pack
- connected page
- seeded records

### Reuse value for J.8
Portfolio is one of the strongest timeline sources and can provide:
- "Community reflection approved"
- "Coding project submitted"
- "Certificate added"

### Non-duplication rule
J.8 should **reuse `PortfolioItem`**, not create another portfolio-history model.

---

# 2) What already exists in learner-facing UI

## 2.1 Student Profile
Reviewed: `src/components/students/student-profile-client.tsx`

### Already mounted
- student details
- guardians
- joining requirements
- documents
- transfer state
- family view
- J.4 competency summary
- J.6 skills passport
- portfolio link

### Reuse value for J.8
Student Profile is the most natural place to add:
- a **Timeline tab/card/section**

### Non-duplication rule
Do **not** create a completely separate learner detail page for J.8 if the timeline belongs naturally on the existing student profile.

---

## 2.2 Parent Portal
Reviewed: `src/components/portal/parent-portal-client.tsx`

### Already mounted
- fees
- results
- competency summary
- skills passport
- attendance
- timetable
- homework
- notes
- portfolio link
- library
- uniform
- discussion
- pickup safety

### Reuse value for J.8
Parent Portal already behaves like a learner-growth dashboard.  
J.8 should likely add a **parent-safe timeline card or tab** there instead of creating another disconnected page.

### Non-duplication rule
The parent-safe timeline must reuse existing visibility rules already enforced by:
- attendance scoping
- results release
- competency visibility
- portfolio parent visibility
- discipline restrictions

---

# 3) What is missing for J.8

## 3.1 No unified timeline aggregator yet
There is currently **no single service** that merges all learner events into one ordered stream.

### Missing piece
A service like:
- `src/lib/services/learner-journey.service.ts`

That service should:
- pull from multiple modules
- normalize each record into a common timeline entry shape
- sort by date / timestamp
- filter by audience (staff vs parent)
- support pagination or limits

---

## 3.2 No common timeline entry format yet
J.8 needs a normalized entry shape, for example:

```ts
{
  id: string;
  date: string;
  sourceModule: "EXAM" | "ASSESSMENT" | "ATTENDANCE" | "DISCIPLINE" | "PORTFOLIO" | "SKILLS" | ...;
  eventType: string;
  title: string;
  summary: string;
  status?: string;
  href?: string;
  visibility: "STAFF" | "PARENT_SAFE";
  verificationStatus?: "VERIFIED" | "PENDING";
}
```

This does **not** need a DB table first.  
It can be built as an aggregation layer over existing models.

---

## 3.3 Clubs / awards / community service are not yet first-class learner history modules
### What exists now
- `clubId` and `awardId` fields exist on `PortfolioItem`
- co-curricular activity concepts exist in timetable / public-site copy
- but there is **no dedicated learner club-membership / award ledger / community-service model yet**

### Implication
For J.8 first version:
- timeline can include club/award/community signals that already exist through `PortfolioItem` and `SkillsPassportEntry`
- full community-service history should wait for J.17
- full talent tracking should also connect later with J.11

### Non-duplication rule
Do **not** invent a heavy new awards/clubs subsystem just to unblock J.8 Chunk 1.

---

## 3.4 Certificates are split across modules
We already have:
- report cards / transcripts / exam docs
- leaving certificate vault
- portfolio certificate items

### Implication
J.8 should treat certificate-like milestones carefully:
- academic certificate/vault events from dedicated certificate modules
- learner showcase certificates from `PortfolioItem`

It should not merge them blindly without source labeling.

---

# 4) Recommended implementation direction for J.8

## Phase A — Aggregation, not duplication
Start J.8 with a **read-only timeline service** and **no new DB table**.

Recommended first sources:
1. `ExamResult` / released exam summaries
2. `AssessmentRecord`
3. `AttendanceRecord` (important events only)
4. `DisciplineIncident` / `Suspension`
5. `CompetencyEvidence`
6. `SkillsPassportEntry`
7. `PortfolioItem`

---

## Phase B — Add timeline surfaces to existing learner pages
Use:
- Student Profile for staff/internal timeline
- Parent Portal for parent-safe timeline

Avoid launching a disconnected duplicate learner-history module first.

---

## Phase C — Audience filtering
Timeline service should support at least:
- `mode: "staff"`
- `mode: "parent"`

### Parent-safe mode should exclude or restrict
- confidential counseling notes
- internal-only discipline notes beyond allowed parent-visible events
- unreleased assessment items
- unapproved portfolio items
- any school-internal note not intended for family visibility

---

# 5) Recommended next chunk order for J.8

## J.8 Chunk 1
Database decision + audit result: **no new DB table yet**.  
Start with service/aggregation over existing sources.

## J.8 Chunk 2
Validation/security for timeline query params and audience mode.

## J.8 Chunk 3
Backend service:
- `learnerJourneyTimeline(user, studentId, mode)`

## J.8 Chunk 4
API endpoint:
- `/api/learner-journey?studentId=...&mode=...`

## J.8 Chunk 5
Reusable timeline UI components.

## J.8 Chunk 6
Student Profile + Parent Portal wiring.

## J.8 Chunk 7
UX hardening / screenshot.

## J.8 Chunk 8
Optional seed enrichment if needed.

---

# 6) Final audit conclusion
J.8 should be built as a **unified aggregation layer** over existing sources, **not** as a new duplicated learner-history database subsystem.

### Reuse directly
- B.5 Exams
- J.3 Flexible Assessments
- B.3 Attendance
- B.20 Discipline
- J.4 Competency Evidence
- J.6 Skills Passport
- J.7 Portfolio
- existing Student Profile / Parent Portal surfaces

### Defer as future integrations
- J.11 Talent Tracking
- J.17 Community Service
- deeper awards/clubs membership ledger if later required

### Safe next move
Proceed to **J.8 Chunk 2 / 3** using a read-only timeline service over current modules.
