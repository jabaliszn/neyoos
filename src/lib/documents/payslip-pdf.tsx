/**
 * Payslip PDF (B.8.2 + G.10 doc set #6). Co-branded, QR-verified.
 * Shows the full KE statutory breakdown: PAYE, SHIF, NSSF, Housing Levy.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface PayslipPdfData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  period: string;
  staffName: string;
  role: string;
  basicKes: number;
  allowancesKes: number;
  overtimeKes: number;
  grossKes: number;
  payeKes: number;
  shifKes: number;
  nssfKes: number;
  housingLevyKes: number;
  saccoKes: number;
  loanKes: number;
  netKes: number;
  letterNo: string;
  verifyCode: string;
  qrDataUrl: string;
  issuedDate: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderPayslipPdf(d: PayslipPdfData): Promise<Buffer> {
  const NAVY = d.brandPrimary || "#1c2740";
  const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
  const s = StyleSheet.create({
    page: { padding: 46, fontSize: 10, color: NAVY, fontFamily: "Helvetica", lineHeight: 1.5 },
    header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 10, marginBottom: 12 },
    school: { fontSize: 15, fontFamily: "Helvetica-Bold" },
    motto: { fontSize: 8, color: GREEN, marginTop: 2, fontFamily: "Helvetica-Oblique" },
    title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 10 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, backgroundColor: "#f6f8fc", borderRadius: 4, padding: 8 },
    metaLabel: { color: MUTED, fontSize: 7 },
    metaValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    section: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#eef2f9" },
    net: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, backgroundColor: "#e9f7f0", borderRadius: 4, padding: 10 },
    netText: { fontSize: 13, fontFamily: "Helvetica-Bold", color: GREEN },
    footer: { position: "absolute", bottom: 38, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#dbe3f0", paddingTop: 10 },
    qrText: { fontSize: 6.5, color: MUTED, marginTop: 2, width: 100, textAlign: "center" },
  });

  const doc = (
    <Document title={`Payslip ${d.period} — ${d.staffName}`} author={d.schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {d.logoUrl ? <Image src={d.logoUrl} style={{ width: 24, height: 24, objectFit: "contain", marginBottom: 3 }} /> : null}
          <Text style={s.school}>{d.schoolName}</Text>
          {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
        </View>
        <Text style={s.title}>PAYSLIP — {d.period}</Text>
        <View style={s.metaRow}>
          <View><Text style={s.metaLabel}>EMPLOYEE</Text><Text style={s.metaValue}>{d.staffName}</Text></View>
          <View><Text style={s.metaLabel}>POSITION</Text><Text style={s.metaValue}>{d.role.replaceAll("_", " ")}</Text></View>
          <View><Text style={s.metaLabel}>PERIOD</Text><Text style={s.metaValue}>{d.period}</Text></View>
        </View>

        <Text style={s.section}>EARNINGS</Text>
        <View style={s.row}><Text>Basic salary</Text><Text>{kes(d.basicKes)}</Text></View>
        {d.allowancesKes > 0 ? <View style={s.row}><Text>Allowances (house / transport / other)</Text><Text>{kes(d.allowancesKes)}</Text></View> : null}
        {d.overtimeKes > 0 ? <View style={s.row}><Text>Overtime (approved)</Text><Text>{kes(d.overtimeKes)}</Text></View> : null}
        <View style={s.row}><Text style={{ fontFamily: "Helvetica-Bold" }}>Gross pay</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{kes(d.grossKes)}</Text></View>

        <Text style={s.section}>STATUTORY DEDUCTIONS</Text>
        <View style={s.row}><Text>PAYE (income tax)</Text><Text>-{kes(d.payeKes)}</Text></View>
        <View style={s.row}><Text>SHIF (SHA, 2.75%)</Text><Text>-{kes(d.shifKes)}</Text></View>
        <View style={s.row}><Text>NSSF (Tier I + II)</Text><Text>-{kes(d.nssfKes)}</Text></View>
        <View style={s.row}><Text>Affordable Housing Levy (1.5%)</Text><Text>-{kes(d.housingLevyKes)}</Text></View>

        {(d.saccoKes > 0 || d.loanKes > 0) ? <Text style={s.section}>OTHER DEDUCTIONS</Text> : null}
        {d.saccoKes > 0 ? <View style={s.row}><Text>SACCO contribution</Text><Text>-{kes(d.saccoKes)}</Text></View> : null}
        {d.loanKes > 0 ? <View style={s.row}><Text>Loan repayment</Text><Text>-{kes(d.loanKes)}</Text></View> : null}

        <View style={s.net}>
          <Text style={s.netText}>NET PAY</Text>
          <Text style={s.netText}>{kes(d.netKes)}</Text>
        </View>

        <View style={s.footer}>
          <Text style={{ fontSize: 8 }}>Ref {d.letterNo} · Issued {d.issuedDate} · Confidential</Text>
          <View style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={d.qrDataUrl} style={{ width: 52, height: 52 }} />
            <Text style={s.qrText}>Scan to verify · {d.verifyCode}</Text>
          </View>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Powered by NEYO · neyo.co.ke</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
