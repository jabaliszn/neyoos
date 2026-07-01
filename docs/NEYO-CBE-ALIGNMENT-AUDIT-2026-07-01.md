# NEYO Kenyan CBE Alignment Audit — 2026-07-01

This audit checks whether NEYO is aligned to the needs of Kenyan Competency-Based Curriculum / Competency-Based Education schools.

Important honesty rule:
- **Aligned** does not automatically mean **fully complete**.
- This audit separates:
  - directionally aligned
  - partially implemented
  - needs stronger proof
  - not yet built

Date context:
- Audit written on **2026-07-01**
- Based on the current NEYO repo state plus Kenyan curriculum references

---

## External reference basis used in this audit
The Kenyan curriculum references consistently show that CBE/CBC implementation depends on official curriculum designs across levels, competencies, learning outcomes, values, assessment support, and pathway flexibility.[1](https://kicd.ac.ke/cbc-materials/) [2](https://kicd.ac.ke/wp-content/uploads/2017/10/CURRICULUMFRAMEWORK.pdf) [10](https://kicd.ac.ke/wp-content/uploads/2019/08/BASIC-EDUCATION-CURRICULUM-FRAMEWORK-2019.pdf)

KICD publicly organizes curriculum support across:
- Pre-Primary
- Primary
- Junior School
- Senior School
- Teacher Education
- Special Needs Education[1](https://kicd.ac.ke/cbc-materials/)

KICD curriculum guidance also emphasizes that curriculum designs should include strands, sub-strands, learning outcomes, competencies, values, pertinent and contemporary issues (PCIs), learning experiences, and assessment opportunities.[3](https://kicd.ac.ke/wp-content/uploads/2019/07/2019-Course-Materials-Submission-Document-Final-Edit-3.7.2019.pdf) [4](https://kicd.ac.ke/wp-content/uploads/2018/02/Presentation-on-CBC-Activities-Jan-2018.pdf) [5](https://kicd.ac.ke/wp-content/uploads/2018/02/PP-1-Curriculum-Designs-Dec-2017C-1-min.pdf)

For Senior School, the current direction remains pathway-based, with broad pathways such as STEM, Social Sciences, and Arts & Sports Science, alongside learner choice and pathway/track specialization.[8](https://kicd.ac.ke/wp-content/uploads/2017/10/CURRICULUMFRAMEWORK.pdf) [10](https://kicd.ac.ke/wp-content/uploads/2019/08/BASIC-EDUCATION-CURRICULUM-FRAMEWORK-2019.pdf)

---

# Audit scale used here
- **GREEN** = strongly aligned and materially present in product direction / codebase
- **AMBER** = partly aligned or partly built, but not yet fully proven end-to-end
- **RED** = not yet built enough to claim alignment

---

# 1. Curriculum structure alignment

## Requirement
Kenyan CBE/CBC schools need support for structured curriculum designs, not only free-text subjects. This includes competency-based design elements like learning outcomes, competencies, values, PCIs, and assessment opportunities.[1](https://kicd.ac.ke/cbc-materials/) [3](https://kicd.ac.ke/wp-content/uploads/2019/07/2019-Course-Materials-Submission-Document-Final-Edit-3.7.2019.pdf) [4](https://kicd.ac.ke/wp-content/uploads/2018/02/Presentation-on-CBC-Activities-Jan-2018.pdf)

## NEYO status
### GREEN / AMBER
NEYO is strongly aligned in architecture because it already has or has been building around:
- curriculum entities
- learning areas
- strands
- competency structures
- assessment records
- report builder direction
- curriculum versioning direction

### Honest boundary
I still would not claim full curriculum completeness for every level and every official curriculum design without a full content/data audit.

## Verdict
**AMBER-GREEN**
- architecture is aligned
- full curriculum-content completeness still needs stronger proof

---

# 2. Education-level coverage (ECDE → Senior School)

## Requirement
KICD exposes curriculum designs across multiple levels, not just one band of schooling.[1](https://kicd.ac.ke/cbc-materials/)

## NEYO status
### GREEN in principle
NEYO direction already supports a school operating at different levels, and you have explicitly insisted that NEYO should know if a school is:
- ECDE
- Primary
- Junior School
- Senior School
- mixed/full institution

### Honest boundary
The product still needs stronger school-level activation logic so the school profile clearly controls:
- active levels
- visible curriculum layers
- pathway availability
- report modes
- dashboards

## Verdict
**AMBER**
- aligned direction
- not yet fully hardened in school-level activation workflow

---

# 3. Subject selection and learner-specific subject adaptation

## Requirement
In a CBE/CBC environment, especially Senior School, learner subject choice must affect timetable, assessments, reports, and teacher visibility.

## NEYO status
### GREEN direction
This is one of the strongest aligned areas in NEYO thinking and current build direction.
Current and earlier work already moved toward:
- subject selection management
- pathway management
- timetable adaptation foundations
- class grouping / combination logic
- report and visibility adaptation direction

## Honest boundary
This still needs a stronger full-chain audit from:
- selection
- to timetable
- to assessment visibility
- to report output
- to analytics

## Verdict
**AMBER-GREEN**
- strongly aligned
- still needs stronger end-to-end proof

---

# 4. Senior School pathways

## Requirement
Senior School requires pathway-aware support rather than one flat subject model.[8](https://kicd.ac.ke/wp-content/uploads/2017/10/CURRICULUMFRAMEWORK.pdf) [10](https://kicd.ac.ke/wp-content/uploads/2019/08/BASIC-EDUCATION-CURRICULUM-FRAMEWORK-2019.pdf)

## NEYO status
### GREEN direction
NEYO has the correct architectural idea:
- do not hard-code only today's pathway labels forever
- let schools configure pathways / required subjects / optional subjects / rules

This is the right future-proof design.

### Honest boundary
I would not yet claim fully proven Senior School pathway orchestration across:
- selection
- eligibility
- reporting
- timetable
- staffing analytics
- parent-facing outputs

## Verdict
**AMBER**
- correctly aligned
- not yet fully proven end-to-end

---

# 5. Timetable alignment to learner choices

## Requirement
Once subject choices are known, the timetable should adapt and avoid clashes as far as possible.

## NEYO status
### GREEN foundation
This is one of the stronger areas:
- L.7 Smart Timetable repair was real
- deterministic scheduling exists
- combination groups exist
- subject-choice-aware grouping foundations exist
- exam auto-generator foundation now exists

## Honest boundary
Still needs deeper proof for the full CBE chain where learner-specific subject choices drive all senior-school timetable outcomes in a polished founder-facing flow.

## Verdict
**GREEN / AMBER**
- strong scheduling foundations
- still needs final pathway/subject-selection orchestration proof

---

# 6. Assessment alignment

## Requirement
Teachers should only assess learners in subjects they actually teach/take. Assessment should align to learning outcomes, competencies, rubrics, and evidence where appropriate.

## NEYO status
### GREEN direction
NEYO has strong competency / assessment / evidence / rubric direction and significant earlier work in these areas.

### Honest boundary
I have not yet done a dedicated fresh audit in this turn proving every assessment visibility path is fully subject-selection aware in Senior School.

## Verdict
**AMBER-GREEN**

---

# 7. Reporting alignment

## Requirement
Reports should adapt to subject choice, pathway context, and competency orientation.

## NEYO status
### GREEN direction
NEYO already has:
- report builder work
- master report work
- modular report architecture
- curriculum-aware reporting direction

### Honest boundary
Still needs stronger formal proof that pathway-specific / subject-choice-specific reporting is fully complete in the latest Senior School scenarios.

## Verdict
**AMBER-GREEN**

---

# 8. Career guidance alignment

## Requirement
CBE/CBC schools increasingly need guidance support, especially for pathway choice.

## NEYO status
### GREEN as approved direction
This fits NEYO very well and has already been identified as a differentiator.

### Guardrail
It should remain:
- guidance
- recommendation
- explanation
- not forced automatic decision-making

## Verdict
**AMBER**
- aligned and approved
- not yet mature enough to claim complete implementation

---

# 9. Curriculum versioning alignment

## Requirement
If curriculum designs change, schools should preserve historical curriculum context rather than overwrite the past.

## NEYO status
### GREEN direction
Curriculum versioning has already been explicitly recognized as important in NEYO and is aligned to the ministry-evolution reality.

## Honest boundary
Would still benefit from a dedicated verification pass specifically focused on version migration, historical reporting, and year-by-year curriculum preservation.

## Verdict
**AMBER-GREEN**

---

# 10. Flexible configuration alignment

## Requirement
A Kenyan CBE-ready system should avoid over-hard-coding current curriculum assumptions and should support configurable structures as policy evolves.[2](https://kicd.ac.ke/wp-content/uploads/2017/10/CURRICULUMFRAMEWORK.pdf)

## NEYO status
### GREEN
This is one of the clearest NEYO strengths in product philosophy.
Your repeated insistence on:
- school-configurable pathways
- school level awareness
- custom paper names
- configurable modules
- deterministic but flexible workflows

is exactly the right approach.

## Verdict
**GREEN**

---

# 11. Practical/lab/resource alignment

## Requirement
CBE schools—especially Junior/Senior—often need practical spaces, labs, workshops, farms, and other facilities.

## NEYO status
### AMBER direction
You identified this correctly.
The best NEYO-aligned shape is a broader:
- Resources & Facilities

model rather than a tiny lab-only module.

### Honest boundary
This is still not yet fully built.

## Verdict
**AMBER**
- very aligned direction
- feature still pending

---

# 12. Parent and portfolio alignment

## Requirement
Competency-based systems benefit from parent visibility into progress, evidence, and learner journey.

## NEYO status
### GREEN direction
Portfolio, growth views, parent communication, and timeline-style visibility are already strong NEYO themes.

### Honest boundary
Still needs full audit if we want to claim this is complete for all levels and all CBE scenarios.

## Verdict
**AMBER-GREEN**

---

# 13. Overall answer: Is NEYO CBE aligned for Kenyan schools?

## Honest answer
### YES — directionally and architecturally, NEYO is strongly aligned.

But:
### NO — I should not yet claim fully complete national CBE coverage without more proof.

---

# Final scorecard

## Strongest aligned areas
- flexible configuration
- subject selection direction
- pathway-aware architecture direction
- timetable engine foundations
- competency/assessment architecture direction
- reporting architecture direction
- curriculum versioning awareness
- school-level configurability philosophy

## Areas that still need stronger proof or build depth
- complete education-level activation workflow
- full Senior School pathway orchestration end-to-end
- full subject-selection-to-report chain proof
- practical/lab/facility scheduling
- comprehensive curriculum-content completeness audit per level

---

# Final verdict
## Current practical verdict
**NEYO is strongly CBE-aligned in architecture and roadmap direction for Kenyan schools, but it is not yet honest to claim 100% fully verified end-to-end CBE compliance across all levels and workflows.**

That is the truthful product position today.

---

# Recommended next action after this audit
1. Keep building the approved missing pieces in priority order.
2. Add school-level activation logic for ECDE / Primary / Junior / Senior / mixed schools.
3. Strengthen full-chain pathway orchestration.
4. Build practical/resource-aware scheduling later.
5. Repeat focused audits after each major CBE milestone instead of over-claiming once.
