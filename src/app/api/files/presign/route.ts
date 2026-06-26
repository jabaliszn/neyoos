import { NextRequest } from "next/server";
import { requireRole, requireUser } from "@/lib/core/session";
import { fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/files/presign — LEGACY direct-upload seam.
 *
 * I.56 Storage Vault: disabled by default because direct browser-to-storage PUT
 * bypasses server-side AES-256-GCM encryption. Use /api/files/encrypted instead.
 * A SUPER_ADMIN may temporarily re-enable for migration only with
 * NEYO_ALLOW_LEGACY_DIRECT_UPLOADS=true.
 */
export async function POST(_req: NextRequest) {
  try {
    await requireUser();
    if (process.env.NEYO_ALLOW_LEGACY_DIRECT_UPLOADS === "true") {
      await requireRole("SUPER_ADMIN");
      return fail("GONE", "Legacy direct upload is disabled for normal users. Use /api/files/encrypted.", 410);
    }
    return fail("GONE", "Direct uploads are disabled. NEYO now encrypts uploads through /api/files/encrypted before storage.", 410);
  } catch (err) {
    return handleError(err);
  }
}
