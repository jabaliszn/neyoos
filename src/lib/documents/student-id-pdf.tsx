/**
 * G.10 Document Set — Student ID Card PDF.
 * Compact, branded (primary color, motto) and QR-verified.
 * Fits on an A7 card size (74 x 105 mm) by default, but completely customizable with physical dimensions!
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

export interface StudentIdCard {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  studentName: string;
  admissionNo: string;
  className: string;
  photoUrl: string | null;
  verifyCode: string;
  qrDataUrl: string;
  logoUrl?: string | null;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";

export async function renderStudentIdCardsPdf(
  cards: StudentIdCard[],
  opts?: { width?: number; height?: number; template?: string }
): Promise<Buffer> {
  const widthMm = opts?.width || 74;
  const heightMm = opts?.height || 105;
  const template = opts?.template || "emerald";

  // Convert mm to points (1 mm = 2.83464 points)
  const pageSize = [widthMm * 2.83464, heightMm * 2.83464] as [number, number];

  const doc = (
    <Document>
      {cards.map((c, i) => {
        const brandColor = c.brandPrimary || "#1c2740";
        
        // Define theme colors based on selected template design
        let cardBg = "#ffffff";
        let textPrimary = brandColor;
        let borderMain = brandColor;
        let badgeColor = GREEN;
        let textMuted = MUTED;

        if (template === "navy") {
          cardBg = "#121a2e"; // dark corporate navy background
          textPrimary = "#ffffff";
          borderMain = "#22354f";
          badgeColor = "#3b82f6";
          textMuted = "#94a3b8";
        } else if (template === "frost") {
          cardBg = "#f8fafc"; // soft ice/frost background
          textPrimary = "#0f172a";
          borderMain = "#38bdf8"; // bright sky blue rim
          badgeColor = "#0284c7";
          textMuted = "#64748b";
        }

        const s = StyleSheet.create({
          page: {
            padding: 10,
            fontSize: 8,
            color: textPrimary,
            fontFamily: "Helvetica",
            backgroundColor: cardBg,
          },
          cardBorder: {
            borderWidth: 1.5,
            borderColor: borderMain,
            borderRadius: 8,
            padding: 8,
            height: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: cardBg,
          },
          header: {
            borderBottomWidth: 1.2,
            borderBottomColor: borderMain,
            paddingBottom: 4,
            marginBottom: 6,
            textAlign: "center",
          },
          schoolRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            marginBottom: 2,
          },
          logo: {
            width: 14,
            height: 14,
            objectFit: "contain",
          },
          school: {
            fontSize: 9,
            fontFamily: "Helvetica-Bold",
          },
          motto: {
            fontSize: 5,
            color: badgeColor,
            marginTop: 1,
            fontFamily: "Helvetica-Oblique",
          },
          addr: {
            fontSize: 4.5,
            color: textMuted,
            marginTop: 0.5,
          },
          body: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          },
          photoCol: {
            width: 46,
            height: 54,
            borderWidth: 1,
            borderColor: template === "navy" ? "#1e293b" : "#dbe3f0",
            borderRadius: 4,
            backgroundColor: template === "navy" ? "#1e293b" : "#f7f9fc",
            justifyContent: "center",
            alignItems: "center",
          },
          photo: {
            width: "100%",
            height: "100%",
            borderRadius: 3,
          },
          initials: {
            fontSize: 12,
            fontFamily: "Helvetica-Bold",
            color: textMuted,
          },
          infoCol: {
            flex: 1,
            justifyContent: "center",
          },
          idLabel: {
            fontSize: 5,
            color: textMuted,
            letterSpacing: 0.5,
          },
          name: {
            fontSize: 8.5,
            fontFamily: "Helvetica-Bold",
            marginBottom: 2,
            color: textPrimary,
          },
          metaRow: {
            marginTop: 2,
          },
          metaText: {
            fontSize: 6,
            color: template === "navy" ? "#cbd5e1" : "#333333",
            marginBottom: 1,
          },
          bold: {
            fontFamily: "Helvetica-Bold",
          },
          footer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopWidth: 1,
            borderTopColor: template === "navy" ? "#1e293b" : "#eef2f6",
            paddingTop: 4,
            marginTop: 4,
          },
          qr: {
            width: 28,
            height: 28,
          },
          ftextCol: {
            flex: 1,
            marginLeft: 4,
          },
          badgeType: {
            fontSize: 5.5,
            fontFamily: "Helvetica-Bold",
            color: badgeColor,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          },
          verify: {
            fontSize: 4.5,
            color: textMuted,
            marginTop: 0.5,
          },
          trademark: {
            fontSize: 4,
            fontFamily: "Helvetica-Bold",
            color: textMuted,
            textTransform: "uppercase",
            opacity: 0.6,
            alignSelf: "flex-end",
          },
        });

        const initials = c.studentName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase();

        return (
          <Page key={i} size={pageSize} style={s.page}>
            <View style={s.cardBorder}>
              <View style={s.header}>
                <View style={s.schoolRow}>
                  {c.logoUrl ? (
                    <Image style={s.logo} src={c.logoUrl} />
                  ) : null}
                  <Text style={s.school}>{c.schoolName}</Text>
                </View>
                {c.motto ? <Text style={s.motto}>{c.motto}</Text> : null}
                <Text style={s.addr}>
                  {[c.addressLine, c.county].filter(Boolean).join(" · ") || "Kenya"}
                </Text>
              </View>

              <View style={s.body}>
                <View style={s.photoCol}>
                  {c.photoUrl ? (
                    <Image style={s.photo} src={c.photoUrl} />
                  ) : (
                    <Text style={s.initials}>{initials}</Text>
                  )}
                </View>

                <View style={s.infoCol}>
                  <Text style={s.idLabel}>STUDENT ID CARD</Text>
                  <Text style={s.name}>{c.studentName}</Text>
                  <View style={s.metaRow}>
                    <Text style={s.metaText}>
                      Adm No: <Text style={s.bold}>{c.admissionNo}</Text>
                    </Text>
                    <Text style={s.metaText}>
                      Class: <Text style={s.bold}>{c.className}</Text>
                    </Text>
                    <Text style={s.metaText}>
                      Status: <Text style={[s.bold, { color: badgeColor }]}>ACTIVE</Text>
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.footer}>
                <Image style={s.qr} src={c.qrDataUrl} />
                <View style={s.ftextCol}>
                  <Text style={s.badgeType}>Official Student ID</Text>
                  <Text style={s.verify}>Ref: {c.verifyCode}</Text>
                </View>
                <Text style={s.trademark}>Powered by NEYO</Text>
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
  return renderToBuffer(doc);
}
