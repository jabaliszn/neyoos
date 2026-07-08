/**
 * R.6 — the printable "Form 4 trip"-style ad-hoc fee-collection report.
 * One real, printable roster of every real student on an activity — split
 * into two clearly separate sections per the founder's own explicit request
 * ("make it easy to know the ones who are going and those who aren't...
 * those who haven't paid not to be in the final list... or at the last
 * section"): a GOING section up top (Paid — cleared / Going — balance
 * owed), and a visually distinct, greyed-out NOT GOING section at the very
 * bottom — exactly what a class teacher hands to the driver/gate on the day,
 * so nobody has to scan a mixed list to know who's actually going.
 */
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface RosterRow {
  studentName: string;
  admissionNo: string;
  className: string;
  status: string; // NOT_PAID | PAID | WAIVED
  balanceKes: number;
}

interface Input {
  tenant: { name: string; county: string | null; addressLine: string | null; motto: string | null; brandPrimary: string | null };
  activity: { name: string; description: string | null; amountKes: number; year: number; term: number; eventDate: string | null };
  rows: RosterRow[];
  generatedAt: string;
  generatedByName: string;
}

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1c2740" },
  header: { marginBottom: 10, borderBottomWidth: 2, borderBottomColor: "#1c2740", paddingBottom: 8 },
  school: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 8, color: "#5b6475", marginTop: 2 },
  title: { fontSize: 13, fontWeight: 700, marginTop: 6 },
  meta: { fontSize: 8, color: "#5b6475", marginTop: 2 },
  summaryRow: { flexDirection: "row", marginTop: 10, marginBottom: 8, gap: 10 },
  summaryBox: { flex: 1, borderWidth: 1, borderColor: "#d7deea", borderRadius: 6, padding: 6 },
  summaryLabel: { fontSize: 7, color: "#5b6475" },
  summaryValue: { fontSize: 12, fontWeight: 700 },

  sectionHeading: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: 700 },
  sectionCount: { fontSize: 8, color: "#5b6475", marginLeft: 6 },

  table: { borderWidth: 1, borderColor: "#d7deea", borderRadius: 6 },
  tHead: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6 },
  tHeadCell: { color: "#fff", fontSize: 8, fontWeight: 700 },
  tRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#eef1f7" },
  tRowMuted: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#e4e7ee", backgroundColor: "#f7f8fb" },

  cName: { width: "30%" },
  cAdm: { width: "18%" },
  cClass: { width: "18%" },
  cStatus: { width: "20%" },
  cBalance: { width: "14%", textAlign: "right" },

  cNameMuted: { width: "48%", color: "#8a94ab" },
  cAdmMuted: { width: "26%", color: "#8a94ab" },
  cClassMuted: { width: "26%", color: "#8a94ab" },

  emptyNote: { fontSize: 8, color: "#8a94ab", fontStyle: "italic", padding: 8, textAlign: "center" },

  footer: { position: "absolute", left: 28, right: 28, bottom: 16, borderTopWidth: 1, borderTopColor: "#d7deea", paddingTop: 6, fontSize: 7, color: "#5b6475", textAlign: "center" },
});

export async function renderActivityRosterPdf(input: Input): Promise<Buffer> {
  const brand = input.tenant.brandPrimary || "#1c2740";

  // GOING = confirmed to actually go (paid in full, or a real owed balance
  // was explicitly recorded because the parent asked for them to go and
  // pay later). NOT GOING = still just sitting on the roster, unpaid, no
  // waiver — the founder's own rule that these students should never be
  // mixed in with who's actually going.
  const paidRows = input.rows.filter((r) => r.status === "PAID");
  const waivedRows = input.rows.filter((r) => r.status === "WAIVED");
  const goingRows = [...paidRows, ...waivedRows]; // paid first, then owing
  const notGoingRows = input.rows.filter((r) => r.status === "NOT_PAID");

  const collected = paidRows.length * input.activity.amountKes;
  const outstanding = waivedRows.reduce((s, r) => s + r.balanceKes, 0);

  const doc = (
    <Document title={`${input.activity.name} — Roster`} author={input.tenant.name}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: brand }]}>
          <Text style={[styles.school, { color: brand }]}>{input.tenant.name}</Text>
          <Text style={styles.sub}>{[input.tenant.motto, input.tenant.county, input.tenant.addressLine].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.title}>{input.activity.name}</Text>
          <Text style={styles.meta}>
            Term {input.activity.term} {input.activity.year}{input.activity.eventDate ? ` · Event date: ${input.activity.eventDate}` : ""} · Per-student amount: {kes(input.activity.amountKes)}
          </Text>
          {input.activity.description ? <Text style={styles.meta}>{input.activity.description}</Text> : null}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Going</Text><Text style={[styles.summaryValue, { color: brand }]}>{goingRows.length}</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Paid — cleared</Text><Text style={[styles.summaryValue, { color: "#1f9d5f" }]}>{paidRows.length}</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Going — balance owed</Text><Text style={[styles.summaryValue, { color: "#c9862b" }]}>{waivedRows.length}</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Collected</Text><Text style={[styles.summaryValue, { color: "#1f9d5f" }]}>{kes(collected)}</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Outstanding</Text><Text style={[styles.summaryValue, { color: "#d23b3b" }]}>{kes(outstanding)}</Text></View>
        </View>

        {/* ---- SECTION 1: GOING — the real, actionable list for the day ---- */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: brand }]}>✓ GOING</Text>
          <Text style={styles.sectionCount}>{goingRows.length} learner{goingRows.length === 1 ? "" : "s"}</Text>
        </View>
        <View style={styles.table}>
          <View style={[styles.tHead, { backgroundColor: brand }]}>
            <Text style={[styles.tHeadCell, styles.cName]}>Learner</Text>
            <Text style={[styles.tHeadCell, styles.cAdm]}>Adm. No.</Text>
            <Text style={[styles.tHeadCell, styles.cClass]}>Class</Text>
            <Text style={[styles.tHeadCell, styles.cStatus]}>Status</Text>
            <Text style={[styles.tHeadCell, styles.cBalance]}>Balance</Text>
          </View>
          {goingRows.length === 0 ? (
            <Text style={styles.emptyNote}>Nobody has paid or been confirmed going yet.</Text>
          ) : (
            goingRows.map((r, i) => (
              <View key={i} style={styles.tRow} wrap={false}>
                <Text style={styles.cName}>{r.studentName}</Text>
                <Text style={styles.cAdm}>{r.admissionNo}</Text>
                <Text style={styles.cClass}>{r.className}</Text>
                <Text style={[styles.cStatus, { color: r.status === "PAID" ? "#1f9d5f" : "#c9862b", fontWeight: 700 }]}>
                  {r.status === "PAID" ? "Paid — cleared" : "Owes balance"}
                </Text>
                <Text style={styles.cBalance}>{r.balanceKes > 0 ? kes(r.balanceKes) : "—"}</Text>
              </View>
            ))
          )}
        </View>

        {/* ---- SECTION 2: NOT GOING — kept clearly separate, greyed out,
             at the very bottom, per the founder's explicit request ---- */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: "#8a94ab" }]}>✕ NOT GOING (unpaid, no balance)</Text>
          <Text style={styles.sectionCount}>{notGoingRows.length} learner{notGoingRows.length === 1 ? "" : "s"}</Text>
        </View>
        <View style={[styles.table, { borderColor: "#e4e7ee" }]}>
          <View style={[styles.tHead, { backgroundColor: "#c3c9d6" }]}>
            <Text style={[styles.tHeadCell, styles.cNameMuted, { color: "#fff" }]}>Learner</Text>
            <Text style={[styles.tHeadCell, styles.cAdmMuted, { color: "#fff" }]}>Adm. No.</Text>
            <Text style={[styles.tHeadCell, styles.cClassMuted, { color: "#fff" }]}>Class</Text>
          </View>
          {notGoingRows.length === 0 ? (
            <Text style={styles.emptyNote}>Everyone on the roster is going.</Text>
          ) : (
            notGoingRows.map((r, i) => (
              <View key={i} style={styles.tRowMuted} wrap={false}>
                <Text style={styles.cNameMuted}>{r.studentName}</Text>
                <Text style={styles.cAdmMuted}>{r.admissionNo}</Text>
                <Text style={styles.cClassMuted}>{r.className}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>Generated by {input.generatedByName} · {input.generatedAt} · Powered by NEYO · neyo.co.ke</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
