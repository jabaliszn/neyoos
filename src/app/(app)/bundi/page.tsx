import { requirePageUser } from "@/lib/core/page-guards";
import { isPaused } from "@/lib/services/platform-flags.service";
import { BundiClient } from "@/components/bundi/bundi-client";

/**
 * B.23 — THE BUNDI LAYER (founder 2026-06-13).
 * Bundi the owl IS the helper. We NEVER say "AI" in product copy.
 * Shipped DESIGN-ONLY and platform-PAUSED (G.22) until NEYO launches it.
 * Any signed-in user may view; while paused the nav link is hidden and a
 * direct visit shows the calm "getting ready" state.
 */
export const dynamic = "force-dynamic";

export default async function BundiPage() {
  await requirePageUser();
  const flag = await isPaused("bundi");
  return <BundiClient paused={flag.paused} note={flag.note} />;
}
