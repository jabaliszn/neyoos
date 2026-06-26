import { effectivePermissionsForUser, getCurrentUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/auth/permissions — the effective permissions for the current user. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ role: null, permissions: [] });
    
    const permissions = await effectivePermissionsForUser(user);

    return ok({
      role: user.role,
      secondaryRole: user.secondaryRole,
      permissions,
    });
  } catch (err) {
    return handleError(err);
  }
}
