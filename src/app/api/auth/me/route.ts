import { getCurrentUser } from "@/lib/core/session";
import { ROLE_LABELS } from "@/lib/core/roles";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — returns the current user, or { user: null } if signed out. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ user: null });
    return ok({
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role],
        popupStyle: user.popupStyle,
        lgContrast: user.lgContrast,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
