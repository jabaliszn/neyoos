import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";
import { getVapidConfig } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const vapid = await getVapidConfig();
    return ok({ vapidPublicKey: vapid.publicKey || null, configured: vapid.configured });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = z.object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
    }).parse(await req.json().catch(() => ({})));
    const sub = await db.webPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { tenantId: user.tenantId, userId: user.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: req.headers.get("user-agent") ?? null },
      update: { tenantId: user.tenantId, userId: user.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: req.headers.get("user-agent") ?? null },
    });
    return ok({ id: sub.id });
  } catch (e) {
    return handleError(e);
  }
}
