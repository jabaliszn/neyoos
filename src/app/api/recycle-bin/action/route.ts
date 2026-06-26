import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { restore, purge } from "@/lib/services/recycle.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["restore", "purge"]),
  kind: z.string().min(1),
  id: z.string().min(1),
});

/** POST /api/recycle-bin/action — restore or purge an item (leadership only). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const { action, kind, id } = schema.parse(await req.json().catch(() => ({})));
    const actor = { id: user.id, fullName: user.fullName };
    if (action === "restore") await restore(user.tenantId, actor, kind, id);
    else await purge(user.tenantId, actor, kind, id);
    return ok({ done: true });
  } catch (err) {
    return handleError(err);
  }
}
