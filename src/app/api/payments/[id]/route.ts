import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/payments/:id — soft-delete a payment (G.6). Leadership only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("finance.manage_structure");
    await withTenant(user.tenantId, async () => {
      // tenantDb turns this into a soft-delete (deletedAt) automatically.
      await tenantDb().payment.delete({ where: { id: params.id } });
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
