import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { resolveScannedStudent } from "@/lib/services/qr-scan.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/qr-scan/resolve — resolve a scanned ID-card QR (or bare code) to
 * the real student it belongs to, WITHOUT taking any action yet. Used by the
 * scan UI to show a confirm screen before 1-tap attendance/payment. Any
 * signed-in staff member may resolve (read-only, tenant-isolated); the
 * mutating actions below are permission-gated separately.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const scanned = String(body.scanned ?? "");
    const student = await resolveScannedStudent(user, scanned);
    return ok({ student });
  } catch (err) {
    return handleError(err);
  }
}
