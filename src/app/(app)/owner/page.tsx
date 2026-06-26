import { requirePagePermission } from "@/lib/core/page-guards";
import { OwnerClient } from "@/components/owner/owner-client";

/**
 * B.24 — Owner Dashboard ("My school at a glance").
 * SCHOOL_OWNER / PRINCIPAL only (permission owner.dashboard).
 */
export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  await requirePagePermission("owner.dashboard");
  return <OwnerClient />;
}
