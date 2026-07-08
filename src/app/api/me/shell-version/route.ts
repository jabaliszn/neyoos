/**
 * Personal Shell Version API (founder-requested "NEYO Shell V2" phase 2,
 * 2026-07-05) — ANY signed-in user reads/writes their OWN preference.
 *
 * GET  — this user's raw personal choice (null = "follow the default"),
 *        PLUS whether the personal toggle is even released for their own
 *        school yet (`released`) so the UI can honestly show/hide the
 *        picker rather than offering a choice that silently does nothing.
 * POST { shellVersion: "v1" | "v2" | null } — saves their own choice.
 *        Saving is always allowed (harmless before release — mirrors a
 *        light switch wired to a breaker that isn't live yet); it only
 *        ever takes visible effect once NEYO Ops has released the
 *        capability for this user's school (see resolveShellVersion()).
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { setPersonalShellVersionSchema } from "@/lib/validations/shell-version";
import {
  getPersonalShellVersion,
  setPersonalShellVersion,
  isPersonalShellToggleReleasedForTenant,
} from "@/lib/services/shell-version.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [shellVersion, released] = await Promise.all([
      getPersonalShellVersion(user),
      isPersonalShellToggleReleasedForTenant(user.tenantId),
    ]);
    return ok({ shellVersion, released });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { shellVersion } = setPersonalShellVersionSchema.parse(await req.json().catch(() => ({})));
    return ok({ shellVersion: await setPersonalShellVersion(user, shellVersion) });
  } catch (e) {
    return handleError(e);
  }
}
