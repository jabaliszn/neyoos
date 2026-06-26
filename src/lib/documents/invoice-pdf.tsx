/**
 * Fee invoice / payment-status PDF (B.7+ founder requests, G.10 doc set #5).
 * FOUNDER UPGRADES 2026-06-12:
 * - A5 size ("rather than wasting a full A4")
 * - school LOGO in the header
 * - "Powered by NEYO" footer
 * - G.25 DIGITAL SCHOOL STAMP (auto-generated, no physical stamp needed)
 * Doubles as PROOF OF PAYMENT when status is PAID. QR-verified; shows print
 * count ("Copy #3") so reprints are visibly tracked.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { SchoolStamp, type StampData } from "@/lib/documents/school-stamp";

export interface InvoicePdfData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoDataUrl: string | null; // school logo (data URI)
  invoiceNo: string;
  description: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  guardianName: string | null;
  totalKes: number;
  discountKes: number;
  discountReason: string | null;
  paidKes: number;
  balanceKes: number;
  status: string;
  dueDate: string;
  payments: { date: string; amountKes: number; ref: string | null; method: string }[];
  copyNumber: number;
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
  issuedByName: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";
const RED = "#d23b3b";

export async function renderInvoicePdf(d: InvoicePdfData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
  // A5 = compact: tighter paddings + smaller type than the old A4 layout.
  const s = StyleSheet.create({
    page: { padding: 26, fontSize: 8.5, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.4 },
    header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 9 },
    school: { fontSize: 12.5, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 7, color: GREEN, marginTop: 1.5, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 6.5, color: MUTED, marginTop: 1.5 },
    stamp: { alignSelf: "flex-start", borderWidth: 1.5, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3, transform: "rotate(-4deg)" },
    title: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, backgroundColor: "#f6f8fc", borderRadius: 3, padding: 6 },
    metaLabel: { color: MUTED, fontSize: 6 },
    metaValue: { fontFamily: "Helvetica-Bold", fontSize: 8 },
    table: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 3, marginBottom: 8 },
    row: { flexDirection: "row", justifyContent: "space-between", padding: 5.5, borderBottomWidth: 1, borderBottomColor: "#eef2f9" },
    rowLast: { flexDirection: "row", justifyContent: "space-between", padding: 5.5 },
    big: { fontSize: 10, fontFamily: "Helvetica-Bold" },
    payHead: { fontSize: 7, color: MUTED, fontFamily: "Helvetica-Bold", marginBottom: 2.5 },
    payRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: "#eef2f9" },
    footer: { position: "absolute", bottom: 20, left: 26, right: 26, borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 7 },
    footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    copyText: { fontSize: 6, color: MUTED },
    qrText: { fontSize: 5.5, color: MUTED, marginTop: 1.5, width: 80, textAlign: "center" },
    poweredBy: { fontSize: 6.5, color: MUTED, textAlign: "center", marginTop: 5 },
  });

  const paidInFull = d.status === "PAID";
  const stampData: StampData = {
    schoolName: d.schoolName,
    county: d.county,
    addressLine: d.addressLine,
    logoDataUrl: d.logoDataUrl,
    dateText: d.issuedDate.toUpperCase(),
  };

  const doc = (
    <Document title={`Invoice ${d.invoiceNo}`} author={d.schoolName}>
      <Page size="A5" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
            {d.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={d.logoDataUrl} style={{ width: 30, height: 30, borderRadius: 4 }} />
            ) : null}
            <View>
              <Text style={s.school}>{d.schoolName}</Text>
              {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
              <Text style={s.sub}>{[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}</Text>
            </View>
          </View>
          <View style={[s.stamp, { borderColor: paidInFull ? GREEN : d.balanceKes > 0 ? RED : NAVY }]}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: paidInFull ? GREEN : d.balanceKes > 0 ? RED : NAVY }}>
              {paidInFull ? "PAID IN FULL" : d.paidKes > 0 ? "PARTIALLY PAID" : "UNPAID"}
            </Text>
          </View>
        </View>

        <Text style={s.title}>FEE INVOICE — {d.invoiceNo}</Text>

        <View style={s.metaRow}>
          <View><Text style={s.metaLabel}>LEARNER</Text><Text style={s.metaValue}>{d.studentName}</Text></View>
          <View><Text style={s.metaLabel}>ADM NO</Text><Text style={s.metaValue}>{d.admissionNo}</Text></View>
          <View><Text style={s.metaLabel}>CLASS</Text><Text style={s.metaValue}>{d.className ?? "—"}</Text></View>
          <View><Text style={s.metaLabel}>DUE DATE</Text><Text style={s.metaValue}>{d.dueDate}</Text></View>
        </View>

        <View style={s.table}>
          <View style={s.row}><Text>{d.description}</Text><Text>{kes(d.totalKes)}</Text></View>
          {d.discountKes > 0 ? (
            <View style={s.row}>
              <Text style={{ color: GREEN }}>Less: {d.discountReason ?? "Discount / bursary"}</Text>
              <Text style={{ color: GREEN }}>-{kes(d.discountKes)}</Text>
            </View>
          ) : null}
          <View style={s.row}><Text>Amount paid</Text><Text style={{ color: GREEN }}>{kes(d.paidKes)}</Text></View>
          <View style={s.rowLast}>
            <Text style={s.big}>Balance due</Text>
            <Text style={[s.big, { color: d.balanceKes > 0 ? RED : GREEN }]}>{kes(d.balanceKes)}</Text>
          </View>
        </View>

        {d.payments.length > 0 ? (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.payHead}>PAYMENTS RECEIVED</Text>
            {d.payments.slice(0, 4).map((p, i) => (
              <View key={i} style={s.payRow}>
                <Text>{p.date} · {p.method}{p.ref ? ` · ${p.ref}` : ""}</Text>
                <Text>{kes(p.amountKes)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {d.guardianName ? <Text style={{ fontSize: 7.5, color: MUTED }}>Guardian: {d.guardianName}</Text> : null}

        {/* G.25 digital rubber stamp — rectangle, blue frame, red date band */}
        <View style={{ position: "absolute", right: 96, bottom: 84 }}>
          <SchoolStamp d={stampData} width={170} />
        </View>

        <View style={s.footer}>
          <View style={s.footerRow}>
            <View>
              <Text style={{ fontSize: 7.5 }}>Issued {d.issuedDate} by {d.issuedByName}</Text>
              <Text style={s.copyText}>Ref {d.letterNo} · Copy #{d.copyNumber} — every print is tracked</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={d.qrDataUrl} style={{ width: 42, height: 42 }} />
              <Text style={s.qrText}>Scan to verify · {d.verifyCode}</Text>
            </View>
          </View>
          <Text style={s.poweredBy}>Powered by NEYO · neyo.co.ke</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
