import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { classSchema } from "@/lib/validations/student";
import { updateClass } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const patchSchema = classSchema.partial().extend({ archived: z.boolean().optional() });

/** PATCH /api/classes/:id — edit / archive a class. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("class.manage");
    const input = patchSchema.parse(await req.json().catch(() => ({})));
    const cls = await withTenant(user.tenantId, () => updateClass(params.id, input));
    return ok({ id: cls.id });
  } catch (err) {
    return handleError(err);
  }
}
