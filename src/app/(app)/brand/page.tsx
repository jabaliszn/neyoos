import { requirePageUser } from "@/lib/core/page-guards";
import { KE_MOMENTS } from "@/lib/i18n/cultural-calendar";
import { BrandShowcase } from "@/components/brand/brand-showcase";

export const dynamic = "force-dynamic";

/**
 * Brand & design style guide (A.20). A living reference: tokens, logo, mascot,
 * component library and the cultural-moments lookup. Available to any signed-in
 * user (it's documentation, not data).
 */
export default async function BrandPage() {
  await requirePageUser();

  // Build this year's moment list (sorted by date) for the lookup table.
  const year = new Date().getFullYear();
  const moments = [...KE_MOMENTS]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ iso: `${year}-${m.date}`, name: m.name, swName: m.swName, type: m.type }));

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Brand &amp; design
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          NEYO&apos;s visual system — logo, colours, components and Bundi. The single
          source of truth for how the product looks.
        </p>
      </div>
      <BrandShowcase moments={moments} />
    </div>
  );
}
