import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";
import type { PathwayReportRow } from "@/lib/services/pathway.service";

type PathwayReportDocInput = {
  schoolName: string;
  motto?: string | null;
  county?: string | null;
  addressLine?: string | null;
  brandPrimary?: string | null;
  generatedDate: string;
  totals: { pathways: number; allocated: number; capacity: number | null };
  rows: PathwayReportRow[];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1c2740", backgroundColor: "#ffffff" },
  header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#d9e2ec", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  schoolName: { fontSize: 18, fontWeight: 700 },
  schoolMeta: { marginTop: 3, fontSize: 9, color: "#52606d" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#52606d", marginBottom: 14 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { borderWidth: 1, borderColor: "#d9e2ec", borderRadius: 10, padding: 10, flexGrow: 1, backgroundColor: "#f8fafc" },
  summaryLabel: { fontSize: 8, color: "#7b8794", textTransform: "uppercase" },
  summaryValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pathwayName: { fontSize: 12, fontWeight: 700 },
  pathwayMeta: { fontSize: 8.5, color: "#52606d", marginTop: 2 },
  capacityPill: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, fontSize: 8.5, backgroundColor: "#e0e7ff", color: "#3730a3" },
  sectionLabel: { fontSize: 8.5, fontWeight: 700, color: "#52606d", marginTop: 8, marginBottom: 4, textTransform: "uppercase" },
  reqRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  reqPill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, fontSize: 7.8, backgroundColor: "#dbeafe", color: "#1d4ed8" },
  studentLine: { fontSize: 8.5, color: "#243b53", lineHeight: 1.5 },
  muted: { fontSize: 8.5, color: "#7b8794" },
  footer: { position: "absolute", left: 32, right: 32, bottom: 20, borderTopWidth: 1, borderTopColor: "#d9e2ec", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 8, color: "#7b8794" },
});

function NeyoMark({ color = "#1c2740" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 64 64">
      <Rect x="8" y="8" width="48" height="48" rx="12" fill={color} />
      <Path d="M20 44V20l24 24V20" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function PathwayReportDoc(input: PathwayReportDocInput) {
  const brand = input.brandPrimary || "#1c2740";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.schoolName, { color: brand }]}>{input.schoolName}</Text>
            <Text style={styles.schoolMeta}>
              {[input.motto, input.county, input.addressLine].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <NeyoMark color={brand} />
        </View>

        <Text style={styles.title}>Senior School Pathway Report</Text>
        <Text style={styles.subtitle}>Generated {input.generatedDate}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pathways</Text>
            <Text style={styles.summaryValue}>{input.totals.pathways}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Allocated learners</Text>
            <Text style={styles.summaryValue}>{input.totals.allocated}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total capacity</Text>
            <Text style={styles.summaryValue}>{input.totals.capacity ?? "—"}</Text>
          </View>
        </View>

        {input.rows.map((row, i) => (
          <View key={i} style={styles.card} wrap={false}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.pathwayName}>{row.pathwayName} ({row.pathwayCode})</Text>
                {row.description ? <Text style={styles.pathwayMeta}>{row.description}</Text> : null}
              </View>
              <Text style={styles.capacityPill}>
                {row.allocatedCount}{row.capacity != null ? `/${row.capacity}` : ""} allocated
                {row.fillPct != null ? ` · ${row.fillPct}% full` : ""}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Subject requirements</Text>
            {row.requirements.length === 0 ? (
              <Text style={styles.muted}>No subject requirements set — open pathway.</Text>
            ) : (
              <View style={styles.reqRow}>
                {row.requirements.map((req, j) => (
                  <Text key={j} style={styles.reqPill}>
                    {req.subjectName}{req.minScorePct != null ? ` ≥${req.minScorePct}%` : ""}{req.isCore ? " · Core" : " · Elective"}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>Allocated learners</Text>
            {row.allocatedStudents.length === 0 ? (
              <Text style={styles.muted}>No learners allocated yet.</Text>
            ) : (
              <Text style={styles.studentLine}>
                {row.allocatedStudents.map((s) => `${s.name} (${s.admissionNo})`).join(" · ")}
              </Text>
            )}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Powered by NEYO · neyo.co.ke</Text>
          <Text style={styles.footerText}>Senior School Pathway Report</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPathwayReportPdf(input: PathwayReportDocInput): Promise<Buffer> {
  return renderToBuffer(<PathwayReportDoc {...input} />);
}
