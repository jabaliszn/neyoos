import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { classSchema } from "@/lib/validations/student";
import { listClasses, createClass } from "@/lib/services/student.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/classes — list classes/streams with student counts. */
export async function GET() {
  try {
    const user = await requirePermission("student.view");
    const classes = await withTenant(user.tenantId, () => listClasses());
    return ok({ classes });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/classes — create a class/stream (B.1). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const input = classSchema.parse(await req.json().catch(() => ({})));
    const cls = await withTenant(user.tenantId, () => createClass(input));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "class.create",
        entityType: "SchoolClass",
        entityId: cls.id,
        metadata: JSON.stringify({ level: input.level, stream: input.stream }),
      },
    });
    return ok({ id: cls.id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
