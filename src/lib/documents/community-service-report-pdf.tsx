import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type Input = {
  tenant: { name: string; county: string | null; addressLine: string | null; motto: string | null; brandPrimary: string | null; };
  student: { name: string; admissionNo: string; className: string | null; };
  totalHours: number;
  activities: Array<{ title: string; category: string; date: string; hours: number; location: string | null; supervisorName: string | null; studentReflection: string | null; status: string; }>;
  title: string;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica", color: "#1c2740" },
  header: { marginBottom: 12, borderBottomWidth: 2, borderBottomColor: "#1c2740", paddingBottom: 8 },
  school: { fontSize: 18, fontWeight: 700 },
  sub: { fontSize: 8, color: "#5b6475", marginTop: 2 },
  title: { fontSize: 14, fontWeight: 700, marginTop: 8 },
  card: { borderWidth: 1, borderColor: "#d7deea", borderRadius: 8, padding: 10, marginTop: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  row: { marginBottom: 3 },
  footer: { position: "absolute", left: 30, right: 30, bottom: 18, borderTopWidth: 1, borderTopColor: "#d7deea", paddingTop: 6, fontSize: 8, color: "#5b6475", textAlign: "center" },
});

export async function renderCommunityServiceReportPdf(input: Input): Promise<Buffer> {
  const brand = input.tenant.brandPrimary || "#1c2740";
  const doc = (
    <Document title={input.title} author={input.tenant.name}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: brand }]}>
          <Text style={[styles.school, { color: brand }]}>{input.tenant.name}</Text>
          <Text style={styles.sub}>{[input.tenant.motto, input.tenant.county, input.tenant.addressLine].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.title}>{input.title}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Learner summary</Text>
          <Text style={styles.row}>Learner: {input.student.name}</Text>
          <Text style={styles.row}>Admission no.: {input.student.admissionNo}</Text>
          <Text style={styles.row}>Class: {input.student.className || "Unassigned"}</Text>
          <Text style={styles.row}>Approved hours: {input.totalHours}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Community service log</Text>
          {input.activities.map((a, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.row}>{a.date} · {a.title} · {a.category} · {a.hours} hrs · {a.status}</Text>
              {a.location ? <Text style={styles.row}>Location: {a.location}</Text> : null}
              {a.supervisorName ? <Text style={styles.row}>Supervisor: {a.supervisorName}</Text> : null}
              {a.studentReflection ? <Text style={styles.row}>Reflection: {a.studentReflection}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Certificate note</Text>
          <Text style={styles.row}>{input.student.name} has demonstrated service, stewardship and citizenship through recorded community service activities.</Text>
        </View>

        <Text style={styles.footer}>Powered by NEYO · neyo.co.ke</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
