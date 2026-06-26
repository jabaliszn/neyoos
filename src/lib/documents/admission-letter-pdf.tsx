/**
 * Admission / offer letter PDF (B.2.7 + G.10 doc set #2).
 * Co-branded (G.9 motto + brand colour), QR-verified (A.10), and includes the
 * school's joining-requirements list so parents know what to bring on day one.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface AdmissionLetterData {
  schoolName: string;
  county: string | null;
  motto: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  applicantName: string;
  applicationNo: string;
  gradeOffered: string;
  curriculum: string | null;
  guardianName: string;
  admitted: boolean;
  depositRequiredKes: number;
  requirements: { label: string; category: string; quantity?: number }[];
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedByName: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderAdmissionLetterPdf(d: AdmissionLetterData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const s = StyleSheet.create({
    page: { padding: 48, fontSize: 11, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.5 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 12, marginBottom: 6 },
    school: { fontSize: 17, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 9, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 9, color: MUTED, marginTop: 2 },
    refRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 16 },
    refText: { fontSize: 9, color: MUTED },
    title: { fontSize: 13, fontFamily: "Helvetica-Bold", textDecoration: "underline", marginBottom: 12, textAlign: "center" },
    p: { marginBottom: 9 },
    bold: { fontFamily: "Helvetica-Bold" },
    box: { marginTop: 4, marginBottom: 10, borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 4, padding: 10 },
    reqTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    reqItem: { fontSize: 9, color: "#33415c", marginBottom: 2 },
    deposit: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GREEN },
    footer: { position: "absolute", bottom: 40, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 12 },
    signLine: { marginTop: 24, borderTopWidth: 1, borderTopColor: NAVY, width: 160, paddingTop: 4, fontSize: 9, color: MUTED },
    qrBox: { alignItems: "center" },
    qrText: { fontSize: 7, color: MUTED, marginTop: 2, width: 110, textAlign: "center" },
  });

  const doc = (
    <Document title={`Admission letter ${d.letterNo}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 24, height: 24, objectFit: "contain", marginBottom: 3 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          <Text style={s.sub}>{[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}</Text>
        </View>

        <View style={s.refRow}>
          <Text style={s.refText}>Ref: {d.letterNo} · Application: {d.applicationNo}</Text>
          <Text style={s.refText}>Date: {d.issuedDate}</Text>
        </View>

        <Text style={s.title}>{d.admitted ? "LETTER OF ADMISSION" : "OFFER OF ADMISSION"}</Text>

        <Text style={s.p}>Dear {d.guardianName},</Text>
        <Text style={s.p}>
          We are pleased to {d.admitted ? "confirm the admission of" : "offer a place to"}{" "}
          <Text style={s.bold}>{d.applicantName}</Text> in{" "}
          <Text style={s.bold}>{d.gradeOffered}</Text>
          {d.curriculum ? ` (${d.curriculum})` : ""} at {d.schoolName}.
        </Text>

        {!d.admitted && d.depositRequiredKes > 0 ? (
          <Text style={s.p}>
            To secure this place, a commitment deposit of{" "}
            <Text style={s.deposit}>KES {d.depositRequiredKes.toLocaleString("en-KE")}</Text> is payable at the school
            office or via the school&apos;s M-Pesa Paybill, quoting the application number above.
          </Text>
        ) : null}

        {d.requirements.length > 0 ? (
          <View style={s.box}>
            <Text style={s.reqTitle}>What to bring on the first day</Text>
            {d.requirements.map((r, i) => (
              <Text key={i} style={s.reqItem}>
                •  {r.label}{r.quantity ? `  ×${r.quantity}` : ""}  ({r.category})
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={s.p}>
          We look forward to welcoming {d.applicantName.split(" ")[0]} to our school community.
        </Text>

        <View style={s.footer}>
          <View>
            <Text style={{ fontSize: 10 }}>{d.issuedByName}</Text>
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
