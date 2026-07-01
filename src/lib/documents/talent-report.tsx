import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";
import type { TalentAnalytics } from "@/lib/services/talent.service";

type TalentReportDocInput = {
  schoolName: string;
  motto?: string | null;
  county?: string | null;
  addressLine?: string | null;
  brandPrimary?: string | null;
  generatedDate: string;
  termLabel: string;
  analytics: TalentAnalytics;
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
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 6, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eef2f7" },
  rowHead: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#d9e2ec" },
  cellL: { fontSize: 9.5, flexGrow: 1 },
  cellR: { fontSize: 9.5, width: 70, textAlign: "right", color: "#52606d" },
  headCellL: { fontSize: 8, fontWeight: 700, color: "#7b8794", textTransform: "uppercase", flexGrow: 1 },
  headCellR: { fontSize: 8, fontWeight: 700, color: "#7b8794", textTransform: "uppercase", width: 70, textAlign: "right" },
  muted: { fontSize: 9, color: "#7b8794", marginBottom: 8 },
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

function Section({ title, rows, headRight }: { title: string; rows: { label: string; right: string }[]; headRight: string }) {
  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No data yet.</Text>
      ) : (
        <View>
          <View style={styles.rowHead}>
            <Text style={styles.headCellL}>Group</Text>
            <Text style={styles.headCellR}>{headRight}</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cellL}>{r.label}</Text>
              <Text style={styles.cellR}>{r.right}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TalentReportDoc(input: TalentReportDocInput) {
  const brand = input.brandPrimary || "#1c2740";
  const a = input.analytics;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.schoolName, { color: brand }]}>{input.schoolName}</Text>
            <Text style={styles.schoolMeta}>{[input.motto, input.county, input.addressLine].filter(Boolean).join(" · ")}</Text>
          </View>
          <NeyoMark color={brand} />
        </View>

        <Text style={styles.title}>Talent & Co-Curricular Participation Report</Text>
        <Text style={styles.subtitle}>{input.termLabel} · Generated {input.generatedDate}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Talent records</Text><Text style={styles.summaryValue}>{a.totals.records}</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Learners involved</Text><Text style={styles.summaryValue}>{a.totals.students}</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Talent areas</Text><Text style={styles.summaryValue}>{a.totals.areas}</Text></View>
        </View>

        <Section title="By talent area" headRight="Learners" rows={a.byArea.map((x) => ({ label: `${x.name} (${x.category})${x.avgScore != null ? ` · avg ${x.avgScore}` : ""}`, right: `${x.students}` }))} />
        <Section title="By class" headRight="Records" rows={a.byClass.map((x) => ({ label: x.label, right: `${x.records}` }))} />
        <Section title="By grade" headRight="Records" rows={a.byGrade.map((x) => ({ label: x.grade, right: `${x.records}` }))} />
        <Section title="By gender" headRight="Records" rows={a.byGender.map((x) => ({ label: x.label, right: `${x.records}` }))} />
        <Section title="By term" headRight="Records" rows={a.byTerm.map((x) => ({ label: x.label, right: `${x.records}` }))} />

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Powered by NEYO · neyo.co.ke</Text>
          <Text style={styles.footerText}>Talent & Co-Curricular Report</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderTalentReportPdf(input: TalentReportDocInput): Promise<Buffer> {
  return renderToBuffer(<TalentReportDoc {...input} />);
}
