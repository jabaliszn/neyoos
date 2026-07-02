import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { scanForPayment } from "@/lib/services/qr-scan.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/qr-scan/payment — N.2 1-Tap Payments: scanning a student's ID QR
 * instantly surfaces their REAL open fee balance (via the existing B.7
 * finance engine) so reception/bursar can prompt for M-Pesa payment right
 * away. Permission: finance.view (read-only lookup; the actual STK push
 * still goes through the existing /api/finance invoice flow).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("finance.view");
    const body = await req.json().catch(() => ({}));
    const scanned = String(body.scanned ?? "");
    const result = await scanForPayment(user, scanned);
    return ok({ result });
  } catch (err) {
    return handleError(err);
  }
}
