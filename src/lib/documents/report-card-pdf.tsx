/**
 * Report card / result slip PDF (B.5.7/9 + G.10 doc set #3).
 * Co-branded (G.9 motto+colour), QR-verified (A.10). CBC shows EE/ME/AE/BE;
 * 8-4-4 shows letter grades + position. AI comments seam -> B.23.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface ReportCardData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  examName: string;
  year: number;
  term: number;
  curriculum: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  rows: { subject: string; code: string; marks: number; pct: number; grade: string }[];
  maxMarks: number;
  total: number;
  avgPct: number;
  overallGrade: string;
  position: number | null;
  classPosition: number | null;
  cohortSize: number;
  comment: string; // rule-based now; AI at B.23
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderReportCardPdf(d: ReportCardData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const s = StyleSheet.create({
    page: { padding: 44, fontSize: 10, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.4 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 10, marginBottom: 12, textAlign: "center" },
    school: { fontSize: 16, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 8.5, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 8, color: MUTED, marginTop: 2 },
    title: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 10 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, backgroundColor: "#f6f8fc", borderRadius: 4, padding: 8 },
    metaCell: { fontSize: 9 },
    metaLabel: { color: MUTED, fontSize: 7.5 },
    metaValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    table: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, marginBottom: 10 },
    thRow: { flexDirection: "row", backgroundColor: "#f6f8fc", borderBottomWidth: 1, borderBottomColor: "#dbe3f0" },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eef2f9" },
    trLast: { flexDirection: "row" },
    cSubject: { width: "44%", padding: 6 },
    cNum: { width: "14%", padding: 6, textAlign: "right" },
    cGrade: { width: "14%", padding: 6, textAlign: "center", fontFamily: "Helvetica-Bold" },
    th: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold" },
    summary: { flexDirection: "row", gap: 8, marginBottom: 12 },
    sumBox: { flex: 1, borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, padding: 8, alignItems: "center" },
    sumLabel: { fontSize: 7.5, color: MUTED },
    sumValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
    comment: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, padding: 8, marginBottom: 10 },
    footer: { position: "absolute", bottom: 36, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 10 },
    signLine: { marginTop: 20, borderTopWidth: 1, borderTopColor: NAVY, width: 140, paddingTop: 3, fontSize: 8, color: MUTED },
    qrText: { fontSize: 6.5, color: MUTED, marginTop: 2, width: 100, textAlign: "center" },
  });

  const doc = (
    <Document title={`Report card ${d.letterNo}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 24, height: 24, objectFit: "contain", marginBottom: 3 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          <Text style={s.sub}>{[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}</Text>
        </View>

        <Text style={s.title}>
          {d.examName.toUpperCase()} — TERM {d.term}, {d.year} {d.curriculum === "CBC" ? "(CBE ASSESSMENT REPORT)" : "(REPORT CARD)"}
        </Text>

        <View style={s.metaRow}>
          <View style={s.metaCell}><Text style={s.metaLabel}>LEARNER</Text><Text style={s.metaValue}>{d.studentName}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>ADM NO</Text><Text style={s.metaValue}>{d.admissionNo}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>CLASS</Text><Text style={s.metaValue}>{d.className ?? "—"}</Text></View>
          {d.position !== null ? (
            <View style={s.metaCell}><Text style={s.metaLabel}>POSITION</Text><Text style={s.metaValue}>{d.position} / {d.cohortSize}</Text></View>
          ) : null}
        </View>

        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.cSubject, s.th]}>SUBJECT</Text>
            <Text style={[s.cNum, s.th]}>MARKS /{d.maxMarks}</Text>
            <Text style={[s.cNum, s.th]}>%</Text>
            <Text style={[s.cGrade, s.th]}>{d.curriculum === "CBC" ? "LEVEL" : "GRADE"}</Text>
          </View>
          {d.rows.map((r, i) => (
            <View key={r.code} style={i === d.rows.length - 1 ? s.trLast : s.tr}>
              <Text style={s.cSubject}>{r.subject}</Text>
              <Text style={s.cNum}>{r.marks}</Text>
              <Text style={s.cNum}>{r.pct}%</Text>
              <Text style={[s.cGrade, { color: r.grade === "EE" || r.grade.startsWith("A") ? GREEN : r.grade === "BE" || r.grade === "E" ? "#d23b3b" : NAVY }]}>{r.grade}</Text>
            </View>
          ))}
        </View>

        <View style={s.summary}>
          <View style={s.sumBox}><Text style={s.sumLabel}>TOTAL</Text><Text style={s.sumValue}>{d.total}</Text></View>
          <View style={s.sumBox}><Text style={s.sumLabel}>AVERAGE</Text><Text style={s.sumValue}>{d.avgPct}%</Text></View>
          <View style={s.sumBox}><Text style={s.sumLabel}>{d.curriculum === "CBC" ? "OVERALL LEVEL" : "MEAN GRADE"}</Text><Text style={[s.sumValue, { color: GREEN }]}>{d.overallGrade}</Text></View>
          {d.classPosition !== null ? (
            <View style={s.sumBox}><Text style={s.sumLabel}>CLASS POSITION</Text><Text style={s.sumValue}>{d.classPosition}</Text></View>
          ) : null}
        </View>

        <View style={s.comment}>
          <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 3 }}>CLASS TEACHER&apos;S REMARKS</Text>
          <Text style={{ fontSize: 9 }}>{d.comment}</Text>
        </View>

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

/** Rule-based remarks until the AI layer (B.23) replaces this. */
export function buildComment(avgPct: number, name: string, curriculum: string): string {
  const first = name.split(" ")[0];
  if (curriculum === "CBC") {
    if (avgPct >= 80) return `${first} is exceeding expectations across the assessed strands. Keep nurturing this momentum at home.`;
    if (avgPct >= 65) return `${first} is meeting expectations well. Consistent practice will push them to the next level.`;
    if (avgPct >= 50) return `${first} is approaching expectations. Targeted revision in the weaker strands will help.`;
    return `${first} is performing below expectations and needs structured support. Kindly arrange a meeting with the class teacher.`;
  }
  if (avgPct >= 75) return `Excellent performance. ${first} should maintain this standard and aim even higher.`;
  if (avgPct >= 60) return `A good performance with clear potential. More practice in the weaker subjects will raise the mean.`;
  if (avgPct >= 45) return `An average performance. ${first} should increase revision time and seek help where stuck.`;
  return `Below-average performance this term. We recommend close follow-up at home and remedial support in school.`;
}
