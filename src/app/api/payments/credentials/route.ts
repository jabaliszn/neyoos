import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import {
  savePaymentCredentials,
  getPaymentConfigStatus,
} from "@/lib/services/payment.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  shortcode: z.string().trim().min(4, "Enter your Paybill/Till number"),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  consumerKey: z.string().trim().min(1, "Consumer key is required"),
  consumerSecret: z.string().trim().min(1, "Consumer secret is required"),
  passkey: z.string().trim().min(1, "Passkey is required"),
});

/** GET — non-secret config status. */
export async function GET() {
  try {
    const user = await requirePermission("tenant.manage_settings");
    return ok(await getPaymentConfigStatus(user.tenantId));
  } catch (err) {
    return handleError(err);
  }
}

/** POST — save (encrypted) Daraja credentials. Leadership only. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const input = schema.parse(await req.json().catch(() => ({})));
    await savePaymentCredentials(user.tenantId, input);
    return ok({ configured: true });
  } catch (err) {
    return handleError(err);
  }
}
