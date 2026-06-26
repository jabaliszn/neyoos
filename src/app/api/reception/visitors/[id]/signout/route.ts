import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { signOutVisitor } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/reception/visitors/:id/signout — sign a visitor out (A.18.5). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("reception.operate");
    const v = await withTenant(user.tenantId, () => signOutVisitor(params.id));
    return ok({ id: v.id, signedOutAt: v.signedOutAt });
  } catch (err) {
    return handleError(err);
  }
}
