/**
 * Shell Version RELEASE GATE API (founder-requested "NEYO Shell V2" phase 2,
 * 2026-07-05) — SUPER_ADMIN (NEYO Ops) ONLY, in both directions.
 *
 * GET  — the current release state: master on/off + which schools have real
 *        staged early access. Used by the NEYO Ops console.
 * POST — either { released: boolean } to flip the real master switch, or
 *        { tenantId, earlyAccess: boolean } to grant/revoke ONE school real
 *        early access ahead of the master switch — a genuine staged
 *        rollout the founder explicitly asked for ("configure how they
 *        want it"), not an all-or-nothing flip.
 *
 * This is deliberately a SEPARATE route from the personal-preference route
 * (/api/me/shell-version) and the platform-default route
 * (/api/platform/shell-version) — three different real authorities:
 * NEYO Ops controls the default AND whether personal choice exists at all;
 * each individual staff member only ever controls their OWN preference,
 * and only once NEYO Ops has opened that door for their school.
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { setShellReleaseSchema } from "@/lib/validations/shell-version";
import {
  getShellReleaseState,
  setPersonalShellTogglePlatformReleased,
  setShellEarlyAccessForTenant,
} from "@/lib/services/shell-version.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    const [state, schools] = await Promise.all([
      getShellReleaseState(),
      db.tenant.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
    ]);
    return ok({ ...state, schools });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = setShellReleaseSchema.parse(await req.json().catch(() => ({})));
    if (input.released !== undefined) {
      return ok({ released: await setPersonalShellTogglePlatformReleased(user, input.released) });
    }
    return ok(await setShellEarlyAccessForTenant(user, input.tenantId!, input.earlyAccess!));
  } catch (e) {
    return handleError(e);
  }
}
