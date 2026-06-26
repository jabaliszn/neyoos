/**
 * G.10 Document Set — Student Academic Transcript PDF.
 * Formal, A4 portrait, co-branded (primary color, logo placeholder, motto) and QR-verified.
 * Displays multi-term/multi-exam academic records chronologically.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface TranscriptExamRow {
  examName: string;
  termLabel: string; // e.g. "Term 2 2026"
  maxMarks: number;
  results: Array<{
    subjectName: string;
    subjectCode: string;
    marks: number;
    grade: string;
    remarks: string;
  }>;
  total: number;
  avgPct: number;
  overallGrade: string;
  position: number;
  cohortSize: number;
}

export interface StudentTranscript {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  studentName: string;
  admissionNo: string;
  className: string;
  gender: string;
  upiNumber: string | null;
  admittedOn: string;
  exams: TranscriptExamRow[];
  verifyCode: string;
  qrDataUrl: string;
}

export async function renderStudentTranscriptPdf(t: StudentTranscript): Promise<Buffer> {
  const NAVY = t.brandPrimary || "#1c2740";
  const GREEN = "#1f9d5f";
  const MUTED = "#677fab";

  const s = StyleSheet.create({
    page: {
      padding: 36,
      fontSize: 9,
      color: "#222222",
      fontFamily: "Helvetica",
      backgroundColor: "#ffffff",
    },
    header: {
      borderBottomWidth: 2,
      borderBottomColor: NAVY,
      paddingBottom: 10,
      marginBottom: 15,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    headerLeft: {
      flex: 1,
    },
    school: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: NAVY,
    },
    motto: {
      fontSize: 8.5,
      color: GREEN,
      marginTop: 2,
      fontFamily: "Helvetica-Oblique",
    },
    addr: {
      fontSize: 8,
      color: MUTED,
      marginTop: 2,
    },
    headerRight: {
      textAlign: "right",
    },
    title: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: NAVY,
      letterSpacing: 1.5,
      textAlign: "center",
      marginBottom: 15,
      textTransform: "uppercase",
    },
    studentInfo: {
      borderWidth: 1,
      borderColor: "#dbe3f0",
      borderRadius: 8,
      padding: 10,
      marginBottom: 15,
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: "#fcfdfe",
    },
    infoCol: {
      width: "50%",
      padding: 4,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    infoLabel: {
      color: MUTED,
      fontFamily: "Helvetica-Bold",
      fontSize: 8.5,
    },
    infoValue: {
      color: "#111111",
      fontFamily: "Helvetica",
      fontSize: 8.5,
    },
    examBlock: {
      marginBottom: 15,
    },
    examHeader: {
      backgroundColor: NAVY,
      color: "#ffffff",
      padding: 6,
      borderRadius: 4,
      fontSize: 9.5,
      fontFamily: "Helvetica-Bold",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    th: {
      fontFamily: "Helvetica-Bold",
      backgroundColor: "#f1f5f9",
      padding: 5,
      fontSize: 8,
      color: NAVY,
    },
    tr: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    td: {
      padding: 5,
      fontSize: 8,
    },
    summaryRow: {
      flexDirection: "row",
      backgroundColor: "#fafafb",
      padding: 6,
      borderBottomWidth: 1,
      borderBottomColor: "#cbd5e1",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },
    summaryText: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: NAVY,
    },
    footer: {
      flexDirection: "row",
      borderTopWidth: 1.5,
      borderTopColor: NAVY,
      paddingTop: 15,
      marginTop: 20,
      justifyContent: "space-between",
    },
    qrBlock: {
      flexDirection: "row",
      alignItems: "center",
      width: "60%",
    },
    qr: {
      width: 50,
      height: 50,
      marginRight: 10,
    },
    fnote: {
      fontSize: 7.5,
      color: MUTED,
      lineHeight: 1.35,
    },
    signBlock: {
      width: "35%",
      textAlign: "right",
      justifyContent: "flex-end",
    },
    line: {
      borderBottomWidth: 1,
      borderBottomColor: MUTED,
      width: "100%",
      marginBottom: 4,
    },
    signLabel: {
      fontSize: 8,
      color: MUTED,
      fontFamily: "Helvetica-Bold",
    },
    powered: {
      fontSize: 6.5,
      color: MUTED,
      textAlign: "center",
      marginTop: 15,
    },
  });

  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {t.logoUrl ? <Image src={t.logoUrl} style={{ width: 28, height: 28, objectFit: "contain", marginBottom: 4 }} /> : null}
            <Text style={s.school}>{t.schoolName}</Text>
            {t.motto ? <Text style={s.motto}>{t.motto}</Text> : null}
            <Text style={s.addr}>
              {[t.addressLine, t.county].filter(Boolean).join(" · ") || "Kenya"}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={{ fontSize: 8, color: MUTED }}>OFFICIAL RECORD</Text>
          </View>
        </View>

        <Text style={s.title}>Official Academic Transcript</Text>

        <View style={s.studentInfo}>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Student Name:</Text>
            <Text style={s.infoValue}>{t.studentName}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Admission No:</Text>
            <Text style={s.infoValue}>{t.admissionNo}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Gender:</Text>
            <Text style={s.infoValue}>{t.gender === "M" ? "Male" : "Female"}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Current Class:</Text>
            <Text style={s.infoValue}>{t.className}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>UPI / NEMIS No:</Text>
            <Text style={s.infoValue}>{t.upiNumber || "—"}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Date of Admission:</Text>
            <Text style={s.infoValue}>{t.admittedOn}</Text>
          </View>
        </View>

        {t.exams.length === 0 ? (
          <View style={{ padding: 20, textAlign: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 }}>
            <Text style={{ fontSize: 10, color: MUTED }}>No academic exam records are available for this student.</Text>
          </View>
        ) : (
          t.exams.map((e, idx) => (
            <View key={idx} style={s.examBlock}>
              <View style={s.examHeader}>
                <Text>{e.examName} ({e.termLabel})</Text>
                <Text>Position: {e.position} / {e.cohortSize}</Text>
              </View>

              <View style={{ marginTop: 5 }}>
                <View style={[s.tr, { borderBottomWidth: 1, borderBottomColor: NAVY }]}>
                  <Text style={[s.th, { width: "15%" }]}>Code</Text>
                  <Text style={[s.th, { width: "35%" }]}>Subject</Text>
                  <Text style={[s.th, { width: "15%", textAlign: "right" }]}>Score</Text>
                  <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Grade</Text>
                  <Text style={[s.th, { width: "20%" }]}>Remarks</Text>
                </View>

                {e.results.map((r, rIdx) => (
                  <View key={rIdx} style={s.tr}>
                    <Text style={[s.td, { width: "15%" }]}>{r.subjectCode}</Text>
                    <Text style={[s.td, { width: "35%" }]}>{r.subjectName}</Text>
                    <Text style={[s.td, { width: "15%", textAlign: "right" }]}>{r.marks} / {e.maxMarks}</Text>
                    <Text style={[s.td, { width: "15%", textAlign: "center", fontFamily: "Helvetica-Bold" }]}>{r.grade}</Text>
                    <Text style={[s.td, { width: "20%", color: "#444" }]}>{r.remarks}</Text>
                  </View>
                ))}
              </View>

              <View style={s.summaryRow}>
                <Text style={s.summaryText}>Total: {e.total}</Text>
                <Text style={s.summaryText}>Average: {e.avgPct}%</Text>
                <Text style={s.summaryText}>Mean Grade: {e.overallGrade}</Text>
              </View>
            </View>
          ))
        )}

        <View style={s.footer}>
          <View style={s.qrBlock}>
            <Image style={s.qr} src={t.qrDataUrl} />
            <Text style={s.fnote}>
              This is an official academic transcript generated by the NEYO School OS.{"\n"}
              To verify the authenticity of this document, scan the QR code or visit{"\n"}
              neyo.co.ke/verify and enter the verification code below.{"\n"}
              Verification Code: <Text style={{ fontFamily: "Helvetica-Bold" }}>{t.verifyCode}</Text>
            </Text>
          </View>
          <View style={s.signBlock}>
            <View style={s.line} />
            <Text style={s.signLabel}>School Principal</Text>
          </View>
        </View>

        <Text style={s.powered}>Powered by NEYO · neyo.co.ke</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
