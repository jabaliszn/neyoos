/**
 * G.13 — "Mzazi Card" A6 fee slip (one card per A6 page; batch = many pages).
 * Co-branded (G.9 brand colour + motto) and QR-verified (A.10). Feature-phone
 * families keep this slip; the QR opens a public live-balance page.
 * Printing is ALWAYS plain (never glass) — founder rule.
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

export interface MzaziCard {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  studentName: string;
  admissionNo: string;
  className: string;
  balanceKes: number;
  paybill: string | null;
  accountNo: string;
  verifyCode: string;
  qrDataUrl: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";
const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export async function renderMzaziCardsPdf(cards: MzaziCard[]): Promise<Buffer> {
  const doc = (
    <Document>
      {cards.map((c, i) => {
        const NAVY = c.brandPrimary || "#1c2740";
        const s = StyleSheet.create({
          // A6 = 105 x 148 mm
          page: { padding: 18, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
          header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 6, marginBottom: 6 },
          school: { fontSize: 13, fontFamily: "Helvetica-Bold" },
          motto: { fontSize: 7, color: GREEN, marginTop: 1, fontFamily: "Helvetica-Oblique" },
          addr: { fontSize: 6.5, color: MUTED, marginTop: 1 },
          title: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: MUTED, marginBottom: 4 },
          name: { fontSize: 12, fontFamily: "Helvetica-Bold" },
          meta: { fontSize: 8, color: MUTED, marginTop: 1, marginBottom: 6 },
          balBox: { borderWidth: 1, borderColor: "#dbe3f0", borderRadius: 6, padding: 8, marginBottom: 8 },
          balLabel: { fontSize: 7, color: MUTED },
          balValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: c.balanceKes > 0 ? "#c0392b" : GREEN },
          payRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
          payCol: {},
          payLabel: { fontSize: 6.5, color: MUTED },
          payValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
          footer: { flexDirection: "row", alignItems: "center", marginTop: 8 },
          qr: { width: 64, height: 64, marginRight: 8 },
          fnote: { fontSize: 6.5, color: MUTED, flex: 1, lineHeight: 1.35 },
          powered: { fontSize: 6, color: MUTED, textAlign: "center", marginTop: 6 },
        });
        return (
          <Page key={i} size="A6" style={s.page}>
            <View style={s.header}>
              <Text style={s.school}>{c.schoolName}</Text>
              {c.motto ? <Text style={s.motto}>{c.motto}</Text> : null}
              <Text style={s.addr}>
                {[c.addressLine, c.county].filter(Boolean).join(" · ") || "Kenya"}
              </Text>
            </View>

            <Text style={s.title}>MZAZI FEE CARD</Text>
            <Text style={s.name}>{c.studentName}</Text>
            <Text style={s.meta}>Adm No: {c.admissionNo} · {c.className}</Text>

            <View style={s.balBox}>
              <Text style={s.balLabel}>Fee balance (as printed)</Text>
              <Text style={s.balValue}>{c.balanceKes > 0 ? kes(c.balanceKes) : "Cleared"}</Text>
              <View style={s.payRow}>
                <View style={s.payCol}>
                  <Text style={s.payLabel}>M-PESA PAYBILL</Text>
                  <Text style={s.payValue}>{c.paybill ?? "— set in Settings —"}</Text>
                </View>
                <View style={s.payCol}>
                  <Text style={s.payLabel}>ACCOUNT NO.</Text>
                  <Text style={s.payValue}>{c.accountNo}</Text>
                </View>
              </View>
            </View>

            <View style={s.footer}>
              <Image style={s.qr} src={c.qrDataUrl} />
              <Text style={s.fnote}>
                Scan to check the live balance any time. Enter the parent&apos;s phone
                number on record to view it. Pay via M-Pesa using the Paybill and
                Account number above.{"\n"}Ref: {c.verifyCode}
              </Text>
            </View>

            <Text style={s.powered}>Powered by NEYO · neyo.co.ke</Text>
          </Page>
        );
      })}
    </Document>
  );
  return renderToBuffer(doc);
}
