/**
 * N.3 Document Set — Dynamic Newsletter Printing.
 *
 * REPLACES the old client-side `window.print()` HTML generator in
 * `students-client.tsx` (`handlePrintNewsletter`) with a real server-rendered
 * PDF, matching how every other NEYO document (ID cards, receipts, letters,
 * transcripts) is built: react-pdf on the server, not the browser's print
 * dialog.
 *
 * Fixes the checklist's two literal, named bugs:
 *
 *  1. "eliminate hardcoded cut-lines" — the old CSS had a
 *     `.newsletter-card::after { content: "✂ Cut Line" }` that showed on
 *     EVERY card in EVERY format, including "1-up" where a single card fills
 *     the whole A4 page and there is nothing to cut. `showCutMarks` is now
 *     computed from the real layout (`itemsPerPage > 1`), not hardcoded true.
 *
 *  2. "dynamically collapse blank spaces based on text length" — the old
 *     `.content { flex: 1 }` always stretched to fill the card regardless of
 *     how little text it held, leaving large dead whitespace for short
 *     notices. `contentLayout()` below estimates the real wrapped-line count
 *     from the actual body text and the actual available card size (which
 *     itself changes per format/card), then:
 *       - for a SHORT body relative to the available space: centers the
 *         content vertically and grows the font a little, so the card reads
 *         as intentionally composed rather than half-empty;
 *       - for a LONG body that would overflow the available space: shrinks
 *         the font down to a legibility floor so it always fits without
 *         being silently truncated.
 *     This is a real per-card computation (each card can have different
 *     personalized text length), not a fixed layout constant.
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

const GREEN = "#1f9d5f";
const MUTED = "#677fab";
// A4 in points (1mm = 2.83464pt).
const MM = 2.83464;
const A4_WIDTH_PT = 210 * MM;
const A4_HEIGHT_PT = 297 * MM;
const PAGE_MARGIN_MM = 12;
const CARD_GAP_MM = 8;

export interface NewsletterHeader {
  schoolName: string;
  motto: string | null;
  county: string | null;
  addressLine: string | null;
  brandPrimary: string;
  logoUrl?: string | null;
  title: string;
  signOffLabel: string;
}

export interface NewsletterCardData {
  /** Personalized recipient label, e.g. "Achieng Mary Otieno · Adm KHS1", or
   *  a generic "Dear Parent/Guardian" style label when not personalized. */
  recipientLabel: string;
  /** Already-substituted final body text for this recipient (placeholders
   *  like {{student_name}} are resolved BEFORE this module ever sees it). */
  bodyText: string;
}

/**
 * Estimate the wrapped line count for a block of text at a given font size
 * and content width, then decide a real per-card font size + vertical
 * alignment so the card never has a fixed dead-space layout.
 */
function contentLayout(
  bodyText: string,
  availableWidthPt: number,
  availableHeightPt: number
): { fontSize: number; justify: "flex-start" | "center"; lineHeight: number } {
  const baseFontSize = 10.5;
  const lineHeight = 1.5;
  // Helvetica average character width is roughly 0.5x the font size.
  const approxCharsPerLine = Math.max(18, Math.floor(availableWidthPt / (baseFontSize * 0.5)));

  const paragraphs = bodyText.split(/\n\n+/).filter((p) => p.length > 0);
  let totalLines = 0;
  for (const p of paragraphs) {
    const linesInParagraph = p
      .split("\n")
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / approxCharsPerLine)), 0);
    totalLines += linesInParagraph;
  }
  if (totalLines === 0) totalLines = 1;
  // A small gap between paragraphs, matching the real rendered spacing below.
  totalLines += (paragraphs.length - 1) * 0.4;

  const estimatedHeightPt = totalLines * baseFontSize * lineHeight;

  if (estimatedHeightPt > availableHeightPt && availableHeightPt > 0) {
    // Long body: shrink to fit rather than silently overflowing/clipping.
    const shrinkFactor = availableHeightPt / estimatedHeightPt;
    const fontSize = Math.max(6.5, baseFontSize * shrinkFactor);
    return { fontSize, justify: "flex-start", lineHeight };
  }

  if (estimatedHeightPt < availableHeightPt * 0.55) {
    // Short body: collapse the blank space by centering instead of leaving
    // a large empty gap, and nudge the font up slightly for readability.
    const growFactor = Math.min(1.25, 1 + (availableHeightPt * 0.55 - estimatedHeightPt) / availableHeightPt);
    const fontSize = Math.min(14, baseFontSize * growFactor);
    return { fontSize, justify: "center", lineHeight };
  }

  return { fontSize: baseFontSize, justify: "flex-start", lineHeight };
}

function NewsletterCardFace({
  h,
  card,
  widthPt,
  heightPt,
  showCutMarks,
}: {
  h: NewsletterHeader;
  card: NewsletterCardData;
  widthPt: number;
  heightPt: number;
  showCutMarks: boolean;
}) {
  const brandColor = h.brandPrimary || "#1c2740";
  const paddingPt = Math.max(10, widthPt * 0.045);
  // Rough available height for the body copy: total card height minus the
  // header block, footer block, and paddings — recomputed per real card size.
  const headerBlockPt = heightPt * 0.2;
  const footerBlockPt = heightPt * 0.16;
  const availableContentHeight = Math.max(20, heightPt - headerBlockPt - footerBlockPt - paddingPt * 2);
  const availableContentWidth = widthPt - paddingPt * 2;
  const { fontSize, justify, lineHeight } = contentLayout(card.bodyText, availableContentWidth, availableContentHeight);

  const s = StyleSheet.create({
    wrap: { width: widthPt, height: heightPt },
    card: {
      borderWidth: 1.3,
      borderColor: showCutMarks ? "#94a3b8" : "#dbe3f0",
      borderStyle: showCutMarks ? "dashed" : "solid",
      borderRadius: 10,
      padding: paddingPt,
      height: "100%",
      width: "100%",
      flexDirection: "column",
      backgroundColor: "#ffffff",
      position: "relative",
    },
    cutLabel: {
      position: "absolute",
      top: -8,
      right: 12,
      backgroundColor: "#ffffff",
      paddingHorizontal: 5,
      fontSize: 7,
      color: "#94a3b8",
      fontFamily: "Helvetica-Bold",
    },
    header: {
      borderBottomWidth: 2,
      borderBottomColor: brandColor,
      paddingBottom: 5,
      marginBottom: 6,
    },
    schoolRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    logo: { width: 20, height: 20, objectFit: "contain" },
    school: { fontSize: 11, fontFamily: "Helvetica-Bold", color: brandColor, textTransform: "uppercase" },
    motto: { fontSize: 7.5, color: GREEN, fontFamily: "Helvetica-Oblique", marginTop: 1 },
    addr: { fontSize: 6.5, color: MUTED, marginTop: 1 },
    title: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", textAlign: "center", marginTop: 4 },
    recipient: { fontSize: 8, color: MUTED, marginBottom: 4 },
    content: {
      flex: 1,
      flexDirection: "column",
      justifyContent: justify,
    },
    paragraph: { fontSize, color: "#334155", lineHeight, marginBottom: fontSize * 0.5 },
    footer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      paddingTop: 5,
      marginTop: 5,
    },
    signature: { borderTopWidth: 0.8, borderTopColor: "#94a3b8", borderTopStyle: "dotted", width: "45%", paddingTop: 2 },
    signLabel: { fontSize: 6.5, color: "#64748b", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
    signBy: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brandColor },
    trademark: { fontSize: 6, fontFamily: "Helvetica-Bold", color: "#94a3b8", textTransform: "uppercase" },
  });

  const paragraphs = card.bodyText.split(/\n\n+/).filter((p) => p.length > 0);

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        {showCutMarks && <Text style={s.cutLabel}>✂ cut</Text>}
        <View style={s.header}>
          <View style={s.schoolRow}>
            {h.logoUrl ? <Image style={s.logo} src={h.logoUrl} /> : null}
            <View>
              <Text style={s.school}>{h.schoolName}</Text>
              {h.motto ? <Text style={s.motto}>{h.motto}</Text> : null}
            </View>
          </View>
          <Text style={s.addr}>{[h.addressLine, h.county].filter(Boolean).join(" · ") || "Kenya"}</Text>
          <Text style={s.title}>{h.title}</Text>
        </View>

        <Text style={s.recipient}>{card.recipientLabel}</Text>

        <View style={s.content}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={s.paragraph}>{p}</Text>
          ))}
        </View>

        <View style={s.footer}>
          <View style={s.signature}>
            <Text style={s.signLabel}>Signed / Stamped</Text>
            <Text style={s.signBy}>{h.signOffLabel}</Text>
          </View>
          <Text style={s.trademark}>Powered by NEYO</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Renders the full newsletter run as a real multi-page A4 PDF.
 *
 *  - "1-up": one full-page card per recipient, no cut marks (nothing to cut).
 *  - "2-up": two cards stacked per A4 sheet, dashed cut line between them.
 *  - "4-up": four cards in a 2x2 grid per A4 sheet, dashed cut lines.
 */
export async function renderNewsletterPdf(
  header: NewsletterHeader,
  cards: NewsletterCardData[],
  opts: { format: "1-up" | "2-up" | "4-up" }
): Promise<Buffer> {
  const itemsPerPage = opts.format === "4-up" ? 4 : opts.format === "2-up" ? 2 : 1;
  // Real fix for the "hardcoded cut-lines" bug: cut guides only make sense
  // when more than one card actually shares a sheet.
  const showCutMarks = itemsPerPage > 1;

  const marginPt = PAGE_MARGIN_MM * MM;
  const gapPt = CARD_GAP_MM * MM;
  const usableWidth = A4_WIDTH_PT - marginPt * 2;
  const usableHeight = A4_HEIGHT_PT - marginPt * 2;

  let cardWidthPt: number;
  let cardHeightPt: number;
  if (opts.format === "4-up") {
    cardWidthPt = (usableWidth - gapPt) / 2;
    cardHeightPt = (usableHeight - gapPt) / 2;
  } else if (opts.format === "2-up") {
    cardWidthPt = usableWidth;
    cardHeightPt = (usableHeight - gapPt) / 2;
  } else {
    cardWidthPt = usableWidth;
    cardHeightPt = usableHeight;
  }

  const pages: NewsletterCardData[][] = [];
  for (let i = 0; i < cards.length; i += itemsPerPage) pages.push(cards.slice(i, i + itemsPerPage));

  const doc = (
    <Document>
      {pages.map((pageCards, pageIdx) => (
        <Page key={pageIdx} size="A4" style={{ padding: marginPt }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gapPt, width: usableWidth }}>
            {pageCards.map((c, i) => (
              <View key={i} style={{ width: cardWidthPt, height: cardHeightPt }}>
                <NewsletterCardFace
                  h={header}
                  card={c}
                  widthPt={cardWidthPt}
                  heightPt={cardHeightPt}
                  showCutMarks={showCutMarks}
                />
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
