import { requireUser } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { ROLE_LABELS } from "@/lib/core/roles";
import { ok, handleError } from "@/lib/api/respond";
import type { Role } from "@/lib/core/roles";

export const dynamic = "force-dynamic";

/** GET /api/conversations/recipients — people the user can message (same tenant). */
export async function GET() {
  try {
    const user = await requireUser();
    const people = await withTenant(user.tenantId, async () =>
      tenantDb().user.findMany({
        where: { isActive: true, id: { not: user.id } },
        select: { id: true, fullName: true, role: true },
        orderBy: { fullName: "asc" },
      })
    );
    return ok({
      recipients: people.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
