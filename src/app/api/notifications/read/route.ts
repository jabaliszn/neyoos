import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { markRead, markAllRead } from "@/lib/services/notification.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

/** POST /api/notifications/read — mark one (id) or all (all:true) as read. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id, all } = schema.parse(await req.json().catch(() => ({})));
    if (all) await markAllRead(user.id);
    else if (id) await markRead(user.id, id);
    return ok({ done: true });
  } catch (err) {
    return handleError(err);
  }
}
