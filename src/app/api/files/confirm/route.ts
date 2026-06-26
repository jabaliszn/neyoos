import { NextRequest } from "next/server";
import { requireRole, requireUser } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/files/confirm — LEGACY direct-upload confirmation seam.
 *
 * I.56 Storage Vault: disabled by default because it records objects that may
 * have reached storage without NEYO encryption. Use /api/files/encrypted.
 */
export async function POST(_req: NextRequest) {
  try {
    await requireUser();
    if (process.env.NEYO_ALLOW_LEGACY_DIRECT_UPLOADS === "true") {
      await requireRole("SUPER_ADMIN");
      return fail("GONE", "Legacy direct upload confirmation is disabled for normal users. Use /api/files/encrypted.", 410);
    }
    return fail("GONE", "Direct upload confirmation is disabled. NEYO now records encrypted uploads through /api/files/encrypted.", 410);
  } catch (err) {
    return handleError(err);
  }
}
