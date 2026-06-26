import { NextRequest } from "next/server";
import { requireRole, requireUser } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * PUT /api/files/dev-put?key=... — LEGACY direct PUT seam.
 *
 * I.56 Storage Vault: disabled by default because raw browser PUT uploads can
 * bypass server-side encryption. Use /api/files/encrypted.
 */
export async function PUT(_req: NextRequest) {
  try {
    await requireUser();
    if (process.env.NEYO_ALLOW_LEGACY_DIRECT_UPLOADS === "true") {
      await requireRole("SUPER_ADMIN");
      return fail("GONE", "Legacy direct PUT is disabled for normal users. Use /api/files/encrypted.", 410);
    }
    return fail("GONE", "Direct PUT upload is disabled. NEYO now encrypts uploads through /api/files/encrypted before storage.", 410);
  } catch (err) {
    return handleError(err);
  }
}
