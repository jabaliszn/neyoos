/**
 * G.27 — Mwalimu Day-One Pack PDF.
 * A single printable A4 pack per teacher containing:
 *   1. Today's teaching timetable.
 *   2. Class registers for classes they teach.
 *   3. Yesterday's absentees list.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface MwalimuPackData {
  schoolName: string;
  motto: string | null;
  teacherName: string;
  date: string;
  timetable: Array<{
    dayOfWeek: number;
    period: number;
    className: string;
    subjectCode: string;
  }>;
  classRosters: Array<{
    className: string;
    students: Array<{ admissionNo: string; name: string; gender: string }>;
  }>;
  yesterdayAbsentees: Array<{
    studentName: string;
    admissionNo: string;
    className: string;
    note: string | null;
  }>;
  brandPrimary: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function renderMwalimuPackPdf(d: MwalimuPackData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";

  const s = StyleSheet.create({
    page: { padding: 36, fontSize: 9, color: "#222222", fontFamily: "Helvetica" },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 15 },
    school: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
    motto: { fontSize: 8, color: GREEN, marginTop: 1, fontFamily: "Helvetica-Oblique" },
    title: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, marginVertical: 10, textTransform: "uppercase" },
    metaText: { fontSize: 9, color: MUTED, marginBottom: 15 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 4, marginBottom: 8 },
    table: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, overflow: "hidden" },
    th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9", padding: 5, fontSize: 8, color: NAVY },
    tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
    td: { padding: 5, fontSize: 8 },
    bold: { fontFamily: "Helvetica-Bold" },
    powered: { fontSize: 6.5, color: MUTED, textAlign: "center", marginTop: 20 },
  });

  const doc = (
    <Document title={`Mwalimu Pack - ${d.teacherName}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 2 }}>Mwalimu Day-One Operations Pack</Text>
        </View>

        <Text style={s.title}>Mwalimu Operational Day-Pack</Text>
        <Text style={s.metaText}>Teacher: <Text style={s.bold}>{d.teacherName}</Text> · Generated Date: <Text style={s.bold}>{d.date}</Text></Text>

        {/* Section 1: Today's Timetable */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Today's Teaching Schedule</Text>
          {d.timetable.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: MUTED, fontFamily: "Helvetica-Oblique" }}>No teaching periods scheduled for today.</Text>
          ) : (
            <View style={s.table}>
              <View style={[s.tr, { borderBottomColor: NAVY }]}>
                <Text style={[s.th, { width: "20%" }]}>Period</Text>
                <Text style={[s.th, { width: "40%" }]}>Class</Text>
                <Text style={[s.th, { width: "40%" }]}>Subject</Text>
              </View>
              {d.timetable.map((t, idx) => (
                <View key={idx} style={s.tr}>
                  <Text style={[s.td, { width: "20%" }]}>P{t.period}</Text>
                  <Text style={[s.td, { width: "40%" }]}>{t.className}</Text>
                  <Text style={[s.td, { width: "40%", fontFamily: "Helvetica-Bold" }]}>{t.subjectCode}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section 2: Yesterday's Absentees */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>2. Yesterday's Class Absentees</Text>
          {d.yesterdayAbsentees.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: MUTED, fontFamily: "Helvetica-Oblique" }}>No student absences recorded yesterday in your classes.</Text>
          ) : (
            <View style={s.table}>
              <View style={[s.tr, { borderBottomColor: NAVY }]}>
                <Text style={[s.th, { width: "30%" }]}>Student Name</Text>
                <Text style={[s.th, { width: "20%" }]}>Adm No</Text>
                <Text style={[s.th, { width: "25%" }]}>Class</Text>
                <Text style={[s.th, { width: "25%" }]}>Notes / Reasons</Text>
              </View>
              {d.yesterdayAbsentees.map((a, idx) => (
                <View key={idx} style={s.tr}>
                  <Text style={[s.td, { width: "30%", fontFamily: "Helvetica-Bold" }]}>{a.studentName}</Text>
                  <Text style={[s.td, { width: "20%" }]}>{a.admissionNo}</Text>
                  <Text style={[s.td, { width: "25%" }]}>{a.className}</Text>
                  <Text style={[s.td, { width: "25%", color: "#555" }]}>{a.note || "No note recorded"}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section 3: Class Register Rosters */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Class Attendance Registers</Text>
          {d.classRosters.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: MUTED, fontFamily: "Helvetica-Oblique" }}>You are not assigned as class teacher to any active class.</Text>
          ) : (
            d.classRosters.map((cr, idx) => (
              <View key={idx} style={{ marginBottom: 15 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4, color: NAVY }}>Class: {cr.className} ({cr.students.length} students)</Text>
                <View style={s.table}>
                  <View style={[s.tr, { borderBottomColor: NAVY }]}>
                    <Text style={[s.th, { width: "25%" }]}>Adm No</Text>
                    <Text style={[s.th, { width: "50%" }]}>Learner Name</Text>
                    <Text style={[s.th, { width: "25%", textAlign: "center" }]}>Mark (P / A)</Text>
                  </View>
                  {cr.students.map((st, sIdx) => (
                    <View key={sIdx} style={s.tr}>
                      <Text style={[s.td, { width: "25%" }]}>{st.admissionNo}</Text>
                      <Text style={[s.td, { width: "50%", fontFamily: "Helvetica-Bold" }]}>{st.name}</Text>
                      <Text style={[s.td, { width: "25%", borderLeftWidth: 0.5, borderLeftColor: "#e2e8f0", textAlign: "center" }]} />
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={s.powered}>Powered by NEYO · neyo.co.ke</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
