/**
 * Shell Version API (founder-requested "NEYO Shell V2", 2026-07-04).
 * GET  /api/platform/shell-version — any signed-in user reads the
 *      COMPANY-set default shell version ("v1" today's sidebar | "v2" the
 *      new floating-bar shell).
 * POST /api/platform/shell-version {shellVersion} — SUPER_ADMIN (NEYO) ONLY,
 *      exactly like G.33's /api/platform/appearance. Schools cannot change
 *      the platform default yet (see the service file for the founder's own
 *      phased plan to add a school override, then a personal override).
 */
import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { setShellVersionSchema } from "@/lib/validations/shell-version";
import { getPlatformShellVersion, setPlatformShellVersion } from "@/lib/services/shell-version.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    return ok({ shellVersion: await getPlatformShellVersion() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const { shellVersion } = setShellVersionSchema.parse(await req.json().catch(() => ({})));
    return ok({ shellVersion: await setPlatformShellVersion(user, shellVersion) });
  } catch (e) {
    return handleError(e);
  }
}
