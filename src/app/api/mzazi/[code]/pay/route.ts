import { NextRequest } from "next/server";
import { z } from "zod";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";
import { mzaziPay } from "@/lib/services/mzazi.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(1),
  amountKes: z.coerce.number().int().min(1).max(1_000_000),
});

/** POST /api/mzazi/[code]/pay — public QR → direct M-Pesa STK after guardian phone check. */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    enforceRate(`mzazi-pay:${clientIp(req)}:${params.code}`, 10, 600);
    const input = schema.parse(await req.json().catch(() => ({})));
    return ok(await mzaziPay(params.code, input.phone, input.amountKes));
  } catch (err) {
    return handleError(err);
  }
}
