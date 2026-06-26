import { MzaziLookupClient } from "@/components/mzazi/mzazi-lookup-client";

export const dynamic = "force-dynamic";

/**
 * G.13 — PUBLIC Mzazi card page (no app shell, no login). A guardian scans the
 * QR on the printed A6 card, enters the phone on record, and sees the live fee
 * balance + how to pay. Privacy-safe: balance hidden until the phone matches.
 */
export default function MzaziPage({ params }: { params: { code: string } }) {
  return <MzaziLookupClient code={params.code} />;
}
