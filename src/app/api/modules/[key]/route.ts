import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { setModule } from "@/lib/services/module.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean() });

/**
 * PATCH /api/modules/:key — toggle a module. Only school leadership may do this.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await requirePermission("tenant.manage_modules");
    const { enabled } = bodySchema.parse(await req.json().catch(() => ({})));
    const modules = await setModule(
      user.tenantId,
      { id: user.id, fullName: user.fullName },
      params.key,
      enabled
    );
    return ok({ modules });
  } catch (err) {
    return handleError(err);
  }
}
