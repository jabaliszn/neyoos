/**
 * G.13 — PUBLIC Mzazi balance lookup (no auth). Privacy-gated: the guardian
 * must enter the phone on record before any balance is returned.
 * POST { phone } -> { found, schoolName, learner(masked unless ok), balance... }
 * Rate-limited per IP so the QR can't be brute-forced.
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";
import { mzaziLookupSchema } from "@/lib/validations/mzazi";
import { mzaziLookup } from "@/lib/services/mzazi.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    // 20 attempts / 10 min / IP — generous for a parent, hostile to scrapers.
    enforceRate(`mzazi:${clientIp(req)}`, 20, 600);
    const { phone } = mzaziLookupSchema.parse(await req.json().catch(() => ({})));
    return ok(await mzaziLookup(params.code, phone));
  } catch (e) {
    return handleError(e);
  }
}
