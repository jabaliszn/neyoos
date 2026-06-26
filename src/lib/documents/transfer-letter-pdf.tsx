/**
 * Transfer / leaving letter PDF (B.1 transfers + G.10 doc set).
 * Co-branded with the school profile (G.9: motto + brand colour) and
 * QR-verified (A.10) so the receiving school can confirm it's genuine.
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

export interface TransferLetterData {
  schoolName: string;
  county: string | null;
  motto: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  // student
  studentName: string;
  admissionNo: string;
  gender: string;
  dateOfBirth: string | null;
  className: string | null;
  upiNumber: string | null;
  admittedOn: string;
  // transfer
  destinationSchool: string;
  destinationCounty: string | null;
  transferDate: string;
  reason: string;
  // verification
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedByName: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderTransferLetterPdf(d: TransferLetterData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const s = StyleSheet.create({
    page: { padding: 48, fontSize: 11, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.5 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 12, marginBottom: 6 },
    school: { fontSize: 17, fontFamily: "Helvetica-Bold" },
    sub: { fontSize: 9, color: MUTED, marginTop: 2 },
    refRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 18 },
    refText: { fontSize: 9, color: MUTED },
    title: { fontSize: 13, fontFamily: "Helvetica-Bold", textDecoration: "underline", marginBottom: 14, textAlign: "center" },
    p: { marginBottom: 10 },
    bold: { fontFamily: "Helvetica-Bold" },
    table: { marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4 },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dbe3f0" },
    trLast: { flexDirection: "row" },
    th: { width: "38%", padding: 6, fontSize: 9, color: MUTED, backgroundColor: "#f6f8fc" },
    td: { width: "62%", padding: 6, fontSize: 10, fontFamily: "Helvetica-Bold" },
    footer: { position: "absolute", bottom: 40, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 12 },
    sign: { fontSize: 10 },
    signLine: { marginTop: 26, borderTopWidth: 1, borderTopColor: NAVY, width: 160, paddingTop: 4, fontSize: 9, color: MUTED },
    qrBox: { alignItems: "center" },
    qrText: { fontSize: 7, color: MUTED, marginTop: 2, width: 110, textAlign: "center" },
  });

  const rows: [string, string][] = [
    ["Full name", d.studentName],
    ["Admission number", d.admissionNo],
    ["Gender", d.gender === "M" ? "Male" : "Female"],
    ["Date of birth", d.dateOfBirth ?? "—"],
    ["Class at departure", d.className ?? "—"],
    ["UPI / NEMIS number", d.upiNumber ?? "—"],
    ["Date admitted", d.admittedOn],
    ["Transfer effective", d.transferDate],
    ["Destination school", d.destinationSchool + (d.destinationCounty ? `, ${d.destinationCounty}` : "")],
  ];

  const doc = (
    <Document title={`Transfer letter ${d.letterNo}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 24, height: 24, objectFit: "contain", marginBottom: 3 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={{ fontSize: 9, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" }}>{d.motto}</Text> : null}
          <Text style={s.sub}>
            {[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}
          </Text>
        </View>

        <View style={s.refRow}>
          <Text style={s.refText}>Ref: {d.letterNo}</Text>
          <Text style={s.refText}>Date: {d.issuedDate}</Text>
        </View>

        <Text style={s.title}>SCHOOL LEAVING / TRANSFER LETTER</Text>

        <Text style={s.p}>To Whom It May Concern,</Text>
        <Text style={s.p}>
          This is to certify that the learner whose particulars appear below was a student of{" "}
          <Text style={s.bold}>{d.schoolName}</Text> and has been released to transfer to{" "}
          <Text style={s.bold}>{d.destinationSchool}</Text> with effect from{" "}
          <Text style={s.bold}>{d.transferDate}</Text>.
        </Text>

        <View style={s.table}>
          {rows.map(([k, v], i) => (
            <View key={k} style={i === rows.length - 1 ? s.trLast : s.tr}>
              <Text style={s.th}>{k}</Text>
              <Text style={s.td}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={s.p}>
          During their stay, the learner&apos;s conduct and records are available from the school
          on request by the receiving institution. We wish them success in their continued education.
        </Text>

        <View style={s.footer}>
          <View style={s.sign}>
            <Text>{d.issuedByName}</Text>
            <Text style={s.signLine}>Principal / Head of Institution</Text>
          </View>
          <View style={s.qrBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={d.qrDataUrl} style={{ width: 64, height: 64 }} />
            <Text style={s.qrText}>Scan to verify · code {d.verifyCode}</Text>
          </View>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Powered by NEYO · neyo.co.ke</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
