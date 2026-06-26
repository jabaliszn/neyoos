/**
 * B.15 Reading history — staff (library.view) OR family (portal.parent,
 * row-scoped to own children via scopeWhere inside the service).
 * GET /api/library/history?studentId=
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import { readingHistory } from "@/lib/services/library.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const role = user.role as Role;
    if (!can(role, "library.view") && !can(role, "portal.parent")) {
      return fail("FORBIDDEN", "No access to reading history.", 403);
    }
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("MISSING", "studentId required.", 400);
    return ok({ history: await readingHistory(user, studentId) });
  } catch (e) {
    return handleError(e);
  }
}
