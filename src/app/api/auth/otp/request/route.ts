import { NextRequest } from "next/server";
import { requestOtpSchema } from "@/lib/validations/auth";
import { requestLoginOtp } from "@/lib/services/auth.service";
import { ok, handleError } from "@/lib/api/respond";

// Auth must run per-request (it touches the DB and cookies).
export const dynamic = "force-dynamic";

/** POST /api/auth/otp/request  — body: { phone } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone } = requestOtpSchema.parse(body); // normalized +254...

    const result = await requestLoginOtp(phone);

    // We return the same shape whether or not the user exists, so we never
    // leak which numbers are registered. `devCode` only appears in development.
    return ok({
      phone,
      expiresInSeconds: result.expiresInSeconds,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
