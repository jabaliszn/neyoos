/**
 * G.10 / N.1 Document Set — Student ID Card PDF.
 * Compact, branded (primary color, motto) and QR-verified.
 *
 * TWO layouts:
 *  - "single"   — one card per PDF page, page sized exactly to the card
 *                 (unchanged legacy behavior, still used for single-student
 *                 downloads and any custom physical card-printer workflow).
 *  - "batch-a4" — N.1: a DENSE grid of cards packed onto real A4 sheets with
 *                 dashed cut-lines between them, so a school can print a
 *                 whole class/stream on ordinary paper and cut the cards
 *                 apart with scissors/paper cutter — no card-sized paper
 *                 stock required. The grid auto-fits as many cards as
 *                 physically fit per A4 sheet at the chosen card size
 *                 (never hardcoded to "4 per page" — computed from the
 *                 actual width/height so odd sizes still pack correctly).
 *
 * N.1 digital stamp overlay: each card optionally renders the REAL G.25
 * digital school stamp (the same SchoolStamp component used on invoices),
 * scaled down to fit a wallet-sized card, when the school has it enabled in
 * Settings → Documents.
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
import { SchoolStamp, type StampData } from "@/lib/documents/school-stamp";

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
  /** N.1 — pre-fetched school logo as a data URI, needed for the stamp (react-pdf
   *  cannot fetch authenticated URLs at render time; the caller resolves this once
   *  per batch via `logoAsDataUrl()` and passes it down). */
  logoDataUrl?: string | null;
  /** N.1 — issue/print date shown on the stamp's red date band, e.g. "02 JUL 2026". */
  issuedDateText?: string;
}

const GREEN = "#1f9d5f";
const MUTED = "#677fab";
// A4 in points (1 mm = 2.83464 pt): 210 x 297 mm.
const A4_WIDTH_PT = 210 * 2.83464;
const A4_HEIGHT_PT = 297 * 2.83464;
const A4_MARGIN_MM = 10; // outer sheet margin so a home printer's unprintable edge is never clipped
const CARD_GAP_MM = 6; // gap between cards, doubles as extra cut-guide breathing room

function themeFor(template: string, brandColor: string) {
  let cardBg = "#ffffff";
  let textPrimary = brandColor;
  let borderMain = brandColor;
  let badgeColor = GREEN;
  let textMuted = MUTED;

  if (template === "navy") {
    cardBg = "#121a2e";
    textPrimary = "#ffffff";
    borderMain = "#22354f";
    badgeColor = "#3b82f6";
    textMuted = "#94a3b8";
  } else if (template === "frost") {
    cardBg = "#f8fafc";
    textPrimary = "#0f172a";
    borderMain = "#38bdf8";
    badgeColor = "#0284c7";
    textMuted = "#64748b";
  }
  return { cardBg, textPrimary, borderMain, badgeColor, textMuted };
}

/**
 * Renders ONE card's visual content at an arbitrary size (points). Shared by
 * both the "single" (page = card) and "batch-a4" (card = a grid cell) layouts
 * so the two never visually drift apart.
 */
function CardFace({
  c,
  template,
  widthPt,
  heightPt,
  showCutMarks,
  showStamp,
}: {
  c: StudentIdCard;
  template: string;
  widthPt: number;
  heightPt: number;
  showCutMarks: boolean;
  showStamp: boolean;
}) {
  const brandColor = c.brandPrimary || "#1c2740";
  const { cardBg, textPrimary, borderMain, badgeColor, textMuted } = themeFor(template, brandColor);

  // Scale factor relative to the original ~74x105mm design so text/photo
  // proportions stay sane at any physical card size the school picks.
  const scale = Math.min(widthPt / (74 * 2.83464), heightPt / (105 * 2.83464));
  const f = (base: number) => Math.max(base * scale, base * 0.55); // never shrink below 55% for legibility

  const s = StyleSheet.create({
    wrap: {
      width: widthPt,
      height: heightPt,
      padding: 0,
    },
    cardBorder: {
      borderWidth: 1.5,
      borderColor: borderMain,
      borderStyle: showCutMarks ? "dashed" : "solid",
      borderRadius: 8,
      padding: f(8),
      height: "100%",
      width: "100%",
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundColor: cardBg,
      position: "relative",
    },
    header: {
      borderBottomWidth: 1.2,
      borderBottomColor: borderMain,
      paddingBottom: f(4),
      marginBottom: f(6),
      textAlign: "center",
    },
    schoolRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 2 },
    logo: { width: f(14), height: f(14), objectFit: "contain" },
    school: { fontSize: f(9), fontFamily: "Helvetica-Bold", color: textPrimary },
    motto: { fontSize: f(5), color: badgeColor, marginTop: 1, fontFamily: "Helvetica-Oblique" },
    addr: { fontSize: f(4.5), color: textMuted, marginTop: 0.5 },
    body: { flexDirection: "row", alignItems: "center", gap: f(8), flex: 1 },
    photoCol: {
      width: f(46), height: f(54), borderWidth: 1,
      borderColor: template === "navy" ? "#1e293b" : "#dbe3f0",
      borderRadius: 4, backgroundColor: template === "navy" ? "#1e293b" : "#f7f9fc",
      justifyContent: "center", alignItems: "center",
    },
    photo: { width: "100%", height: "100%", borderRadius: 3 },
    initials: { fontSize: f(12), fontFamily: "Helvetica-Bold", color: textMuted },
    infoCol: { flex: 1, justifyContent: "center" },
    idLabel: { fontSize: f(5), color: textMuted, letterSpacing: 0.5 },
    name: { fontSize: f(8.5), fontFamily: "Helvetica-Bold", marginBottom: 2, color: textPrimary },
    metaRow: { marginTop: 2 },
    metaText: { fontSize: f(6), color: template === "navy" ? "#cbd5e1" : "#333333", marginBottom: 1 },
    bold: { fontFamily: "Helvetica-Bold" },
    footer: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderTopWidth: 1, borderTopColor: template === "navy" ? "#1e293b" : "#eef2f6",
      paddingTop: f(4), marginTop: f(4),
    },
    qr: { width: f(28), height: f(28) },
    ftextCol: { flex: 1, marginLeft: 4 },
    badgeType: { fontSize: f(5.5), fontFamily: "Helvetica-Bold", color: badgeColor, letterSpacing: 0.5, textTransform: "uppercase" },
    verify: { fontSize: f(4.5), color: textMuted, marginTop: 0.5 },
    trademark: { fontSize: f(4), fontFamily: "Helvetica-Bold", color: textMuted, textTransform: "uppercase", opacity: 0.6, alignSelf: "flex-end" },
    cutLabel: {
      position: "absolute", top: -7, right: 10, backgroundColor: cardBg,
      paddingHorizontal: 4, fontSize: 5.5, color: textMuted, fontWeight: "bold",
    },
  });

  const initials = c.studentName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const stampData: StampData | null = showStamp
    ? {
        schoolName: c.schoolName,
        county: c.county,
        addressLine: c.addressLine,
        logoDataUrl: c.logoDataUrl ?? null,
        dateText: (c.issuedDateText ?? "").toUpperCase(),
      }
    : null;

  return (
    <View style={s.wrap}>
      <View style={s.cardBorder}>
        {showCutMarks && <Text style={s.cutLabel}>✂ cut</Text>}
        <View style={s.header}>
          <View style={s.schoolRow}>
            {c.logoUrl ? <Image style={s.logo} src={c.logoUrl} /> : null}
            <Text style={s.school}>{c.schoolName}</Text>
          </View>
          {c.motto ? <Text style={s.motto}>{c.motto}</Text> : null}
          <Text style={s.addr}>{[c.addressLine, c.county].filter(Boolean).join(" · ") || "Kenya"}</Text>
        </View>

        <View style={s.body}>
          <View style={s.photoCol}>
            {c.photoUrl ? <Image style={s.photo} src={c.photoUrl} /> : <Text style={s.initials}>{initials}</Text>}
          </View>
          <View style={s.infoCol}>
            <Text style={s.idLabel}>STUDENT ID CARD</Text>
            <Text style={s.name}>{c.studentName}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaText}>Adm No: <Text style={s.bold}>{c.admissionNo}</Text></Text>
              <Text style={s.metaText}>Class: <Text style={s.bold}>{c.className}</Text></Text>
              <Text style={s.metaText}>Status: <Text style={[s.bold, { color: badgeColor }]}>ACTIVE</Text></Text>
            </View>
          </View>
        </View>

        {stampData && (
          <View style={{ position: "absolute", right: f(6), bottom: f(30), opacity: 0.9 }}>
            <SchoolStamp d={stampData} width={Math.max(70, widthPt * 0.42)} />
          </View>
        )}

        <View style={s.footer}>
          <Image style={s.qr} src={c.qrDataUrl} />
          <View style={s.ftextCol}>
            <Text style={s.badgeType}>Official Student ID</Text>
            <Text style={s.verify}>Ref: {c.verifyCode}</Text>
          </View>
          <Text style={s.trademark}>Powered by NEYO</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Legacy/default layout: one card per PDF page, page sized to the card
 * (74x105mm by default). Used for single-student downloads.
 */
export async function renderStudentIdCardsPdf(
  cards: StudentIdCard[],
  opts?: { width?: number; height?: number; template?: string; showStamp?: boolean }
): Promise<Buffer> {
  const widthMm = opts?.width || 74;
  const heightMm = opts?.height || 105;
  const template = opts?.template || "emerald";
  const showStamp = opts?.showStamp ?? false;
  const pageSize = [widthMm * 2.83464, heightMm * 2.83464] as [number, number];

  const doc = (
    <Document>
      {cards.map((c, i) => (
        <Page key={i} size={pageSize} style={{ padding: 0 }}>
          <CardFace c={c} template={template} widthPt={pageSize[0]} heightPt={pageSize[1]} showCutMarks={false} showStamp={showStamp} />
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}

/**
 * N.1 — DENSE BATCH layout: packs as many cards as physically fit onto real
 * A4 sheets (computed from the chosen card size, never hardcoded to a fixed
 * "N per page"), with dashed cut-lines between every card so a school can
 * print on ordinary paper and cut the cards apart. Cards are laid out
 * left-to-right, top-to-bottom, continuing across as many A4 pages as needed.
 */
export async function renderStudentIdCardsBatchA4Pdf(
  cards: StudentIdCard[],
  opts?: { width?: number; height?: number; template?: string; showStamp?: boolean }
): Promise<Buffer> {
  const cardWidthPt = (opts?.width || 74) * 2.83464;
  const cardHeightPt = (opts?.height || 105) * 2.83464;
  const template = opts?.template || "emerald";
  const showStamp = opts?.showStamp ?? false;
  const gapPt = CARD_GAP_MM * 2.83464;
  const marginPt = A4_MARGIN_MM * 2.83464;

  const usableWidth = A4_WIDTH_PT - marginPt * 2;
  const usableHeight = A4_HEIGHT_PT - marginPt * 2;

  // Auto-fit: how many whole cards (plus their gaps) fit across/down a sheet.
  const cols = Math.max(1, Math.floor((usableWidth + gapPt) / (cardWidthPt + gapPt)));
  const rows = Math.max(1, Math.floor((usableHeight + gapPt) / (cardHeightPt + gapPt)));
  const perPage = cols * rows;

  const pages: StudentIdCard[][] = [];
  for (let i = 0; i < cards.length; i += perPage) pages.push(cards.slice(i, i + perPage));

  const doc = (
    <Document>
      {pages.map((pageCards, pageIdx) => (
        <Page key={pageIdx} size="A4" style={{ padding: marginPt }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gapPt }}>
            {pageCards.map((c, i) => (
              <View key={i} style={{ width: cardWidthPt, height: cardHeightPt }}>
                <CardFace c={c} template={template} widthPt={cardWidthPt} heightPt={cardHeightPt} showCutMarks={true} showStamp={showStamp} />
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
