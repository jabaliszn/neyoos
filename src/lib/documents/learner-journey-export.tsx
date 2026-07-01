import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";
import type { LearnerJourneyTimelineView } from "@/components/learner-journey/learner-journey-components";

type JourneyExportDocInput = {
  schoolName: string;
  motto?: string | null;
  county?: string | null;
  addressLine?: string | null;
  brandPrimary?: string | null;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  mode: "staff" | "parent";
  generatedDate: string;
  verifyCode: string;
  entries: LearnerJourneyTimelineView["entries"];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1c2740", backgroundColor: "#ffffff" },
  header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#d9e2ec" },
  schoolName: { fontSize: 18, fontWeight: 700 },
  schoolMeta: { marginTop: 3, fontSize: 9, color: "#52606d" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  titleBlock: { flexGrow: 1, paddingRight: 16 },
  title: { fontSize: 16, fontWeight: 700 },
  subtitle: { marginTop: 4, fontSize: 10, color: "#52606d", lineHeight: 1.45 },
  verifyBlock: { minWidth: 130, alignItems: "flex-end" },
  verifyPill: { borderWidth: 1, borderColor: "#d9e2ec", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, fontSize: 8, color: "#52606d" },
  learnerCard: { borderWidth: 1, borderColor: "#d9e2ec", borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: "#f8fafc" },
  learnerName: { fontSize: 12, fontWeight: 700 },
  learnerMeta: { marginTop: 4, fontSize: 9, color: "#52606d" },
  legendRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  legendPill: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontSize: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
  entryCard: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 10, marginBottom: 8 },
  entryTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  entryTitle: { fontSize: 10.5, fontWeight: 700, marginBottom: 3 },
  entryMeta: { fontSize: 8.5, color: "#52606d", lineHeight: 1.4 },
  entrySummary: { marginTop: 6, fontSize: 9.2, lineHeight: 1.55, color: "#243b53" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 7 },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, fontSize: 7.5 },
  footer: { position: "absolute", left: 32, right: 32, bottom: 20, borderTopWidth: 1, borderTopColor: "#d9e2ec", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 8, color: "#7b8794" },
});

function formatDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
}

function toneForSource(source: string) {
  switch (source) {
    case "EXAM": return { bg: "#dbeafe", fg: "#1d4ed8" };
    case "ASSESSMENT": return { bg: "#fef3c7", fg: "#b45309" };
    case "COMPETENCY":
    case "PORTFOLIO": return { bg: "#dcfce7", fg: "#15803d" };
    case "DISCIPLINE": return { bg: "#fee2e2", fg: "#b91c1c" };
    default: return { bg: "#e5e7eb", fg: "#334155" };
  }
}

function statusTone(status?: string | null) {
  const upper = status?.toUpperCase() ?? "";
  if (["APPROVED", "PUBLISHED", "RELEASED", "ACTIVE", "VERIFIED"].includes(upper)) return { bg: "#dcfce7", fg: "#15803d" };
  if (["PENDING", "SUBMITTED", "DRAFT", "SCORED", "MODERATED", "INTERNAL"].includes(upper)) return { bg: "#fef3c7", fg: "#b45309" };
  if (["REJECTED", "SUSPENDED", "REVERSED"].includes(upper)) return { bg: "#fee2e2", fg: "#b91c1c" };
  return { bg: "#e5e7eb", fg: "#334155" };
}

function verificationTone(status: string) {
  if (status === "VERIFIED") return { bg: "#dcfce7", fg: "#15803d" };
  if (status === "PENDING") return { bg: "#fef3c7", fg: "#b45309" };
  return { bg: "#e5e7eb", fg: "#334155" };
}

function visibilityTone(visibility: string) {
  return visibility === "PARENT_SAFE" ? { bg: "#dcfce7", fg: "#15803d" } : { bg: "#e5e7eb", fg: "#334155" };
}

function NeyoMark({ color = "#1c2740" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 64 64">
      <Rect x="8" y="8" width="48" height="48" rx="12" fill={color} />
      <Path d="M20 44V20l24 24V20" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function LearnerJourneyExportDoc(input: JourneyExportDocInput) {
  const primary = input.brandPrimary || "#1c2740";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={[styles.schoolName, { color: primary }]}>{input.schoolName}</Text>
          <Text style={styles.schoolMeta}>
            {[input.motto, input.county, input.addressLine].filter(Boolean).join(" • ") || "Education OS learner record export"}
          </Text>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Learner Journey Export</Text>
            <Text style={styles.subtitle}>
              Transfer-friendly learner timeline built from live school records. This export keeps source labels, visibility context, verification state and milestone notes so another school can understand the learner story clearly.
            </Text>
          </View>
          <View style={styles.verifyBlock}>
            <Text style={styles.verifyPill}>Verify: LJ-{input.verifyCode}</Text>
            <Text style={[styles.schoolMeta, { marginTop: 6 }]}>Generated {input.generatedDate}</Text>
          </View>
        </View>

        <View style={styles.learnerCard}>
          <Text style={styles.learnerName}>{input.studentName}</Text>
          <Text style={styles.learnerMeta}>
            Admission No: {input.admissionNo} {input.className ? `• ${input.className}` : ""} • Export mode: {input.mode === "staff" ? "Staff transfer copy" : "Family-safe transfer copy"}
          </Text>
        </View>

        <View style={styles.legendRow}>
          <Text style={[styles.legendPill, { backgroundColor: "#dbeafe", color: "#1d4ed8" }]}>Source modules preserved</Text>
          <Text style={[styles.legendPill, { backgroundColor: "#dcfce7", color: "#15803d" }]}>Parent-safe visibility marked</Text>
          <Text style={[styles.legendPill, { backgroundColor: "#fef3c7", color: "#b45309" }]}>Pending/internal states marked</Text>
        </View>

        <Text style={styles.sectionTitle}>Timeline milestones</Text>
        {input.entries.length === 0 ? (
          <View style={styles.entryCard}><Text style={styles.entrySummary}>No learner journey milestones matched this export filter.</Text></View>
        ) : input.entries.map((entry) => {
          const sourceTone = toneForSource(entry.sourceModule);
          const status = statusTone(entry.status);
          const verification = verificationTone(entry.verificationStatus);
          const visibility = visibilityTone(entry.visibility);
          return (
            <View key={entry.id} style={styles.entryCard} wrap={false}>
              <View style={styles.entryTop}>
                <View style={{ flexGrow: 1 }}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryMeta}>{formatDate(entry.date)} • {entry.sourceModule} • {entry.eventType.replaceAll("_", " ")}</Text>
                </View>
              </View>
              <Text style={styles.entrySummary}>{entry.summary}</Text>
              <View style={styles.badgeRow}>
                <Text style={[styles.badge, { backgroundColor: sourceTone.bg, color: sourceTone.fg }]}>{entry.sourceModule}</Text>
                <Text style={[styles.badge, { backgroundColor: verification.bg, color: verification.fg }]}>{entry.verificationStatus}</Text>
                <Text style={[styles.badge, { backgroundColor: visibility.bg, color: visibility.fg }]}>{entry.visibility === "PARENT_SAFE" ? "Family safe" : "Staff only"}</Text>
                {entry.status ? <Text style={[styles.badge, { backgroundColor: status.bg, color: status.fg }]}>{entry.status}</Text> : null}
                {entry.pinned ? <Text style={[styles.badge, { backgroundColor: "#fef3c7", color: "#92400e" }]}>Pinned milestone</Text> : null}
                {entry.pinNote ? <Text style={[styles.badge, { backgroundColor: "#fff7ed", color: "#9a3412" }]}>Pinned note kept</Text> : null}
              </View>
              {entry.pinNote ? <Text style={[styles.entryMeta, { marginTop: 6 }]}>Pinned note: {entry.pinNote}</Text> : null}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <NeyoMark color={primary} />
            <Text style={styles.footerText}>Powered by NEYO · neyo.co.ke</Text>
          </View>
          <Text style={styles.footerText}>Transfer-friendly learner journey export</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderLearnerJourneyExportPdf(input: JourneyExportDocInput) {
  return renderToBuffer(<LearnerJourneyExportDoc {...input} />);
}
