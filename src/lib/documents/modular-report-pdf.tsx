import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type ModularReportSection = {
  type: string;
  title: string;
  items?: string[];
  rows?: string[];
};

type Input = {
  schoolName: string;
  motto?: string | null;
  county?: string | null;
  addressLine?: string | null;
  brandPrimary: string;
  documentTemplate: "classic" | "modern" | "compact";
  poweredByNeyo: boolean;
  reportTitle: string;
  description?: string | null;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
  sections: ModularReportSection[];
};

function theme(documentTemplate: Input["documentTemplate"], brand: string) {
  if (documentTemplate === "classic") {
    return { bg: "#ffffff", card: "#ffffff", line: "#cbd5e1", muted: "#64748b", brand };
  }
  if (documentTemplate === "compact") {
    return { bg: "#f8fafc", card: "#f8fafc", line: "#dbe2ea", muted: "#52606d", brand };
  }
  return { bg: "#f6f8fc", card: "#ffffff", line: "#d7deea", muted: "#5b6475", brand };
}

export async function renderModularReportPdf(input: Input): Promise<Buffer> {
  const t = theme(input.documentTemplate, input.brandPrimary || "#1c2740");
  const styles = StyleSheet.create({
    page: { padding: input.documentTemplate === "compact" ? 24 : 34, fontSize: 10, fontFamily: "Helvetica", color: "#1c2740", backgroundColor: t.bg },
    header: { marginBottom: 12, borderBottomWidth: 2, borderBottomColor: t.brand, paddingBottom: 10 },
    school: { fontSize: 18, fontWeight: 700, color: t.brand },
    meta: { fontSize: 8.5, color: t.muted, marginTop: 2 },
    title: { fontSize: 14, fontWeight: 700, marginTop: 8, marginBottom: 4 },
    subtitle: { fontSize: 9, color: t.muted },
    learner: { marginTop: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 10, padding: 10 },
    learnerLine: { fontSize: 9.5, marginBottom: 3 },
    section: { marginTop: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 10, padding: 10 },
    sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
    row: { fontSize: 9, marginBottom: 3, color: "#243b53" },
    item: { fontSize: 9, marginBottom: 4 },
    footer: { position: "absolute", left: 34, right: 34, bottom: 22, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    footerText: { fontSize: 7.5, color: t.muted },
  });

  const doc = (
    <Document title={input.reportTitle} author={input.schoolName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.school}>{input.schoolName}</Text>
          <Text style={styles.meta}>{[input.motto, input.county, input.addressLine].filter(Boolean).join(" · ") || "Kenya"}</Text>
          <Text style={styles.title}>{input.reportTitle}</Text>
          {input.description ? <Text style={styles.subtitle}>{input.description}</Text> : null}
        </View>

        <View style={styles.learner}>
          <Text style={styles.learnerLine}>Learner: {input.studentName}</Text>
          <Text style={styles.learnerLine}>Admission no.: {input.admissionNo}</Text>
          <Text style={styles.learnerLine}>Class: {input.className || "Unassigned"}</Text>
          <Text style={styles.learnerLine}>Issued: {input.issuedDate}</Text>
        </View>

        {input.sections.map((section, index) => (
          <View key={`${section.type}-${index}`} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {(section.items || []).map((item, i) => <Text key={i} style={styles.item}>{item}</Text>)}
            {(section.rows || []).map((row, i) => <Text key={i} style={styles.row}>• {row}</Text>)}
            {(!section.items || section.items.length === 0) && (!section.rows || section.rows.length === 0) ? <Text style={styles.row}>No data in this section yet.</Text> : null}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerText}>Verify: {input.verifyCode}</Text>
            <Text style={styles.footerText}>Template-driven modular report</Text>
          </View>
          <Image src={input.qrDataUrl} style={{ width: 48, height: 48 }} />
          <Text style={styles.footerText}>{input.poweredByNeyo ? "Powered by NEYO · neyo.co.ke" : "School document"}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
