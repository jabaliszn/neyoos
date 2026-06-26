import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/services/payment.service";
import { verifyWebhookToken } from "@/lib/payments/daraja-provider";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook/[slug] — Daraja STK callback (A.6).
 * Tenant-slugged URL. We verify the shared webhook token, then process the
 * callback idempotently. Always returns 200 so Daraja doesn't retry forever.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  void params; // slug identifies the tenant route; correlation is by checkoutRequestId
  try {
    const token = req.nextUrl.searchParams.get("t");
    if (!verifyWebhookToken(token)) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    // Detect provider: mock bodies are flat; Daraja nests under Body.stkCallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDaraja = Boolean((body as any)?.Body?.stkCallback);
    await handleCallback(isDaraja ? "mpesa_daraja" : "mock", body);

    // Daraja expects this acknowledgement shape.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch {
    // Even on error, ack so Daraja stops retrying; we logged internally.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
