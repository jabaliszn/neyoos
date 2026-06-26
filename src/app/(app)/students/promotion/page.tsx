import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { PromotionClient } from "@/components/students/promotion-client";

export const dynamic = "force-dynamic";

/** G.16 — New academic year promotions + stream reshuffle (leadership). */
export default async function PromotionPage() {
  await requirePagePermission("class.manage");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-navy-500 transition-colors duration-200 ease-apple hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Students
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          New academic year
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Promote every class one level up, graduate the final years, and optionally reshuffle streams.
        </p>
      </div>
      <PromotionClient />
    </div>
  );
}
