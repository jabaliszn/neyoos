/**
 * Payment receipt PDF (Feature A.10). Co-branded header + QR verification.
 * Rendered server-side with @react-pdf/renderer.
 * Overhauled to support full G.9 brand primary colors, motto, and logo.
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

export interface ReceiptData {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoDataUrl: string | null; // school logo (data URI)
  receiptNo: string;
  date: string;
  payerName: string;
  phone: string;
  amountKes: number;
  description: string;
  mpesaRef: string | null;
  verifyCode: string;
  qrDataUrl: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

function ReceiptDoc({ d }: { d: ReceiptData }) {
  const NAVY = d.brandPrimary || "#1c2740";

  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 11, color: NAVY, fontFamily: "Helvetica" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: NAVY,
      paddingBottom: 12,
      marginBottom: 20,
    },
    logoAndText: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 6,
    },
    school: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
    motto: { fontSize: 8.5, color: GREEN, marginTop: 1, fontFamily: "Helvetica-Oblique" },
    sub: { fontSize: 9, color: MUTED, marginTop: 1 },
    badge: { fontSize: 9, color: GREEN, fontFamily: "Helvetica-Bold" },
    title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 14, color: NAVY },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e4e9f1",
    },
    label: { color: MUTED },
    value: { fontFamily: "Helvetica-Bold", color: "#111" },
    amountBox: {
      marginTop: 16,
      padding: 14,
      backgroundColor: "#eefbf3",
      borderRadius: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    amount: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN },
    footer: {
      marginTop: 26,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    qr: { width: 90, height: 90 },
    fineprint: { fontSize: 8, color: MUTED, maxWidth: 340, lineHeight: 1.4 },
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.logoAndText}>
            {d.logoDataUrl ? (
              <Image style={s.logo} src={d.logoDataUrl} />
            ) : null}
            <View>
              <Text style={s.school}>{d.schoolName}</Text>
              {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
              <Text style={s.sub}>
                {[d.addressLine, d.county ? `${d.county} County` : null].filter(Boolean).join(" · ") || "Kenya"}
              </Text>
            </View>
          </View>
          <Text style={s.badge}>OFFICIAL RECEIPT</Text>
        </View>

        <Text style={s.title}>Payment Receipt</Text>

        <View style={s.row}>
          <Text style={s.label}>Receipt No.</Text>
          <Text style={s.value}>{d.receiptNo}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Date</Text>
          <Text style={s.value}>{d.date}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Received from</Text>
          <Text style={s.value}>{d.payerName}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Phone</Text>
          <Text style={s.value}>{d.phone}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>For</Text>
          <Text style={s.value}>{d.description}</Text>
        </View>
        {d.mpesaRef ? (
          <View style={s.row}>
            <Text style={s.label}>M-Pesa Ref</Text>
            <Text style={s.value}>{d.mpesaRef}</Text>
          </View>
        ) : null}

        <View style={s.amountBox}>
          <Text style={{ color: MUTED }}>Amount paid</Text>
          <Text style={s.amount}>
            KES {d.amountKes.toLocaleString("en-KE")}
          </Text>
        </View>

        <View style={s.footer}>
          <Text style={s.fineprint}>
            Scan the QR code to verify this receipt at neyo.co.ke/verify/
            {d.verifyCode}. This is a computer-generated receipt and is valid
            without a signature.
          </Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <View style={{ alignItems: "center" }}><Image style={s.qr} src={d.qrDataUrl} /><Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Powered by NEYO · neyo.co.ke</Text></View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(d: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDoc d={d} />);
}
