import { QuoteRequestForm } from "@/components/quote/quote-request-form";

export const metadata = { title: "Get a quote — NEYO" };
export const dynamic = "force-dynamic";

/** Part V — Capacity-Based Pricing 2.0. PUBLIC — a prospective school sees
 * a real, instant, honest price and can request a formal quotation. */
export default function QuotePage() {
  return <QuoteRequestForm />;
}
