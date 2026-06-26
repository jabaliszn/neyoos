/**
 * G.25 Digital school stamp — REDESIGNED per founder 2026-06-12:
 * RECTANGLE like a real Kenyan office rubber stamp:
 *   - BLUE double-border frame + blue school name / PO Box / county lines
 *   - the DATE through the MIDDLE in RED (like the date-band of a real stamp)
 *   - school logo at the left, no "digital stamp" wording anywhere
 * Drawn with react-pdf SVG primitives (GOTCHA: <Image> rejects SVG data-URIs).
 */
import React from "react";
import { Image, View, Text, Svg, Rect, Line } from "@react-pdf/renderer";

export interface StampData {
  schoolName: string;
  county: string | null;
  addressLine: string | null; // P.O. Box line
  logoDataUrl: string | null; // pre-fetched logo as data URI (PNG/JPG)
  dateText: string; // "12 JUN 2026"
}

const STAMP_BLUE = "#1d3f8f"; // classic stamp-pad blue
const STAMP_RED = "#c0282d"; // classic date-band red

/**
 * Rectangle rubber-stamp block for @react-pdf documents.
 * width in pt; height is derived (ratio ~ 2.6:1 like a real stamp).
 */
export function SchoolStamp({ d, width = 170 }: { d: StampData; width?: number }) {
  const h = width / 2.6;
  const logoSize = h * 0.42;
  const initials = d.schoolName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const poBox = d.addressLine || (d.county ? `${d.county} County, Kenya` : "Kenya");

  return (
    <View style={{ width, height: h, position: "relative", opacity: 0.85, transform: "rotate(-2deg)" }}>
      {/* double border frame — blue */}
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <Rect x={1.2} y={1.2} width={width - 2.4} height={h - 2.4} stroke={STAMP_BLUE} strokeWidth={2} fill="none" rx={3} />
        <Rect x={5} y={5} width={width - 10} height={h - 10} stroke={STAMP_BLUE} strokeWidth={0.8} fill="none" rx={2} />
        {/* date band rules */}
        <Line x1={8} y1={h * 0.42} x2={width - 8} y2={h * 0.42} stroke={STAMP_BLUE} strokeWidth={0.7} />
        <Line x1={8} y1={h * 0.62} x2={width - 8} y2={h * 0.62} stroke={STAMP_BLUE} strokeWidth={0.7} />
      </Svg>

      {/* content rows */}
      <View style={{ position: "absolute", top: 0, left: 0, width, height: h, paddingHorizontal: 9, paddingVertical: 6 }}>
        {/* top: logo + school name */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: h * 0.34 }}>
          {d.logoDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={d.logoDataUrl} style={{ width: logoSize, height: logoSize, borderRadius: 2 }} />
          ) : (
            <Text style={{ fontSize: h * 0.17, fontFamily: "Helvetica-Bold", color: STAMP_BLUE }}>{initials}</Text>
          )}
          <Text style={{ fontSize: h * 0.135, fontFamily: "Helvetica-Bold", color: STAMP_BLUE, maxWidth: width * 0.74 }}>
            {d.schoolName.toUpperCase()}
          </Text>
        </View>

        {/* middle band: the DATE in RED */}
        <View style={{ height: h * 0.28, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: h * 0.155, fontFamily: "Helvetica-Bold", color: STAMP_RED, letterSpacing: 1.5 }}>
            {d.dateText}
          </Text>
        </View>

        {/* bottom: P.O. Box line — blue */}
        <View style={{ height: h * 0.3, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: h * 0.105, color: STAMP_BLUE, textAlign: "center" }}>
            {poBox.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Fetch the school logo from local storage as a data URI (PDFs can't hit our auth'd API). */
export async function logoAsDataUrl(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const m = logoUrl.match(/[?&]key=([^&]+)/);
    if (!m) return null;
    const key = decodeURIComponent(m[1]);
    const { readObject } = await import("@/lib/services/storage.service");
    const obj = await readObject(key);
    if (!obj) return null;
    if (!/image\/(png|jpe?g)/.test(obj.contentType)) return null;
    return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
  } catch {
    return null;
  }
}
