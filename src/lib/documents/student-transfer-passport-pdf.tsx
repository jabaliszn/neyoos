import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, color: "#1c2740", fontFamily: "Helvetica" },
  header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#d7deea" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#5b6475", marginBottom: 2 },
  section: { marginBottom: 12, padding: 10, borderWidth: 1, borderColor: "#d7deea", borderRadius: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 110, color: "#5b6475" },
  value: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 as any },
  chip: { fontSize: 8, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 999, backgroundColor: "#e8eefc", color: "#23408e" },
  item: { marginBottom: 5, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: "#edf1f7" },
  small: { fontSize: 8, color: "#5b6475" },
  footer: { position: "absolute", bottom: 16, left: 24, right: 24, fontSize: 8, color: "#5b6475", textAlign: "center" },
});

type Input = {
  tenant: { name: string; county: string | null; addressLine: string | null; motto: string | null; brandPrimary: string; };
  student: { fullName: string; admissionNo: string; upiNumber: string | null; className: string | null; gender: string; dateOfBirth: string | null; guardians: Array<{ fullName: string; phone: string | null }>; };
  snapshot: any;
};

function MiniLogo({ color }: { color: string }) {
  return (
    <Svg width={28} height={28}>
      <Rect x={1} y={1} width={26} height={26} rx={7} fill={color} />
      <Path d="M7 20 L14 8 L21 20" stroke="#ffffff" strokeWidth={2.3} fill="none" />
      <Path d="M10 16 H18" stroke="#ffffff" strokeWidth={2} fill="none" />
    </Svg>
  );
}

function list(items: any[], render: (item: any, index: number) => React.ReactNode, empty = "No records included.") {
  if (!items || items.length === 0) return <Text style={styles.small}>{empty}</Text>;
  return <View>{items.slice(0, 8).map(render)}</View>;
}

function PassportDoc({ tenant, student, snapshot }: Input) {
  const modules: string[] = snapshot?.modules ?? [];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.title}>Student Transfer Passport</Text>
              <Text style={styles.subtitle}>{tenant.name}{tenant.county ? ` · ${tenant.county}` : ""}</Text>
              <Text style={styles.subtitle}>{tenant.addressLine || tenant.motto || "Portable learner record for transfer and continuity."}</Text>
            </View>
            <MiniLogo color={tenant.brandPrimary || "#1c2740"} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learner profile</Text>
          <View style={styles.row}><Text style={styles.label}>Full name</Text><Text style={styles.value}>{student.fullName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Admission no.</Text><Text style={styles.value}>{student.admissionNo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>UPI / NEMIS</Text><Text style={styles.value}>{student.upiNumber || "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Class</Text><Text style={styles.value}>{student.className || "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date of birth</Text><Text style={styles.value}>{student.dateOfBirth || "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Guardians</Text><Text style={styles.value}>{student.guardians.map((g) => `${g.fullName}${g.phone ? ` (${g.phone})` : ""}`).join(", ") || "—"}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared modules</Text>
          <View style={styles.chipRow}>{modules.map((m) => <Text key={m} style={styles.chip}>{m}</Text>)}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic highlights</Text>
          {list(snapshot?.academics || [], (item, i) => (
            <View key={i} style={styles.item}>
              <Text>{item.subject?.name || "Subject"} · {item.exam?.name || "Exam"}</Text>
              <Text style={styles.small}>Marks: {item.marks ?? "—"} / {item.exam?.maxMarks ?? "—"}</Text>
            </View>
          ), "No academic results shared.")}
          {snapshot?.leavingCertificate ? <Text style={styles.small}>Leaving certificate: {snapshot.leavingCertificate.certificateNo} ({snapshot.leavingCertificate.status})</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Competency, talent and portfolio</Text>
          {list(snapshot?.competencies || [], (item, i) => (
            <View key={i} style={styles.item}>
              <Text>{item.competency?.name || "Competency"}</Text>
              <Text style={styles.small}>Level {item.level ?? "—"} · {item.narrative || "No narrative"}</Text>
            </View>
          ), "No competency evidence shared.")}
          {list(snapshot?.talents || [], (item, i) => (
            <View key={`t-${i}`} style={styles.item}>
              <Text>{item.talentArea?.name || "Talent area"}</Text>
              <Text style={styles.small}>Coach: {item.coach?.fullName || item.coachName || "—"} · Score: {item.score ?? "—"}</Text>
            </View>
          ), "No talent records shared.")}
          {list(snapshot?.portfolio || [], (item, i) => (
            <View key={`p-${i}`} style={styles.item}>
              <Text>{item.title}</Text>
              <Text style={styles.small}>{item.category || "Portfolio"} · {item.description || "No description"}</Text>
            </View>
          ), "No portfolio items shared.")}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance, discipline and wellbeing</Text>
          <Text style={styles.small}>Attendance entries: {snapshot?.attendance?.length || 0}</Text>
          <Text style={styles.small}>Discipline entries: {snapshot?.discipline?.length || 0}</Text>
          <Text style={styles.small}>Medical profile included: {snapshot?.medical ? "Yes" : "No"}</Text>
          <Text style={styles.small}>Community service entries: {snapshot?.communityService?.length || 0}</Text>
        </View>

        <Text style={styles.footer}>Powered by NEYO · neyo.co.ke</Text>
      </Page>
    </Document>
  );
}

export async function renderStudentTransferPassportPdf(input: Input) {
  return renderToBuffer(<PassportDoc {...input} />);
}
