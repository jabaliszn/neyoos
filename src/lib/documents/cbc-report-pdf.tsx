/**
 * KICD-format CBC assessment report (B.6.3) + parent-friendly wording (B.6.6).
 * Co-branded (G.9), QR-verified (A.10). Per learning area: strands with the
 * 4-level rubric code AND a plain-language line parents actually understand.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface CbcReportData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  studentName: string;
  admissionNo: string;
  className: string | null;
  subjects: {
    subject: string;
    code: string;
    overall: string;
    strands: { strand: string; learningOutcome: string | null; code: string; label: string; parentFriendly: string; comment: string | null; date: string }[];
  }[];
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";
const LEVEL_COLOR: Record<string, string> = { EE: GREEN, ME: "#2563ad", AE: "#c98a06", BE: "#d23b3b" };

export async function renderCbcReportPdf(d: CbcReportData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const s = StyleSheet.create({
    page: { padding: 42, fontSize: 9.5, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.4 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 9, marginBottom: 10, textAlign: "center" },
    school: { fontSize: 15, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 8, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 7.5, color: MUTED, marginTop: 2 },
    title: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 8 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, backgroundColor: "#f6f8fc", borderRadius: 4, padding: 7 },
    metaLabel: { color: MUTED, fontSize: 7 },
    metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
    subjBlock: { marginBottom: 9, borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4 },
    subjHead: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f6f8fc", padding: 6, borderBottomWidth: 1, borderBottomColor: "#dbe3f0" },
    subjName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    strandRow: { padding: 6, borderBottomWidth: 1, borderBottomColor: "#eef2f9" },
    strandTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
    strandName: { fontFamily: "Helvetica-Bold", fontSize: 9 },
    outcome: { fontSize: 7.5, color: MUTED, marginBottom: 2 },
    parentLine: { fontSize: 8, color: "#33415c" },
    rubric: { marginTop: 8, marginBottom: 10, flexDirection: "row", gap: 6 },
    rubricItem: { flex: 1, borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, padding: 5, alignItems: "center" },
    footer: { position: "absolute", bottom: 34, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 9 },
    signLine: { marginTop: 18, borderTopWidth: 1, borderTopColor: NAVY, width: 130, paddingTop: 3, fontSize: 7.5, color: MUTED },
    qrText: { fontSize: 6, color: MUTED, marginTop: 2, width: 95, textAlign: "center" },
  });

  const doc = (
    <Document title={`CBC report ${d.letterNo}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 24, height: 24, objectFit: "contain", marginBottom: 3 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          <Text style={s.sub}>{[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}</Text>
        </View>

        <Text style={s.title}>COMPETENCY BASED ASSESSMENT REPORT</Text>

        <View style={s.metaRow}>
          <View><Text style={s.metaLabel}>LEARNER</Text><Text style={s.metaValue}>{d.studentName}</Text></View>
          <View><Text style={s.metaLabel}>ASSESSMENT NO</Text><Text style={s.metaValue}>{d.admissionNo}</Text></View>
          <View><Text style={s.metaLabel}>GRADE / CLASS</Text><Text style={s.metaValue}>{d.className ?? "—"}</Text></View>
          <View><Text style={s.metaLabel}>DATE</Text><Text style={s.metaValue}>{d.issuedDate}</Text></View>
        </View>

        {d.subjects.map((sub) => (
          <View key={sub.code} style={s.subjBlock} wrap={false}>
            <View style={s.subjHead}>
              <Text style={s.subjName}>{sub.subject}</Text>
              <Text style={[s.subjName, { color: LEVEL_COLOR[sub.overall] ?? NAVY }]}>{sub.overall}</Text>
            </View>
            {sub.strands.map((st) => (
              <View key={st.strand} style={s.strandRow}>
                <View style={s.strandTop}>
                  <Text style={s.strandName}>{st.strand}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: LEVEL_COLOR[st.code] ?? NAVY }}>{st.code} — {st.label}</Text>
                </View>
                {st.learningOutcome ? <Text style={s.outcome}>{st.learningOutcome}</Text> : null}
                <Text style={s.parentLine}>
                  {d.studentName.split(" ")[0]} {st.parentFriendly}{st.comment ? ` · Teacher: “${st.comment}”` : ""}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={s.rubric}>
          {[["EE", "Exceeding"], ["ME", "Meeting"], ["AE", "Approaching"], ["BE", "Below"]].map(([code, label]) => (
            <View key={code} style={s.rubricItem}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, color: LEVEL_COLOR[code] }}>{code}</Text>
              <Text style={{ fontSize: 6.5, color: MUTED }}>{label} Expectations</Text>
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <View>
            <Text style={{ fontSize: 8.5 }}>Ref: {d.letterNo}</Text>
            <Text style={s.signLine}>Class Teacher / Head of Institution</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={d.qrDataUrl} style={{ width: 52, height: 52 }} />
            <Text style={s.qrText}>Scan to verify · {d.verifyCode}</Text>
          </View>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Powered by NEYO · neyo.co.ke</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
