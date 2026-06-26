import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { previewCost } from "@/lib/services/notification.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  channels: z.array(z.enum(["in_app", "push", "whatsapp", "sms", "email"])).min(1),
  recipientCount: z.coerce.number().int().nonnegative(),
});

/** POST /api/notifications/cost-preview — KES estimate before sending (A.7). */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("comms.send");
    const { channels, recipientCount } = schema.parse(
      await req.json().catch(() => ({}))
    );
    return ok(previewCost(channels, recipientCount));
  } catch (err) {
    return handleError(err);
  }
}
