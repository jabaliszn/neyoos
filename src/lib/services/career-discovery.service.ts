import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { getStudentPathwayReadiness } from "@/lib/services/pathway.service";
import type { CareerDiscoveryInput } from "@/lib/validations/career-discovery";

export class CareerDiscoveryError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CareerDiscoveryError";
  }
}

const CAREER_RULES: Array<{ area: string; interestKeywords: string[]; subjectCodes: string[]; competencyKeywords: string[]; talentKeywords: string[] }> = [
  { area: "Engineering & Technology", interestKeywords: ["engineering", "machines", "building", "robotics", "aeronautical"], subjectCodes: ["MAT", "PHY", "CHE", "CMP"], competencyKeywords: ["problem", "critical", "digital"], talentKeywords: ["coding", "stem", "robotics"] },
  { area: "Medicine & Healthcare", interestKeywords: ["doctor", "medicine", "nurse", "health", "pediatric"], subjectCodes: ["BIO", "CHE", "MAT"], competencyKeywords: ["care", "communication", "citizenship"], talentKeywords: ["science", "health"] },
  { area: "Agriculture & Environmental", interestKeywords: ["agriculture", "farming", "environment", "climate"], subjectCodes: ["AGR", "BIO", "GEO"], competencyKeywords: ["citizenship", "problem"], talentKeywords: ["environment", "agriculture"] },
  // P.6 (2026-07-02): a student's Religious Education subject choice is
  // CRE/IRE/HRE (Christian/Islamic/Hindu) — whichever their family practises.
  // These credit the SAME real career-relevant skills (ethics, civic
  // education, communication) regardless of which one a learner studies, so
  // all three are recognised here — a student studying IRE or HRE must not
  // silently lose career-signal credit just because the code only checked CRE.
  { area: "Business & Economics", interestKeywords: ["business", "entrepreneur", "finance", "accounting"], subjectCodes: ["BST", "MAT", "CRE", "IRE", "HRE"], competencyKeywords: ["leadership", "communication"], talentKeywords: ["leadership", "enterprise"] },
  { area: "ICT & Computer Science", interestKeywords: ["ict", "computer", "software", "technology", "programming"], subjectCodes: ["CMP", "MAT", "PHY"], competencyKeywords: ["digital", "critical"], talentKeywords: ["coding", "ict"] },
  { area: "Creative Arts & Design", interestKeywords: ["art", "design", "music", "creative", "film"], subjectCodes: ["ART", "MUS", "LIT"], competencyKeywords: ["creativity", "communication"], talentKeywords: ["music", "art", "drama"] },
  { area: "Sports & Athletics", interestKeywords: ["sports", "athletics", "football", "basketball"], subjectCodes: ["PED"], competencyKeywords: ["teamwork", "leadership"], talentKeywords: ["sports", "athletics", "football"] },
  { area: "Education & Training", interestKeywords: ["teacher", "education", "training", "mentor"], subjectCodes: ["ENG", "KIS", "HIS"], competencyKeywords: ["communication", "leadership"], talentKeywords: ["debate", "leadership"] },
  { area: "Law & Public Service", interestKeywords: ["law", "justice", "government", "public service"], subjectCodes: ["HIS", "CRE", "IRE", "HRE", "ENG"], competencyKeywords: ["communication", "citizenship", "leadership"], talentKeywords: ["debate", "leadership", "public speaking"] },
];

function scoreBand(avg: number | null) {
  if (avg == null) return 0;
  if (avg >= 75) return 3;
  if (avg >= 60) return 2;
  if (avg >= 45) return 1;
  return 0;
}

function countKeywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((sum, keyword) => sum + (lower.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

async function buildSubjectAverages(studentId: string) {
  const results = await tenantDb().examResult.findMany({ where: { studentId }, include: { exam: { select: { maxMarks: true } } } });
  const bySubject = new Map<string, { total: number; count: number }>();
  for (const row of results) {
    const max = row.exam?.maxMarks || 100;
    const pct = Math.max(0, Math.min(100, Math.round((row.marks / max) * 100)));
    const agg = bySubject.get(row.subjectId) || { total: 0, count: 0 };
    agg.total += pct;
    agg.count += 1;
    bySubject.set(row.subjectId, agg);
  }
  const out = new Map<string, number>();
  for (const [subjectId, agg] of bySubject.entries()) out.set(subjectId, Math.round(agg.total / agg.count));
  return out;
}

export async function getStudentCareerRecords(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().careerDiscoveryRecord.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
  });
}

export async function logCareerRecord(user: SessionUser, input: CareerDiscoveryInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new CareerDiscoveryError("NOT_FOUND", "Student not found");

    return tDb.careerDiscoveryRecord.create({
      data: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        recordType: input.recordType,
        careerArea: input.careerArea || null,
        notes: input.notes,
        recordedById: user.id,
        recordedByName: user.fullName,
      },
    });
  });
}

export async function deleteCareerRecord(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.careerDiscoveryRecord.findUnique({ where: { id } });
    if (!existing) throw new CareerDiscoveryError("NOT_FOUND", "Record not found");
    if (existing.recordedById !== user.id && !["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
      throw new CareerDiscoveryError("FORBIDDEN", "Not allowed to delete this record");
    }
    return tDb.careerDiscoveryRecord.delete({ where: { id } });
  });
}

export async function getCareerDiscoveryProfile(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({ where: { id: studentId }, include: { schoolClass: true } });
    if (!student) throw new CareerDiscoveryError("NOT_FOUND", "Student not found");

    const [records, subjectAvgs, competencies, talents, readiness] = await Promise.all([
      tDb.careerDiscoveryRecord.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
      buildSubjectAverages(studentId),
      tDb.competencyEvidence.findMany({ where: { studentId, approved: true, visibleToParents: true }, include: { competency: true }, orderBy: { evidenceDate: "desc" }, take: 50 }),
      tDb.talentRecord.findMany({ where: { studentId }, include: { talentArea: true }, orderBy: { dateRecorded: "desc" }, take: 20 }),
      getStudentPathwayReadiness(user, studentId).catch(() => ({ pathways: [] as any[] })),
    ]);

    const subjects = await tDb.subject.findMany({ where: { id: { in: [...subjectAvgs.keys()] } } });
    const subjectCodeById = new Map(subjects.map((s) => [s.id, s.code]));

    const freeText = records.map((r) => `${r.careerArea || ""} ${r.notes}`).join(" ");
    const competencyText = competencies.map((c) => `${c.competency.name} ${c.narrative || ""}`).join(" ");
    const talentText = talents.map((t) => `${t.talentArea.name} ${t.notes || ""}`).join(" ");

    const recommendations = CAREER_RULES.map((rule) => {
      let score = 0;
      const reasons: string[] = [];

      const interestHits = countKeywordHits(freeText, rule.interestKeywords);
      if (interestHits > 0) {
        score += interestHits * 3;
        reasons.push(`interests mention ${rule.interestKeywords.find((k) => freeText.toLowerCase().includes(k.toLowerCase()))}`);
      }

      let subjectSupport = 0;
      for (const [subjectId, avg] of subjectAvgs.entries()) {
        const code = subjectCodeById.get(subjectId);
        if (code && rule.subjectCodes.includes(code)) {
          subjectSupport += scoreBand(avg);
        }
      }
      if (subjectSupport > 0) {
        score += subjectSupport;
        reasons.push(`subject performance supports ${rule.area.toLowerCase()}`);
      }

      const competencyHits = countKeywordHits(competencyText, rule.competencyKeywords);
      if (competencyHits > 0) {
        score += competencyHits * 2;
        reasons.push(`competency evidence aligns with ${rule.area.toLowerCase()}`);
      }

      const talentHits = countKeywordHits(talentText, rule.talentKeywords);
      if (talentHits > 0) {
        score += talentHits * 2;
        reasons.push(`talent records support ${rule.area.toLowerCase()}`);
      }

      const pathwayMatches = readiness.pathways?.filter((p: any) => p.pathwayName?.toLowerCase().includes(rule.area.split(" ")[0].toLowerCase()) || p.pathwayCode?.toLowerCase().includes(rule.area.split(" ")[0].toLowerCase())) || [];
      if (pathwayMatches.some((p: any) => p.overallReadiness === "READY" || p.overallReadiness === "ALMOST")) {
        score += 2;
        reasons.push("pathway readiness is supportive");
      }

      return {
        area: rule.area,
        score,
        reasons,
        confidence: score >= 8 ? "HIGH" : score >= 4 ? "MEDIUM" : score > 0 ? "LOW" : "NONE",
      };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? `${student.schoolClass.level}${student.schoolClass.stream ? ` ${student.schoolClass.stream}` : ""}` : null,
      },
      records,
      recommendations,
      pathwayReadiness: readiness.pathways || [],
      signals: {
        subjectAverages: subjects.map((s) => ({ subjectId: s.id, code: s.code, name: s.name, avgPct: subjectAvgs.get(s.id) || 0 })).sort((a, b) => b.avgPct - a.avgPct),
        competencies: competencies.slice(0, 8).map((c) => ({ name: c.competency.name, narrative: c.narrative, level: c.level })),
        talents: talents.slice(0, 8).map((t) => ({ name: t.talentArea.name, score: t.score, notes: t.notes })),
      },
      mode: "RULE_BASED_NO_BUNDI",
    };
  });
}
