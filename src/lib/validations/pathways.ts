import { z } from "zod";

export const pathwayRequirementSchema = z.object({
  subjectId: z.string().cuid(),
  isCore: z.boolean().default(true),
  minScorePct: z.number().min(0).max(100).optional().nullable(),
});

// P.1 (2026-07-02): the real KICD Senior School pathway taxonomy for
// Kenya's 2026 CBE rollout — three official pathways, each with real track
// subdivisions and real elective subject lists (source: KICD publications
// on Senior School subjects/lesson-hours, cross-referenced against multiple
// 2026 education-sector reports). This is DATA, seeded on request — a
// school never has these subjects/pathways silently created without an
// explicit "load official pathways" action (P.1 CHUNK 3/4).
export const PATHWAY_GROUPS = ["STEM", "SOCIAL_SCIENCES", "ARTS_SPORTS"] as const;
export type PathwayGroup = (typeof PATHWAY_GROUPS)[number];

export const PATHWAY_GROUP_LABELS: Record<PathwayGroup, string> = {
  STEM: "Science, Technology, Engineering & Mathematics (STEM)",
  SOCIAL_SCIENCES: "Social Sciences",
  ARTS_SPORTS: "Arts & Sports Science",
};

export const PATHWAY_SCHOOL_TYPES = ["NONE", "TRIPLE", "DUAL"] as const;
export type PathwaySchoolType = (typeof PATHWAY_SCHOOL_TYPES)[number];

export interface OfficialTrack {
  trackName: string;
  code: string; // stable short code used as the Pathway.code suffix
  description: string;
  /** Real elective subjects for this track: {name, code}. Core compulsory
   * subjects (English, Kiswahili/KSL, Mathematics, Community Service
   * Learning) are NOT listed here — they are handled once, school-wide,
   * in P.2/P.3, not duplicated per pathway/track. */
  electives: { name: string; code: string }[];
}

export interface OfficialPathway {
  group: PathwayGroup;
  name: string;
  description: string;
  tracks: OfficialTrack[];
}

/** The real KICD Senior School taxonomy, Grade 10-12, 2026 CBE. */
export const KICD_SENIOR_SCHOOL_PATHWAYS: OfficialPathway[] = [
  {
    group: "STEM",
    name: "STEM",
    description: "Science, Technology, Engineering & Mathematics — pre-tertiary pathway for careers such as medicine, engineering, data science and aviation.",
    tracks: [
      {
        trackName: "Pure Sciences",
        code: "PURE",
        description: "Biology, Chemistry, Physics — the classic sciences track for medicine, pure research and engineering entry.",
        electives: [
          { name: "Biology", code: "BIO" },
          { name: "Chemistry", code: "CHE" },
          { name: "Physics", code: "PHY" },
        ],
      },
      {
        trackName: "Applied Sciences",
        code: "APPL",
        description: "General Science and Agriculture — practical, applied-science track.",
        electives: [
          { name: "General Science", code: "GSC" },
          { name: "Agriculture", code: "AGR" },
        ],
      },
      {
        trackName: "Technology & Engineering",
        code: "TECH",
        description: "Computer Studies, Building Construction, Electricity, Metalwork, Aviation — hands-on technical/engineering track.",
        electives: [
          { name: "Computer Studies", code: "CMP" },
          { name: "Building Construction", code: "BLD" },
          { name: "Electricity", code: "ELC" },
          { name: "Metalwork", code: "MTW" },
          { name: "Aviation Technology", code: "AVT" },
        ],
      },
      {
        trackName: "Career & Technical Studies (CTS)",
        code: "CTS",
        description: "Home Science and other applied/vocational subjects with a STEM foundation.",
        electives: [
          { name: "Home Science", code: "HSC" },
        ],
      },
    ],
  },
  {
    group: "SOCIAL_SCIENCES",
    name: "Social Sciences",
    description: "Humanities, business, languages and literature — pre-tertiary pathway for careers such as law, journalism, economics and public service.",
    tracks: [
      {
        trackName: "Humanities & Business Studies",
        code: "HUMB",
        description: "History, Geography, Business Studies, Legal Studies and Religious Education.",
        electives: [
          { name: "History & Citizenship", code: "HIS" },
          { name: "Geography", code: "GEO" },
          { name: "Business Studies", code: "BST" },
          { name: "Legal Studies", code: "LEG" },
          { name: "Christian Religious Education", code: "CRE" },
          { name: "Islamic Religious Education", code: "IRE" },
          { name: "Hindu Religious Education", code: "HRE" },
        ],
      },
      {
        trackName: "Languages & Literature",
        code: "LANG",
        description: "Literature, indigenous languages, sign language and foreign languages.",
        electives: [
          { name: "Literature in English", code: "LIT" },
          { name: "Fasihi ya Kiswahili", code: "FAS" },
          { name: "Indigenous Languages", code: "IND" },
          { name: "Kenyan Sign Language", code: "KSL" },
          { name: "Arabic", code: "ARB" },
          { name: "French", code: "FRE" },
          { name: "German", code: "GER" },
          { name: "Mandarin Chinese", code: "MAN" },
        ],
      },
    ],
  },
  {
    group: "ARTS_SPORTS",
    name: "Arts & Sports Science",
    description: "Performing arts, visual arts and sports science — pre-tertiary pathway for careers such as music, design, film and professional sport.",
    tracks: [
      {
        trackName: "Performing Arts",
        code: "PERF",
        description: "Music, dance, theatre and film.",
        electives: [
          { name: "Music and Dance", code: "MUS" },
          { name: "Theatre and Film", code: "THF" },
        ],
      },
      {
        trackName: "Visual Arts",
        code: "VISU",
        description: "Fine art, design and craft-based disciplines.",
        electives: [
          { name: "Fine Arts", code: "FIN" },
        ],
      },
      {
        trackName: "Sports",
        code: "SPRT",
        description: "Sports training, coaching and recreation management.",
        electives: [
          { name: "Sports and Recreation", code: "SPR" },
        ],
      },
    ],
  },
];

/** The 4 compulsory Senior School learning areas every learner takes
 * regardless of pathway (KICD official structure) — used by P.2/P.3, kept
 * here as shared reference data alongside the pathway taxonomy. */
export const SENIOR_SCHOOL_CORE_SUBJECTS = [
  { name: "English", code: "ENG" },
  { name: "Kiswahili", code: "KIS" }, // or Kenyan Sign Language for KSL-medium learners
  { name: "Community Service Learning", code: "CSL" },
  // Mathematics is split Core (STEM) vs Essential (non-STEM) — see P.2.
] as const;

// P.2 (2026-07-02): Kenya CBE reversed the earlier CBC "Math optional for
// some senior tracks" controversy — Mathematics is compulsory again for
// EVERY Senior School learner, split into two REAL, separately-taught
// subjects depending on pathway: Core Mathematics (STEM) vs Essential
// Mathematics (Social Sciences / Arts & Sports Science — a simplified,
// practical/utilitarian syllabus, not a "lite" relabel of the same content).
export const MATH_VARIANTS = ["CORE", "ESSENTIAL"] as const;
export type MathVariant = (typeof MATH_VARIANTS)[number];

export interface MathVariantDef {
  variant: MathVariant;
  name: string;
  code: string;
  description: string;
  /** Which official pathway group(s) take this variant compulsorily. */
  compulsoryFor: PathwayGroup[];
}

export const CORE_ESSENTIAL_MATHEMATICS: MathVariantDef[] = [
  {
    variant: "CORE",
    name: "Core Mathematics",
    code: "MATC",
    description: "Compulsory for STEM pathway learners — the full Senior School mathematics syllabus (algebra, calculus foundations, statistics, trigonometry) required for STEM tracks and university STEM entry.",
    compulsoryFor: ["STEM"],
  },
  {
    variant: "ESSENTIAL",
    name: "Essential Mathematics",
    code: "MATE",
    description: "Compulsory for Social Sciences and Arts & Sports Science pathway learners — a simplified, practical/utilitarian mathematics syllabus (numeracy, budgeting, statistics for everyday and career use) ensuring numeracy for all without forcing the full STEM syllabus on non-STEM learners.",
    compulsoryFor: ["SOCIAL_SCIENCES", "ARTS_SPORTS"],
  },
];

/** Given a pathway group, return which Mathematics variant is compulsory. */
export function mathVariantForPathwayGroup(group: PathwayGroup): MathVariantDef {
  const found = CORE_ESSENTIAL_MATHEMATICS.find((m) => m.compulsoryFor.includes(group));
  // Every real KICD group maps to exactly one variant; STEM->CORE is the
  // fallback only if the taxonomy above is ever edited inconsistently.
  return found ?? CORE_ESSENTIAL_MATHEMATICS[0];
}

// P.3 (2026-07-02): Community Service Learning (CSL) is one of the 4
// compulsory Senior School learning areas (KICD official structure,
// P.0 research) — a REAL, gradeable Subject, taught and assessed like any
// other, DISTINCT from the pre-existing J.17 CommunityServiceActivity module
// (which logs individual activities/hours/reflections but has no grading —
// audited before building this: J.17 stays exactly as-is and CSL feeds off
// it as evidence in the future, it is not replaced or duplicated). CSL is
// compulsory for ALL THREE official pathway groups (unlike Math, which
// varies the SUBJECT by group — CSL is the same subject and grading
// approach everywhere, per KICD's uniform "Community Service Learning"
// requirement across all Senior School pathways).
export const COMMUNITY_SERVICE_LEARNING_SUBJECT = {
  name: "Community Service Learning",
  code: "CSL",
  description: "Compulsory for every Senior School learner regardless of pathway — graded via observation and reflection on the standard CBC 4-point rubric (BE/AE/ME/EE), reusing the existing B.6 CBC strand/assessment engine rather than a new grading system.",
  compulsoryFor: ["STEM", "SOCIAL_SCIENCES", "ARTS_SPORTS"] as PathwayGroup[],
};

/** The real KICD CSL strands used for CBC-rubric grading (B.6 engine). */
export const CSL_STRANDS: { name: string; learningOutcome: string }[] = [
  {
    name: "Community Engagement & Service",
    learningOutcome: "Actively participate in and contribute meaningful effort to a real community service activity (e.g. environmental work, charity, school or civic service).",
  },
  {
    name: "Reflection & Impact",
    learningOutcome: "Reflect critically on the purpose, process and outcome of a service activity, articulating what was learned and its impact on self and community.",
  },
  {
    name: "Service Portfolio Quality",
    learningOutcome: "Maintain organised, evidenced records of service undertaken (hours, supervisor confirmation, reflection) suitable for a transcript-ready portfolio.",
  },
];

export const pathwaySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().min(2, "Code must be at least 2 characters").max(20).toUpperCase(),
  description: z.string().max(500).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  requirements: z.array(pathwayRequirementSchema).optional(),
  pathwayGroup: z.enum(PATHWAY_GROUPS).optional().nullable(),
  trackName: z.string().max(100).optional().nullable(),
});

export type PathwayInput = z.infer<typeof pathwaySchema>;

/** P.1 CHUNK 4 — school-wide pathway configuration (Tenant-level). */
export const pathwaySchoolConfigSchema = z
  .object({
    pathwaySchoolType: z.enum(PATHWAY_SCHOOL_TYPES),
    enabledPathwayGroups: z.array(z.enum(PATHWAY_GROUPS)),
  })
  .refine(
    (v) => v.pathwaySchoolType === "NONE" || v.enabledPathwayGroups.length > 0,
    { message: "Select at least one pathway group when configuring Triple or Dual.", path: ["enabledPathwayGroups"] }
  )
  .refine(
    (v) => v.pathwaySchoolType !== "TRIPLE" || v.enabledPathwayGroups.length === 3,
    { message: "A Triple Pathway school must offer all 3 official pathways.", path: ["enabledPathwayGroups"] }
  )
  .refine(
    (v) => v.pathwaySchoolType !== "DUAL" || v.enabledPathwayGroups.length === 2,
    { message: "A Dual Pathway school must offer exactly 2 pathways.", path: ["enabledPathwayGroups"] }
  )
  .refine(
    (v) => v.pathwaySchoolType !== "DUAL" || v.enabledPathwayGroups.includes("STEM"),
    { message: "A Dual Pathway school must include STEM (e.g. STEM + Arts, or STEM + Social Sciences), per KICD guidance.", path: ["enabledPathwayGroups"] }
  );

export type PathwaySchoolConfigInput = z.infer<typeof pathwaySchoolConfigSchema>;

/** P.1 CHUNK 4 — "load official pathways" action payload: which groups to seed. */
export const seedOfficialPathwaysSchema = z.object({
  groups: z.array(z.enum(PATHWAY_GROUPS)).min(1, "Select at least one pathway group to load."),
});
export type SeedOfficialPathwaysInput = z.infer<typeof seedOfficialPathwaysSchema>;

export const studentPathwayPreferenceSchema = z.object({
  pathwayId: z.string().cuid(),
  choiceOrder: z.number().int().min(1).max(5),
});

export const studentPathwayAllocationSchema = z.object({
  pathwayId: z.string().cuid(),
  teacherNotes: z.string().max(500).optional().nullable(),
  isRecommended: z.boolean().default(false),
  isAllocated: z.boolean().default(true),
});

export type StudentPathwayPreferenceInput = z.infer<typeof studentPathwayPreferenceSchema>;
export type StudentPathwayAllocationInput = z.infer<typeof studentPathwayAllocationSchema>;

// Payload for the "set preferences" screen: a student picks up to 5 ranked pathways.
export const setStudentPreferencesSchema = z.object({
  preferences: z
    .array(studentPathwayPreferenceSchema)
    .max(5, "A student can rank at most 5 pathway choices."),
});

export type SetStudentPreferencesInput = z.infer<typeof setStudentPreferencesSchema>;

// =============================================================================
// P.4 (2026-07-02) — National Assessment Milestones (KPSEA / KJSEA / Senior
// Secondary Assessment) + legacy KCPE/KCSE for the last 8-4-4 cohorts.
// =============================================================================

/** Real KNEC/KICD national milestones under Kenya's 2026 CBE structure,
 * plus the legacy 8-4-4 exams still relevant while the last cohorts
 * transition out (per the P.0 research: KPSEA replaces nothing directly but
 * is a new Grade 6 checkpoint; KJSEA replaces KCPE at the junior->senior
 * transition; the future Senior Secondary Assessment will replace KCSE). */
export const NATIONAL_ASSESSMENT_MILESTONES = [
  "KPSEA",
  "KJSEA",
  "SENIOR_SECONDARY_ASSESSMENT",
  "KCPE",
  "KCSE",
] as const;
export type NationalAssessmentMilestone = (typeof NATIONAL_ASSESSMENT_MILESTONES)[number];

export const NATIONAL_ASSESSMENT_MILESTONE_LABELS: Record<NationalAssessmentMilestone, string> = {
  KPSEA: "KPSEA — Kenya Primary School Education Assessment (Grade 6)",
  KJSEA: "KJSEA — Kenya Junior School Education Assessment (Grade 9)",
  SENIOR_SECONDARY_ASSESSMENT: "Senior Secondary Assessment (Grade 12)",
  KCPE: "KCPE — Kenya Certificate of Primary Education (legacy 8-4-4, Std 8)",
  KCSE: "KCSE — Kenya Certificate of Secondary Education (legacy 8-4-4, Form 4)",
};

/** Which milestone is the real, KICD-designated Grade 9→10 pathway
 * placement input (used by getStudentPathwayReadiness, not internal
 * exam averages alone). */
export const PATHWAY_PLACEMENT_MILESTONE: NationalAssessmentMilestone = "KJSEA";

export const nationalAssessmentSubjectSchema = z.object({
  subjectName: z.string().trim().min(1).max(100),
  subjectCode: z.string().trim().max(20).optional().nullable(),
  score: z.number().min(0).max(100).optional().nullable(),
  grade: z.string().trim().max(10).optional().nullable(),
});

export const nationalAssessmentSchema = z.object({
  studentId: z.string().cuid(),
  milestone: z.enum(NATIONAL_ASSESSMENT_MILESTONES),
  year: z.number().int().min(2015).max(2100),
  indexNo: z.string().trim().max(40).optional().nullable(),
  overallScorePct: z.number().int().min(0).max(100).optional().nullable(),
  overallGrade: z.string().trim().max(10).optional().nullable(),
  subjects: z.array(nationalAssessmentSubjectSchema).max(20).default([]),
  status: z.enum(["PENDING", "CONFIRMED", "DISPUTED"]).default("CONFIRMED"),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type NationalAssessmentInput = z.infer<typeof nationalAssessmentSchema>;

// ---------------------------------------------------------------------------
// P.5 — Official KICD Senior School 40-lesson/week timetable structure.
// This is an OPTIONAL, one-click template a school may apply to a Senior
// School class — it never forces anything: periodsPerDay/lessonDurationMins
// stay fully custom per school (TimetableConfig), and this preset is simply
// one convenient way to fill ClassSubjectNeed + TimetableConfig with the
// real KICD numbers in one action, editable afterward like any other config.
// Source: P.0 research — 40 lessons/week @ 40 min: English 5, Kiswahili 5,
// Mathematics 5 (variant depends on pathway group — P.2), CSL 3 (P.3),
// 3 Electives x 5 = 15, PE 3, ICT Skills 2, PPI 1, Personal/Group Study 1.
export const KICD_SENIOR_SCHOOL_TIMETABLE_TEMPLATE = {
  totalLessonsPerWeek: 40,
  lessonDurationMins: 40,
  periodsPerDay: 8, // 40 lessons / 5 weekdays = 8/day if no Saturday teaching load is used for it
  compulsorySubjectLessons: {
    ENGLISH: 5,
    KISWAHILI_OR_KSL: 5,
    MATHEMATICS: 5, // real variant (Core/Essential) resolved per pathway group, see P.2
    COMMUNITY_SERVICE_LEARNING: 3, // see P.3 — real CSL subject, not a placeholder
  },
  electiveLessonsEach: 5, // x3 real pathway electives = 15
  nonAcademicLessons: {
    PE: 3,
    ICT_SKILLS: 2,
    PPI: 1, // Pastoral Programme of Instruction
    PERSONAL_GROUP_STUDY: 1,
  },
} as const;

