import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { notify } from "@/lib/services/notification.service";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const channelEnum = z.enum(["in_app", "push", "whatsapp", "sms", "email"]);
const schema = z.object({
  recipientIds: z.array(z.string()).optional(), // explicit recipients
  role: z.string().optional(), // OR everyone with this role
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  category: z.string().optional(),
  channels: z.array(channelEnum).min(1),
  cascade: z.boolean().optional(),
});

/** POST /api/notifications/send — send to recipients (or a whole role). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("comms.send");
    const input = schema.parse(await req.json().catch(() => ({})));

    // Resolve recipients within the tenant (isolation enforced).
    const recipientIds = await withTenant(user.tenantId, async () => {
      if (input.recipientIds?.length) {
        const found = await tenantDb().user.findMany({
          where: { id: { in: input.recipientIds } },
          select: { id: true },
        });
        return found.map((u) => u.id);
      }
      if (input.role) {
        const found = await tenantDb().user.findMany({
          where: { role: input.role },
          select: { id: true },
        });
        return found.map((u) => u.id);
      }
      return [];
    });

    let sent = 0;
    for (const rid of recipientIds) {
      await notify({
        tenantId: user.tenantId,
        recipientId: rid,
        title: input.title,
        body: input.body,
        category: input.category ?? "general",
        channels: input.channels,
        cascade: input.cascade,
      });
      sent++;
    }

    return ok({ sent });
  } catch (err) {
    return handleError(err);
  }
}
