/**
 * H.2 Role-Based Settings & Module Visibility Control.
 * GET  /api/settings/visibility            -> current { map }
 * POST /api/settings/visibility {href, hiddenRoles[]}  -> set a rule (leadership)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getNavVisibility, setNavVisibility } from "@/lib/services/nav-visibility.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ map: await getNavVisibility(user.tenantId) });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({
  href: z.string().min(1).max(100),
  hiddenRoles: z.array(z.string().min(1)).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const body = schema.parse(await req.json());
    return ok({ map: await setNavVisibility(user, body) });
  } catch (e) {
    return handleError(e);
  }
}
