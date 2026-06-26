import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { visitorSignInSchema } from "@/lib/validations/reception";
import { signInVisitor, todayVisitors } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception/visitors — today's visitors (A.18.5). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const visitors = await withTenant(user.tenantId, todayVisitors);
    return ok({ visitors });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/reception/visitors — sign a visitor in (A.18.5). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const input = visitorSignInSchema.parse(await req.json().catch(() => ({})));
    const visitor = await withTenant(user.tenantId, () =>
      signInVisitor(user.tenantId, input, user.id)
    );
    return ok({ id: visitor.id, badgeNo: visitor.badgeNo }, 201);
  } catch (err) {
    return handleError(err);
  }
}
