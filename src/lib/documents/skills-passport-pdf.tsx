/**
 * PART J.6 — Skills Passport PDF.
 *
 * Co-branded (G.9 motto+colour), QR-verified (A.10). Renders academic growth,
 * J.4 competencies, and talent/leadership star ratings in a beautiful, portable
 * document with the "Powered by NEYO" trademark footer.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface SkillsPassportPdfData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  studentName: string;
  admissionNo: string;
  className: string | null;
  academicGrowth: {
    exams: { examName: string; subjectName: string; marks: number; grade: string; term: number; year: number }[];
    flexibleAssessments: { planTitle: string; typeName: string; scoreMarks: number | null; scorePct: number | null; rubricLevel: number | null; rubricCode: string | null; narrative: string | null; term: number; year: number }[];
  };
  competencyGrowth: { competencyName: string; competencyCode: string; groupName: string; level: number | null; scorePct: number | null; narrative: string | null; date: string; recordedByName: string }[];
  talentAndLeadership: { skillArea: string; latestRating: number; evidenceCount: number; latestSource: string; latestNarrative: string | null; latestDate: string }[];
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderSkillsPassportPdf(d: SkillsPassportPdfData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 10, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.4 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 12, marginBottom: 16, textAlign: "center" },
    school: { fontSize: 18, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 9, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 8, color: MUTED, marginTop: 2 },
    title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 12 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, backgroundColor: "#f6f8fc", borderRadius: 4, padding: 10 },
    metaCell: { fontSize: 10 },
    metaLabel: { color: MUTED, fontSize: 8, marginBottom: 2 },
    metaValue: { fontFamily: "Helvetica-Bold", fontSize: 11 },
    sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#dbe3f0", paddingBottom: 4, marginBottom: 8, color: NAVY },
    table: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, marginBottom: 16 },
    thRow: { flexDirection: "row", backgroundColor: "#f6f8fc", borderBottomWidth: 1, borderBottomColor: "#dbe3f0" },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eef2f9", paddingVertical: 6, paddingHorizontal: 8 },
    trLast: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8 },
    cCol1: { width: "50%" },
    cCol2: { width: "25%", textAlign: "center" },
    cCol3: { width: "25%", textAlign: "right", fontFamily: "Helvetica-Bold" },
    th: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold", paddingVertical: 6, paddingHorizontal: 8 },
    skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    skillBox: { width: "48%", borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 6, padding: 10, backgroundColor: "#ffffff" },
    skillHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    skillName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
    skillStars: { fontSize: 10, color: "#d97706", fontFamily: "Helvetica-Bold" },
    skillDesc: { fontSize: 8.5, color: "#475569" },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 10 },
    signLine: { marginTop: 20, borderTopWidth: 1, borderTopColor: NAVY, width: 140, paddingTop: 3, fontSize: 8, color: MUTED },
    qrText: { fontSize: 6.5, color: MUTED, marginTop: 2, width: 100, textAlign: "center" },
    emptyText: { fontSize: 9, color: MUTED, fontStyle: "italic", marginBottom: 12 },
  });

  const doc = (
    <Document title={`Skills Passport ${d.studentName}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 28, height: 28, objectFit: "contain", marginBottom: 4 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          <Text style={s.sub}>{[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}</Text>
        </View>

        <Text style={s.title}>SKILLS PASSPORT & HOLISTIC LEARNER IDENTITY</Text>

        <View style={s.metaRow}>
          <View style={s.metaCell}><Text style={s.metaLabel}>LEARNER</Text><Text style={s.metaValue}>{d.studentName}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>ADM NO</Text><Text style={s.metaValue}>{d.admissionNo}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>CLASS</Text><Text style={s.metaValue}>{d.className ?? "—"}</Text></View>
        </View>

        {/* 1. Academic Growth */}
        <Text style={s.sectionTitle}>ACADEMIC GROWTH & FLEXIBLE ASSESSMENTS</Text>
        {d.academicGrowth.exams.length === 0 && d.academicGrowth.flexibleAssessments.length === 0 ? (
          <Text style={s.emptyText}>No academic results recorded yet.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.thRow}>
              <Text style={[s.cCol1, s.th]}>ASSESSMENT / SUBJECT</Text>
              <Text style={[s.cCol2, s.th]}>TERM / YEAR</Text>
              <Text style={[s.cCol3, s.th]}>RESULT</Text>
            </View>
            {d.academicGrowth.exams.map((e, i) => (
              <View key={`ex-${i}`} style={s.tr}>
                <View style={s.cCol1}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{e.subjectName}</Text>
                  <Text style={{ fontSize: 7.5, color: MUTED }}>{e.examName}</Text>
                </View>
                <Text style={[s.cCol2, { fontSize: 9 }]}>Term {e.term}, {e.year}</Text>
                <Text style={[s.cCol3, { fontSize: 9, color: GREEN }]}>{e.marks} marks ({e.grade})</Text>
              </View>
            ))}
            {d.academicGrowth.flexibleAssessments.map((a, i) => (
              <View key={`fl-${i}`} style={s.tr}>
                <View style={s.cCol1}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{a.planTitle}</Text>
                  <Text style={{ fontSize: 7.5, color: MUTED }}>{a.typeName}</Text>
                </View>
                <Text style={[s.cCol2, { fontSize: 9 }]}>Term {a.term}, {a.year}</Text>
                <Text style={[s.cCol3, { fontSize: 9, color: "#2563eb" }]}>
                  {a.rubricCode ? `Level ${a.rubricLevel} (${a.rubricCode})` : a.scorePct !== null ? `${a.scorePct}%` : "Recorded"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 2. Competency Growth */}
        <Text style={s.sectionTitle}>J.4 CORE COMPETENCY OBSERVATIONS</Text>
        {d.competencyGrowth.length === 0 ? (
          <Text style={s.emptyText}>No competency observations recorded yet.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.thRow}>
              <Text style={[s.cCol1, s.th]}>COMPETENCY</Text>
              <Text style={[s.cCol2, s.th]}>DATE</Text>
              <Text style={[s.cCol3, s.th]}>ASSESSMENT</Text>
            </View>
            {d.competencyGrowth.map((c, i) => (
              <View key={`comp-${i}`} style={s.tr}>
                <View style={s.cCol1}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{c.competencyName}</Text>
                  {c.narrative ? <Text style={{ fontSize: 8, color: "#475569", marginTop: 2 }}>{c.narrative}</Text> : null}
                </View>
                <Text style={[s.cCol2, { fontSize: 9 }]}>{c.date}</Text>
                <Text style={[s.cCol3, { fontSize: 9, color: GREEN }]}>{c.level !== null ? `Level ${c.level}` : c.scorePct !== null ? `${c.scorePct}%` : "Observed"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 3. Talent & Leadership */}
        <Text style={s.sectionTitle}>TALENT & LEADERSHIP STAR RATINGS</Text>
        {d.talentAndLeadership.length === 0 ? (
          <Text style={s.emptyText}>No talent or leadership ratings logged yet.</Text>
        ) : (
          <View style={s.skillGrid}>
            {d.talentAndLeadership.map((t, i) => (
              <View key={`tal-${i}`} style={s.skillBox}>
                <View style={s.skillHeader}>
                  <Text style={s.skillName}>{t.skillArea.toUpperCase()}</Text>
                  <Text style={s.skillStars}>★ {t.latestRating} / 5</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 4 }}>Source: {t.latestSource} · {t.latestDate}</Text>
                {t.latestNarrative ? <Text style={s.skillDesc}>{t.latestNarrative}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <View>
            <Text style={{ fontSize: 9 }}>Issued {d.issuedDate}</Text>
            <Text style={s.signLine}>Principal / Head of Institution</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={d.qrDataUrl} style={{ width: 56, height: 56 }} />
            <Text style={s.qrText}>Scan to verify · {d.verifyCode}</Text>
          </View>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Powered by NEYO · neyo.co.ke</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
